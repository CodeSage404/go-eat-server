import Order, { OrderStatus } from '../models/order.model';
import User, { UserRole } from '../models/user.model';
import Wallet from '../models/wallet.model';
import Restaurant from '../models/restaurant.model';
import AppError from '../utils/appError';
import logger from '../utils/logger';
import notificationService from './notification.service';
import paystackModule from './payments/paystack.module';
import flutterwaveModule from './payments/flutterwave.module';
import stripeModule from './payments/stripe.module';
import Setting from '../models/setting.model';
import emailService from './email.service';
import { NotificationType } from '../models/userNotification.model';

export type PaymentProvider = 'paystack' | 'flutterwave' | 'stripe';
export class PaymentService {
  /**
   * Helper to resolve payment provider based on order location, user country, and admin settings
   */
  private resolveProviderByLocation(order: any, setting: any, user?: any, requestedProvider?: PaymentProvider): PaymentProvider {
    // 1. Check Global Provider Kill Switches
    const paystackEnabled = setting?.enablePaystack !== false;
    const flutterwaveEnabled = setting?.enableFlutterwave !== false;
    const stripeEnabled = setting?.enableStripe !== false;

    if (!paystackEnabled && !flutterwaveEnabled && !stripeEnabled) {
      throw new AppError('Online card payments are currently disabled by the administrator.', 503);
    }

    const isProviderEnabled = (p: PaymentProvider): boolean => {
      if (p === 'paystack') return paystackEnabled;
      if (p === 'flutterwave') return flutterwaveEnabled;
      if (p === 'stripe') return stripeEnabled;
      return false;
    };

    // 2. Admin Override: Force a specific provider globally everywhere
    if (
      setting?.forceGlobalPaymentProvider &&
      setting.forceGlobalPaymentProvider !== 'none' &&
      isProviderEnabled(setting.forceGlobalPaymentProvider as PaymentProvider)
    ) {
      return setting.forceGlobalPaymentProvider as PaymentProvider;
    }

    // 3. If a specific provider was requested by user, verify it's not disabled
    if (requestedProvider && isProviderEnabled(requestedProvider)) {
      return requestedProvider;
    }

    // 4. Determine Country Code from User profile or Order address
    let countryCode = (user?.countryCode || '').toUpperCase();
    if (!countryCode) {
      if (user?.isNigeria) countryCode = 'NG';
      else if (user?.isUk) countryCode = 'GB';
      else if (user?.isItaly) countryCode = 'IT';
    }

    if (!countryCode) {
      const locationStr = `${order?.deliveryAddress?.address || ''} ${order?.deliveryAddress?.city || ''} ${order?.deliveryAddress?.state || ''} ${order?.deliveryAddress?.street || ''}`.toLowerCase();
      if (locationStr.includes('uk') || locationStr.includes('united kingdom') || locationStr.includes('london') || locationStr.includes('gb') || locationStr.includes('england') || locationStr.includes('manchester')) {
        countryCode = 'GB';
      } else if (locationStr.includes('italy') || locationStr.includes('italia') || locationStr.includes('rome') || locationStr.includes('milan')) {
        countryCode = 'IT';
      } else if (locationStr.includes('nigeria') || locationStr.includes('lagos') || locationStr.includes('abuja')) {
        countryCode = 'NG';
      }
    }

    // 5. Check Admin Platform Settings (Country-specific payment provider mapping)
    if (setting?.countryPaymentProviders && Array.isArray(setting.countryPaymentProviders)) {
      const match = setting.countryPaymentProviders.find(
        (c: any) => c.countryCode?.toUpperCase() === countryCode && c.isActive !== false
      );
      if (match && match.provider && isProviderEnabled(match.provider as PaymentProvider)) {
        return match.provider as PaymentProvider;
      }
    }

    // 6. Direct Country Assignment (if enabled)
    if (countryCode === 'NG' || user?.isNigeria) {
      if (paystackEnabled) return 'paystack';
      if (flutterwaveEnabled) return 'flutterwave';
      if (stripeEnabled) return 'stripe';
    }

    if (countryCode === 'GB' || countryCode === 'UK' || countryCode === 'IT' || user?.isUk || user?.isItaly) {
      if (stripeEnabled) return 'stripe';
      if (paystackEnabled) return 'paystack';
      if (flutterwaveEnabled) return 'flutterwave';
    }

    // 7. African Countries fallback
    const africanCountries = ['GH', 'KE', 'ZA', 'EG', 'RW', 'UG', 'TZ', 'CI', 'SN', 'CM'];
    if (africanCountries.includes(countryCode)) {
      if (setting?.defaultPaymentProvider === 'flutterwave' && flutterwaveEnabled) return 'flutterwave';
      if (paystackEnabled) return 'paystack';
      if (flutterwaveEnabled) return 'flutterwave';
      if (stripeEnabled) return 'stripe';
    }

    // 8. Outside Africa (UK, US, Europe, Canada, etc.) defaults to Stripe if enabled
    if (stripeEnabled) return 'stripe';
    if (paystackEnabled) return 'paystack';
    if (flutterwaveEnabled) return 'flutterwave';

    return 'stripe';
  }

