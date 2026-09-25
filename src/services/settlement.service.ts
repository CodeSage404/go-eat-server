import Order, { IOrder, OrderStatus } from '../models/order.model';
import Restaurant from '../models/restaurant.model';
import Wallet, { IWallet } from '../models/wallet.model';
import Transaction, { TransactionType, TransactionStatus } from '../models/transaction.model';
import logger from '../utils/logger';
import paymentService from './payment.service';

class SettlementService {
  /**
   * Calculate Outlet Net Settlement
   * Net Settlement = Gross Order Value - (Gross Order Value * Commission Rate [15%])
   */
  public calculateOutletSettlement(order: IOrder): {
    grossAmount: number;
    commissionRate: number;
    commissionAmount: number;
    outletNetSettlement: number;
    courierEarnings: number;
  } {
    const grossAmount = order.totalAmount || 0;
    const commissionRate = order.commissionRate || 0.15; // Default 15%
    const commissionAmount = Math.round(grossAmount * commissionRate * 100) / 100;
    const outletNetSettlement = Math.max(0, Math.round((grossAmount - commissionAmount) * 100) / 100);
    const courierEarnings = (order.deliveryFee || 0) + (order.tipAmount || 0);

    return {
      grossAmount,
      commissionRate,
      commissionAmount,
      outletNetSettlement,
      courierEarnings,
    };
  }

  /**
   * When an outlet accepts an order:
   * Calculate financial breakdown and log expected proceeds in outlet's pending balance.
   */
  public async processOrderAccepted(order: IOrder): Promise<void> {
    try {
      const breakdown = this.calculateOutletSettlement(order);
      
      order.grossAmount = breakdown.grossAmount;
      order.commissionRate = breakdown.commissionRate;
      order.commissionAmount = breakdown.commissionAmount;
      order.outletNetSettlement = breakdown.outletNetSettlement;
      order.courierEarnings = breakdown.courierEarnings;
      await order.save();

      const restaurantId = (order.restaurant as any)?._id || order.restaurant;
      const restaurant = restaurantId ? await Restaurant.findById(restaurantId) : null;
      if (restaurant && restaurant.owner) {
        let wallet = await Wallet.findOne({ user: restaurant.owner });
        if (!wallet) {
          wallet = await Wallet.create({ user: restaurant.owner });
        }

        wallet.pendingBalance += breakdown.outletNetSettlement;
        await wallet.save();

        logger.info(`💰 Logged pending settlement of ${breakdown.outletNetSettlement} for outlet owner ${restaurant.owner}`);
      }
    } catch (err) {
      logger.error('❌ Error processing order accepted settlement:', err);
    }
  }

  /**
   * When a courier accepts/is assigned to an order:
   * Log estimated courier earnings in courier's pending balance.
   */
  public async processCourierAssigned(order: IOrder, riderId: string): Promise<void> {
    try {
      const earnings = (order.deliveryFee || 0) + (order.tipAmount || 0);
      let wallet = await Wallet.findOne({ user: riderId });
      if (!wallet) {
        wallet = await Wallet.create({ user: riderId });
      }

      wallet.pendingBalance += earnings;
      await wallet.save();

      logger.info(`🚴 Logged pending delivery earnings of ${earnings} for rider ${riderId}`);
    } catch (err) {
      logger.error('❌ Error processing courier assigned settlement:', err);
    }
  }

