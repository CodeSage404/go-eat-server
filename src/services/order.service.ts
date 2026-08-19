import Order, { IOrder, OrderStatus } from '../models/order.model';
import Restaurant from '../models/restaurant.model';
import User, { UserRole } from '../models/user.model';
import { emitToUser } from '../io';
import notificationService from './notification.service';
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
  async updateOrderStatus(orderId: string, status: OrderStatus, userId: string, role: string): Promise<IOrder | null> {
    const order = await Order.findById(orderId).populate('customer restaurant rider');
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    // Production-grade permission and status flow validation
    if (role === 'vendor') {
      // order.restaurant may be a populated document or a plain ObjectId — extract the ID safely
      const restaurantId = (order.restaurant as any)?._id
        ? (order.restaurant as any)._id.toString()
        : order.restaurant.toString();

      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant || restaurant.owner.toString() !== userId.toString()) {
        throw new AppError("You do not have permission to manage this outlet's orders", 403);
      }

      const allowedVendorStatuses = [OrderStatus.ACCEPTED, OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.CANCELLED];
      if (!allowedVendorStatuses.includes(status)) {
        throw new AppError(`Outlets cannot set order status to ${status}`, 400);
      }
    }
    else if (role === 'rider') {
      if (!order.rider || order.rider._id.toString() !== userId) {
        throw new AppError('You are not the assigned courier for this order', 403);
      }

      const allowedRiderStatuses = [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED, OrderStatus.CANCELLED];
      if (!allowedRiderStatuses.includes(status)) {
        throw new AppError(`Couriers cannot set order status to ${status}`, 400);
      }
    }
    else if (role !== 'admin') {
      throw new AppError('Unauthorized to update order status', 403);
    }

    order.status = status;
    await order.save();

    // Notify Customer via Push and Socket
    await notificationService.notifyOrderStatusUpdate(
      order.customer._id.toString(),
      order._id.toString(),
      order.status
    );

    // If order is DELIVERED, credit the Rider's wallet
    if (status === OrderStatus.DELIVERED && order.rider) {
      const riderId = order.rider._id.toString();
      let wallet = await Wallet.findOne({ user: riderId });
      if (!wallet) wallet = await Wallet.create({ user: riderId });

      wallet.balance += order.deliveryFee || 0;
      await wallet.save();

      await Transaction.create({
        wallet: wallet._id,
        amount: order.deliveryFee || 0,
        type: TransactionType.EARNING,
        status: TransactionStatus.COMPLETED,
        description: `Delivery fee for order ${order._id}`,
        reference: order._id.toString(),
      });
    }

    // If order is READY, notify nearby riders
    if (status === OrderStatus.READY) {
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
      { rider: riderId, status: OrderStatus.ACCEPTED },
      { new: true }
    ).populate('customer restaurant rider');

    if (order) {
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
