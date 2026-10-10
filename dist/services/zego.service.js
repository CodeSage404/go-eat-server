"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken04 = generateToken04;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = __importDefault(require("../utils/logger"));
const appError_1 = __importDefault(require("../utils/appError"));
const order_model_1 = __importDefault(require("../models/order.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const io_1 = require("../io");
const notification_service_1 = __importDefault(require("./notification.service"));
const zegoLastNotificationMap = new Map();
/**
 * ZEGOCLOUD token04 Generator using Node.js built-in crypto
 */
function makeRandomIv() {
    const str = '0123456789abcdefghijklmnopqrstuvwxyz';
    let res = '';
    for (let i = 0; i < 16; i++) {
        res += str.charAt(Math.floor(Math.random() * str.length));
    }
    return res;
}
function aesEncrypt(plainText, key, iv) {
    const cipher = crypto_1.default.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
    cipher.setAutoPadding(true);
    const encrypted = cipher.update(plainText);
    const final = cipher.final();
    return Buffer.concat([encrypted, final]);
}
function generateToken04(appId, userId, secret, effectiveTimeInSeconds, payload = '') {
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
    get appId() {
        return parseInt(process.env.ZEGO_APP_ID || '1031074673', 10);
    }
    get appSign() {
        return process.env.ZEGO_APP_SIGN || '';
    }
    get serverSecret() {
        return process.env.ZEGO_SERVER_SECRET || '';
    }
    /**
     * Dynamically resolves the communication recipient according to the order lifecycle:
     * - Kitchen / Prep stage: Customer <-> Restaurant/Vendor
     * - Courier stage: Customer <-> Delivery Courier (Rider)
     * - Explicit target requests are preserved.
     */
    resolveOrderCommunication(order, role, explicitTarget) {
        if (!order) {
            return { target: 'customer', recipientUserId: null, recipientIdentity: '', restaurantId: null };
        }
        const riderUserId = order.rider ? (order.rider._id?.toString() || order.rider.toString()) : null;
        const customerUserId = order.customer ? (order.customer._id?.toString() || order.customer.toString()) : null;
        let vendorUserId = null;
        let restaurantId = null;
        if (order.restaurant) {
            restaurantId = order.restaurant._id?.toString() || order.restaurant.toString();
            const owner = order.restaurant.owner;
            if (owner) {
                vendorUserId = owner._id?.toString() || owner.toString();
            }
            else {
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
            if (!target || target === 'auto') {
                target = isCourierStage ? 'rider' : 'restaurant';
            }
            if (target === 'restaurant') {
                return {
                    target: 'restaurant',
                    recipientUserId: vendorUserId,
                    recipientIdentity: `vendor_${vendorUserId || restaurantId || 'unknown'}`,
                    restaurantId,
                };
            }
            else {
                return {
                    target: 'rider',
                    recipientUserId: riderUserId,
                    recipientIdentity: `rider_${riderUserId || 'unassigned'}`,
                    restaurantId,
                };
            }
        }
        if (role === 'vendor') {
            if (!target || target === 'auto') {
                target = 'customer';
            }
            if (target === 'rider') {
                return {
                    target: 'rider',
                    recipientUserId: riderUserId,
                    recipientIdentity: `rider_${riderUserId || 'unassigned'}`,
                    restaurantId,
                };
            }
            else {
                return {
                    target: 'customer',
                    recipientUserId: customerUserId,
                    recipientIdentity: `customer_${customerUserId || 'unknown'}`,
                    restaurantId,
                };
            }
        }
        // role === 'rider'
        if (!target || target === 'auto') {
            target = 'customer';
        }
        if (target === 'restaurant') {
            return {
                target: 'restaurant',
                recipientUserId: vendorUserId,
                recipientIdentity: `vendor_${vendorUserId || restaurantId || 'unknown'}`,
                restaurantId,
            };
        }
        else {
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
    async generateCallToken(userId, orderId, role = 'customer', target = 'customer') {
        let order = null;
        if (orderId) {
            order = await order_model_1.default.findById(orderId)
                .populate('rider', 'name phoneNumber profilePicture profileImage vehicleType')
                .populate('customer', 'name phoneNumber profilePicture profileImage')
                .populate('restaurant', 'name phoneContact businessPhone phone phoneNumber logo owner');
            if (!order) {
                throw new appError_1.default('Order not found', 404);
            }
        }
        const callerIdentity = `${role}_${userId}`;
        const roomId = orderId ? `goeat_order_${orderId}` : `goeat_user_${userId}`;
        const { target: resolvedTarget, recipientUserId, recipientIdentity } = this.resolveOrderCommunication(order, role, target);
        const riderData = order?.rider ? {
            name: order.rider.name || 'Delivery Courier',
            phoneNumber: order.rider.phoneNumber,
            profilePicture: order.rider.profilePicture || order.rider.profileImage,
            vehicleType: order.rider.vehicleType || 'Motorcycle',
        } : null;
        const customerData = order?.customer ? {
            name: order.customer.name || 'Customer',
            phoneNumber: order.customer.phoneNumber,
            profilePicture: order.customer.profilePicture || order.customer.profileImage,
        } : null;
        const restPhone = order?.restaurant?.phoneContact || order?.restaurant?.businessPhone || order?.restaurant?.phoneNumber || order?.restaurant?.phone;
        const restaurantData = order?.restaurant ? {
            name: order.restaurant.name || 'Restaurant Outlet',
            phoneContact: restPhone,
            businessPhone: restPhone,
            phoneNumber: restPhone,
            phone: restPhone,
            logo: order.restaurant.logo,
        } : null;
        // Generate ZEGOCLOUD token04 with 2 hours expiry
        const effectiveTimeInSeconds = 7200;
        const token = generateToken04(this.appId, callerIdentity, this.serverSecret, effectiveTimeInSeconds, JSON.stringify({ room_id: roomId }));
        let callerName = role === 'vendor' ? (order?.restaurant?.name || 'Restaurant Outlet') : (role === 'rider' ? 'Delivery Courier' : 'Customer');
        const callerUser = await user_model_1.default.findById(userId).select('name phoneNumber profileImage');
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
    async notifyCallRecipient(callerUserId, orderId, role, target) {
        const order = await order_model_1.default.findById(orderId)
            .populate('rider', 'name phoneNumber profilePicture profileImage')
            .populate('customer', 'name phoneNumber profilePicture profileImage')
            .populate('restaurant', 'name phoneContact businessPhone logo owner');
        if (!order)
            return;
        const { target: resolvedTarget, recipientUserId, restaurantId } = this.resolveOrderCommunication(order, role, target);
        if (!recipientUserId && !restaurantId) {
            logger_1.default.warn(`[ZegoService] No recipient resolved for order ${orderId}, role: ${role}, target: ${target}`);
            return;
        }
        // Debounce duplicate rapid taps (2 seconds), NOT 20 seconds, to prevent dropping retry calls
        const cooldownKey = `zego_${orderId}_${callerUserId}_${recipientUserId}`;
        const now = Date.now();
        const lastSent = zegoLastNotificationMap.get(cooldownKey) || 0;
        if (now - lastSent < 2000)
            return;
        zegoLastNotificationMap.set(cooldownKey, now);
        let callerName = 'Go-Eat Connection';
        let callerImage;
        let callerPhone;
        if (role === 'vendor') {
            callerName = order.restaurant?.name || 'Restaurant Outlet';
            callerImage = order.restaurant?.logo;
            callerPhone = order.restaurant?.phoneContact || order.restaurant?.businessPhone;
        }
        else if (role === 'rider') {
            callerName = order.rider?.name || 'Delivery Courier';
            callerImage = order.rider?.profilePicture || order.rider?.profileImage;
            callerPhone = order.rider?.phoneNumber;
        }
        else {
            callerName = order.customer?.name || 'Customer';
            callerImage = order.customer?.profilePicture || order.customer?.profileImage;
            callerPhone = order.customer?.phoneNumber;
        }
        if (!callerName || callerName === 'Go-Eat Connection') {
            const callerUser = await user_model_1.default.findById(callerUserId).select('name phoneNumber profileImage');
            if (callerUser?.name)
                callerName = callerUser.name;
            if (callerUser?.profileImage)
                callerImage = callerUser.profileImage;
            if (callerUser?.phoneNumber)
                callerPhone = callerUser.phoneNumber;
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
            (0, io_1.emitToUser)(recipientUserId, 'incoming_zego_call', callPayload);
            (0, io_1.emitToUser)(recipientUserId, 'incoming_call', callPayload);
        }
        // If recipient is a restaurant/vendor, also emit to restaurant room to cover staff/tablet sockets
        if (resolvedTarget === 'restaurant' && restaurantId && restaurantId !== recipientUserId) {
            (0, io_1.emitToUser)(restaurantId, 'incoming_zego_call', callPayload);
            (0, io_1.emitToUser)(restaurantId, 'incoming_call', callPayload);
        }
        // High Priority Push Notification fallback with VoIP flag
        if (recipientUserId) {
            notification_service_1.default.sendNotification(recipientUserId, 'Incoming Voice Call 📞', `${callerName} is calling you regarding Order #${displayOrderId}`, {
                type: 'incoming_zego_call',
                isVoip: true,
                orderId,
                roomId,
                callerId: `${role}_${callerUserId}`,
                callerName,
                callerImage,
                displayOrderId,
                target: resolvedTarget,
            }).catch((err) => {
                logger_1.default.warn('[ZegoService] Failed to send push notification:', err);
            });
        }
    }
    /**
     * Dispatches a call ended event via Socket.IO to notify the other party immediately
     */
    async notifyCallEnded(callerUserId, orderId, role, target) {
        const order = await order_model_1.default.findById(orderId)
            .populate('rider', '_id')
            .populate('customer', '_id')
            .populate('restaurant', 'owner');
        if (!order)
            return;
        const { target: resolvedTarget, recipientUserId, restaurantId } = this.resolveOrderCommunication(order, role, target);
        // Clear debounce maps when call ends so next call connects instantly
        if (recipientUserId) {
            zegoLastNotificationMap.delete(`zego_${orderId}_${callerUserId}_${recipientUserId}`);
            zegoLastNotificationMap.delete(`zego_${orderId}_${recipientUserId}_${callerUserId}`);
            (0, io_1.emitToUser)(recipientUserId, 'zego_call_ended', {
                orderId,
                callerId: `${role}_${callerUserId}`,
            });
        }
        if (resolvedTarget === 'restaurant' && restaurantId && restaurantId !== recipientUserId) {
            (0, io_1.emitToUser)(restaurantId, 'zego_call_ended', {
                orderId,
                callerId: `${role}_${callerUserId}`,
            });
        }
    }
    /**
     * Dispatches a Missed Call notification and socket event when a call goes unanswered
     */
    async notifyMissedCall(callerUserId, orderId, role, target) {
        const order = await order_model_1.default.findById(orderId)
            .populate('rider', 'name phoneNumber profilePicture profileImage')
            .populate('customer', 'name phoneNumber profilePicture profileImage')
            .populate('restaurant', 'name owner logo');
        if (!order)
            return;
        const { target: resolvedTarget, recipientUserId, restaurantId } = this.resolveOrderCommunication(order, role, target);
        if (!recipientUserId && !restaurantId)
            return;
        let callerName = role === 'vendor' ? order.restaurant?.name || 'Restaurant Outlet' : (role === 'rider' ? 'Delivery Courier' : 'Customer');
        const callerUser = await user_model_1.default.findById(callerUserId).select('name');
        if (callerUser?.name) {
            callerName = role === 'vendor' ? order.restaurant?.name || callerUser.name : callerUser.name;
        }
        const displayOrderId = order._id.toString().slice(-6).toUpperCase();
        const callbackTarget = role === 'vendor' ? 'restaurant' : role;
        // 1. Send push notification for missed call
        if (recipientUserId) {
            notification_service_1.default.sendNotification(recipientUserId, 'Missed Call 📞', `You missed a call from ${callerName} regarding Order #${displayOrderId}. Tap to call back.`, {
                type: 'missed_call',
                orderId,
                callerId: `${role}_${callerUserId}`,
                callerName,
                callerRole: role,
                target: callbackTarget,
                displayOrderId,
            }).catch((err) => {
                logger_1.default.warn('[ZegoService] Failed to send missed call push:', err);
            });
            // 2. Real-time socket event
            (0, io_1.emitToUser)(recipientUserId, 'missed_call', {
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
            (0, io_1.emitToUser)(restaurantId, 'missed_call', {
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
exports.default = new ZegoService();