  /**
   * When an order is completed/delivered:
   * Transfer outlet net settlement from pending balance to available balance (deducting 15% commission).
   * Transfer courier earnings from pending balance to available balance.
   */
  public async processOrderCompleted(order: IOrder): Promise<void> {
    try {
      // Idempotency check: verify order hasn't already been settled
      const existingTx = await Transaction.findOne({
        reference: order._id.toString(),
        type: TransactionType.SETTLEMENT,
      });

      if (existingTx || order.status === OrderStatus.COMPLETED) {
        logger.info(`ℹ️ Order #${order._id} already settled. Skipping duplicate completion processing.`);
        return;
      }

      const breakdown = this.calculateOutletSettlement(order);
      const restaurantId = (order.restaurant as any)?._id || order.restaurant;
      const restaurant = restaurantId ? await Restaurant.findById(restaurantId) : null;

      // 1. Process Outlet Settlement
      if (restaurant && restaurant.owner) {
        let wallet = await Wallet.findOne({ user: restaurant.owner });
        if (!wallet) {
          wallet = await Wallet.create({ user: restaurant.owner });
        }

        // Deduct from pending and add to available balance
        wallet.pendingBalance = Math.max(0, wallet.pendingBalance - breakdown.outletNetSettlement);
        wallet.balance += breakdown.outletNetSettlement;
        wallet.availableBalance += breakdown.outletNetSettlement;
        await wallet.save();

        // Create transaction records
        await Transaction.create({
          wallet: wallet._id,
          amount: breakdown.outletNetSettlement,
          type: TransactionType.SETTLEMENT,
          status: TransactionStatus.COMPLETED,
          description: `Net settlement for completed order #${order._id.toString().substring(0, 6).toUpperCase()} (Gross: ${breakdown.grossAmount}, Commission 15%: -${breakdown.commissionAmount})`,
          reference: order._id.toString(),
        });
      }

      // 2. Process Courier Settlement
      if (order.rider) {
        const riderId = (order.rider as any)?._id
          ? (order.rider as any)._id.toString()
          : order.rider?.toString?.() || String(order.rider);

        let wallet = await Wallet.findOne({ user: riderId });
        if (!wallet) {
          wallet = await Wallet.create({ user: riderId });
        }

        const earnings = breakdown.courierEarnings;
        wallet.pendingBalance = Math.max(0, wallet.pendingBalance - earnings);
        wallet.balance += earnings;
        wallet.availableBalance += earnings;
        await wallet.save();

        await Transaction.create({
          wallet: wallet._id,
          amount: earnings,
          type: TransactionType.EARNING,
          status: TransactionStatus.COMPLETED,
          description: `Delivery fee for completed order #${order._id.toString().substring(0, 6).toUpperCase()}`,
          reference: order._id.toString(),
        });
      }

      order.status = OrderStatus.COMPLETED;
      await order.save();
    } catch (err) {
      logger.error('❌ Error processing order completion settlement:', err);
    }
  }

