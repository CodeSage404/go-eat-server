import axios from 'axios';
import crypto from 'crypto';
import AppError from '../utils/appError';
import Order, { OrderStatus } from '../models/order.model';
import User from '../models/user.model';
import notificationService from './notification.service';

class PaymentService {
  private readonly secretKey = process.env.PAYSTACK_SECRET_KEY || 'sk_test_placeholder';
  private readonly baseUrl = 'https://api.paystack.co';

  /**
   * Initialize a Paystack transaction for an order
   */
  async initializePayment(orderId: string, userId: string): Promise<any> {
    const order = await Order.findById(orderId);
    if (!order) throw new AppError('Order not found', 404);

    if (order.customer.toString() !== userId) {
      throw new AppError('Unauthorized', 403);
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new AppError('This order cannot be paid for in its current state', 400);
    }

    const user = await User.findById(userId);
    if (!user) throw new AppError('User not found', 404);

    // Paystack amounts are in kobo (multiply by 100)
    const amountInKobo = Math.round(order.totalAmount * 100);

    try {
      const response = await axios.post(
        `${this.baseUrl}/transaction/initialize`,
        {
          email: user.email,
          amount: amountInKobo,
          reference: `ORD_${order._id}_${Date.now()}`,
          metadata: {
            orderId: order._id,
            customerId: user._id,
          },
          // callback_url: 'https://yourfrontend.com/payment/verify' // Will be added later
        },
        {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.data;
    } catch (error: any) {
      console.error('Paystack initialization error:', error.response?.data || error.message);
      throw new AppError('Payment initialization failed', 500);
    }
  }

  /**
   * Process incoming Paystack Webhook
   */
  async processWebhook(event: any, signature: string): Promise<void> {
    // Verify Signature
    const hash = crypto
      .createHmac('sha512', this.secretKey)
      .update(JSON.stringify(event))
      .digest('hex');

    if (hash !== signature) {
      throw new AppError('Invalid webhook signature', 400);
    }

    // Handle successful payment event
    if (event.event === 'charge.success') {
      const { reference, metadata } = event.data;
      const orderId = metadata.orderId;

      const order = await Order.findById(orderId);
      if (order && order.status === OrderStatus.PENDING) {
        // Mark order as accepted (payment verified)
        order.status = OrderStatus.ACCEPTED;
        order.paymentResult = {
          id: event.data.id.toString(),
          status: 'success',
          update_time: new Date().toISOString(),
          email_address: event.data.customer.email,
        };
        await order.save();

        // Notify Restaurant and Customer
        await notificationService.notifyNewOrder(order.restaurant.toString(), order._id.toString());
        await notificationService.notifyOrderStatusUpdate(
          order.customer.toString(),
          order._id.toString(),
          order.status
        );
      }
    }
  }
}

export default new PaymentService();
