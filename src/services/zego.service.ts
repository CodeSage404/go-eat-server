import crypto from 'crypto';
import logger from '../utils/logger';
import AppError from '../utils/appError';
import Order from '../models/order.model';
import User from '../models/user.model';
import { emitToUser } from '../io';
import notificationService from './notification.service';

const zegoLastNotificationMap = new Map<string, number>();

/**
 * ZEGOCLOUD token04 Generator using Node.js built-in crypto
 */
function makeRandomIv(): string {
  const str = '0123456789abcdefghijklmnopqrstuvwxyz';
  let res = '';
  for (let i = 0; i < 16; i++) {
    res += str.charAt(Math.floor(Math.random() * str.length));
  }
  return res;
}

function aesEncrypt(plainText: string, key: string, iv: string): Buffer {
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
  cipher.setAutoPadding(true);
  const encrypted = cipher.update(plainText);
  const final = cipher.final();
  return Buffer.concat([encrypted, final]);
}

export function generateToken04(
  appId: number,
  userId: string,
  secret: string,
  effectiveTimeInSeconds: number,
  payload = ''
): string {
  if (!appId || typeof appId !== 'number') {
    throw new Error('appID invalid');
  }
  if (!userId || typeof userId !== 'string') {
    throw new Error('userID invalid');
  }
  if (!secret || typeof secret !== 'string' || secret.length !== 32) {
    throw new Error('secret must be a 32 byte string');
  }
  if (!effectiveTimeInSeconds || typeof effectiveTimeInSeconds !== 'number') {
    throw new Error('effectiveTimeInSeconds invalid');
  }

  const createTime = Math.floor(Date.now() / 1000);
  const tokenInfo = {
    app_id: appId,
    user_id: userId,
    nonce: Math.floor(Math.random() * 2147483647),
    ctime: createTime,
    expire: createTime + effectiveTimeInSeconds,
    payload: payload || '',
  };

  const plainText = JSON.stringify(tokenInfo);
  const iv = makeRandomIv();
  const encryptBuf = aesEncrypt(plainText, secret, iv);

  const b1 = new Uint8Array(8);
  const b2 = new Uint8Array(2);
  const b3 = new Uint8Array(2);

  new DataView(b1.buffer).setBigInt64(0, BigInt(tokenInfo.expire), false);
  new DataView(b2.buffer).setUint16(0, iv.length, false);
  new DataView(b3.buffer).setUint16(0, encryptBuf.byteLength, false);

  const buf = Buffer.concat([
    Buffer.from(b1),
    Buffer.from(b2),
    Buffer.from(iv),
    Buffer.from(b3),
    encryptBuf,
  ]);

  return '04' + buf.toString('base64');
}

class ZegoService {
  public get appId(): number {
    return parseInt(process.env.ZEGO_APP_ID || '1031074673', 10);
  }

  public get appSign(): string {
    return process.env.ZEGO_APP_SIGN || '';
  }

  public get serverSecret(): string {
    return process.env.ZEGO_SERVER_SECRET || '';
  }

