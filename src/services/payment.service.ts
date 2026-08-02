import Order, { OrderStatus } from '../models/order.model';
import User, { UserRole } from '../models/user.model';
import Wallet from '../models/wallet.model';
import AppError from '../utils/appError';
import logger from '../utils/logger';
import notificationService from './notification.service';
import paystackModule from './payments/paystack.module';
import flutterwaveModule from './payments/flutterwave.module';

export type PaymentProvider = 'paystack' | 'flutterwave';

export class PaymentService {
  /**
   * Initialize Payment for an Order using preferred provider (Paystack or Flutterwave)
   */
  async initializePayment(
    orderId: string,
    userId: string,
    provider: PaymentProvider = (process.env.DEFAULT_PAYMENT_PROVIDER as PaymentProvider) || 'paystack',
    callbackUrl?: string
  ): Promise<{ authorizationUrl: string; accessCode?: string; reference: string; provider: PaymentProvider }> {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);

    if (order.customer.toString() !== userId) {
      throw new AppError('Unauthorized access to this order', 403);
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new AppError('This order cannot be paid for in its current state', 400);
    }

    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    const reference = `ORD_${order._id}_${Date.now()}`;
    const amount = order.totalAmount;

    if (provider.toLowerCase() === 'flutterwave') {
      const result = await flutterwaveModule.initializePayment({
        email: user.email,
        amount,
        reference,
        customerName: user.name,
        customerPhone: user.phoneNumber,
        redirectUrl: callbackUrl || `${process.env.APP_URL || 'https://api.goeatalone.com'}/payment/callback?reference=${reference}&provider=flutterwave`,
        metadata: {
          orderId: order._id.toString(),
          customerId: user._id.toString(),
        },
      });

      return {
        authorizationUrl: result.authorizationUrl,
        reference: result.reference,
        provider: 'flutterwave',
      };
    } else {
      // Default: Paystack
      const result = await paystackModule.initializePayment({
        email: user.email,
        amount,
        reference,
        callbackUrl: callbackUrl || `${process.env.APP_URL || 'https://api.goeatalone.com'}/payment/callback?reference=${reference}&provider=paystack`,
        metadata: {
          orderId: order._id.toString(),
          customerId: user._id.toString(),
        },
      });

      return {
        authorizationUrl: result.authorizationUrl,
        accessCode: result.accessCode,
        reference: result.reference,
        provider: 'paystack',
      };
    }
  }

  /**
   * Verify Payment Status from either Paystack or Flutterwave
   */
  async verifyPayment(reference: string, provider: PaymentProvider = 'paystack'): Promise<any> {
    let orderId: string | undefined;
    let paymentResult: any;

    if (provider.toLowerCase() === 'flutterwave') {
      const data = await flutterwaveModule.verifyPayment(reference);
      if (data.status !== 'successful') {
        throw new AppError('Flutterwave payment was not successful', 400);
      }
      orderId = data.meta?.orderId || reference.split('_')[1];
      paymentResult = {
        id: data.id ? String(data.id) : reference,
        status: 'success',
        update_time: new Date().toISOString(),
        email_address: data.customer?.email,
        provider: 'flutterwave',
      };
    } else {
      const data = await paystackModule.verifyPayment(reference);
      if (data.status !== 'success') {
        throw new AppError('Paystack payment was not successful', 400);
      }
      orderId = data.metadata?.orderId || reference.split('_')[1];
      paymentResult = {
        id: data.id ? String(data.id) : reference,
        status: 'success',
        update_time: new Date().toISOString(),
        email_address: data.customer?.email,
        provider: 'paystack',
      };
    }

    if (!orderId) {
      throw new AppError('Could not identify associated order from payment reference', 400);
    }

    const order = await Order.findById(orderId);
    if (!order) {
      throw new AppError('Order associated with payment not found', 404);
    }

    if (order.status === OrderStatus.PENDING) {
      order.status = OrderStatus.ACCEPTED;
      order.paymentResult = paymentResult;
      await order.save();

      // Send notifications
      try {
        await notificationService.notifyNewOrder(order.restaurant.toString(), order._id.toString());
        await notificationService.notifyOrderStatusUpdate(
          order.customer.toString(),
          order._id.toString(),
          order.status
        );
      } catch (notifyErr: any) {
        logger.warn('Failed to send order notifications:', notifyErr.message);
      }
    }

    return {
      orderId: order._id,
      status: order.status,
      paymentResult: order.paymentResult,
    };
  }

  /**
   * Secure Webhook Handler for Paystack
   */
  async processPaystackWebhook(event: any, signature: string): Promise<void> {
    const isValid = paystackModule.verifyWebhookSignature(event, signature);
    if (!isValid) {
      throw new AppError('Invalid Paystack webhook signature', 400);
    }

    if (event.event === 'charge.success') {
      const reference = event.data?.reference;
      if (reference) {
        await this.verifyPayment(reference, 'paystack');
      }
    }
  }

  /**
   * Secure Webhook Handler for Flutterwave
   */
  async processFlutterwaveWebhook(payload: any, signatureHeader: string): Promise<void> {
    const isValid = flutterwaveModule.verifyWebhookSignature(signatureHeader);
    if (!isValid) {
      throw new AppError('Invalid Flutterwave webhook signature', 400);
    }

    if (payload.event === 'charge.completed' && payload.data?.status === 'successful') {
      const reference = payload.data?.tx_ref;
      if (reference) {
        await this.verifyPayment(reference, 'flutterwave');
      }
    }
  }

  /**
   * Payout / Transfer money to a Delivery Rider's Bank Account
   */
  async payoutRider(
    riderId: string,
    amount: number,
    provider: PaymentProvider = (process.env.DEFAULT_PAYMENT_PROVIDER as PaymentProvider) || 'paystack'
  ): Promise<any> {
    if (amount <= 0) throw new AppError('Payout amount must be greater than zero', 400);

    const rider = await User.findById(riderId);
    if (!rider || rider.role !== UserRole.RIDER) {
      throw new AppError('Delivery rider not found', 404);
    }

    const wallet = await Wallet.findOne({ user: riderId });
    if (!wallet) {
      throw new AppError('Rider wallet not found', 404);
    }

    if (wallet.balance < amount) {
      throw new AppError(`Insufficient wallet balance. Current balance: NGN ${wallet.balance}`, 400);
    }

    const bankAccount = wallet.bankAccount;
    if (!bankAccount || !bankAccount.accountNumber || !bankAccount.bankCode) {
      throw new AppError('Rider has not configured valid bank account details for payout', 400);
    }

    const reference = `PAYOUT_RIDER_${riderId}_${Date.now()}`;
    let transferResult: any;

    if (provider.toLowerCase() === 'flutterwave') {
      transferResult = await flutterwaveModule.initiatePayout({
        amount,
        accountNumber: bankAccount.accountNumber,
        bankCode: bankAccount.bankCode,
        reference,
        narration: `Go-Eat Rider Payout (${rider.name})`,
        beneficiaryName: bankAccount.accountName || rider.name,
      });
    } else {
      let recipientCode = bankAccount.recipientCode;
      if (!recipientCode) {
        const recipient = await paystackModule.createTransferRecipient({
          name: bankAccount.accountName || rider.name,
          accountNumber: bankAccount.accountNumber,
          bankCode: bankAccount.bankCode,
        });
        recipientCode = recipient.recipientCode;
        wallet.bankAccount!.recipientCode = recipientCode;
        await wallet.save();
      }

      transferResult = await paystackModule.initiatePayout({
        amount,
        recipientCode,
        reference,
        reason: `Go-Eat Rider Payout (${rider.name})`,
      });
    }

    // Deduct amount from wallet balance after transfer initiation
    wallet.balance -= amount;
    wallet.lastPayoutDate = new Date();
    await wallet.save();

    logger.info(`✅ Successful payout of NGN ${amount} to rider ${rider.name} (${riderId}) via ${provider}`);

    return {
      reference,
      provider,
      amount,
      newBalance: wallet.balance,
      transferDetails: transferResult,
    };
  }

  /**
   * Payout / Transfer money to a Restaurant Vendor's Bank Account
   */
  async payoutRestaurant(
    restaurantId: string,
    amount: number,
    provider: PaymentProvider = (process.env.DEFAULT_PAYMENT_PROVIDER as PaymentProvider) || 'paystack'
  ): Promise<any> {
    if (amount <= 0) throw new AppError('Payout amount must be greater than zero', 400);

    const wallet = await Wallet.findOne({ user: restaurantId });
    if (!wallet) {
      throw new AppError('Restaurant wallet not found', 404);
    }

    if (wallet.balance < amount) {
      throw new AppError(`Insufficient wallet balance. Current balance: NGN ${wallet.balance}`, 400);
    }

    const bankAccount = wallet.bankAccount;
    if (!bankAccount || !bankAccount.accountNumber || !bankAccount.bankCode) {
      throw new AppError('Restaurant has not configured valid bank account details for payout', 400);
    }

    const reference = `PAYOUT_REST_${restaurantId}_${Date.now()}`;
    let transferResult: any;

    if (provider.toLowerCase() === 'flutterwave') {
      transferResult = await flutterwaveModule.initiatePayout({
        amount,
        accountNumber: bankAccount.accountNumber,
        bankCode: bankAccount.bankCode,
        reference,
        narration: 'Go-Eat Restaurant Payout',
        beneficiaryName: bankAccount.accountName || 'Go-Eat Vendor',
      });
    } else {
      let recipientCode = bankAccount.recipientCode;
      if (!recipientCode) {
        const recipient = await paystackModule.createTransferRecipient({
          name: bankAccount.accountName || 'Go-Eat Vendor',
          accountNumber: bankAccount.accountNumber,
          bankCode: bankAccount.bankCode,
        });
        recipientCode = recipient.recipientCode;
        wallet.bankAccount!.recipientCode = recipientCode;
        await wallet.save();
      }

      transferResult = await paystackModule.initiatePayout({
        amount,
        recipientCode,
        reference,
        reason: 'Go-Eat Restaurant Payout',
      });
    }

    wallet.balance -= amount;
    wallet.lastPayoutDate = new Date();
    await wallet.save();

    logger.info(`✅ Successful payout of NGN ${amount} to restaurant vendor (${restaurantId}) via ${provider}`);

    return {
      reference,
      provider,
      amount,
      newBalance: wallet.balance,
      transferDetails: transferResult,
    };
  }
}

export default new PaymentService();