  /**
   * Cancellation Responsibility Matrix Processor
   * Resolves financial liability, refunds, and courier compensation based on pre-cancellation order stage & initiator.
   */
  public async processOrderCancellation(
    order: IOrder,
    initiator: 'customer' | 'outlet' | 'courier' | 'goeat',
    reason: string,
    previousStatus?: OrderStatus
  ): Promise<{ refundAmount: number; courierCompensation: number }> {
    let refundAmount = 0;
    let courierCompensation = 0;

    order.cancellationInitiator = initiator;
    order.cancelReason = reason;

    // Use previousStatus to accurately evaluate the stage reached before cancellation was requested
    const effectiveStatus = previousStatus || order.status;
    const breakdown = this.calculateOutletSettlement(order);

    // 1. Outlet Rejects / Cancels Before Acceptance
    if (
      effectiveStatus === OrderStatus.PENDING ||
      effectiveStatus === OrderStatus.PAYMENT_PENDING ||
      effectiveStatus === OrderStatus.SENT_TO_OUTLET
    ) {
      refundAmount = order.totalAmount; // Full refund to customer
      order.status = OrderStatus.REJECTED;
    }
    // 2. Outlet Cancels After Acceptance / Preparation
    else if (initiator === 'outlet') {
      refundAmount = order.totalAmount; // Full refund to customer from outlet failure
      order.status = OrderStatus.CANCELLED_BY_OUTLET;

      // Reverse pending balance for outlet if accepted
      const restaurantId = (order.restaurant as any)?._id || order.restaurant;
      const restaurant = restaurantId ? await Restaurant.findById(restaurantId) : null;
      if (restaurant && restaurant.owner) {
        const wallet = await Wallet.findOne({ user: restaurant.owner });
        if (wallet && breakdown.outletNetSettlement > 0) {
          wallet.pendingBalance = Math.max(0, wallet.pendingBalance - breakdown.outletNetSettlement);
          await wallet.save();
        }
      }

      // If courier was already assigned/dispatched, courier gets compensation
      if (order.rider) {
        courierCompensation = Math.round((order.deliveryFee || 0) * 0.8); // 80% compensation for dispatched courier
        const riderId = (order.rider as any)?._id
          ? (order.rider as any)._id.toString()
          : order.rider?.toString?.() || String(order.rider);

        let riderWallet = await Wallet.findOne({ user: riderId });
        if (!riderWallet) riderWallet = await Wallet.create({ user: riderId });

        riderWallet.balance += courierCompensation;
        riderWallet.availableBalance += courierCompensation;
        await riderWallet.save();

        await Transaction.create({
          wallet: riderWallet._id,
          amount: courierCompensation,
          type: TransactionType.CANCELLATION_COMPENSATION,
          status: TransactionStatus.COMPLETED,
          description: `Courier cancellation compensation for order #${order._id.toString().substring(0, 6).toUpperCase()}`,
          reference: order._id.toString(),
        });
      }
    }
    // 3. Customer Cancels
    else if (initiator === 'customer') {
      order.status = OrderStatus.CANCELLED_BY_CUSTOMER;

      if (effectiveStatus === OrderStatus.ACCEPTED) {
        refundAmount = order.totalAmount; // Full refund if prep hasn't materially commenced
        const restaurantId = (order.restaurant as any)?._id || order.restaurant;
        const restaurant = restaurantId ? await Restaurant.findById(restaurantId) : null;
        if (restaurant && restaurant.owner) {
          const wallet = await Wallet.findOne({ user: restaurant.owner });
          if (wallet && breakdown.outletNetSettlement > 0) {
            wallet.pendingBalance = Math.max(0, wallet.pendingBalance - breakdown.outletNetSettlement);
            await wallet.save();
          }
        }
      } else if (
        effectiveStatus === OrderStatus.PREPARING ||
        effectiveStatus === OrderStatus.READY ||
        effectiveStatus === OrderStatus.READY_FOR_COLLECTION
      ) {
        // Preparation started: Customer receives partial refund; outlet cost protected
        refundAmount = Math.round(order.totalAmount * 0.5); // 50% partial refund

        const restaurantId = (order.restaurant as any)?._id || order.restaurant;
        const restaurant = restaurantId ? await Restaurant.findById(restaurantId) : null;
        if (restaurant && restaurant.owner) {
          let wallet = await Wallet.findOne({ user: restaurant.owner });
          if (wallet) {
            wallet.pendingBalance = Math.max(0, wallet.pendingBalance - breakdown.outletNetSettlement);
            wallet.balance += breakdown.outletNetSettlement;
            wallet.availableBalance += breakdown.outletNetSettlement;
            await wallet.save();
          }
        }
      }
    } else {
      order.status = OrderStatus.CANCELLED_BY_GOEAT;
      refundAmount = order.totalAmount;
    }

    // Always clear courier pending earnings if rider was assigned and not compensated
    if (order.rider && courierCompensation === 0) {
      const riderId = (order.rider as any)?._id
        ? (order.rider as any)._id.toString()
        : order.rider?.toString?.() || String(order.rider);

      const riderWallet = await Wallet.findOne({ user: riderId });
      if (riderWallet && breakdown.courierEarnings > 0) {
        riderWallet.pendingBalance = Math.max(0, riderWallet.pendingBalance - breakdown.courierEarnings);
        await riderWallet.save();
      }
    }

    order.refundAmount = refundAmount;

    // Credit Customer In-App Wallet for immediate refund access
    if (refundAmount > 0 && order.customer) {
      try {
        const customerId = (order.customer as any)?._id
          ? (order.customer as any)._id.toString()
          : order.customer?.toString?.() || String(order.customer);

        let customerWallet = await Wallet.findOne({ user: customerId });
        if (!customerWallet) {
          customerWallet = await Wallet.create({ user: customerId });
        }

        customerWallet.balance += refundAmount;
        customerWallet.availableBalance += refundAmount;
        await customerWallet.save();

        await Transaction.create({
          wallet: customerWallet._id,
          amount: refundAmount,
          type: TransactionType.REFUND,
          status: TransactionStatus.COMPLETED,
          description: `Refund for cancelled order #${order._id.toString().substring(0, 6).toUpperCase()}${reason ? `: ${reason}` : ''}`,
          reference: order._id.toString(),
        });

        order.paymentStatus = 'refunded';
        logger.info(`✅ Processed full refund of NGN ${refundAmount} to customer ${customerId} for order ${order._id}`);
      } catch (refundErr) {
        logger.error('❌ Error crediting customer wallet during cancellation refund:', refundErr);
      }

      // Also initiate direct gateway refund back to card/bank via Stripe / Paystack
      try {
        await paymentService.processGatewayRefund(order, refundAmount, reason || 'Order cancelled');
      } catch (gwErr: any) {
        logger.error('❌ Error in payment gateway refund:', gwErr.message);
      }
    }

    await order.save();

    return { refundAmount, courierCompensation };
  }

