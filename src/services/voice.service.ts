import twilio from 'twilio';
import logger from '../utils/logger';
import AppError from '../utils/appError';
import Order from '../models/order.model';
import User from '../models/user.model';
import { formatPhoneNumber } from '../utils/twilioVerify.util';
import notificationService from './notification.service';

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
    role: 'customer' | 'rider' = 'customer'
  ): Promise<{ token: string; identity: string; recipientIdentity: string; orderId: string; rider?: any }> {
    const order = await Order.findById(orderId).populate('rider', 'name phoneNumber profilePicture vehicleType');
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const { keySid, keySecret } = await this.getOrCreateApiKey();

    const identity = `${role}_${userId}`;
    const recipientIdentity = role === 'customer'
      ? `rider_${order.rider ? (order.rider as any)._id : 'unassigned'}`
      : `customer_${order.customer}`;

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: this.twimlAppSid || undefined,
      incomingAllow: true,
    });

    const token = new AccessToken(this.accountSid, keySid, keySecret, {
      identity,
      ttl: 3600, // 1 hour
    });

    token.addGrant(voiceGrant);

    const riderData = order.rider ? {
      name: (order.rider as any).name || 'Delivery Courier',
      phoneNumber: (order.rider as any).phoneNumber,
      profilePicture: (order.rider as any).profilePicture,
      vehicleType: (order.rider as any).vehicleType || 'Motorcycle',
    } : null;

    // Send Push & Real-time Notification to call recipient
    const recipientUserId = role === 'customer'
      ? (order.rider ? (order.rider as any)._id?.toString() : null)
      : (order.customer ? order.customer.toString() : null);

    if (recipientUserId) {
      const callerUser = await User.findById(userId).select('name');
      const callerName = callerUser?.name || (role === 'customer' ? 'Customer' : 'Delivery Courier');
      const displayOrderId = order._id.toString().slice(-6).toUpperCase();

      notificationService.sendNotification(
        recipientUserId,
        'Incoming Voice Call 📞',
        `${callerName} is calling you regarding Order #${displayOrderId}`,
        { type: 'incoming_call', orderId, role, callerName }
      ).catch((err: any) => {
        logger.warn('Failed to dispatch call notification:', err);
      });
    }

    return {
      token: token.toJwt(),
      identity,
      recipientIdentity,
      orderId,
      rider: riderData,
    };
  }

  /**
   * Generates TwiML for routing a call to a client identity or phone number
   */
  generateCallTwiml(to: string): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const response = new VoiceResponse();

    if (to.startsWith('client:')) {
      const clientName = to.replace('client:', '');
      const dial = response.dial({ callerId: this.twilioPhoneNumber });
      dial.client(clientName);
    } else if (to.startsWith('+') || /^\d+$/.test(to)) {
      const dial = response.dial({ callerId: this.twilioPhoneNumber });
      dial.number(formatPhoneNumber(to));
    } else {
      const dial = response.dial({ callerId: this.twilioPhoneNumber });
      dial.client(to);
    }

    return response.toString();
  }

  /**
   * Initiates a masked cellular call bridge between customer and rider
   */
  async initiateMaskedBridgeCall(
    orderId: string,
    customerUserId: string
  ): Promise<{ callSid: string; message: string; maskedCallerId: string }> {
    const order = await Order.findById(orderId).populate('rider', 'phoneNumber name');
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    const customer = await User.findById(customerUserId);
    if (!customer || !customer.phoneNumber) {
      throw new AppError('Customer phone number not available for cellular call', 400);
    }

    const rider = order.rider as any;
    if (!rider || !rider.phoneNumber) {
      throw new AppError('Courier has not been assigned or does not have a phone number', 400);
    }

    const customerPhone = formatPhoneNumber(customer.phoneNumber);
    const riderPhone = formatPhoneNumber(rider.phoneNumber);
    const twilioFrom = this.twilioPhoneNumber;

    logger.info(`📞 Bridging masked call for Order ${orderId}: ${customerPhone} -> Twilio -> ${riderPhone}`);

    try {
      const twiml = `
        <Response>
          <Say voice="Polly.Joanna">Connecting you securely to your Go Eat courier. Please wait.</Say>
          <Dial callerId="${twilioFrom}" timeout="30">
            <Number>${riderPhone}</Number>
          </Dial>
        </Response>
      `.trim();

      const call = await this.client.calls.create({
        to: customerPhone,
        from: twilioFrom,
        twiml,
      });

      logger.info(`✅ Masked bridge call initiated with SID: ${call.sid}`);

      return {
        callSid: call.sid,
        message: 'Calling your phone now. When you answer, we will connect you to your courier.',
        maskedCallerId: twilioFrom,
      };
    } catch (error: any) {
      logger.error('❌ Failed to initiate Twilio masked bridge call:', error);
      throw new AppError(`Twilio call error: ${error.message || 'Unable to place call'}`, 500);
    }
  }
}

export default new VoiceService();
