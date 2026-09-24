import twilio from 'twilio';
import logger from '../utils/logger';
import AppError from '../utils/appError';
import Order from '../models/order.model';
import User from '../models/user.model';
import { formatPhoneNumber } from '../utils/twilioVerify.util';
import notificationService from './notification.service';
import { emitToUser } from '../io';

const voiceServiceLastCallPushMap = new Map<string, number>();

class VoiceService {
  private cachedApiKeySid: string | null = null;
  private cachedApiSecret: string | null = null;

  private get accountSid(): string {
    return process.env.TWILIO_ACCOUNT_SID || '';
  }

  private get authToken(): string {
    return process.env.TWILIO_AUTH_TOKEN || '';
  }

  private get twilioPhoneNumber(): string {
    return process.env.TWILIO_PHONE_NUMBER || '+19707037753';
  }

  private get twimlAppSid(): string {
    return process.env.TWILIO_TWIML_APP_SID || '';
  }

  private get iosPushCredentialSid(): string {
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev && process.env.TWILIO_IOS_SANDBOX_PUSH_CREDENTIAL_SID) {
      return process.env.TWILIO_IOS_SANDBOX_PUSH_CREDENTIAL_SID;
    }
    return process.env.TWILIO_IOS_PUSH_CREDENTIAL_SID || '';
  }

  private get androidPushCredentialSid(): string {
    return process.env.TWILIO_ANDROID_PUSH_CREDENTIAL_SID || '';
  }

  private get client(): twilio.Twilio {
    if (!this.accountSid || !this.authToken) {
      throw new AppError('Twilio credentials are not configured on the server', 500);
    }
    return twilio(this.accountSid, this.authToken);
  }

  /**
   * Lazily resolves or generates an API Key and Secret for Voice SDK JWT generation.
   */
  private async getOrCreateApiKey(): Promise<{ keySid: string; keySecret: string }> {
    if (process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_SECRET) {
      return {
        keySid: process.env.TWILIO_API_KEY_SID,
        keySecret: process.env.TWILIO_API_SECRET,
      };
    }

    if (this.cachedApiKeySid && this.cachedApiSecret) {
      return {
        keySid: this.cachedApiKeySid,
        keySecret: this.cachedApiSecret,
      };
    }

    try {
      logger.info('Creating a new Twilio API Key for in-app voice calls...');
      const key = await this.client.newKeys.create({ friendlyName: 'Go-Eat Voice SDK Key' });
      this.cachedApiKeySid = key.sid;
      this.cachedApiSecret = key.secret;
      logger.info(`✅ Twilio API Key provisioned: ${key.sid}`);
      return { keySid: key.sid, keySecret: key.secret };
    } catch (error: any) {
      logger.error('Failed to create Twilio API Key:', error);
      throw new AppError(`Failed to initialize Voice API Key: ${error.message}`, 500);
    }
  }

  /**
   * Generate an in-app VoIP call token for an authenticated user and order
   */
  async generateVoiceToken(
    userId: string,
    orderId: string,
    role: 'customer' | 'rider' | 'vendor' = 'customer',
    platform: 'ios' | 'android' = 'ios',
    target: 'customer' | 'rider' | 'restaurant' = 'customer'
  ): Promise<{ token: string; identity: string; recipientIdentity: string; orderId: string; rider?: any; customer?: any; restaurant?: any }> {
    const order = await Order.findById(orderId)
      .populate('rider', 'name phoneNumber profilePicture profileImage vehicleType')
      .populate('customer', 'name phoneNumber profilePicture profileImage')
      .populate('restaurant', 'name phoneContact logo');
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const { keySid, keySecret } = await this.getOrCreateApiKey();

    const identity = `${role}_${userId}`;
    let recipientIdentity = '';
    let recipientUserId: string | null = null;

    if (role === 'vendor') {
      if (target === 'rider') {
        recipientIdentity = `rider_${order.rider ? (order.rider as any)._id : 'unassigned'}`;
        recipientUserId = order.rider ? (order.rider as any)._id?.toString() : null;
      } else {
        recipientIdentity = `customer_${order.customer ? (order.customer as any)._id || order.customer : 'unknown'}`;
        recipientUserId = order.customer ? ((order.customer as any)._id?.toString() || order.customer.toString()) : null;
      }
    } else if (role === 'customer') {
      recipientIdentity = `rider_${order.rider ? (order.rider as any)._id : 'unassigned'}`;
      recipientUserId = order.rider ? (order.rider as any)._id?.toString() : null;
    } else {
      // rider calling
      if (target === 'restaurant') {
        recipientIdentity = `vendor_${(order.restaurant as any)?.owner || order.restaurant}`;
        recipientUserId = (order.restaurant as any)?.owner ? (order.restaurant as any).owner.toString() : null;
      } else {
        recipientIdentity = `customer_${order.customer ? (order.customer as any)._id || order.customer : 'unknown'}`;
        recipientUserId = order.customer ? ((order.customer as any)._id?.toString() || order.customer.toString()) : null;
      }
    }

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const pushCredentialSid = platform === 'android' ? this.androidPushCredentialSid : this.iosPushCredentialSid;

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: this.twimlAppSid || undefined,
      incomingAllow: true,
      pushCredentialSid: pushCredentialSid || undefined,
    });

    const token = new AccessToken(this.accountSid, keySid, keySecret, {
      identity,
      ttl: 3600, // 1 hour
    });

    token.addGrant(voiceGrant);

    const riderData = order.rider ? {
      name: (order.rider as any).name || 'Delivery Courier',
      phoneNumber: (order.rider as any).phoneNumber,
      profilePicture: (order.rider as any).profilePicture || (order.rider as any).profileImage,
      vehicleType: (order.rider as any).vehicleType || 'Motorcycle',
    } : null;

    const customerData = order.customer ? {
      name: (order.customer as any).name || 'Customer',
      phoneNumber: (order.customer as any).phoneNumber,
      profilePicture: (order.customer as any).profilePicture || (order.customer as any).profileImage,
    } : null;

    const restaurantData = order.restaurant ? {
      name: (order.restaurant as any).name || 'Restaurant Outlet',
      phoneContact: (order.restaurant as any).phoneContact,
      logo: (order.restaurant as any).logo,
    } : null;

    // Send Push & Real-time Notification to call recipient
    if (recipientUserId) {
      const callerUser = await User.findById(userId).select('name phoneNumber profileImage');
      let callerName = callerUser?.name || 'Go-Eat Partner';
      let callerImage = callerUser?.profileImage;
      let callerPhone = callerUser?.phoneNumber;

      if (role === 'vendor') {
        callerName = restaurantData?.name ? `${restaurantData.name} (Restaurant)` : (callerUser?.name || 'Restaurant Outlet');
        callerImage = restaurantData?.logo || callerUser?.profileImage;
        callerPhone = restaurantData?.phoneContact || callerUser?.phoneNumber;
      } else if (role === 'customer') {
        callerName = callerUser?.name || customerData?.name || 'Customer';
        callerImage = customerData?.profilePicture || callerUser?.profileImage;
        callerPhone = customerData?.phoneNumber || callerUser?.phoneNumber;
      } else if (role === 'rider') {
        callerName = riderData?.name || callerUser?.name || 'Delivery Courier';
        callerImage = riderData?.profilePicture || callerUser?.profileImage;
        callerPhone = riderData?.phoneNumber || callerUser?.phoneNumber;
      }

      const displayOrderId = order._id.toString().slice(-6).toUpperCase();

      // Send Push & Real-time Notification to call recipient (with 45s cooldown to prevent notification spam)
      const callCooldownKey = `${orderId}_${recipientUserId}`;
      const now = Date.now();
      const lastSentTime = voiceServiceLastCallPushMap.get(callCooldownKey) || 0;

      if (now - lastSentTime > 45000) {
        voiceServiceLastCallPushMap.set(callCooldownKey, now);

        // Direct real-time socket event for immediate ringing UI
        emitToUser(recipientUserId, 'incoming_call', {
          orderId,
          role,
          target,
          callerName,
          callerImage,
          callerPhone,
          displayOrderId,
        });

        // Notification Inbox and FCM push notification
        notificationService.sendNotification(
          recipientUserId,
          'Incoming Voice Call 📞',
          `${callerName} is calling you regarding Order #${displayOrderId}`,
          { type: 'incoming_call', orderId, role, target, callerName, callerImage, callerPhone, displayOrderId }
        ).catch((err: any) => {
          logger.warn('Failed to dispatch call notification:', err);
        });
      } else {
        logger.info(`⏳ Skipping duplicate call push notification for ${recipientUserId} (cooldown active)`);
      }
    }

    return {
      token: token.toJwt(),
      identity,
      recipientIdentity,
      orderId,
      rider: riderData,
      customer: customerData,
      restaurant: restaurantData,
    };
  }

  /**
   * Generates TwiML for routing a call to a client identity or phone number
   */
  generateCallTwiml(to: string, callerName?: string, orderId?: string): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    if (to.startsWith('client:') || to.startsWith('rider_') || to.startsWith('customer_') || to.startsWith('vendor_')) {
      const clientName = to.replace('client:', '');
      const dial = response.dial({
        callerId: 'Go-Eat',
        answerOnBridge: true,
      });
      const client = dial.client(clientName);
      if (callerName) {
        client.parameter({ name: 'callerName', value: callerName });
      }
      if (orderId) {
        client.parameter({ name: 'orderId', value: orderId });
      }
    } else if (to.startsWith('+') || /^\d+$/.test(to)) {
      const dial = response.dial({ callerId: this.twilioPhoneNumber });
      dial.number(formatPhoneNumber(to));
    } else {
      const dial = response.dial({ callerId: 'Go-Eat', answerOnBridge: true });
      const client = dial.client(to);
      if (callerName) client.parameter({ name: 'callerName', value: callerName });
      if (orderId) client.parameter({ name: 'orderId', value: orderId });
    }

    return response.toString();
  }

  /**
   * Initiates a masked cellular call bridge between parties
   */
  async initiateMaskedBridgeCall(
    orderId: string,
    callerUserId: string,
    target: 'customer' | 'rider' | 'restaurant' = 'customer'
  ): Promise<{ callSid: string; message: string; maskedCallerId: string }> {
    const order = await Order.findById(orderId)
      .populate('rider', 'phoneNumber name')
      .populate('customer', 'phoneNumber name')
      .populate('restaurant', 'phoneContact name');
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const callerUser = await User.findById(callerUserId);
    if (!callerUser) {
      throw new AppError('Caller user not found', 404);
    }

    let callerPhone = callerUser.phoneNumber;
    if (!callerPhone && callerUser.role === 'vendor' && (order.restaurant as any)?.phoneContact) {
      callerPhone = (order.restaurant as any).phoneContact;
    }
    if (!callerPhone) {
      throw new AppError('Caller phone number not available for cellular call', 400);
    }

    let recipientPhone = '';
    let recipientLabel = 'your courier';

    if (callerUser.role === 'vendor') {
      if (target === 'rider' && (order.rider as any)?.phoneNumber) {
        recipientPhone = (order.rider as any).phoneNumber;
        recipientLabel = 'your delivery courier';
      } else if ((order.customer as any)?.phoneNumber) {
        recipientPhone = (order.customer as any).phoneNumber;
        recipientLabel = 'the customer';
      }
    } else if (callerUser.role === 'rider') {
      if (target === 'restaurant' && (order.restaurant as any)?.phoneContact) {
        recipientPhone = (order.restaurant as any).phoneContact;
        recipientLabel = 'the restaurant';
      } else if ((order.customer as any)?.phoneNumber) {
        recipientPhone = (order.customer as any).phoneNumber;
        recipientLabel = 'the customer';
      }
    } else {
      // Customer calling courier
      if ((order.rider as any)?.phoneNumber) {
        recipientPhone = (order.rider as any).phoneNumber;
        recipientLabel = 'your courier';
      }
    }

    if (!recipientPhone) {
      throw new AppError('Recipient phone number not available for cellular call', 400);
    }

    const formattedCaller = formatPhoneNumber(callerPhone);
    const formattedRecipient = formatPhoneNumber(recipientPhone);
    const twilioFrom = this.twilioPhoneNumber;

    logger.info(`📞 Bridging masked call for Order ${orderId}: ${formattedCaller} -> Twilio -> ${formattedRecipient}`);

    try {
      const twiml = `
        <Response>
          <Say voice="Polly.Joanna">Connecting you securely to ${recipientLabel}. Please wait.</Say>
          <Dial callerId="${twilioFrom}" timeout="30">
            <Number>${formattedRecipient}</Number>
          </Dial>
        </Response>
      `.trim();

      const call = await this.client.calls.create({
        to: formattedCaller,
        from: twilioFrom,
        twiml,
      });

      logger.info(`✅ Masked bridge call initiated with SID: ${call.sid}`);

      return {
        callSid: call.sid,
        message: `Calling your phone now. When you answer, we will connect you to ${recipientLabel}.`,
        maskedCallerId: twilioFrom,
      };
    } catch (error: any) {
      logger.error('❌ Failed to initiate Twilio masked bridge call:', error);
      throw new AppError(`Twilio call error: ${error.message || 'Unable to place call'}`, 500);
    }
  }
}

export default new VoiceService();
