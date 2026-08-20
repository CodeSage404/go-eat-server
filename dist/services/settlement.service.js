"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const order_model_1 = require("../models/order.model");
const restaurant_model_1 = __importDefault(require("../models/restaurant.model"));
const wallet_model_1 = __importDefault(require("../models/wallet.model"));
const transaction_model_1 = __importStar(require("../models/transaction.model"));
const logger_1 = __importDefault(require("../utils/logger"));
class SettlementService {
    /**
     * Calculate Outlet Net Settlement
     * Net Settlement = Gross Order Value - (Gross Order Value * Commission Rate [15%])
     */
    calculateOutletSettlement(order) {
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
    async processOrderAccepted(order) {
        try {
            const breakdown = this.calculateOutletSettlement(order);
            order.grossAmount = breakdown.grossAmount;
            order.commissionRate = breakdown.commissionRate;
            order.commissionAmount = breakdown.commissionAmount;
            order.outletNetSettlement = breakdown.outletNetSettlement;
            order.courierEarnings = breakdown.courierEarnings;
            await order.save();
            const restaurant = await restaurant_model_1.default.findById(order.restaurant);
            if (restaurant && restaurant.owner) {
                let wallet = await wallet_model_1.default.findOne({ user: restaurant.owner });
                if (!wallet) {
                    wallet = await wallet_model_1.default.create({ user: restaurant.owner });
                }
                wallet.pendingBalance += breakdown.outletNetSettlement;
                await wallet.save();
                logger_1.default.info(`💰 Logged pending settlement of ${breakdown.outletNetSettlement} for outlet owner ${restaurant.owner}`);
            }
        }
        catch (err) {
            logger_1.default.error('❌ Error processing order accepted settlement:', err);
        }
    }
    /**
     * When a courier accepts/is assigned to an order:
     * Log estimated courier earnings in courier's pending balance.
     */
    async processCourierAssigned(order, riderId) {
        try {
            const earnings = order.deliveryFee || 0;
            let wallet = await wallet_model_1.default.findOne({ user: riderId });
            if (!wallet) {
                wallet = await wallet_model_1.default.create({ user: riderId });
            }
            wallet.pendingBalance += earnings;
            await wallet.save();
            logger_1.default.info(`🚴 Logged pending delivery earnings of ${earnings} for rider ${riderId}`);
        }
        catch (err) {
            logger_1.default.error('❌ Error processing courier assigned settlement:', err);
        }
    }
    /**
     * When an order is completed/delivered:
     * Transfer outlet net settlement from pending balance to available balance (deducting 15% commission).
     * Transfer courier earnings from pending balance to available balance.
     */
    async processOrderCompleted(order) {
        try {
            // Idempotency check: verify order hasn't already been settled
            const existingTx = await transaction_model_1.default.findOne({
                reference: order._id.toString(),
                type: transaction_model_1.TransactionType.SETTLEMENT,
            });
            if (existingTx || order.status === order_model_1.OrderStatus.COMPLETED) {
                logger_1.default.info(`ℹ️ Order #${order._id} already settled. Skipping duplicate completion processing.`);
                return;
            }
            const breakdown = this.calculateOutletSettlement(order);
            const restaurant = await restaurant_model_1.default.findById(order.restaurant);
            // 1. Process Outlet Settlement
            if (restaurant && restaurant.owner) {
                let wallet = await wallet_model_1.default.findOne({ user: restaurant.owner });
                if (!wallet) {
                    wallet = await wallet_model_1.default.create({ user: restaurant.owner });
                }
                // Deduct from pending and add to available balance
                wallet.pendingBalance = Math.max(0, wallet.pendingBalance - breakdown.outletNetSettlement);
                wallet.balance += breakdown.outletNetSettlement;
                wallet.availableBalance += breakdown.outletNetSettlement;
                await wallet.save();
                // Create transaction records
                await transaction_model_1.default.create({
                    wallet: wallet._id,
                    amount: breakdown.outletNetSettlement,
                    type: transaction_model_1.TransactionType.SETTLEMENT,
                    status: transaction_model_1.TransactionStatus.COMPLETED,
                    description: `Net settlement for completed order #${order._id.toString().substring(0, 6).toUpperCase()} (Gross: ${breakdown.grossAmount}, Commission 15%: -${breakdown.commissionAmount})`,
                    reference: order._id.toString(),
                });
            }
            // 2. Process Courier Settlement
            if (order.rider) {
                const riderId = order.rider?._id
                    ? order.rider._id.toString()
                    : order.rider.toString();
                let wallet = await wallet_model_1.default.findOne({ user: riderId });
                if (!wallet) {
                    wallet = await wallet_model_1.default.create({ user: riderId });
                }
                const earnings = breakdown.courierEarnings;
                wallet.pendingBalance = Math.max(0, wallet.pendingBalance - earnings);
                wallet.balance += earnings;
                wallet.availableBalance += earnings;
                await wallet.save();
                await transaction_model_1.default.create({
                    wallet: wallet._id,
                    amount: earnings,
                    type: transaction_model_1.TransactionType.EARNING,
                    status: transaction_model_1.TransactionStatus.COMPLETED,
                    description: `Delivery fee for completed order #${order._id.toString().substring(0, 6).toUpperCase()}`,
                    reference: order._id.toString(),
                });
            }
            order.status = order_model_1.OrderStatus.COMPLETED;
            await order.save();
        }
        catch (err) {
            logger_1.default.error('❌ Error processing order completion settlement:', err);
        }
    }
    /**
     * Cancellation Responsibility Matrix Processor
     * Resolves financial liability, refunds, and courier compensation based on pre-cancellation order stage & initiator.
     */
    async processOrderCancellation(order, initiator, reason, previousStatus) {
        let refundAmount = 0;
        let courierCompensation = 0;
        order.cancellationInitiator = initiator;
        order.cancelReason = reason;
        // Use previousStatus to accurately evaluate the stage reached before cancellation was requested
        const effectiveStatus = previousStatus || order.status;
        const breakdown = this.calculateOutletSettlement(order);
        // 1. Outlet Rejects / Cancels Before Acceptance
        if (effectiveStatus === order_model_1.OrderStatus.PENDING ||
            effectiveStatus === order_model_1.OrderStatus.PAYMENT_PENDING ||
            effectiveStatus === order_model_1.OrderStatus.SENT_TO_OUTLET) {
            refundAmount = order.totalAmount; // Full refund to customer
            order.status = order_model_1.OrderStatus.REJECTED;
        }
        // 2. Outlet Cancels After Acceptance / Preparation
        else if (initiator === 'outlet') {
            refundAmount = order.totalAmount; // Full refund to customer from outlet failure
            order.status = order_model_1.OrderStatus.CANCELLED_BY_OUTLET;
            // Reverse pending balance for outlet if accepted
            const restaurant = await restaurant_model_1.default.findById(order.restaurant);
            if (restaurant && restaurant.owner) {
                const wallet = await wallet_model_1.default.findOne({ user: restaurant.owner });
                if (wallet && breakdown.outletNetSettlement > 0) {
                    wallet.pendingBalance = Math.max(0, wallet.pendingBalance - breakdown.outletNetSettlement);
                    await wallet.save();
                }
            }
            // If courier was already assigned/dispatched, courier gets compensation
            if (order.rider) {
                courierCompensation = Math.round((order.deliveryFee || 0) * 0.8); // 80% compensation for dispatched courier
                const riderId = order.rider?._id
                    ? order.rider._id.toString()
                    : order.rider.toString();
                let riderWallet = await wallet_model_1.default.findOne({ user: riderId });
                if (!riderWallet)
                    riderWallet = await wallet_model_1.default.create({ user: riderId });
                riderWallet.balance += courierCompensation;
                riderWallet.availableBalance += courierCompensation;
                await riderWallet.save();
                await transaction_model_1.default.create({
                    wallet: riderWallet._id,
                    amount: courierCompensation,
                    type: transaction_model_1.TransactionType.CANCELLATION_COMPENSATION,
                    status: transaction_model_1.TransactionStatus.COMPLETED,
                    description: `Courier cancellation compensation for order #${order._id.toString().substring(0, 6).toUpperCase()}`,
                    reference: order._id.toString(),
                });
            }
        }
        // 3. Customer Cancels
        else if (initiator === 'customer') {
            order.status = order_model_1.OrderStatus.CANCELLED_BY_CUSTOMER;
            if (effectiveStatus === order_model_1.OrderStatus.ACCEPTED) {
                refundAmount = order.totalAmount; // Full refund if prep hasn't materially commenced
                const restaurant = await restaurant_model_1.default.findById(order.restaurant);
                if (restaurant && restaurant.owner) {
                    const wallet = await wallet_model_1.default.findOne({ user: restaurant.owner });
                    if (wallet && breakdown.outletNetSettlement > 0) {
                        wallet.pendingBalance = Math.max(0, wallet.pendingBalance - breakdown.outletNetSettlement);
                        await wallet.save();
                    }
                }
            }
            else if (effectiveStatus === order_model_1.OrderStatus.PREPARING ||
                effectiveStatus === order_model_1.OrderStatus.READY ||
                effectiveStatus === order_model_1.OrderStatus.READY_FOR_COLLECTION) {
                // Preparation started: Customer receives partial refund; outlet cost protected
                refundAmount = Math.round(order.totalAmount * 0.5); // 50% partial refund
                const restaurant = await restaurant_model_1.default.findById(order.restaurant);
                if (restaurant && restaurant.owner) {
                    let wallet = await wallet_model_1.default.findOne({ user: restaurant.owner });
                    if (wallet) {
                        wallet.pendingBalance = Math.max(0, wallet.pendingBalance - breakdown.outletNetSettlement);
                        wallet.balance += breakdown.outletNetSettlement;
                        wallet.availableBalance += breakdown.outletNetSettlement;
                        await wallet.save();
                    }
                }
            }
        }
        else {
            order.status = order_model_1.OrderStatus.CANCELLED_BY_GOEAT;
            refundAmount = order.totalAmount;
        }
        // Always clear courier pending earnings if rider was assigned and not compensated
        if (order.rider && courierCompensation === 0) {
            const riderId = order.rider?._id
                ? order.rider._id.toString()
                : order.rider.toString();
            const riderWallet = await wallet_model_1.default.findOne({ user: riderId });
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
exports.default = new SettlementService();
