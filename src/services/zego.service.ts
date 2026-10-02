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
    let recipientIdentity = '';
    let recipientUserId: string | null = null;
    const roomId = orderId ? `goeat_order_${orderId}` : `goeat_user_${userId}`;

    if (order) {
      if (role === 'vendor') {
        if (target === 'rider') {
          recipientIdentity = `rider_${order.rider ? (order.rider as any)._id : 'unassigned'}`;
          recipientUserId = order.rider ? (order.rider as any)._id?.toString() : null;
        } else {
          recipientIdentity = `customer_${order.customer ? (order.customer as any)._id || order.customer : 'unknown'}`;
          recipientUserId = order.customer ? ((order.customer as any)._id?.toString() || order.customer.toString()) : null;
        }
      } else if (role === 'customer') {
        if (target === 'restaurant') {
          recipientIdentity = `vendor_${(order.restaurant as any)?.owner || order.restaurant}`;
          recipientUserId = (order.restaurant as any)?.owner ? (order.restaurant as any).owner.toString() : null;
        } else {
          recipientIdentity = `rider_${order.rider ? (order.rider as any)._id : 'unassigned'}`;
          recipientUserId = order.rider ? (order.rider as any)._id?.toString() : null;
        }
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
    }

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

    const callerUser = await User.findById(userId).select('name phoneNumber profileImage');
    const callerName = callerUser?.name || (role === 'rider' ? 'Delivery Courier' : 'Customer');

    return {
      token,
      appId: this.appId,
      appSign: this.appSign,
      roomId,
      userId: callerIdentity,
      userName: callerName,
      recipientIdentity,
      recipientUserId,
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
      .populate('restaurant', 'name phoneContact logo owner');
    if (!order) return;

    let recipientUserId: string | null = null;
    let recipientIdentity = '';

    if (role === 'rider') {
      recipientUserId = order.customer ? ((order.customer as any)._id?.toString() || order.customer.toString()) : null;
      recipientIdentity = `customer_${recipientUserId}`;
    } else if (role === 'customer') {
      recipientUserId = order.rider ? (order.rider as any)._id?.toString() : null;
      recipientIdentity = `rider_${recipientUserId}`;
    }

    if (!recipientUserId) return;

    const cooldownKey = `zego_${orderId}_${recipientUserId}`;
    const now = Date.now();
    const lastSent = zegoLastNotificationMap.get(cooldownKey) || 0;
    if (now - lastSent < 20000) return;
    zegoLastNotificationMap.set(cooldownKey, now);

    const callerUser = await User.findById(callerUserId).select('name phoneNumber profileImage');
    const callerName = callerUser?.name || (role === 'rider' ? 'Delivery Courier' : 'Customer');
    const callerImage = callerUser?.profileImage;
    const callerPhone = callerUser?.phoneNumber;
    const displayOrderId = order._id.toString().slice(-6).toUpperCase();
    const roomId = `goeat_order_${orderId}`;

    // Real-time socket event for immediate ringing UI
    emitToUser(recipientUserId, 'incoming_zego_call', {
      orderId,
      roomId,
      role,
      target,
      callerId: `${role}_${callerUserId}`,
      callerName,
      callerImage,
      callerPhone,
      displayOrderId,
    });

    // FCM Push Notification fallback
    notificationService.sendNotification(
      recipientUserId,
      'Incoming Voice Call 📞',
      `${callerName} is calling you regarding Order #${displayOrderId}`,
      {
        type: 'incoming_zego_call',
        orderId,
        roomId,
        callerId: `${role}_${callerUserId}`,
        callerName,
        callerImage,
        displayOrderId,
      }
    ).catch((err) => {
      logger.warn('[ZegoService] Failed to send push notification:', err);
    });
  }
}

export default new ZegoService();