  /**
   * Transparently calculates cancellation eligibility and refund breakdown for an active order
   */
  public calculateCancellationPreview(order: IOrder): {
    eligible: boolean;
    refundAmount: number;
    refundType: 'full' | 'partial' | 'none';
    message: string;
    canContactSupport: boolean;
  } {
    const status = order.status;
    const isPaid = order.paymentStatus === 'completed';
    const total = order.totalAmount || 0;
    const currencySymbol = String(order.currency).toUpperCase() === 'NGN' ? '₦' : '£';

    // 1. Orders out for delivery or completed
    if (
      status === OrderStatus.OUT_FOR_DELIVERY ||
      status === OrderStatus.COURIER_COLLECTED ||
      status === OrderStatus.DELIVERED ||
      status === OrderStatus.COMPLETED
    ) {
      return {
        eligible: false,
        refundAmount: 0,
        refundType: 'none',
        message: 'This order is no longer eligible for cancellation.',
        canContactSupport: true,
      };
    }

    // 2. Already cancelled
    if (
      status === OrderStatus.CANCELLED ||
      status === OrderStatus.CANCELLED_BY_CUSTOMER ||
      status === OrderStatus.CANCELLED_BY_OUTLET ||
      status === OrderStatus.CANCELLED_BY_GOEAT ||
      status === OrderStatus.REJECTED
    ) {
      return {
        eligible: false,
        refundAmount: 0,
        refundType: 'none',
        message: 'This order has already been cancelled.',
        canContactSupport: false,
      };
    }

    // 3. Before prep: 100% full refund
    if (
      status === OrderStatus.PENDING ||
      status === OrderStatus.PAYMENT_PENDING ||
      status === OrderStatus.SENT_TO_OUTLET ||
      status === OrderStatus.ACCEPTED
    ) {
      return {
        eligible: true,
        refundAmount: isPaid ? total : 0,
        refundType: isPaid ? 'full' : 'none',
        message: isPaid
          ? `Full refund of ${currencySymbol}${total.toFixed(2)} will be returned to your original payment method.`
          : 'Order will be cancelled without charge.',
        canContactSupport: false,
      };
    }

    // 4. In prep / ready: 50% partial refund
    if (
      status === OrderStatus.PREPARING ||
      status === OrderStatus.READY ||
      status === OrderStatus.READY_FOR_COLLECTION
    ) {
      const partialAmount = Math.round(total * 0.5 * 100) / 100;
      return {
        eligible: true,
        refundAmount: isPaid ? partialAmount : 0,
        refundType: isPaid ? 'partial' : 'none',
        message: isPaid
          ? `Partial refund: ${currencySymbol}${partialAmount.toFixed(2)} (covers kitchen food preparation costs).`
          : 'Order will be cancelled.',
        canContactSupport: true,
      };
    }

    return {
      eligible: false,
      refundAmount: 0,
      refundType: 'none',
      message: 'This order is no longer eligible for cancellation.',
      canContactSupport: true,
    };
  }
}

export default new SettlementService();