  /**
   * Dynamically resolves the communication recipient according to the order lifecycle:
   * - Kitchen / Prep stage: Customer <-> Restaurant/Vendor
   * - Courier stage: Customer <-> Delivery Courier (Rider)
   * - Explicit target requests are preserved.
   */
  private resolveOrderCommunication(
    order: any,
    role: 'customer' | 'rider' | 'vendor',
    explicitTarget?: 'customer' | 'rider' | 'restaurant'
  ): { target: 'customer' | 'rider' | 'restaurant'; recipientUserId: string | null; recipientIdentity: string; restaurantId: string | null } {
    if (!order) {
      return { target: 'customer', recipientUserId: null, recipientIdentity: '', restaurantId: null };
    }

    const riderUserId = order.rider ? ((order.rider as any)._id?.toString() || order.rider.toString()) : null;
    const customerUserId = order.customer ? ((order.customer as any)._id?.toString() || order.customer.toString()) : null;

    let vendorUserId: string | null = null;
    let restaurantId: string | null = null;
    if (order.restaurant) {
      restaurantId = (order.restaurant as any)._id?.toString() || order.restaurant.toString();
      const owner = (order.restaurant as any).owner;
      if (owner) {
        vendorUserId = (owner as any)._id?.toString() || owner.toString();
      } else {
        vendorUserId = restaurantId;
      }
    }

    const orderStatus = String(order.status || '').toLowerCase();
    const isCourierStage = [
      'courier_assigned',
      'courier_collected',
      'out_for_delivery',
      'delivered',
      'completed',
      'in_transit',
      'on_the_way',
    ].includes(orderStatus) || !!riderUserId;

    let target = explicitTarget;

    if (role === 'customer') {
      if (!target || (target as string) === 'auto') {
        target = isCourierStage ? 'rider' : 'restaurant';
      }

      if (target === 'restaurant') {
        return {
          target: 'restaurant',
          recipientUserId: vendorUserId,
          recipientIdentity: `vendor_${vendorUserId || restaurantId || 'unknown'}`,
          restaurantId,
        };
      } else {
        return {
          target: 'rider',
          recipientUserId: riderUserId,
          recipientIdentity: `rider_${riderUserId || 'unassigned'}`,
          restaurantId,
        };
      }
    }

    if (role === 'vendor') {
      if (!target || (target as string) === 'auto') {
        target = 'customer';
      }

      if (target === 'rider') {
        return {
          target: 'rider',
          recipientUserId: riderUserId,
          recipientIdentity: `rider_${riderUserId || 'unassigned'}`,
          restaurantId,
        };
      } else {
        return {
          target: 'customer',
          recipientUserId: customerUserId,
          recipientIdentity: `customer_${customerUserId || 'unknown'}`,
          restaurantId,
        };
      }
    }

    // role === 'rider'
    if (!target || (target as string) === 'auto') {
      target = 'customer';
    }

    if (target === 'restaurant') {
      return {
        target: 'restaurant',
        recipientUserId: vendorUserId,
        recipientIdentity: `vendor_${vendorUserId || restaurantId || 'unknown'}`,
        restaurantId,
      };
    } else {
      return {
        target: 'customer',
        recipientUserId: customerUserId,
        recipientIdentity: `customer_${customerUserId || 'unknown'}`,
        restaurantId,
      };
    }
  }

  /**
   * Generates a ZEGOCLOUD Call token and session metadata for an order call
   */
  async generateCallToken(
    userId: string,
    orderId?: string,
    role: 'customer' | 'rider' | 'vendor' = 'customer',
    target: 'customer' | 'rider' | 'restaurant' = 'customer'
  ) {
    let order: any = null;
    if (orderId) {
      order = await Order.findById(orderId)
        .populate('rider', 'name phoneNumber profilePicture profileImage vehicleType')
        .populate('customer', 'name phoneNumber profilePicture profileImage')
        .populate('restaurant', 'name phoneContact businessPhone phone phoneNumber logo owner');
      if (!order) {
        throw new AppError('Order not found', 404);
      }
    }

    const callerIdentity = `${role}_${userId}`;
    const roomId = orderId ? `goeat_order_${orderId}` : `goeat_user_${userId}`;

    const { target: resolvedTarget, recipientUserId, recipientIdentity } = this.resolveOrderCommunication(
      order,
      role,
      target
    );

    const riderData = order?.rider ? {
      name: (order.rider as any).name || 'Delivery Courier',
      phoneNumber: (order.rider as any).phoneNumber,
      profilePicture: (order.rider as any).profilePicture || (order.rider as any).profileImage,
      vehicleType: (order.rider as any).vehicleType || 'Motorcycle',
    } : null;

    const customerData = order?.customer ? {
      name: (order.customer as any).name || 'Customer',
      phoneNumber: (order.customer as any).phoneNumber,
      profilePicture: (order.customer as any).profilePicture || (order.customer as any).profileImage,
    } : null;

    const restPhone = (order?.restaurant as any)?.phoneContact || (order?.restaurant as any)?.businessPhone || (order?.restaurant as any)?.phoneNumber || (order?.restaurant as any)?.phone;
    const restaurantData = order?.restaurant ? {
      name: (order.restaurant as any).name || 'Restaurant Outlet',
      phoneContact: restPhone,
      businessPhone: restPhone,
      phoneNumber: restPhone,
      phone: restPhone,
      logo: (order.restaurant as any).logo,
    } : null;

    // Generate ZEGOCLOUD token04 with 2 hours expiry
    const effectiveTimeInSeconds = 7200;
    const token = generateToken04(
      this.appId,
      callerIdentity,
      this.serverSecret,
      effectiveTimeInSeconds,
      JSON.stringify({ room_id: roomId })
    );

    let callerName = role === 'vendor' ? (order?.restaurant?.name || 'Restaurant Outlet') : (role === 'rider' ? 'Delivery Courier' : 'Customer');
    const callerUser = await User.findById(userId).select('name phoneNumber profileImage');
    if (callerUser?.name) {
      callerName = role === 'vendor' ? (order?.restaurant?.name || callerUser.name) : callerUser.name;
    }

    return {
      token,
      appId: this.appId,
      appSign: this.appSign,
      roomId,
      userId: callerIdentity,
      userName: callerName,
      recipientIdentity,
      recipientUserId,
      resolvedTarget,
      orderId: orderId || '',
      rider: riderData,
      customer: customerData,
      restaurant: restaurantData,
    };
  }

