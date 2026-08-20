import Order, { IOrder, OrderStatus } from '../models/order.model';
import Restaurant from '../models/restaurant.model';
import User, { UserRole } from '../models/user.model';
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

    // Create the order
    const order = await Order.create(data);

    // Notify Restaurant (Vendor) via Push and Socket
    await notificationService.notifyNewOrder(restaurant.owner.toString(), order._id.toString());

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
    cancelReason?: string
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

      const allowedVendorStatuses = [OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.READY_FOR_COLLECTION, OrderStatus.CANCELLED, OrderStatus.CANCELLED_BY_OUTLET];
      if (!allowedVendorStatuses.includes(status)) {
        throw new AppError(`Outlets cannot set order status to ${status}`, 400);
      }
    } else if (role === 'rider') {
      if (!order.rider || (order.rider as any)._id?.toString() !== userId && order.rider.toString() !== userId) {
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

    // Rich status-specific messages for the customer
    const customerMessages: Record<string, string> = {
      [OrderStatus.ACCEPTED]: `Order #${shortId} from ${outletName} has been accepted and is being prepared! (Est. prep time: ${prepTimeText})`,
      [OrderStatus.PREPARING]: `Order #${shortId} from ${outletName} is currently cooking! (Est. prep time: ${prepTimeText})`,
      [OrderStatus.READY]: `Order #${shortId} is ready and waiting for courier pickup at ${outletName}.`,
      [OrderStatus.READY_FOR_COLLECTION]: `Order #${shortId} is ready and waiting for courier pickup at ${outletName}.`,
      [OrderStatus.OUT_FOR_DELIVERY]: `Your order #${shortId} from ${outletName} has been picked up and is on its way to your address!`,
      [OrderStatus.DELIVERED]: `Your order #${shortId} from ${outletName} has been delivered. Enjoy your meal!`,
      [OrderStatus.CANCELLED]: `Your order #${shortId} from ${outletName} has been cancelled.`,
    };

    // Rich status-specific titles for customer in-app notifications
    const customerTitles: Record<string, string> = {
      [OrderStatus.ACCEPTED]: `Order Accepted & Preparing 🧑‍🍳`,
      [OrderStatus.PREPARING]: `Order Cooking 🍳`,
      [OrderStatus.READY]: `Order Ready for Pickup 📦`,
      [OrderStatus.READY_FOR_COLLECTION]: `Order Ready for Pickup 📦`,
      [OrderStatus.OUT_FOR_DELIVERY]: `Order Out for Delivery 🛵`,
      [OrderStatus.DELIVERED]: `Order Delivered 🎉`,
      [OrderStatus.CANCELLED]: `Order Cancelled ❌`,
    };

    // Rich status-specific messages for the vendor/outlet
    const vendorMessages: Record<string, string> = {
      [OrderStatus.ACCEPTED]: `You accepted order #${shortId}. Estimated prep time set to ${prepTimeText}.`,
      [OrderStatus.PREPARING]: `Order #${shortId} is marked as preparing.`,
      [OrderStatus.READY]: `Order #${shortId} marked ready. Waiting for courier pickup.`,
      [OrderStatus.READY_FOR_COLLECTION]: `Order #${shortId} marked ready. Waiting for courier pickup.`,
      [OrderStatus.OUT_FOR_DELIVERY]: `Order #${shortId} picked up by courier and on its way to customer.`,
      [OrderStatus.DELIVERED]: `Order #${shortId} delivered successfully!`,
      [OrderStatus.CANCELLED]: `Order #${shortId} has been cancelled.`,
    };

    // Notify Customer via Notification Service
    await notificationService.sendNotification(
      customerId,
      customerTitles[status] || `Order Update 🛵`,
      customerMessages[status] || `Your order #${shortId} status is now ${status.replace('_', ' ')}.`,
      { orderId: order._id.toString(), status, estimatedPrepTime: order.estimatedPrepTime, type: 'ORDER_UPDATE' },
      NotificationType.ORDER_UPDATE
    );

    // Emit Real-Time Socket Event to Customer
    emitToUser(customerId, SOCKET_EVENTS.ORDER_STATUS_UPDATE, {
      orderId: order._id.toString(),
      status,
      estimatedPrepTime: order.estimatedPrepTime,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
    });

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
    }

    // Notify Vendor/Outlet
    if (vendorUserId) {
      await notificationService.notifyVendorOrderUpdate(
        vendorUserId,
        order._id.toString(),
        status,
        vendorMessages[status] || `Order #${shortId} status: ${status.replace('_', ' ')}`
      );
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
   * Find and notify nearby riders about a ready order
   */
  private async notifyNearbyRiders(order: IOrder) {
    const restaurant = await Restaurant.findById(order.restaurant);
    if (!restaurant) return;

    // Find riders within Xkm who are online
    const riders = await User.find({
      role: UserRole.RIDER,
      isOnline: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: restaurant.location.coordinates,
          },
          $maxDistance: APP_CONSTANTS.MAX_RIDER_DISTANCE_METERS,
        },
      },
    });

    riders.forEach((rider) => {
      notificationService.notifyRiderAvailableOrder(rider._id.toString(), order._id.toString());
    });
  }

  /**
   * Assign a rider to an order
   */
  async assignRider(orderId: string, riderId: string): Promise<IOrder | null> {
    const order = await Order.findByIdAndUpdate(
      orderId,
      { rider: riderId, status: OrderStatus.COURIER_ASSIGNED },
      { new: true }
    ).populate('customer restaurant rider');

    if (order) {
      // Process courier pending earnings
      await settlementService.processCourierAssigned(order, riderId);

      // Notify Customer and Restaurant
      emitToUser(order.customer._id.toString(), SOCKET_EVENTS.RIDER_ASSIGNED, order.rider);
      const restaurant = await Restaurant.findById(order.restaurant);
      if (restaurant) {
        emitToUser(restaurant.owner.toString(), SOCKET_EVENTS.RIDER_ASSIGNED, order.rider);
      }
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
    return await Order.findById(orderId).populate('customer restaurant rider items.foodItem');
  }

  async getRestaurantOrders(restaurantId: string): Promise<IOrder[]> {
    return await Order.find({ restaurant: restaurantId }).sort({ createdAt: -1 });
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
      status: OrderStatus.PENDING
    };

    return await this.placeOrder(newOrderData);
  }
}

export default new OrderService();
