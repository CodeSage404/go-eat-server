import crypto from 'crypto';
import mongoose from 'mongoose';
import Order, { IOrder, OrderStatus } from '../models/order.model';
import Restaurant from '../models/restaurant.model';
import User, { UserRole, UserStatus } from '../models/user.model';
import { emitToUser } from '../io';
import notificationService from './notification.service';
import settlementService from './settlement.service';
import emailService from './email.service';
import logger from '../utils/logger';
import { NotificationType } from '../models/userNotification.model';
import mapsService from './maps.service';
import AppError from '../utils/appError';
import Wallet from '../models/wallet.model';
import Transaction, { TransactionType, TransactionStatus } from '../models/transaction.model';
import { APP_CONSTANTS, SOCKET_EVENTS } from '../types/constants';

class OrderService {
  /**
   * Place a new order
   */
  async placeOrder(data: Partial<IOrder>): Promise<IOrder> {
    const restaurant = await Restaurant.findById(data.restaurant);
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }

    // Calculate estimated delivery time using Google Maps (Production Logic)
    const travelData = await mapsService.getDistanceAndTime(
      restaurant.location?.coordinates || [3.3792, 6.5244],
      data.deliveryAddress?.coordinates || [3.3792, 6.5244]
    );

    // Buffer for food preparation (e.g., 20 mins)
    const prepTimeInSeconds = 20 * 60;
    const totalTimeInSeconds = (travelData.durationValue || 0) + prepTimeInSeconds;
    data.estimatedDeliveryTime = new Date(Date.now() + totalTimeInSeconds * 1000);

    // Auto-generate unique 4-digit Delivery Verification PIN if not provided
    if (!data.deliveryPin) {
      data.deliveryPin = Math.floor(1000 + Math.random() * 9000).toString();
    }
    data.deliveryPinVerified = false;

    // Create the order
    const order = await Order.create(data);

    const shortId = order._id.toString().slice(-6).toUpperCase();

    // For CASH orders, send notifications and receipts immediately.
    // For CARD / online payment orders, notifications and receipts are deferred until payment verification in payment.service.ts.
    const isCashOrder = order.paymentMethod?.toLowerCase() === 'cash';

    if (isCashOrder) {
      // Notify Restaurant (Vendor) via Push, Socket, and In-app
      await notificationService.notifyNewOrder(restaurant.owner.toString(), order._id.toString());

      // Notify Customer via Push, Socket, and In-app
      if (order.customer) {
        await notificationService.sendNotification(
          order.customer.toString(),
          `Order Placed! 🍽️`,
          `Your order #${shortId} from ${restaurant.name} has been placed successfully and sent to the outlet!`,
          { orderId: order._id.toString(), status: 'pending', type: 'ORDER_UPDATE' },
          NotificationType.ORDER_UPDATE
        );

        // Send Itemized Receipt Email to Customer
        try {
          await order.populate('items.foodItem');
          const customerUser = await User.findById(order.customer);
          if (customerUser && customerUser.email && !customerUser.email.includes('customer@goeat.com')) {
            emailService.sendTemplateEmail(
              customerUser.email,
              'ORDER_CONFIRMED',
              `Order Receipt: #${shortId} from ${restaurant.name}`,
              {
                orderId: order._id,
                customerName: customerUser.name || 'Customer',
                total: order.totalAmount,
                items: order.items,
              }
            ).catch((err: any) => logger.warn('Failed to send order placed receipt email:', err.message));
          }
        } catch (emailErr: any) {
          logger.warn('Error preparing customer receipt email on placeOrder:', emailErr.message);
        }
      }
    }