  /**
   * Dispatches an incoming call alert via Socket.IO and Push Notification when a call is dialed
   */
  async notifyCallRecipient(
    callerUserId: string,
    orderId: string,
    role: 'customer' | 'rider' | 'vendor',
    target: 'customer' | 'rider' | 'restaurant'
  ): Promise<void> {
    const order = await Order.findById(orderId)
      .populate('rider', 'name phoneNumber profilePicture profileImage')
      .populate('customer', 'name phoneNumber profilePicture profileImage')
      .populate('restaurant', 'name phoneContact businessPhone logo owner');
    if (!order) return;

    const { target: resolvedTarget, recipientUserId, restaurantId } = this.resolveOrderCommunication(
      order,
      role,
      target
    );

    if (!recipientUserId && !restaurantId) {
      logger.warn(`[ZegoService] No recipient resolved for order ${orderId}, role: ${role}, target: ${target}`);
      return;
    }

    // Debounce duplicate rapid taps (2 seconds), NOT 20 seconds, to prevent dropping retry calls
    const cooldownKey = `zego_${orderId}_${callerUserId}_${recipientUserId}`;
    const now = Date.now();
    const lastSent = zegoLastNotificationMap.get(cooldownKey) || 0;
    if (now - lastSent < 2000) return;
    zegoLastNotificationMap.set(cooldownKey, now);

    let callerName = 'Go-Eat Connection';
    let callerImage: string | undefined;
    let callerPhone: string | undefined;

    if (role === 'vendor') {
      callerName = (order.restaurant as any)?.name || 'Restaurant Outlet';
      callerImage = (order.restaurant as any)?.logo;
      callerPhone = (order.restaurant as any)?.phoneContact || (order.restaurant as any)?.businessPhone;
    } else if (role === 'rider') {
      callerName = (order.rider as any)?.name || 'Delivery Courier';
      callerImage = (order.rider as any)?.profilePicture || (order.rider as any)?.profileImage;
      callerPhone = (order.rider as any)?.phoneNumber;
    } else {
      callerName = (order.customer as any)?.name || 'Customer';
      callerImage = (order.customer as any)?.profilePicture || (order.customer as any)?.profileImage;
      callerPhone = (order.customer as any)?.phoneNumber;
    }

    if (!callerName || callerName === 'Go-Eat Connection') {
      const callerUser = await User.findById(callerUserId).select('name phoneNumber profileImage');
      if (callerUser?.name) callerName = callerUser.name;
      if (callerUser?.profileImage) callerImage = callerUser.profileImage;
      if (callerUser?.phoneNumber) callerPhone = callerUser.phoneNumber;
    }

    const displayOrderId = order._id.toString().slice(-6).toUpperCase();
    const roomId = `goeat_order_${orderId}`;

    const callPayload = {
      orderId,
      roomId,
      role,
      target: resolvedTarget,
      callerId: `${role}_${callerUserId}`,
      callerName,
      callerImage,
      callerPhone,
      displayOrderId,
      timestamp: now,
    };

    // Real-time socket event for immediate ringing UI
    if (recipientUserId) {
      emitToUser(recipientUserId, 'incoming_zego_call', callPayload);
      emitToUser(recipientUserId, 'incoming_call', callPayload);
    }
    // If recipient is a restaurant/vendor, also emit to restaurant room to cover staff/tablet sockets
    if (resolvedTarget === 'restaurant' && restaurantId && restaurantId !== recipientUserId) {
      emitToUser(restaurantId, 'incoming_zego_call', callPayload);
      emitToUser(restaurantId, 'incoming_call', callPayload);
    }

    // High Priority Push Notification fallback with VoIP flag
    if (recipientUserId) {
      notificationService.sendNotification(
        recipientUserId,
        'Incoming Voice Call 📞',
        `${callerName} is calling you regarding Order #${displayOrderId}`,
        {
          type: 'incoming_zego_call',
          isVoip: true,
          orderId,
          roomId,
          callerId: `${role}_${callerUserId}`,
          callerName,
          callerImage,
          displayOrderId,
          target: resolvedTarget,
        }
      ).catch((err) => {
        logger.warn('[ZegoService] Failed to send push notification:', err);
      });
    }
  }

