import crypto from 'crypto';
import mongoose from 'mongoose';
import Order, { IOrder, OrderStatus } from '../models/order.model';
import Restaurant from '../models/restaurant.model';
import FoodItem from '../models/foodItem.model';
import Setting from '../models/setting.model';
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

    const isPickup = data.orderType === 'pickup';

    // 1. Resolve and Validate Coordinates
    const restCoords = restaurant.location?.coordinates;
    if (!restCoords || restCoords.length < 2) {
      throw new AppError('Restaurant location coordinates are not configured.', 400);
    }

    let customerCoords = data.deliveryAddress?.coordinates;
    const isInvalidCoords = !customerCoords || customerCoords.length < 2 || (customerCoords[0] === 0 && customerCoords[1] === 0);

    if (isInvalidCoords && !isPickup) {
      // Attempt server-side geocoding from text address if coordinates are missing
      const addressString = data.deliveryAddress?.address || data.deliveryAddress?.street || '';
      if (addressString.trim()) {
        const geocoded = await mapsService.geocodeAddress(addressString);
        if (geocoded && geocoded.length >= 2) {
          customerCoords = [geocoded[0], geocoded[1]];
          if (data.deliveryAddress) {
            data.deliveryAddress.coordinates = customerCoords;
          }
        }
      }
    }

    if (!isPickup && (!customerCoords || customerCoords.length < 2 || (customerCoords[0] === 0 && customerCoords[1] === 0))) {
      throw new AppError('Valid delivery location coordinates are required. Please select your address on the map.', 400);
    }

    // 2. Fetch platform settings for fees & thresholds
    const setting = await Setting.findOne();
    const maxRadius = restaurant.deliveryRadius || setting?.maxDeliveryDistance || 15;
    const baseFee = setting?.deliveryBaseFee ?? 500;
    const feePerKm = setting?.deliveryFeePerKm ?? 100;
    const serviceFee = setting?.serviceFee ?? 170;

    // 3. Server-side validation of items & price recalculation against FoodItem collection
    if (!data.items || data.items.length === 0) {
      throw new AppError('Order must contain at least one item', 400);
    }

    const itemIds = data.items.map(item => item.foodItem);
    const dbFoodItems = await FoodItem.find({ _id: { $in: itemIds } });
    const foodMap = new Map(dbFoodItems.map(f => [f._id.toString(), f]));

    let computedFoodSubtotal = 0;
    const validatedItems: any[] = [];

    for (const item of data.items) {
      const foodIdStr = (item.foodItem as any)?._id ? (item.foodItem as any)._id.toString() : item.foodItem?.toString();
      const food = foodMap.get(foodIdStr);

      if (!food) {
        throw new AppError(`Food item not found or unavailable: ${item.name || foodIdStr}`, 404);
      }

      if (food.restaurant.toString() !== restaurant._id.toString()) {
        throw new AppError(`Item "${food.name}" does not belong to ${restaurant.name}`, 400);
      }

      if (!food.isAvailable) {
        throw new AppError(`Item "${food.name}" is currently sold out or unavailable`, 400);
      }

      const qty = Math.max(1, Number(item.quantity) || 1);
      const verifiedPrice = Number(food.price);
      computedFoodSubtotal += verifiedPrice * qty;

      validatedItems.push({
        foodItem: food._id,
        name: food.name,
        price: verifiedPrice,
        quantity: qty,
        image: food.image || item.image || '',
      });
    }

    data.items = validatedItems;
    data.grossAmount = computedFoodSubtotal;

    let finalDistKm = 0;
    const prepTimeInSeconds = 20 * 60;
    let totalTimeInSeconds = prepTimeInSeconds;

    if (!isPickup && customerCoords) {
      // Calculate travel distance and duration
      const travelData = await mapsService.getDistanceAndTime(
        [restCoords[0], restCoords[1]],
        [customerCoords[0], customerCoords[1]]
      );

      const haversineDistKm = this.calculateHaversineDistanceKm(
        restCoords[1], restCoords[0],
        customerCoords[1], customerCoords[0]
      );

      const travelDistKm = travelData.distanceValue ? (travelData.distanceValue / 1000) : haversineDistKm;
      finalDistKm = Number((travelDistKm || haversineDistKm).toFixed(2));

      // Guard: Check if delivery exceeds restaurant delivery radius
      if (finalDistKm > maxRadius) {
        throw new AppError(
          `Delivery address is outside the maximum delivery radius for ${restaurant.name} (${finalDistKm.toFixed(1)} km > ${maxRadius} km max). Please select an outlet closer to your location.`,
          400
        );
      }

      totalTimeInSeconds = (travelData.durationValue || Math.round(finalDistKm * 3 * 60)) + prepTimeInSeconds;

      // Dynamic distance-based delivery fee calculation (enforced server-side)
      data.deliveryFee = Math.round(baseFee + (finalDistKm * feePerKm));
      data.distanceKm = finalDistKm;
    } else {
      data.deliveryFee = 0;
      data.distanceKm = 0;
    }

    data.serviceFee = serviceFee;
    data.totalAmount = computedFoodSubtotal + (data.deliveryFee || 0) + (data.serviceFee || 0) + (Number(data.tipAmount) || 0);
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
      let candidateRiders: any[] = [];

      // Proximity Dispatch (Radius: 10km max distance)
      if (restaurantCoords && restaurantCoords.length >= 2) {
        const [restLng, restLat] = restaurantCoords;
        try {
          candidateRiders = await User.find({
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

      // Fallback: If no riders matched via $near, retrieve online active riders and compute distance
      if (!candidateRiders || candidateRiders.length === 0) {
        const allOnlineRiders = await User.find({
          role: UserRole.RIDER,
          isOnline: true,
          status: UserStatus.ACTIVE,
        });

        if (restaurantCoords && restaurantCoords.length >= 2) {
          const [restLng, restLat] = restaurantCoords;
          candidateRiders = allOnlineRiders.filter((r) => {
            const coords = r.location?.coordinates;
            if (!coords || coords.length < 2) return true; // Include couriers without cached coordinates
            const distKm = this.calculateHaversineDistanceKm(restLat, restLng, coords[1], coords[0]);
            return distKm <= 12; // 12km max delivery radius
          });
        } else {
          candidateRiders = allOnlineRiders;
        }
      }

      if (!candidateRiders || candidateRiders.length === 0) {
        logger.info(`📡 Proximity Dispatch: No online riders found near order #${order._id}`);
        return;
      }

      // Calculate distance for each candidate rider to the restaurant
      const [restLng, restLat] = restaurantCoords && restaurantCoords.length >= 2
        ? restaurantCoords
        : [3.3792, 6.5244];

      const ridersWithDistance = candidateRiders.map((rider) => {
        const coords = rider.location?.coordinates;
        const distKm = coords && coords.length >= 2
          ? this.calculateHaversineDistanceKm(restLat, restLng, coords[1], coords[0])
          : 999;
        return { rider, distKm };
      });

      // Check which riders currently have an active delivery in progress
      const candidateRiderIds = candidateRiders.map((r) => r._id);
      const activeDeliveries = await Order.find({
        rider: { $in: candidateRiderIds },
        status: {
          $in: [
            OrderStatus.COURIER_ASSIGNED,
            OrderStatus.COURIER_COLLECTED,
            OrderStatus.OUT_FOR_DELIVERY,
          ],
        },
      });
      const busyRiderIds = new Set(
        activeDeliveries
          .filter((o) => Boolean(o.rider))
          .map((o) => ((o.rider as any)?._id ? (o.rider as any)._id.toString() : (o.rider as any).toString()))
      );

      // Separate into available (not on an active delivery) vs busy
      const availableRiders = ridersWithDistance
        .filter((item) => !busyRiderIds.has(item.rider._id.toString()))
        .sort((a, b) => a.distKm - b.distKm);

      const busyRiders = ridersWithDistance
        .filter((item) => busyRiderIds.has(item.rider._id.toString()))
        .sort((a, b) => a.distKm - b.distKm);

      // Prioritize the closest available rider. If none available, route to closest busy rider
      const selected = availableRiders.length > 0 ? availableRiders[0] : busyRiders[0];

      if (selected) {
        const targetRider = selected.rider;
        const isBusy = busyRiderIds.has(targetRider._id.toString());
        logger.info(
          `📡 Proximity Dispatch: Order #${order._id} assigned to closest ${isBusy ? 'busy' : 'available'} courier ${targetRider._id} (${selected.distKm.toFixed(2)}km)`
        );

        // Send Push & In-app Notification
        await notificationService.notifyRiderAvailableOrder(targetRider._id.toString(), order._id.toString());

        // Emit Real-time Socket Event for instantaneous offer modal popup
        emitToUser(targetRider._id.toString(), 'NEW_DELIVERY_REQUEST', populatedOrder || order);
      }
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

    // If rider coordinates provided, filter to nearby jobs (max 25km pickup radius) and sort closest first
    if (riderLat && riderLng && orders.length > 0) {
      const MAX_PICKUP_SEARCH_RADIUS_KM = 25;
      const nearbyOrders = orders.filter((o) => {
        const coords = (o.restaurant as any)?.location?.coordinates;
        if (!coords || coords.length < 2) return true;
        const dist = this.calculateHaversineDistanceKm(riderLat, riderLng, coords[1], coords[0]);
        return dist <= MAX_PICKUP_SEARCH_RADIUS_KM;
      });

      return nearbyOrders.sort((a, b) => {
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
    // 1. Enforce single active delivery rule: A rider cannot go on more than one delivery at a time
    const existingActiveOrder = await Order.findOne({
      rider: riderId,
      status: {
        $in: [
          OrderStatus.COURIER_ASSIGNED,
          OrderStatus.COURIER_COLLECTED,
          OrderStatus.OUT_FOR_DELIVERY,
        ],
      },
    });

    if (existingActiveOrder) {
      throw new AppError(
        'You already have an ongoing delivery in progress. Please complete your current delivery before accepting another.',
        400
      );
    }

    // 2. Atomic assignment: only accept if order is unassigned
    const order = await Order.findOneAndUpdate(
      {
        _id: orderId,
        rider: null,
        status: {
          $in: [
            OrderStatus.ACCEPTED,
            OrderStatus.PREPARING,
            OrderStatus.READY,
            OrderStatus.READY_FOR_COLLECTION,
          ],
        },
      },
      { rider: riderId, status: OrderStatus.COURIER_ASSIGNED },
      { returnDocument: 'after' }
    ).populate('customer restaurant rider');

    if (!order) {
      throw new AppError(
        'This delivery is no longer available or has already been accepted by another courier.',
        400
      );
    }

    // Double-check race condition: if concurrent assignment happened across multiple requests, rollback
    const riderActiveDeliveries = await Order.find({
      rider: riderId,
      status: {
        $in: [
          OrderStatus.COURIER_ASSIGNED,
          OrderStatus.COURIER_COLLECTED,
          OrderStatus.OUT_FOR_DELIVERY,
        ],
      },
    });

    const activeBatchKeys = new Set(riderActiveDeliveries.map(o => o.batchGroupId || o._id.toString()));
    if (activeBatchKeys.size > 1) {
      await Order.findByIdAndUpdate(orderId, {
        $unset: { rider: 1 },
        status: OrderStatus.READY_FOR_COLLECTION,
      });
      throw new AppError(
        'You already have an ongoing delivery in progress. Please complete your current delivery before accepting another.',
        400
      );
    }

    // 3. Batched Pickup Assignment: if this order is part of a batched multi-outlet group, link sibling orders to the same courier
    if (order.batchGroupId && order.isBatchedDelivery) {
      await Order.updateMany(
        {
          batchGroupId: order.batchGroupId,
          rider: null,
          _id: { $ne: order._id },
        },
        { rider: riderId, status: OrderStatus.COURIER_ASSIGNED }
      );
    }

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

  /**
   * Calculate real-time fee quote for single or multi-outlet carts
   */
  async quoteCheckoutFees(params: {
    outlets: Array<{ restaurantId: string; subtotal: number; itemCount?: number }>;
    deliveryCoordinates?: [number, number];
    deliveryAddressText?: string;
    isPickup?: boolean;
  }) {
    const { outlets, deliveryCoordinates, deliveryAddressText, isPickup } = params;
    const setting = await Setting.findOne();

    const baseFee = setting?.deliveryBaseFee ?? 500;
    const feePerKm = setting?.deliveryFeePerKm ?? 100;
    const serviceFee = setting?.serviceFee ?? 170;
    const smallOrderFee = setting?.smallOrderFee ?? 150;
    const smallOrderThreshold = setting?.smallOrderFeeThreshold ?? 1000;
    const batchThresholdKm = setting?.batchPickupThresholdKm ?? 3.0;
    const multiOutletExtraStopFee = setting?.multiOutletExtraStopFee ?? 300;
    const maxGlobalRadius = setting?.maxDeliveryDistance ?? 15;

    if (isPickup) {
      return {
        isPickup: true,
        deliveryFee: 0,
        serviceFee: 0,
        smallOrderFee: 0,
        totalFees: 0,
        routingMode: 'PICKUP',
        outlets: outlets.map((o) => ({ ...o, deliveryFee: 0, distanceKm: 0, withinRadius: true })),
      };
    }

    let customerCoords = deliveryCoordinates;
    if ((!customerCoords || customerCoords.length < 2 || (customerCoords[0] === 0 && customerCoords[1] === 0)) && deliveryAddressText) {
      const geocoded = await mapsService.geocodeAddress(deliveryAddressText);
      if (geocoded && geocoded.length >= 2) customerCoords = [geocoded[0], geocoded[1]];
    }

    if (!customerCoords || customerCoords.length < 2 || (customerCoords[0] === 0 && customerCoords[1] === 0)) {
      throw new AppError('Valid delivery coordinates or address are required to calculate delivery fees.', 400);
    }

    // Fetch details for all outlets
    const restaurantDocs = await Restaurant.find({ _id: { $in: outlets.map((o) => o.restaurantId) } });
    const restaurantMap = new Map(restaurantDocs.map((r) => [r._id.toString(), r]));

    const outletQuotes = [];
    let totalSubtotal = 0;

    for (const outletItem of outlets) {
      totalSubtotal += (outletItem.subtotal || 0);
      const restDoc = restaurantMap.get(outletItem.restaurantId);
      if (!restDoc) {
        throw new AppError(`Restaurant not found: ${outletItem.restaurantId}`, 404);
      }

      const restCoords = restDoc.location?.coordinates;
      if (!restCoords || restCoords.length < 2) {
        throw new AppError(`Location coordinates not configured for ${restDoc.name}`, 400);
      }

      const haversineDistKm = this.calculateHaversineDistanceKm(
        restCoords[1], restCoords[0],
        customerCoords[1], customerCoords[0]
      );
      const maxRadius = restDoc.deliveryRadius || maxGlobalRadius;
      const withinRadius = haversineDistKm <= maxRadius;

      const singleTripFee = Math.round(baseFee + (haversineDistKm * feePerKm));

      outletQuotes.push({
        restaurantId: outletItem.restaurantId,
        restaurantName: restDoc.name,
        coordinates: restCoords,
        distanceKm: Number(haversineDistKm.toFixed(2)),
        deliveryRadius: maxRadius,
        withinRadius,
        singleTripFee,
        subtotal: outletItem.subtotal,
      });
    }

    // Check if any outlet is outside delivery radius
    const outOfBounds = outletQuotes.find((o) => !o.withinRadius);
    if (outOfBounds) {
      throw new AppError(
        `${outOfBounds.restaurantName} is outside your delivery radius (${outOfBounds.distanceKm} km > ${outOfBounds.deliveryRadius} km max). Please select items from an outlet closer to you.`,
        400
      );
    }

    // Single outlet vs Multi-outlet routing determination
    let routingMode: 'SINGLE_OUTLET' | 'BATCHED_PICKUP' | 'SPLIT_DELIVERY' = 'SINGLE_OUTLET';
    let totalDeliveryFee = 0;
    let outletDistanceKm = 0;

    if (outletQuotes.length === 1) {
      routingMode = 'SINGLE_OUTLET';
      totalDeliveryFee = outletQuotes[0].singleTripFee;
    } else {
      // Pairwise distance between Outlet A and Outlet B
      const restA = outletQuotes[0];
      const restB = outletQuotes[1];
      outletDistanceKm = Number(
        this.calculateHaversineDistanceKm(
          restA.coordinates[1], restA.coordinates[0],
          restB.coordinates[1], restB.coordinates[0]
        ).toFixed(2)
      );

      if (outletDistanceKm <= batchThresholdKm) {
        // Approach 1: Single Rider (Batched Pickup)
        routingMode = 'BATCHED_PICKUP';
        const totalBatchedDist = outletDistanceKm + Math.max(restA.distanceKm, restB.distanceKm);
        totalDeliveryFee = Math.round(baseFee + (totalBatchedDist * feePerKm) + multiOutletExtraStopFee);
      } else {
        // Approach 2: Split Delivery (Multiple Riders)
        routingMode = 'SPLIT_DELIVERY';
        totalDeliveryFee = outletQuotes.reduce((sum, o) => sum + o.singleTripFee, 0);
      }
    }

    const appliedSmallOrderFee = totalSubtotal < smallOrderThreshold ? smallOrderFee : 0;
    const totalFees = totalDeliveryFee + serviceFee + appliedSmallOrderFee;

    return {
      isPickup: false,
      routingMode,
      outletDistanceKm,
      batchThresholdKm,
      totalDeliveryFee,
      serviceFee,
      smallOrderFee: appliedSmallOrderFee,
      totalFees,
      estimatedTotal: totalSubtotal + totalFees,
      outlets: outletQuotes,
    };
  }

  /**
   * Process a multi-outlet cart checkout with Batched Pickup or Split Delivery routing
   */
  async processMultiOutletCheckout(payload: {
    customerId: string;
    subOrders: Array<{
      restaurant: string;
      items: any[];
      totalAmount: number;
    }>;
    deliveryAddress: any;
    paymentMethod: any;
    deliveryMode?: string;
    deliveryTime?: string;
    deliveryNotes?: string;
    tipAmount?: number;
    orderType?: 'delivery' | 'pickup';
  }): Promise<{
    batchGroupId?: string;
    routingMode: string;
    orders: IOrder[];
    totalCharged: number;
    totalDeliveryFee: number;
  }> {
    const { customerId, subOrders, deliveryAddress, paymentMethod, deliveryMode, deliveryTime, deliveryNotes, tipAmount, orderType } = payload;

    if (!subOrders || subOrders.length === 0) {
      throw new AppError('No sub-orders provided for checkout', 400);
    }

    // If single outlet, place normal order
    if (subOrders.length === 1) {
      const singleOrder = await this.placeOrder({
        customer: customerId as any,
        restaurant: subOrders[0].restaurant as any,
        items: subOrders[0].items,
        totalAmount: subOrders[0].totalAmount,
        deliveryAddress,
        paymentMethod,
        deliveryMode,
        deliveryTime,
        deliveryNotes,
        tipAmount: tipAmount || 0,
        orderType: orderType || 'delivery',
      });

      return {
        routingMode: 'SINGLE_OUTLET',
        orders: [singleOrder],
        totalCharged: singleOrder.totalAmount,
        totalDeliveryFee: singleOrder.deliveryFee || 0,
      };
    }

    // Multi-outlet checkout: Quote fees and determine routing mode
    const quote = await this.quoteCheckoutFees({
      outlets: subOrders.map((o) => ({
        restaurantId: o.restaurant,
        subtotal: o.totalAmount,
        itemCount: o.items.length,
      })),
      deliveryCoordinates: deliveryAddress?.coordinates,
      deliveryAddressText: deliveryAddress?.address || deliveryAddress?.street,
      isPickup: orderType === 'pickup',
    });

    const batchGroupId = 'BATCH_' + crypto.randomBytes(6).toString('hex').toUpperCase();
    const isBatched = quote.routingMode === 'BATCHED_PICKUP';
    const createdOrders: IOrder[] = [];

    // Distribute delivery fee among sub-orders:
    // If batched, assign full fee to first sub-order and 0 to subsequent
    for (let i = 0; i < subOrders.length; i++) {
      const sub = subOrders[i];
      const assignedDeliveryFee = isBatched
        ? (i === 0 ? (quote.totalDeliveryFee || 0) : 0)
        : ((quote.outlets[i] as any)?.singleTripFee || 0);

      const assignedTip = i === 0 ? (tipAmount || 0) : 0;
      const assignedServiceFee = i === 0 ? quote.serviceFee : 0;

      const orderData: Partial<IOrder> = {
        customer: customerId as any,
        restaurant: sub.restaurant as any,
        items: sub.items,
        totalAmount: sub.totalAmount + assignedDeliveryFee + assignedTip + assignedServiceFee,
        deliveryFee: assignedDeliveryFee,
        serviceFee: assignedServiceFee,
        tipAmount: assignedTip,
        distanceKm: (quote.outlets[i] as any)?.distanceKm || 0,
        batchGroupId,
        isBatchedDelivery: isBatched,
        batchSequence: i + 1,
        splitDelivery: !isBatched,
        deliveryAddress,
        paymentMethod,
        deliveryMode,
        deliveryTime,
        deliveryNotes,
        orderType: orderType || 'delivery',
      };

      const created = await this.placeOrder(orderData);
      createdOrders.push(created);
    }

    const totalCharged = createdOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    return {
      batchGroupId,
      routingMode: quote.routingMode,
      orders: createdOrders,
      totalCharged,
      totalDeliveryFee: quote.totalDeliveryFee || 0,
    };
  }
}

export default new OrderService();
