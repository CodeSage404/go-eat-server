import Order, { IOrder, OrderStatus } from '../models/order.model';
import Restaurant from '../models/restaurant.model';
import Wallet, { IWallet } from '../models/wallet.model';
import Transaction, { TransactionType, TransactionStatus } from '../models/transaction.model';
import logger from '../utils/logger';

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
    const courierEarnings = (order.deliveryFee || 0);

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

      const restaurant = await Restaurant.findById(order.restaurant);
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
      const earnings = order.deliveryFee || 0;
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
      const restaurant = await Restaurant.findById(order.restaurant);

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
          : order.rider.toString();

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
      const restaurant = await Restaurant.findById(order.restaurant);
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
          : order.rider.toString();

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
        const restaurant = await Restaurant.findById(order.restaurant);
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

        const restaurant = await Restaurant.findById(order.restaurant);
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
        : order.rider.toString();

      const riderWallet = await Wallet.findOne({ user: riderId });
      if (riderWallet && breakdown.courierEarnings > 0) {
        riderWallet.pendingBalance = Math.max(0, riderWallet.pendingBalance - breakdown.courierEarnings);
        await riderWallet.save();
      }
    }

    order.refundAmount = refundAmount;
    await order.save();

    return { refundAmount, courierCompensation };
  }
}

export default new SettlementService();