  /**
   * Dispatches a call ended event via Socket.IO to notify the other party immediately
   */
  async notifyCallEnded(
    callerUserId: string,
    orderId: string,
    role: 'customer' | 'rider' | 'vendor',
    target: 'customer' | 'rider' | 'restaurant'
  ): Promise<void> {
    const order = await Order.findById(orderId)
      .populate('rider', '_id')
      .populate('customer', '_id')
      .populate('restaurant', 'owner');
    if (!order) return;

    const { target: resolvedTarget, recipientUserId, restaurantId } = this.resolveOrderCommunication(
      order,
      role,
      target
    );

    // Clear debounce maps when call ends so next call connects instantly
    if (recipientUserId) {
      zegoLastNotificationMap.delete(`zego_${orderId}_${callerUserId}_${recipientUserId}`);
      zegoLastNotificationMap.delete(`zego_${orderId}_${recipientUserId}_${callerUserId}`);
      emitToUser(recipientUserId, 'zego_call_ended', {
        orderId,
        callerId: `${role}_${callerUserId}`,
      });
    }

    if (resolvedTarget === 'restaurant' && restaurantId && restaurantId !== recipientUserId) {
      emitToUser(restaurantId, 'zego_call_ended', {
        orderId,
        callerId: `${role}_${callerUserId}`,
      });
    }
  }

  /**
   * Dispatches a Missed Call notification and socket event when a call goes unanswered
   */
  async notifyMissedCall(
    callerUserId: string,
    orderId: string,
    role: 'customer' | 'rider' | 'vendor',
    target: 'customer' | 'rider' | 'restaurant'
  ): Promise<void> {
    const order = await Order.findById(orderId)
      .populate('rider', 'name phoneNumber profilePicture profileImage')
      .populate('customer', 'name phoneNumber profilePicture profileImage')
      .populate('restaurant', 'name owner logo');
    if (!order) return;

    const { target: resolvedTarget, recipientUserId, restaurantId } = this.resolveOrderCommunication(
      order,
      role,
      target
    );

    if (!recipientUserId && !restaurantId) return;

    let callerName = role === 'vendor' ? (order.restaurant as any)?.name || 'Restaurant Outlet' : (role === 'rider' ? 'Delivery Courier' : 'Customer');
    const callerUser = await User.findById(callerUserId).select('name');
    if (callerUser?.name) {
      callerName = role === 'vendor' ? (order.restaurant as any)?.name || callerUser.name : callerUser.name;
    }
    const displayOrderId = order._id.toString().slice(-6).toUpperCase();

    const callbackTarget = role === 'vendor' ? 'restaurant' : role;

    // 1. Send push notification for missed call
    if (recipientUserId) {
      notificationService.sendNotification(
        recipientUserId,
        'Missed Call 📞',
        `You missed a call from ${callerName} regarding Order #${displayOrderId}. Tap to call back.`,
        {
          type: 'missed_call',
          orderId,
          callerId: `${role}_${callerUserId}`,
          callerName,
          callerRole: role,
          target: callbackTarget,
          displayOrderId,
        }
      ).catch((err) => {
        logger.warn('[ZegoService] Failed to send missed call push:', err);
      });

      // 2. Real-time socket event
      emitToUser(recipientUserId, 'missed_call', {
        orderId,
        callerId: `${role}_${callerUserId}`,
        callerName,
        callerRole: role,
        target: callbackTarget,
        displayOrderId,
        timestamp: new Date().toISOString(),
      });
    }

    if (resolvedTarget === 'restaurant' && restaurantId && restaurantId !== recipientUserId) {
      emitToUser(restaurantId, 'missed_call', {
        orderId,
        callerId: `${role}_${callerUserId}`,
        callerName,
        callerRole: role,
        target: callbackTarget,
        displayOrderId,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export default new ZegoService();
