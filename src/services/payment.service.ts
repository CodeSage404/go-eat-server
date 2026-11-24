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
import monnifyModule from './payments/monnify.module';
import bachsModule from './payments/bachs.module';
import Setting from '../models/setting.model';
import emailService from './email.service';
import { NotificationType } from '../models/userNotification.model';

export type PaymentProvider = 'paystack' | 'flutterwave' | 'stripe' | 'monnify' | 'bachs';
export class PaymentService {
  /**
   * Helper to resolve payment provider based on order location, user country, and admin settings
   */
  private resolveProviderByLocation(order: any, setting: any, user?: any, requestedProvider?: PaymentProvider): PaymentProvider {
    // Platform Production Rule: Stripe and Bachs.io are the ONLY active production payment gateways.
    const bachsEnabled = setting?.enableBachs !== false;
    const stripeEnabled = setting?.enableStripe !== false;

    // 1. If explicit forced global provider in admin, check if it's bachs or stripe
    if (setting?.forceGlobalPaymentProvider === 'bachs' && bachsEnabled) return 'bachs';
    if (setting?.forceGlobalPaymentProvider === 'stripe' && stripeEnabled) return 'stripe';

    // 2. Determine Country Code from User profile or Order address
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
      } else if (locationStr.includes('nigeria') || locationStr.includes('lagos') || locationStr.includes('abuja') || locationStr.includes('enugu')) {
        countryCode = 'NG';
      }
    }

    // 3. User requested provider if valid production provider
    if (requestedProvider === 'bachs' && bachsEnabled) return 'bachs';
    if (requestedProvider === 'stripe' && stripeEnabled) return 'stripe';

    // 4. Nigeria strictly uses Bachs.io for all NGN card & transfer transactions
    if (countryCode === 'NG' || user?.isNigeria || String(order?.currency || '').toUpperCase() === 'NGN') {
      if (bachsEnabled) return 'bachs';
      return 'stripe';
    }

    // 5. UK, Italy and Global markets strictly use Stripe
    if (stripeEnabled) return 'stripe';
    return bachsEnabled ? 'bachs' : 'stripe';
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

    // If order is completely free (e.g. First Bite Free Order Campaign), auto-complete without hitting payment gateways
    if (amount === 0) {
      for (const ord of orders) {
        ord.paymentStatus = 'completed';
        ord.status = OrderStatus.PENDING;
        ord.paymentResult = {
          id: reference,
          status: 'success',
          update_time: new Date().toISOString(),
          email_address: safeEmail,
          provider: 'first_bite_free',
        } as any;
        await ord.save();

        // Notify Restaurant & Customer
        try {
          const restaurantId = (ord.restaurant as any)?._id || ord.restaurant;
          const restaurant = restaurantId ? await Restaurant.findById(restaurantId) : null;
          const shortId = ord._id.toString().slice(-6).toUpperCase();
          if (restaurant && restaurant.owner) {
            await notificationService.notifyNewOrder(restaurant.owner.toString(), ord._id.toString());
          }
          if (ord.customer) {
            await notificationService.sendNotification(
              userId,
              `Your First Bite is on Us! 🎁🎉`,
              `Your first order #${shortId} is 100% free! It has been placed successfully and sent to ${restaurant?.name || 'the kitchen'}.`,
              { orderId: ord._id.toString(), status: 'pending', type: 'ORDER_UPDATE' },
              NotificationType.ORDER_UPDATE
            );
          }
        } catch (err: any) {
          logger.warn('Error sending notifications for free first bite order:', err);
        }
      }

      return {
        authorizationUrl: '',
        reference,
        provider: 'stripe',
      };
    }

    const serverBaseUrl = (process.env.RENDER_EXTERNAL_URL || 'https://api.goeatone.com').replace(/\/$/, '');
    const webRedirectDestination = callbackUrl || 'https://goeatone.com/checkout?status=success';
    const serverCallbackUrl = `${serverBaseUrl}/api/v1/payments/callback?redirect_url=${encodeURIComponent(webRedirectDestination)}`;

    if (activeProvider.toLowerCase() === 'flutterwave') {
      const result = await flutterwaveModule.initializePayment({
        email: safeEmail,
        amount,
        reference,
        customerName: user.name,
        customerPhone: user.phoneNumber,
        redirectUrl: `${serverCallbackUrl}&provider=flutterwave`,
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

      // Rates consistent with platform conversion: NGN per 1 unit of foreign currency
      const EXCHANGE_RATES_FROM_NGN: Record<string, number> = {
        gbp: 2000,
        eur: 1700,
        usd: 1550,
        cad: 1150,
      };

      let finalStripeAmount = amount;
      const orderCurrency = String(order.currency || 'NGN').toUpperCase();
      const targetCurrency = stripeCurrency.toLowerCase();

      // If the order amounts are in NGN, but Stripe is charging in GBP/EUR/USD, convert to foreign currency
      if (orderCurrency === 'NGN' && EXCHANGE_RATES_FROM_NGN[targetCurrency]) {
        const rate = EXCHANGE_RATES_FROM_NGN[targetCurrency];
        finalStripeAmount = Math.round((amount / rate) * 100) / 100;
        logger.info(`Stripe payment conversion applied: ${amount} NGN -> ${finalStripeAmount} ${targetCurrency.toUpperCase()} (rate: ${rate})`);
      } else if (targetCurrency === 'gbp' && finalStripeAmount > 1000 && orderCurrency !== 'GBP') {
        // Safety guard: If an order total is > 1,000 on a GBP Stripe checkout and not explicitly tagged GBP,
        // it is an unflagged NGN amount that slipped through
        finalStripeAmount = Math.round((amount / 2000) * 100) / 100;
        logger.warn(`Stripe payment safety cap applied: ${amount} converted to ${finalStripeAmount} GBP`);
      }

      const result = await stripeModule.initializePayment({
        email: safeEmail,
        amount: finalStripeAmount,
        reference,
        currency: stripeCurrency,
        redirectUrl: `${serverCallbackUrl}&provider=stripe`,
        metadata: {
          orderId: order._id.toString(),
          orderIds: orderIdList.join(','),
          customerId: user._id.toString(),
          originalNgnAmount: orderCurrency === 'NGN' ? amount : undefined,
          convertedCurrency: stripeCurrency,
        },
      });

      return {
        authorizationUrl: result.authorizationUrl,
        reference: result.reference,
        provider: 'stripe',
      };
    } else if (provider?.toLowerCase() === 'monnify') {
      const Restaurant = require('../models/restaurant.model').default;
      const restaurantId = (order.restaurant as any)?._id || order.restaurant;
      const restaurantObj = restaurantId ? await Restaurant.findById(restaurantId) : null;
      const subaccount = restaurantObj?.monnifySubaccountCode;

      let transactionCharge: number | undefined;
      if (subaccount) {
        const commissionRate = setting?.commissionRate || 10;
        transactionCharge = 100 - commissionRate; // Percentage to vendor
      }

      const result = await monnifyModule.initializePayment({
        email: safeEmail,
        name: user?.name,
        amount,
        reference,
        callbackUrl: `${serverCallbackUrl}&provider=monnify`,
        metadata: {
          orderId: order._id.toString(),
          orderIds: orderIdList.join(','),
          customerId: user._id.toString(),
        },
        subaccount,
        transactionCharge,
        description: `Go-Eat Order #${order._id.toString().slice(-6)}`,
      });

      return {
        authorizationUrl: result.authorizationUrl,
        accessCode: result.accessCode,
        reference: result.reference,
        provider: 'monnify',
      };
    } else if (activeProvider.toLowerCase() === 'bachs') {
      const result = await bachsModule.initializePayment({
        email: safeEmail,
        name: user?.name,
        amount,
        reference,
        callbackUrl: `${serverCallbackUrl}&provider=bachs`,
        cancelUrl: 'https://goeatone.com/checkout',
        metadata: {
          orderId: order._id.toString(),
          orderIds: orderIdList.join(','),
          customerId: user._id.toString(),
        },
        description: `Go-Eat Order #${order._id.toString().slice(-6)}`,
      });

      return {
        authorizationUrl: result.authorizationUrl,
        reference: result.reference,
        provider: 'bachs',
      };
    } else {
      // Fallback: If in Nigeria -> Bachs.io, otherwise Stripe. (Paystack/Flutterwave/Monnify disabled for production)
      const userCountry = (user?.countryCode || (user?.isNigeria ? 'NG' : '')).toUpperCase();
      const isNigeria = userCountry === 'NG' || user?.isNigeria || String(order.currency || '').toUpperCase() === 'NGN';

      if (isNigeria) {
        const result = await bachsModule.initializePayment({
          email: safeEmail,
          name: user?.name,
          amount,
          reference,
          callbackUrl: `${serverCallbackUrl}&provider=bachs`,
          cancelUrl: 'https://goeatone.com/checkout',
          metadata: {
            orderId: order._id.toString(),
            orderIds: orderIdList.join(','),
            customerId: user._id.toString(),
          },
          description: `Go-Eat Order #${order._id.toString().slice(-6)}`,
        });

        return {
          authorizationUrl: result.authorizationUrl,
          reference: result.reference,
          provider: 'bachs',
        };
      } else {
        const result = await stripeModule.initializePayment({
          email: safeEmail,
          amount,
          reference,
          currency: String(order.currency || 'gbp').toLowerCase(),
          redirectUrl: `${serverCallbackUrl}&provider=stripe`,
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
      }
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
    } else if (provider?.toLowerCase() === 'monnify') {
      const data = await monnifyModule.verifyPayment(reference);
      const isPaid = data?.paymentStatus === 'PAID' || data?.status === 'PAID';
      if (!isPaid) {
        throw new AppError('Monnify payment was not successful', 400);
      }
      orderId = data?.metaData?.orderId || reference.split('_')[1];
      metaOrderIds = data?.metaData?.orderIds;
      paymentResult = {
        id: data?.transactionReference || reference,
        status: 'success',
        update_time: data?.paidOn || new Date().toISOString(),
        email_address: data?.customer?.email || data?.customerEmail,
        provider: 'monnify',
      };
    } else if (provider?.toLowerCase() === 'bachs') {
      const data = await bachsModule.verifyPayment(reference);
      if (data.status !== 'success') {
        throw new AppError('Bachs payment was not successful', 400);
      }
      orderId = data?.metadata?.orderId || reference.split('_')[1];
      metaOrderIds = data?.metadata?.orderIds;
      paymentResult = {
        id: data?.id || reference,
        status: 'success',
        update_time: new Date().toISOString(),
        email_address: data?.customer?.email,
        provider: 'bachs',
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
   * Secure Webhook Handler for Monnify
   */
  async processMonnifyWebhook(payload: any, signature: string): Promise<void> {
    const isValid = monnifyModule.verifyWebhookSignature(payload, signature);
    if (!isValid) {
      throw new AppError('Invalid Monnify webhook signature', 400);
    }

    const eventType = payload.eventType;
    if (eventType === 'SUCCESSFUL_TRANSACTION' || payload.eventData?.paymentStatus === 'PAID') {
      const reference = payload.eventData?.paymentReference || payload.eventData?.transactionReference;
      if (reference) {
        await this.verifyPayment(reference, 'monnify');
      }
    }
  }

  /**
   * Secure Webhook Handler for Bachs.io
   */
  async processBachsWebhook(payload: any): Promise<void> {
    const eventType = payload?.event || payload?.type;
    const data = payload?.data || payload;
    const reference = data?.metadata?.reference || data?.reference;

    if (
      reference &&
      (eventType === 'checkout.completed' ||
        eventType === 'collection.succeeded' ||
        data?.status === 'succeeded' ||
        data?.status === 'completed')
    ) {
      await this.verifyPayment(reference, 'bachs');
    }
  }

  /**
   * Payout / Transfer money to a Delivery Rider's Bank Account
   */
  async payoutRider(
    riderId: string,
    amount: number,
    provider: PaymentProvider = (process.env.DEFAULT_PAYMENT_PROVIDER as PaymentProvider) || 'bachs'
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

    if (provider.toLowerCase() === 'bachs' || provider.toLowerCase() === 'paystack') {
      transferResult = await bachsModule.initiatePayout({
        amount,
        accountNumber: bankAccount.accountNumber,
        bankCode: bankAccount.bankCode,
        reference,
        narration: `Go-Eat Rider Payout (${rider.name})`,
        beneficiaryName: bankAccount.accountName || rider.name,
      });
    } else if (provider.toLowerCase() === 'stripe') {
      transferResult = { status: 'submitted', reference, message: 'Dispatched via Stripe Connect' };
    } else {
      transferResult = await bachsModule.initiatePayout({
        amount,
        accountNumber: bankAccount.accountNumber,
        bankCode: bankAccount.bankCode,
        reference,
        narration: `Go-Eat Rider Payout (${rider.name})`,
        beneficiaryName: bankAccount.accountName || rider.name,
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
    provider: PaymentProvider = (process.env.DEFAULT_PAYMENT_PROVIDER as PaymentProvider) || 'bachs'
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

    if (provider.toLowerCase() === 'bachs' || provider.toLowerCase() === 'paystack') {
      transferResult = await bachsModule.initiatePayout({
        amount,
        accountNumber: bankAccount.accountNumber,
        bankCode: bankAccount.bankCode,
        reference,
        narration: 'Go-Eat Restaurant Payout',
        beneficiaryName: bankAccount.accountName || 'Go-Eat Vendor',
      });
    } else if (provider.toLowerCase() === 'stripe') {
      transferResult = { status: 'submitted', reference, message: 'Dispatched via Stripe Connect' };
    } else {
      transferResult = await bachsModule.initiatePayout({
        amount,
        accountNumber: bankAccount.accountNumber,
        bankCode: bankAccount.bankCode,
        reference,
        narration: 'Go-Eat Restaurant Payout',
        beneficiaryName: bankAccount.accountName || 'Go-Eat Vendor',
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
      } else if (String(provider).toLowerCase() === 'monnify') {
        return await monnifyModule.refundTransaction({
          reference: reference || order.paymentReference,
          amount,
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

  /**
   * Determine the active bank account verification provider and format based on country / user and admin settings
   */
  async getBankVerificationConfig(userCountryCode?: string, user?: any): Promise<{
    countryCode: string;
    countryName: string;
    provider: 'paystack' | 'stripe' | 'flutterwave' | 'monnify' | 'bachs';
    accountFormat: 'nuban' | 'uk_sort_code' | 'iban' | 'us_routing' | 'general';
    currency: string;
    requiresRoutingNumber: boolean;
    routingNumberLabel?: string;
    accountNumberLabel: string;
  }> {
    const setting = await Setting.findOne();

    // 1. Determine Country Code
    let countryCode = (userCountryCode || user?.countryCode || '').toUpperCase().trim();
    if (!countryCode) {
      if (user?.isNigeria) countryCode = 'NG';
      else if (user?.isUk) countryCode = 'GB';
      else if (user?.isItaly) countryCode = 'IT';
      else countryCode = 'NG'; // Default fallback
    }
    if (countryCode === 'UK') countryCode = 'GB';

    // 2. Check Provider Kill-Switches
    const bachsEnabled = setting?.enableBachs !== false;
    const paystackEnabled = setting?.enableBankVerificationPaystack !== false;
    const stripeEnabled = setting?.enableBankVerificationStripe !== false;
    const monnifyEnabled = setting?.enableBankVerificationMonnify !== false && setting?.enableMonnify !== false;

    // STRICT PLATFORM RULE:
    // Nigeria is strictly verified via Bachs.io (NUBAN resolution) - NEVER via Stripe.
    // UK & Italy/Europe are strictly verified via Stripe Connect.
    if (countryCode === 'NG' || countryCode === 'GH') {
      return {
        countryCode: 'NG',
        countryName: 'Nigeria',
        provider: 'bachs',
        accountFormat: 'nuban',
        currency: 'NGN',
        requiresRoutingNumber: false,
        accountNumberLabel: 'NUBAN Account Number',
      };
    }

    if (countryCode === 'GB') {
      return {
        countryCode: 'GB',
        countryName: 'United Kingdom',
        provider: 'stripe',
        accountFormat: 'uk_sort_code',
        currency: 'GBP',
        requiresRoutingNumber: true,
        routingNumberLabel: 'Sort Code',
        accountNumberLabel: 'Account Number',
      };
    }

    if (countryCode === 'IT' || countryCode === 'EU') {
      return {
        countryCode: 'IT',
        countryName: 'Italy',
        provider: 'stripe',
        accountFormat: 'iban',
        currency: 'EUR',
        requiresRoutingNumber: false,
        accountNumberLabel: 'IBAN',
      };
    }

    // 3. Check Admin Force Global Override
    const forcedProvider = setting?.forceGlobalBankVerificationProvider || 'none';
    if (forcedProvider === 'stripe' && stripeEnabled) {
      return {
        countryCode,
        countryName: this.getCountryName(countryCode),
        provider: 'stripe',
        accountFormat: countryCode === 'GB' ? 'uk_sort_code' : countryCode === 'IT' ? 'iban' : countryCode === 'US' ? 'us_routing' : 'general',
        currency: countryCode === 'GB' ? 'GBP' : countryCode === 'IT' ? 'EUR' : countryCode === 'NG' ? 'NGN' : 'USD',
        requiresRoutingNumber: countryCode === 'GB' || countryCode === 'US',
        routingNumberLabel: countryCode === 'GB' ? 'Sort Code' : 'Routing Number',
        accountNumberLabel: countryCode === 'IT' ? 'IBAN' : 'Account Number',
      };
    } else if (forcedProvider === 'monnify' && monnifyEnabled) {
      return {
        countryCode,
        countryName: this.getCountryName(countryCode),
        provider: 'monnify',
        accountFormat: 'nuban',
        currency: 'NGN',
        requiresRoutingNumber: false,
        accountNumberLabel: 'NUBAN Account Number',
      };
    } else if (forcedProvider === 'paystack' && paystackEnabled) {
      return {
        countryCode,
        countryName: this.getCountryName(countryCode),
        provider: 'paystack',
        accountFormat: 'nuban',
        currency: 'NGN',
        requiresRoutingNumber: false,
        accountNumberLabel: 'NUBAN Account Number',
      };
    }

    // 4. Check Admin Country-Specific Verification Rules
    if (setting?.countryBankVerificationProviders && Array.isArray(setting.countryBankVerificationProviders)) {
      const match = setting.countryBankVerificationProviders.find(
        (c: any) => c.countryCode?.toUpperCase() === countryCode && c.isActive !== false
      );
      if (match) {
        const prov = match.provider;
        if ((prov === 'paystack' && paystackEnabled) || (prov === 'stripe' && stripeEnabled)) {
          return {
            countryCode,
            countryName: match.countryName || this.getCountryName(countryCode),
            provider: prov,
            accountFormat: match.accountFormat || (countryCode === 'GB' ? 'uk_sort_code' : countryCode === 'IT' ? 'iban' : 'nuban'),
            currency: countryCode === 'GB' ? 'GBP' : countryCode === 'IT' ? 'EUR' : countryCode === 'NG' ? 'NGN' : 'USD',
            requiresRoutingNumber: match.accountFormat === 'uk_sort_code' || match.accountFormat === 'us_routing',
            routingNumberLabel: match.accountFormat === 'uk_sort_code' ? 'Sort Code' : 'Routing Number',
            accountNumberLabel: match.accountFormat === 'iban' ? 'IBAN' : 'Account Number',
          };
        }
      }
    }

    // 5. Default Regional Fallback
    if (countryCode === 'NG' || countryCode === 'GH') {
      return {
        countryCode: 'NG',
        countryName: 'Nigeria',
        provider: bachsEnabled ? ('bachs' as any) : ('stripe' as any),
        accountFormat: 'nuban',
        currency: 'NGN',
        requiresRoutingNumber: false,
        accountNumberLabel: 'NUBAN Account Number',
      };
    }

    if (countryCode === 'GB') {
      return {
        countryCode: 'GB',
        countryName: 'United Kingdom',
        provider: stripeEnabled ? 'stripe' : 'paystack',
        accountFormat: 'uk_sort_code',
        currency: 'GBP',
        requiresRoutingNumber: true,
        routingNumberLabel: 'Sort Code',
        accountNumberLabel: 'Account Number',
      };
    }

    if (countryCode === 'IT') {
      return {
        countryCode: 'IT',
        countryName: 'Italy',
        provider: stripeEnabled ? 'stripe' : 'paystack',
        accountFormat: 'iban',
        currency: 'EUR',
        requiresRoutingNumber: false,
        accountNumberLabel: 'IBAN',
      };
    }

    // Default Foreign / International -> Stripe
    return {
      countryCode,
      countryName: this.getCountryName(countryCode),
      provider: stripeEnabled ? 'stripe' : 'paystack',
      accountFormat: countryCode === 'US' ? 'us_routing' : 'general',
      currency: countryCode === 'US' ? 'USD' : 'EUR',
      requiresRoutingNumber: countryCode === 'US',
      routingNumberLabel: countryCode === 'US' ? 'Routing Number' : undefined,
      accountNumberLabel: 'Account Number',
    };
  }

  private getCountryName(code: string): string {
    const map: Record<string, string> = {
      NG: 'Nigeria',
      GB: 'United Kingdom',
      UK: 'United Kingdom',
      IT: 'Italy',
      US: 'United States',
      CA: 'Canada',
      GH: 'Ghana',
      KE: 'Kenya',
    };
    return map[code.toUpperCase()] || code;
  }

  /**
   * Resolve and verify bank account across multi-country providers (Paystack or Stripe)
   */
  async resolveUnifiedBankAccount(params: {
    accountNumber: string;
    bankCode?: string;
    routingNumber?: string;
    accountHolderName?: string;
    countryCode?: string;
    user?: any;
  }): Promise<{
    accountNumber: string;
    accountName: string;
    bankName: string;
    bankCode: string;
    currency: string;
    provider: 'paystack' | 'stripe' | 'flutterwave' | 'monnify' | 'bachs';
    isVerified: boolean;
  }> {
    const config = await this.getBankVerificationConfig(params.countryCode, params.user);

    if (config.provider === 'stripe') {
      const stripeRes = await stripeModule.resolveBankAccount({
        accountNumber: params.accountNumber,
        routingNumber: params.routingNumber || params.bankCode,
        countryCode: config.countryCode,
        accountHolderName: params.accountHolderName,
        currency: config.currency,
      });
      return {
        ...stripeRes,
        provider: 'stripe',
      };
    }

    if (config.provider === 'monnify') {
      const cleanBankCode = params.bankCode || '044';
      const monnifyRes = await monnifyModule.resolveAccountNumber(params.accountNumber, cleanBankCode);
      return {
        accountNumber: monnifyRes.accountNumber,
        accountName: monnifyRes.accountName,
        bankName: 'Nigerian Commercial Bank',
        bankCode: cleanBankCode,
        currency: 'NGN',
        provider: 'monnify',
        isVerified: true,
      };
    }

    // Default to Bachs.io for Nigerian account resolution & verification
    const cleanBankCode = params.bankCode || '044';
    const bachsRes = await bachsModule.resolveAccountNumber(params.accountNumber, cleanBankCode);
    return {
      accountNumber: bachsRes.accountNumber,
      accountName: bachsRes.accountName,
      bankName: 'Nigerian Commercial Bank',
      bankCode: cleanBankCode,
      currency: 'NGN',
      provider: 'bachs' as any,
      isVerified: true,
    };
  }
}

export default new PaymentService();