  /**
   * Initialize Payment for an Order using preferred provider (Paystack, Flutterwave, or Stripe)
   */
  async initializePayment(
    orderId: string,
    userId: string,
    provider?: PaymentProvider,
    callbackUrl?: string
  ): Promise<{ authorizationUrl: string; accessCode?: string; reference: string; provider: PaymentProvider }> {
    const orderIdList = orderId.includes(',') ? orderId.split(',').map(s => s.trim()) : [orderId.trim()];
    const orders = await Order.find({ _id: { $in: orderIdList } });
    if (!orders || orders.length === 0) throw new AppError('Order(s) not found', 404);

    const order = orders[0];
    const orderCustomerId = (order.customer as any)?._id
      ? (order.customer as any)._id.toString()
      : order.customer?.toString?.();
    if (orderCustomerId && orderCustomerId !== userId) {
      throw new AppError('Unauthorized access to this order', 403);
    }

    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    const setting = await Setting.findOne();
    const activeProvider: PaymentProvider = this.resolveProviderByLocation(order, setting, user, provider);

    const safeEmail = user.email && user.email.trim() !== ''
      ? user.email
      : `${(user.phoneNumber || user._id.toString()).replace(/[^0-9a-zA-Z]/g, '') || 'customer'}@goeat.com`;

    if (!user.email || user.email.trim() === '') {
      user.email = safeEmail;
      await user.save({ validateBeforeSave: false });
    }

    const reference = `ORD_${order._id}_${Date.now()}`;
    const amount = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    const serverBaseUrl = (process.env.RENDER_EXTERNAL_URL || 'https://go-eat-server-z96s.onrender.com').replace(/\/$/, '');
    const defaultCallbackUrl = `${serverBaseUrl}/api/v1/payments/callback?reference=${reference}`;

    if (activeProvider.toLowerCase() === 'flutterwave') {
      const result = await flutterwaveModule.initializePayment({
        email: safeEmail,
        amount,
        reference,
        customerName: user.name,
        customerPhone: user.phoneNumber,
        redirectUrl: callbackUrl || `${defaultCallbackUrl}&provider=flutterwave`,
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
    } else if (activeProvider.toLowerCase() === 'stripe') {
      const userCountryCode = (user?.countryCode || (user?.isNigeria ? 'NG' : user?.isUk ? 'GB' : user?.isItaly ? 'IT' : '')).toUpperCase();
      let stripeCurrency = 'gbp';
      if (user?.isItaly || userCountryCode === 'IT' || (order.currency && String(order.currency).toLowerCase() === 'eur')) {
        stripeCurrency = 'eur';
      } else if (user?.isUk || userCountryCode === 'GB' || userCountryCode === 'UK' || (order.currency && String(order.currency).toLowerCase() === 'gbp')) {
        stripeCurrency = 'gbp';
      } else if (order.currency) {
        stripeCurrency = String(order.currency).toLowerCase();
      }

      const result = await stripeModule.initializePayment({
        email: safeEmail,
        amount,
        reference,
        currency: stripeCurrency,
        redirectUrl: callbackUrl || `${defaultCallbackUrl}&provider=stripe`,
        metadata: {
          orderId: order._id.toString(),
          orderIds: orderIdList.join(','),
          customerId: user._id.toString(),
        },
      });

      return {
        authorizationUrl: result.authorizationUrl,
        reference: result.reference,
        provider: 'stripe',
      };
    } else {
      // Default: Paystack
      const Restaurant = require('../models/restaurant.model').default;
      const restaurantId = (order.restaurant as any)?._id || order.restaurant;
      const restaurantObj = restaurantId ? await Restaurant.findById(restaurantId) : null;
      const subaccount = restaurantObj?.paystackSubaccountCode;
      
      let transactionCharge: number | undefined;
      if (subaccount) {
        const commissionRate = setting?.commissionRate || 10;
        const subtotal = order.totalAmount - (order.deliveryFee || 0);
        const adminCut = (subtotal * commissionRate) / 100;
        // Platform retains adminCut + deliveryFee + serviceFee(if any)
        transactionCharge = adminCut + (order.deliveryFee || 0);
      }

      const result = await paystackModule.initializePayment({
        email: safeEmail,
        amount,
        reference,
        callbackUrl: callbackUrl || `${defaultCallbackUrl}&provider=paystack`,
        metadata: {
          orderId: order._id.toString(),
          orderIds: orderIdList.join(','),
          customerId: user._id.toString(),
        },
        subaccount,
        transactionCharge,
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
   * Verify Payment Status from either Paystack, Flutterwave, or Stripe
   */
  async verifyPayment(reference: string, provider: PaymentProvider = 'paystack'): Promise<any> {
    let orderId: string | undefined;
    let metaOrderIds: string | undefined;
    let paymentResult: any;

    if (provider.toLowerCase() === 'flutterwave') {
      const data = await flutterwaveModule.verifyPayment(reference);
      if (data.status !== 'successful') {
        throw new AppError('Flutterwave payment was not successful', 400);
      }
      orderId = data.meta?.orderId || reference.split('_')[1];
      metaOrderIds = data.meta?.orderIds;
      paymentResult = {
        id: data.id ? String(data.id) : reference,
        status: 'success',
        update_time: new Date().toISOString(),
        email_address: data.customer?.email,
        provider: 'flutterwave',
      };
    } else if (provider.toLowerCase() === 'stripe') {
      const data = await stripeModule.verifyPayment(reference);
      if (data.status !== 'success') {
        throw new AppError('Stripe payment was not successful', 400);
      }
      orderId = data.metadata?.orderId || reference.split('_')[1];
      metaOrderIds = data.metadata?.orderIds;
      paymentResult = {
        id: data.id ? String(data.id) : reference,
        status: 'success',
        update_time: new Date().toISOString(),
        provider: 'stripe',
      };
    } else {
      const data = await paystackModule.verifyPayment(reference);
      if (data.status !== 'success') {
        throw new AppError('Paystack payment was not successful', 400);
      }
      orderId = data.metadata?.orderId || reference.split('_')[1];
      metaOrderIds = data.metadata?.orderIds || '';
      paymentResult = {
        id: data.id ? String(data.id) : reference,
        status: 'success',
        update_time: new Date().toISOString(),
        email_address: data.customer?.email,
        provider: 'paystack',
      };
    }

    const orderIdList = metaOrderIds
      ? metaOrderIds.split(',').map((s: string) => s.trim()).filter(Boolean)
      : (orderId ? [orderId.trim()] : []);

    const orders = await Order.find({ _id: { $in: orderIdList } });

    for (const order of orders) {
      if (order.paymentStatus !== 'completed') {
        order.paymentStatus = 'completed';
        order.paymentResult = paymentResult;
        if (order.status === OrderStatus.PAYMENT_PENDING) {
          order.status = OrderStatus.PENDING;
        }
        await order.save();

        // Split logic per order
        try {
          const restaurantId = (order.restaurant as any)?._id || order.restaurant;
          const restaurant = restaurantId ? await Restaurant.findById(restaurantId) : null;
          const setting = await Setting.findOne();
          const commissionRate = setting?.commissionRate || 10;
          
          const subtotal = order.totalAmount - (order.deliveryFee || 0);
          const adminCut = (subtotal * commissionRate) / 100;
          const vendorCut = subtotal - adminCut;
          
          if (restaurant && restaurant.owner && vendorCut > 0) {
            let vendorWallet = await Wallet.findOne({ user: restaurant.owner });
            if (!vendorWallet) {
              vendorWallet = await Wallet.create({ user: restaurant.owner, balance: 0 });
            }
            
            if (restaurant.paystackSubaccountCode && provider === 'paystack') {
              logger.info(`Vendor ${restaurant.owner} automatically paid via Paystack Subaccount.`);
            } else {
              vendorWallet.balance += vendorCut;
              await vendorWallet.save();

              try {
                await this.payoutRestaurant(restaurant.owner.toString(), vendorCut, provider);
              } catch (payoutErr: any) {
                logger.warn(`Automatic vendor payout delayed for order ${order._id}: ${payoutErr.message}`);
              }
            }
          }
        } catch (splitErr: any) {
          logger.error(`Error processing vendor split for order ${order._id}:`, splitErr.message);
        }

        // Send notifications upon verified payment
        try {
          const restaurantId = (order.restaurant as any)?._id || order.restaurant;
          const restaurant = restaurantId ? await Restaurant.findById(restaurantId) : null;
          const shortId = order._id.toString().slice(-6).toUpperCase();
          if (restaurant && restaurant.owner) {
            await notificationService.notifyNewOrder(restaurant.owner.toString(), order._id.toString());
          }
          const customerId = (order.customer as any)?._id
            ? (order.customer as any)._id.toString()
            : order.customer?.toString?.();
          if (customerId) {
            await notificationService.sendNotification(
              customerId,
              `Order Placed! 🍽️`,
              `Your payment was verified! Order #${shortId} from ${restaurant?.name || 'the outlet'} has been placed successfully and sent to the kitchen!`,
              { orderId: order._id.toString(), status: 'pending', type: 'ORDER_UPDATE' },
              NotificationType.ORDER_UPDATE
            );
          }
        } catch (notifyErr: any) {
          logger.warn('Failed to send order notifications:', notifyErr.message);
        }

        // Send Email Confirmation to Customer
        try {
          const populatedOrder = await Order.findById(order._id).populate('customer restaurant items.foodItem');
          const customerUser = populatedOrder?.customer as any;
          const restaurantDoc = populatedOrder?.restaurant as any;
          const shortId = order._id.toString().slice(-6).toUpperCase();

          if (customerUser && customerUser.email && !customerUser.email.includes('customer@goeat.com')) {
            emailService.sendTemplateEmail(
              customerUser.email,
              'ORDER_CONFIRMED',
              `Order Confirmed: #${shortId} from ${restaurantDoc?.name || 'Go-Eat Partner'}`,
              {
                orderId: order._id,
                customerName: customerUser.name || 'Customer',
                total: order.totalAmount,
                items: order.items,
              }
            ).catch((err: any) => logger.warn('Failed to send customer order email:', err.message));
          }

          // Send Email to Vendor
          const vendorEmail = restaurantDoc?.businessEmail || (restaurantDoc?.owner as any)?.email;
          if (vendorEmail) {
            emailService.sendTemplateEmail(
              vendorEmail,
              'VENDOR_ORDER_RECEIVED',
              `New Order Received: #${shortId}`,
              {
                orderId: order._id,
                outletName: restaurantDoc?.name || 'Partner',
                customerName: customerUser?.name || 'Customer',
                total: order.totalAmount,
                items: order.items,
              },
              'partners'
            ).catch((err: any) => logger.warn('Failed to send vendor order email:', err.message));
          }
        } catch (emailErr: any) {
          logger.warn('Failed to send order email:', emailErr.message);
        }
      }
    }

    const primaryOrder = orders[0];
    return {
      orderId: primaryOrder ? primaryOrder._id : orderId,
      status: primaryOrder ? primaryOrder.status : 'completed',
      paymentResult,
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

  /**
   * Process refund to customer's original payment method via Stripe or Paystack
   */
  async processGatewayRefund(order: any, amount: number, reason: string): Promise<any> {
    const provider = order.paymentResult?.provider || order.paymentMethod || 'stripe';
    const reference = order.paymentResult?.id || order.paymentReference;

    logger.info(`🔄 Initiating gateway refund of ${amount} for order #${order._id} via ${provider}`);

    try {
      if (String(provider).toLowerCase() === 'stripe') {
        const sessionId = reference?.startsWith('cs_') ? reference : undefined;
        const paymentIntentId = reference?.startsWith('pi_') ? reference : undefined;
        return await stripeModule.refundPayment({
          paymentIntentId,
          sessionId,
          amountInCents: Math.round(amount * 100),
          reason: reason || 'Order cancellation or item refund',
        });
      } else if (String(provider).toLowerCase() === 'paystack') {
        return await paystackModule.refundTransaction({
          reference: reference || order.paymentReference,
          amountInKobo: Math.round(amount * 100),
          reason: reason || 'Order cancellation or item refund',
        });
      } else {
        logger.warn(`⚠️ Gateway refund not supported for provider ${provider}.`);
        return null;
      }
    } catch (err: any) {
      logger.error(`❌ Gateway refund error for order #${order._id}:`, err.message);
      return null;
    }
  }
}

export default new PaymentService();