    return order;
  }

  /**
   * Update order status and notify relevant parties
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    userId: string,
    role: string,
    cancelReason?: string,
    estimatedPrepTime?: number
  ): Promise<IOrder | null> {
    const order = await Order.findById(orderId).populate('customer restaurant rider');
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Production-grade permission and status flow validation
    if (role === 'vendor') {
      const restaurantId = (order.restaurant as any)?._id
        ? (order.restaurant as any)._id.toString()
        : order.restaurant.toString();

      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant || restaurant.owner.toString() !== userId.toString()) {
        throw new AppError("You do not have permission to manage this outlet's orders", 403);
      }

      const allowedVendorStatuses = [
        OrderStatus.ACCEPTED,
        OrderStatus.PREPARING,
        OrderStatus.READY,
        OrderStatus.READY_FOR_COLLECTION,
        OrderStatus.OUT_FOR_DELIVERY,
        OrderStatus.DELIVERED,
        OrderStatus.CANCELLED,
        OrderStatus.CANCELLED_BY_OUTLET
      ];
      if (!allowedVendorStatuses.includes(status)) {
        throw new AppError(`Outlets cannot set order status to ${status}`, 400);
      }
    } else if (role === 'rider') {
      const assignedRiderId = (order.rider as any)?._id
        ? (order.rider as any)._id.toString()
        : order.rider?.toString();
      if (!assignedRiderId || assignedRiderId !== userId.toString()) {
        throw new AppError('You are not the assigned courier for this order', 403);
      }

      const allowedRiderStatuses = [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.COURIER_COLLECTED, OrderStatus.DELIVERED, OrderStatus.CANCELLED];
      if (!allowedRiderStatuses.includes(status)) {
        throw new AppError(`Couriers cannot set order status to ${status}`, 400);
      }
    } else if (role === 'customer') {
      const customerId = (order.customer as any)?._id
        ? (order.customer as any)._id.toString()
        : order.customer.toString();

      if (customerId !== userId.toString()) {
        throw new AppError('You are not authorized to manage this order', 403);
      }

      const allowedCustomerStatuses = [OrderStatus.CANCELLED, OrderStatus.CANCELLED_BY_CUSTOMER, OrderStatus.REJECTED];
      if (!allowedCustomerStatuses.includes(status)) {
        throw new AppError(`Customers cannot set order status to ${status}`, 400);
      }
    } else if (role !== 'admin') {
      throw new AppError('Unauthorized to update order status', 403);
    }

    // Capture pre-mutation status for cancellation matrix processing
    const previousStatus = order.status;

    order.status = status;
    if (cancelReason) {
      order.cancelReason = cancelReason;
    }
    if (estimatedPrepTime) {
      order.estimatedPrepTime = estimatedPrepTime;
      order.estimatedDeliveryTime = new Date(Date.now() + estimatedPrepTime * 60 * 1000);
    } else if (status === OrderStatus.ACCEPTED || status === OrderStatus.PREPARING) {
      order.estimatedPrepTime = order.estimatedPrepTime || 20;
      order.estimatedDeliveryTime = new Date(Date.now() + order.estimatedPrepTime * 60 * 1000);
    }
    await order.save();

    // Extract IDs safely from potentially populated fields
    const customerId = (order.customer as any)?._id
      ? (order.customer as any)._id.toString()
      : order.customer.toString();

    const restaurantDoc = (order.restaurant as any)?._id
      ? (order.restaurant as any)
      : await Restaurant.findById(order.restaurant.toString());

    const vendorUserId = (restaurantDoc?.owner as any)?._id
      ? (restaurantDoc.owner as any)._id.toString()
      : restaurantDoc?.owner
      ? restaurantDoc.owner.toString()
      : null;

    const shortId = order._id.toString().substring(0, 6).toUpperCase();
    const outletName = restaurantDoc?.name || 'Outlet';
    const prepTimeText = order.estimatedPrepTime ? `${order.estimatedPrepTime} mins` : '20 mins';

    const effectiveCancelReason = cancelReason || order.cancelReason || '';
    const refundNote = order.refundAmount && order.refundAmount > 0 
      ? ` ₦${order.refundAmount.toLocaleString()} has been refunded to your Go-Eat Wallet.` 
      : '';

    // Rich status-specific messages for the customer
    const customerMessages: Record<string, string> = {
      [OrderStatus.ACCEPTED]: `Your order #${shortId} from ${outletName} has been accepted and is being prepared.`,
      [OrderStatus.PREPARING]: `Your meal for order #${shortId} is currently being prepared at ${outletName} (Est. ~${prepTimeText}).`,
      [OrderStatus.READY]: `Your order #${shortId} from ${outletName} is ready and available for pickup!`,
      [OrderStatus.READY_FOR_COLLECTION]: `Your order #${shortId} from ${outletName} is ready and available for pickup!`,
      [OrderStatus.OUT_FOR_DELIVERY]: `Your order #${shortId} has been picked up by the courier and is on the way to your address!`,
      [OrderStatus.DELIVERED]: `Your order #${shortId} from ${outletName} has been delivered. Enjoy your meal!`,
      [OrderStatus.CANCELLED]: effectiveCancelReason 
        ? `Your order #${shortId} was cancelled by ${outletName}. Reason: "${effectiveCancelReason}".${refundNote}`
        : `Your order #${shortId} from ${outletName} has been cancelled.${refundNote}`,
    };

    // Rich status-specific titles for customer in-app notifications
    const customerTitles: Record<string, string> = {
      [OrderStatus.ACCEPTED]: `Order Accepted 🧑‍🍳`,
      [OrderStatus.PREPARING]: `Order Preparing 🍳`,
      [OrderStatus.READY]: `Order Ready for Pickup 📦`,
      [OrderStatus.READY_FOR_COLLECTION]: `Order Ready for Pickup 📦`,
      [OrderStatus.OUT_FOR_DELIVERY]: `Order on the Way 🛵`,
      [OrderStatus.DELIVERED]: `Order Delivered 🎉`,
      [OrderStatus.CANCELLED]: `Order Cancelled ❌`,
    };

    // Rich status-specific messages for the vendor/outlet
    const vendorMessages: Record<string, string> = {
      [OrderStatus.ACCEPTED]: `You accepted order #${shortId}. Estimated prep time set to ${prepTimeText}.`,
      [OrderStatus.PREPARING]: `Order #${shortId} is marked as preparing.`,
      [OrderStatus.READY]: `Order #${shortId} is marked as ready and available for courier pickup.`,
      [OrderStatus.READY_FOR_COLLECTION]: `Order #${shortId} is marked as ready and available for courier pickup.`,
      [OrderStatus.OUT_FOR_DELIVERY]: `Order #${shortId} has been collected by the courier and is on its way to the customer.`,
      [OrderStatus.DELIVERED]: `Order #${shortId} delivered successfully! Earnings credited to your wallet.`,
      [OrderStatus.CANCELLED]: effectiveCancelReason
        ? `Order #${shortId} cancelled. Reason: "${effectiveCancelReason}".`
        : `Order #${shortId} has been cancelled.`,
    };

    // Notify Customer via Notification Service
    await notificationService.sendNotification(
      customerId,
      customerTitles[status] || `Order Update 🛵`,
      customerMessages[status] || `Your order #${shortId} status is now ${status.replace('_', ' ')}.`,
      { orderId: order._id.toString(), status, cancelReason: effectiveCancelReason, refundAmount: order.refundAmount, estimatedPrepTime: order.estimatedPrepTime, type: 'ORDER_UPDATE' },
      NotificationType.ORDER_UPDATE
    );

    // Emit Real-Time Socket Event to Customer
    emitToUser(customerId, SOCKET_EVENTS.ORDER_STATUS_UPDATE, {
      orderId: order._id.toString(),
      status,
      cancelReason: effectiveCancelReason,
      refundAmount: order.refundAmount,
      estimatedPrepTime: order.estimatedPrepTime,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
    });

    // Also notify customer of real-time wallet refund if applicable
    if (order.refundAmount && order.refundAmount > 0) {
      emitToUser(customerId, 'walletBalanceUpdate', {
        amount: order.refundAmount,
        reason: 'order_refund',
        orderId: order._id.toString(),
      });
    }

    if (status === OrderStatus.ACCEPTED || status === OrderStatus.PREPARING) {
      emitToUser(customerId, SOCKET_EVENTS.ORDER_PREPARING, {
        orderId: order._id.toString(),
        status: 'preparing',
        estimatedPrepTime: order.estimatedPrepTime,
        estimatedDeliveryTime: order.estimatedDeliveryTime,
      });

      // Send Email to Customer informing them order is accepted & being prepared
      const customerUser = (order.customer as any)?.email ? (order.customer as any) : await User.findById(customerId);
      if (customerUser && customerUser.email && !customerUser.email.includes('customer@goeat.com')) {
        emailService.sendTemplateEmail(
          customerUser.email,
          'ORDER_PREPARING',
          `Order Accepted & Being Prepared! 🧑‍🍳`,
          {
            orderId: order._id,
            customerName: customerUser.name || 'Customer',
            estimatedPrepTime: order.estimatedPrepTime || 20,
          }
        ).catch((err: any) => logger.error('Failed to send order preparing email:', err));
      }
    } else if (status === OrderStatus.OUT_FOR_DELIVERY && order.deliveryPin) {
      // Send separate dedicated PIN reminder notification
      notificationService.notifyOrderDeliveryPin(
        customerId,
        order._id.toString(),
        order.deliveryPin
      ).catch((err: any) => logger.warn('Failed to send delivery PIN push notification:', err.message));
    }

    // Notify Vendor/Outlet
    if (vendorUserId) {
      await notificationService.notifyVendorOrderUpdate(
        vendorUserId,
        order._id.toString(),
        status,
        vendorMessages[status] || `Order #${shortId} status: ${status.replace('_', ' ')}`
      );

      // Schedule late alert if accepted/preparing
      if (status === OrderStatus.ACCEPTED || status === OrderStatus.PREPARING) {
        this.schedulePrepTimeAlert(order._id.toString(), vendorUserId, order.estimatedPrepTime || 20, shortId);
      }
    }

    // Operational Policy Settlement Triggers
    if (status === OrderStatus.ACCEPTED) {
      await settlementService.processOrderAccepted(order);
    } else if (status === OrderStatus.DELIVERED || status === OrderStatus.COMPLETED) {
      await settlementService.processOrderCompleted(order);
    } else if (
      status === OrderStatus.CANCELLED ||
      status === OrderStatus.CANCELLED_BY_CUSTOMER ||
      status === OrderStatus.CANCELLED_BY_OUTLET ||
      status === OrderStatus.REJECTED
    ) {
      const initiator = role === 'vendor' ? 'outlet' : role === 'rider' ? 'courier' : role === 'customer' ? 'customer' : 'goeat';
      await settlementService.processOrderCancellation(order, initiator, cancelReason || 'Order status cancelled', previousStatus);
    }

    // If order is READY, notify nearby riders
    if (status === OrderStatus.READY || status === OrderStatus.READY_FOR_COLLECTION) {
      this.notifyNearbyRiders(order);
    }

    return order;
  }

  /**
   * Find and notify nearby riders about a ready order using geographic proximity matching
   */
  private async notifyNearbyRiders(order: IOrder) {
    try {
      const populatedOrder = await Order.findById(order._id)
        .populate('restaurant', 'name address location images phoneContact rating')
        .populate('customer', 'name phoneNumber email profileImage')
        .populate('items.foodItem', 'name price image');

      const restaurantCoords = (populatedOrder?.restaurant as any)?.location?.coordinates;
      let targetRiders: any[] = [];

      // Proximity Dispatch (Radius: 10km max distance)
      if (restaurantCoords && restaurantCoords.length >= 2) {
        const [restLng, restLat] = restaurantCoords;
        try {
          targetRiders = await User.find({
            role: UserRole.RIDER,
            isOnline: true,
            status: UserStatus.ACTIVE,
            location: {
              $near: {
                $geometry: {
                  type: 'Point',
                  coordinates: [Number(restLng), Number(restLat)],
                },
                $maxDistance: 10000, // 10,000 meters = 10km
              },
            },
          });
        } catch (geoErr) {
          logger.warn('Geospatial $near query error, falling back to Haversine calculation:', geoErr);
        }
      }

      // Fallback: If no riders matched via $near (or coordinates not yet indexed), filter online riders using Haversine
      if (!targetRiders || targetRiders.length === 0) {
        const allOnlineRiders = await User.find({
          role: UserRole.RIDER,
          isOnline: true,
        });

        if (restaurantCoords && restaurantCoords.length >= 2) {
          const [restLng, restLat] = restaurantCoords;
          targetRiders = allOnlineRiders.filter((r) => {
            const coords = r.location?.coordinates;
            if (!coords || coords.length < 2) return true; // Include couriers without cached coordinates
            const distKm = this.calculateHaversineDistanceKm(restLat, restLng, coords[1], coords[0]);
            return distKm <= 12; // 12km max delivery radius
          });
        } else {
          targetRiders = allOnlineRiders;
        }
      }

      logger.info(
        `📡 Proximity Dispatch: Alerting ${targetRiders.length} rider(s) within outlet radius for order #${order._id}`
      );

      targetRiders.forEach((rider) => {
        notificationService.notifyRiderAvailableOrder(rider._id.toString(), order._id.toString());
        emitToUser(rider._id.toString(), 'NEW_DELIVERY_REQUEST', populatedOrder || order);
      });
    } catch (err) {
      logger.error('Error notifying riders about available order:', err);
    }
  }

  private calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Schedule late preparation alert notification to the vendor
   */
  private schedulePrepTimeAlert(orderId: string, vendorUserId: string, prepTimeMinutes: number, shortId: string) {
    const delayMs = prepTimeMinutes * 60 * 1000;
    setTimeout(async () => {
      try {
        const checkOrder = await Order.findById(orderId);
        if (checkOrder && (checkOrder.status === OrderStatus.ACCEPTED || checkOrder.status === OrderStatus.PREPARING)) {
          logger.warn(`⏱️ Prep time expired for order #${shortId}. Sending late alert to vendor ${vendorUserId}.`);
          await notificationService.sendNotification(
            vendorUserId,
            `Prep Time Alert: Order #${shortId} Running Late! ⏱️`,
            `Your estimated prep time of ${prepTimeMinutes} mins for order #${shortId} has elapsed. Please finish meal preparation and mark as ready for pickup.`,
            { orderId, type: 'PREP_TIME_ALERT', status: checkOrder.status },
            NotificationType.ORDER_UPDATE
          );
        }
      } catch (err: any) {
        logger.error(`Failed to execute prep time alert for order #${shortId}:`, err);
      }
    }, delayMs);
  }

  /**
   * Get available delivery jobs for couriers, with optional proximity sorting
   */
  async getAvailableDeliveryJobs(riderLat?: number, riderLng?: number): Promise<IOrder[]> {
    const orders = await Order.find({
      status: {
        $in: [
          OrderStatus.ACCEPTED,
          OrderStatus.PREPARING,
          OrderStatus.READY,
          OrderStatus.READY_FOR_COLLECTION,
        ],
      },
      rider: null,
    })
      .populate('restaurant', 'name address location images phoneContact rating')
      .populate('customer', 'name phoneNumber email profileImage')
      .populate('items.foodItem', 'name price image')
      .sort({ createdAt: -1 });

    // If rider coordinates provided, sort jobs by closest distance first
    if (riderLat && riderLng && orders.length > 0) {
      return orders.sort((a, b) => {
        const coordsA = (a.restaurant as any)?.location?.coordinates;
        const coordsB = (b.restaurant as any)?.location?.coordinates;
        const distA = coordsA?.length >= 2 ? this.calculateHaversineDistanceKm(riderLat, riderLng, coordsA[1], coordsA[0]) : 9999;
        const distB = coordsB?.length >= 2 ? this.calculateHaversineDistanceKm(riderLat, riderLng, coordsB[1], coordsB[0]) : 9999;
        return distA - distB;
      });
    }

    return orders;
  }

  /**
   * Assign a rider to an order and dispatch push notifications to customer and outlet
   */
  async assignRider(orderId: string, riderId: string): Promise<IOrder | null> {
    const order = await Order.findByIdAndUpdate(
      orderId,
      { rider: riderId, status: OrderStatus.COURIER_ASSIGNED },
      { returnDocument: 'after' }
    ).populate('customer restaurant rider');

    if (order) {
      // Process courier pending earnings
      await settlementService.processCourierAssigned(order, riderId);

      const riderUser = (order.rider as any)?._id ? (order.rider as any) : await User.findById(riderId);
      const riderName = riderUser?.name || 'A delivery rider';
      const shortId = order._id.toString().substring(0, 6).toUpperCase();
      const restaurantDoc = (order.restaurant as any)?._id ? (order.restaurant as any) : await Restaurant.findById(order.restaurant);
      const restaurantName = restaurantDoc?.name || 'the restaurant';

      // 1. Send Push & In-app Notification to Customer
      const customerId = (order.customer as any)?._id
        ? (order.customer as any)._id.toString()
        : order.customer.toString();

      await notificationService.sendNotification(
        customerId,
        `Courier Assigned 🛵`,
        `${riderName} has accepted your order #${shortId} and is on their way to ${restaurantName}!`,
        {
          orderId: order._id.toString(),
          status: OrderStatus.COURIER_ASSIGNED,
          type: 'RIDER_ASSIGNED',
          rider: order.rider,
        },
        NotificationType.ORDER_UPDATE
      );

      // Emit Real-time Socket to Customer
      emitToUser(customerId, SOCKET_EVENTS.RIDER_ASSIGNED, order.rider);

      // 2. Send Push & In-app Notification to Restaurant Outlet
      if (restaurantDoc && restaurantDoc.owner) {
        const vendorOwnerId = (restaurantDoc.owner as any)?._id
          ? (restaurantDoc.owner as any)._id.toString()
          : restaurantDoc.owner.toString();

        await notificationService.sendNotification(
          vendorOwnerId,
          `Courier Assigned 🛵`,
          `${riderName} has accepted delivery for order #${shortId} and is en route for pickup.`,
          {
            orderId: order._id.toString(),
            status: OrderStatus.COURIER_ASSIGNED,
            type: 'RIDER_ASSIGNED',
            rider: order.rider,
          },
          NotificationType.ORDER_UPDATE
        );

        // Emit Real-time Socket to Vendor
        emitToUser(vendorOwnerId, SOCKET_EVENTS.RIDER_ASSIGNED, order.rider);
      }

      // 3. Send Push & In-app Notification to Rider
      await notificationService.sendNotification(
        riderId,
        `Delivery Accepted! 🚀`,
        `You've accepted order #${shortId}. Head to ${restaurantName} to collect the order.`,
        {
          orderId: order._id.toString(),
          status: OrderStatus.COURIER_ASSIGNED,
          type: 'RIDER_ASSIGNED',
          restaurantName,
          orderShortId: shortId,
        },
        NotificationType.ORDER_UPDATE
      );

      // Emit Real-time Socket to Rider
      emitToUser(riderId, 'DELIVERY_ACCEPTED_CONFIRMATION', order);
    }

    return order;
  }

  async getCustomerOrders(customerId: string): Promise<IOrder[]> {
    return await Order.find({ customer: customerId })
      .populate('restaurant', 'name address image isSelfPickup hasDelivery location')
      .populate('items.foodItem', 'name price image')
      .sort({ createdAt: -1 });
  }

  async getOrderById(orderId: string): Promise<IOrder | null> {
    if (!orderId) return null;
    const targetId = orderId.includes(',') ? orderId.split(',')[0].trim() : orderId.trim();
    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      return null;
    }
    return await Order.findById(targetId).populate('customer restaurant rider items.foodItem');
  }

  async getRestaurantOrders(restaurantId: string): Promise<IOrder[]> {
    return await Order.find({ restaurant: restaurantId })
      .populate('customer', 'name phoneNumber email')
      .populate('items.foodItem', 'name price image')
      .sort({ createdAt: -1 });
  }

  async getRiderOrders(riderId: string): Promise<IOrder[]> {
    return await Order.find({ rider: riderId }).sort({ createdAt: -1 });
  }

  async reorder(orderId: string, customerId: string): Promise<IOrder> {
    const originalOrder = await Order.findById(orderId);
    if (!originalOrder) throw new AppError('Original order not found', 404);

    // Create a new order object with same items and restaurant
    const newOrderData: Partial<IOrder> = {
      customer: customerId as any,
      restaurant: originalOrder.restaurant,
      items: originalOrder.items,
      totalAmount: originalOrder.totalAmount,
      deliveryFee: originalOrder.deliveryFee,
      deliveryAddress: originalOrder.deliveryAddress,
      paymentMethod: originalOrder.paymentMethod,
      status: OrderStatus.PENDING,
    };

    return await this.placeOrder(newOrderData);
  }

  /**
   * Verify delivery PIN and complete order delivery
   */
  async verifyDeliveryPin(
    orderId: string,
    pin: string,
    userId: string,
    role: string
  ): Promise<IOrder> {
    const order = await Order.findById(orderId).populate('customer restaurant rider');
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Role check: Only assigned rider, outlet owner, or admin can verify delivery
    const isSuperAdmin = role === 'admin' || role === 'superadmin';
    const isAssignedRider =
      order.rider &&
      ((order.rider as any)._id?.toString() === userId || order.rider.toString() === userId);

    let isOutletOwner = false;
    if (role === 'vendor') {
      const restaurantId = (order.restaurant as any)?._id
        ? (order.restaurant as any)._id.toString()
        : order.restaurant.toString();
      const restaurant = await Restaurant.findById(restaurantId);
      if (restaurant && restaurant.owner.toString() === userId) {
        isOutletOwner = true;
      }
    }

    if (!isSuperAdmin && !isAssignedRider && !isOutletOwner) {
      throw new AppError('You do not have authorization to confirm delivery for this order', 403);
    }

    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.COMPLETED) {
      throw new AppError('This order has already been marked as delivered', 400);
    }

    if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REJECTED) {
      throw new AppError('Cannot verify delivery for a cancelled or rejected order', 400);
    }

    // Defend against PIN brute forcing: Max 5 failed attempts per order
    const MAX_PIN_ATTEMPTS = 5;
    const currentAttempts = order.failedPinAttempts || 0;

    if (currentAttempts >= MAX_PIN_ATTEMPTS) {
      throw new AppError(
        'Too many incorrect PIN attempts. For security reasons, this order verification has been locked. Please contact support.',
        429
      );
    }

    // Constant-time PIN verification
    const formattedInputPin = String(pin || '').trim();
    const actualPin = String(order.deliveryPin || '').trim();

    let isPinMatch = false;
    if (actualPin && formattedInputPin) {
      try {
        const inputBuf = Buffer.from(formattedInputPin);
        const actualBuf = Buffer.from(actualPin);
        isPinMatch = (inputBuf.length === actualBuf.length) && crypto.timingSafeEqual(inputBuf, actualBuf);
      } catch {
        isPinMatch = false;
      }
    }

    if (!isPinMatch) {
      await Order.findByIdAndUpdate(orderId, { $inc: { failedPinAttempts: 1 } });
      const remainingAttempts = MAX_PIN_ATTEMPTS - (currentAttempts + 1);
      throw new AppError(
        `Invalid delivery verification PIN. ${remainingAttempts} attempt(s) remaining before order verification is locked.`,
        400
      );
    }

    order.deliveryPinVerified = true;
    order.deliveryPinVerifiedAt = new Date();
    order.failedPinAttempts = 0;
    await order.save();

    // Transition order status to DELIVERED through existing pipeline (notifies customer & triggers settlements)
    const updatedOrder = await this.updateOrderStatus(
      orderId,
      OrderStatus.DELIVERED,
      userId,
      role
    );

    return updatedOrder || order;
  }
}

export default new OrderService();
