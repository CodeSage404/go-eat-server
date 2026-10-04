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
const wallet_model_1 = __importDefault(require("../models/wallet.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const transaction_model_1 = __importStar(require("../models/transaction.model"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const paystack_module_1 = __importDefault(require("../services/payments/paystack.module"));
const stripe_module_1 = __importDefault(require("../services/payments/stripe.module"));
const locationResolver_1 = require("../utils/locationResolver");
const notification_service_1 = __importDefault(require("../services/notification.service"));
const email_service_1 = __importDefault(require("../services/email.service"));
const order_model_1 = __importDefault(require("../models/order.model"));
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = __importDefault(require("../utils/logger"));
class WalletController {
    constructor() {
        /**
         * Get my wallet, settlement balances, and recent transactions
         */
        this.getMyWallet = (0, catchAsync_1.catchAsync)(async (req, res) => {
            let wallet = await wallet_model_1.default.findOne({ user: req.user._id });
            // Auto-create wallet if it doesn't exist
            if (!wallet) {
                wallet = await wallet_model_1.default.create({ user: req.user._id });
            }
            const userDoc = await user_model_1.default.findById(req.user._id).select('hasWithdrawalPin');
            const hasWithdrawalPin = Boolean(userDoc?.hasWithdrawalPin);
            const transactions = await transaction_model_1.default.find({ wallet: wallet._id })
                .sort({ createdAt: -1 })
                .limit(30);
            res.status(200).json({
                status: 'success',
                data: {
                    wallet: {
                        _id: wallet._id,
                        user: wallet.user,
                        balance: wallet.balance,
                        availableBalance: wallet.availableBalance || wallet.balance,
                        pendingBalance: wallet.pendingBalance || 0,
                        currency: wallet.currency,
                        bankAccount: wallet.bankAccount,
                        bankDetails: wallet.bankAccount,
                        isSettlementOnHold: wallet.isSettlementOnHold || false,
                        holdReason: wallet.holdReason,
                        lastPayoutDate: wallet.lastPayoutDate,
                        isActive: wallet.isActive,
                        hasWithdrawalPin,
                        createdAt: wallet.createdAt,
                        updatedAt: wallet.updatedAt,
                    },
                    hasWithdrawalPin,
                    transactions,
                },
            });
        });
        /**
         * Request a withdrawal from Available Balance
         * Enforces GoEat Operational Policy Section 6:
         * - Withdrawals cannot be made from Pending Balance.
         * - Blocked if settlement is on hold.
         */
        this.requestWithdrawal = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { amount, pin } = req.body;
            if (!amount || amount <= 0) {
                throw new appError_1.default('A valid withdrawal amount is required', 400);
            }
            // Security Verification: Require 4-digit withdrawal PIN
            const userDoc = await user_model_1.default.findById(req.user._id).select('+withdrawalPin');
            if (!userDoc || !userDoc.hasWithdrawalPin || !userDoc.withdrawalPin) {
                throw new appError_1.default('Please set up a withdrawal PIN before requesting a withdrawal', 403);
            }
            if (!pin || pin.toString().length !== 4) {
                throw new appError_1.default('Please enter your 4-digit withdrawal PIN', 400);
            }
            const isPinCorrect = await userDoc.compareWithdrawalPin(pin.toString());
            if (!isPinCorrect) {
                throw new appError_1.default('Incorrect withdrawal PIN. Please try again.', 400);
            }
            // Atomically check available balance and deduct in a single database operation to prevent race conditions
            const wallet = await wallet_model_1.default.findOneAndUpdate({
                user: req.user._id,
                isSettlementOnHold: { $ne: true },
                $or: [
                    { availableBalance: { $gte: amount } },
                    { availableBalance: { $exists: false }, balance: { $gte: amount } },
                ],
            }, {
                $inc: { balance: -amount, availableBalance: -amount },
                $set: { lastPayoutDate: new Date() },
            }, { new: true });
            if (!wallet) {
                // Find wallet to provide a specific, informative error message
                const existingWallet = await wallet_model_1.default.findOne({ user: req.user._id });
                if (!existingWallet) {
                    throw new appError_1.default('Wallet not found', 404);
                }
                if (existingWallet.isSettlementOnHold) {
                    throw new appError_1.default(`Settlement is temporarily on hold: ${existingWallet.holdReason || 'Account investigation or dispute'}`, 400);
                }
                const currentAvailable = existingWallet.availableBalance ?? existingWallet.balance ?? 0;
                throw new appError_1.default(`Insufficient available balance. Available: ₦${currentAvailable.toLocaleString()}, Requested: ₦${amount.toLocaleString()}. (Note: Pending funds cannot be withdrawn until order completion).`, 400);
            }
            // Create withdrawal transaction
            const transaction = await transaction_model_1.default.create({
                wallet: wallet._id,
                amount,
                type: transaction_model_1.TransactionType.WITHDRAWAL,
                status: transaction_model_1.TransactionStatus.PENDING,
                description: 'Payout to verified bank account',
                reference: `WDR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
            });
            // Send email receipt to user mailbox
            if (req.user?.email) {
                const userDoc = await user_model_1.default.findById(req.user._id);
                const recipientName = userDoc?.name || 'Valued Partner';
                const bankAcc = wallet.bankAccount;
                const currencySymbol = wallet.currency === 'GBP' ? '£' : wallet.currency === 'EUR' ? '€' : wallet.currency === 'USD' ? '$' : '₦';
                email_service_1.default.sendWithdrawalReceipt(req.user.email, {
                    userName: recipientName,
                    reference: transaction.reference || transaction._id.toString().slice(-8).toUpperCase(),
                    date: new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
                    bankName: bankAcc?.bankName || 'Verified Bank Account',
                    accountNumber: bankAcc?.accountNumber || '••••',
                    accountName: bankAcc?.accountName || recipientName,
                    status: 'Processing',
                    currencySymbol,
                    amount,
                }).catch(err => logger_1.default.error('Failed to dispatch withdrawal receipt email:', err));
            }
            // Notify user via In-App, Real-Time Socket, and Push Notification
            notification_service_1.default.notifyWalletTransaction(req.user._id.toString(), 'Withdrawal Initiated 💸', `Your payout request of ₦${amount.toLocaleString()} has been received and processed.`, amount, transaction._id.toString()).catch(() => { });
            res.status(200).json({
                status: 'success',
                data: {
                    wallet: {
                        _id: wallet._id,
                        balance: wallet.balance,
                        availableBalance: wallet.availableBalance,
                        pendingBalance: wallet.pendingBalance,
                        lastPayoutDate: wallet.lastPayoutDate,
                    },
                    transaction,
                },
            });
        });
        /**
         * Update Bank Details (Multi-country support: Nigeria, UK, Italy, International)
         */
        this.updateBankDetails = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { accountNumber, bankCode, accountName, bankName, bankSlug, bankLogo, sortCode, routingNumber, iban, countryCode, provider, } = req.body;
            if (!accountNumber || !accountName) {
                throw new appError_1.default('accountNumber and accountName are required', 400);
            }
            const loc = (0, locationResolver_1.resolveRequestLocation)(req);
            const activeCountry = (countryCode || loc.countryCode || 'NG').toUpperCase();
            const effectiveBankCode = bankCode || sortCode || (iban ? iban.slice(5, 10) : 'INTERNATIONAL');
            let wallet = await wallet_model_1.default.findOne({ user: req.user._id });
            if (!wallet) {
                wallet = await wallet_model_1.default.create({ user: req.user._id });
            }
            wallet.bankAccount = {
                accountNumber: String(accountNumber).trim(),
                bankCode: effectiveBankCode,
                accountName: String(accountName).trim(),
                bankName: bankName || (activeCountry === 'GB' ? 'UK Bank' : activeCountry === 'IT' ? 'Italian Bank' : undefined),
                bankSlug: bankSlug ? String(bankSlug).trim() : undefined,
                bankLogo: bankLogo ? String(bankLogo).trim() : undefined,
                recipientCode: undefined, // reset recipient code so it gets regenerated on next payout
                routingNumber: routingNumber ? String(routingNumber).trim() : undefined,
                sortCode: sortCode ? String(sortCode).trim() : undefined,
                iban: iban ? String(iban).trim() : undefined,
                countryCode: activeCountry,
                provider: provider || (activeCountry === 'NG' ? 'paystack' : 'stripe'),
            };
            await wallet.save();
            res.status(200).json({
                status: 'success',
                message: 'Bank details updated successfully',
                data: {
                    wallet: {
                        ...wallet.toObject(),
                        bankDetails: wallet.bankAccount,
                    },
                },
            });
        });
        /**
         * Get List of Supported Banks based on User Country / Region
         */
        this.getBanks = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const loc = (0, locationResolver_1.resolveRequestLocation)(req);
            const countryCode = (req.query.countryCode || loc.countryCode || 'NG').toUpperCase();
            if (countryCode === 'GB' || countryCode === 'UK') {
                const banks = stripe_module_1.default.getBanksByCountry('GB');
                return res.status(200).json({
                    status: 'success',
                    results: banks.length,
                    data: banks,
                });
            }
            else if (countryCode === 'IT') {
                const banks = stripe_module_1.default.getBanksByCountry('IT');
                return res.status(200).json({
                    status: 'success',
                    results: banks.length,
                    data: banks,
                });
            }
            else if (countryCode === 'US') {
                const banks = stripe_module_1.default.getBanksByCountry('US');
                return res.status(200).json({
                    status: 'success',
                    results: banks.length,
                    data: banks,
                });
            }
            const country = req.query.country || (countryCode === 'GH' ? 'ghana' : 'nigeria');
            const banks = await paystack_module_1.default.getBanks(country);
            res.status(200).json({
                status: 'success',
                results: banks.length,
                data: banks,
            });
        });
        /**
         * Check if authenticated user has set up a withdrawal PIN
         */
        this.checkWithdrawalPin = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const user = await user_model_1.default.findById(req.user._id).select('hasWithdrawalPin');
            res.status(200).json({
                status: 'success',
                data: {
                    hasWithdrawalPin: Boolean(user?.hasWithdrawalPin),
                },
            });
        });
        /**
         * Set or update withdrawal PIN
         */
        this.setWithdrawalPin = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { pin, currentPin } = req.body;
            const pinStr = pin ? pin.toString().trim() : '';
            if (!pinStr || pinStr.length !== 4 || !/^\d{4}$/.test(pinStr)) {
                throw new appError_1.default('Withdrawal PIN must be exactly 4 numeric digits', 400);
            }
            // Obvious / weak PIN check:
            // 1. All 4 digits identical (e.g. 0000, 1111, 2222, 3333, 9999)
            // 2. Sequential numbers ascending or descending (e.g. 0123, 1234, 2345, ..., 9876, 4321)
            // 3. Three identical consecutive digits (e.g. 2000, 5444, 1112, 9000)
            const isAllSame = /^(\d)\1{3}$/.test(pinStr);
            const isSequentialAscending = '0123456789'.includes(pinStr);
            const isSequentialDescending = '9876543210'.includes(pinStr);
            const hasThreeConsecutiveSame = /^(\d)\1{2}\d$/.test(pinStr) || /^\d(\d)\1{2}$/.test(pinStr);
            if (isAllSame || isSequentialAscending || isSequentialDescending || hasThreeConsecutiveSame) {
                throw new appError_1.default('This PIN is too simple or predictable (e.g. repeated or sequential digits). Please choose a stronger 4-digit PIN.', 400);
            }
            const user = await user_model_1.default.findById(req.user._id).select('+withdrawalPin +password');
            if (!user) {
                throw new appError_1.default('User not found', 404);
            }
            // If user already has a withdrawal PIN, require verification of the current PIN
            if (user.hasWithdrawalPin && user.withdrawalPin) {
                if (!currentPin) {
                    throw new appError_1.default('Please provide your current 4-digit PIN to update your PIN', 400);
                }
                const isCurrentCorrect = await user.compareWithdrawalPin(currentPin.toString());
                if (!isCurrentCorrect) {
                    throw new appError_1.default('Current withdrawal PIN is incorrect', 400);
                }
            }
            user.withdrawalPin = pin.toString();
            user.hasWithdrawalPin = true;
            await user.save();
            res.status(200).json({
                status: 'success',
                message: 'Withdrawal PIN configured successfully',
                data: {
                    hasWithdrawalPin: true,
                },
            });
        });
        /**
         * Get single transaction details / receipt
         */
        this.getTransactionById = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const id = req.params.id;
            if (!id || !mongoose_1.default.Types.ObjectId.isValid(id)) {
                throw new appError_1.default('Invalid transaction ID', 400);
            }
            const wallet = await wallet_model_1.default.findOne({ user: req.user._id });
            if (!wallet) {
                throw new appError_1.default('Wallet not found', 404);
            }
            const transaction = await transaction_model_1.default.findOne({ _id: id, wallet: wallet._id });
            if (!transaction) {
                throw new appError_1.default('Transaction not found', 404);
            }
            // If transaction has reference and it could be an Order ID, attempt to populate linked order details
            let orderDetails = null;
            if (transaction.reference) {
                const cleanRef = transaction.reference.trim();
                if (mongoose_1.default.Types.ObjectId.isValid(cleanRef)) {
                    orderDetails = await order_model_1.default.findById(cleanRef)
                        .populate('restaurant', 'name address phone logo coverImage')
                        .populate('customer', 'firstName lastName name phone')
                        .lean();
                }
            }
            res.status(200).json({
                status: 'success',
                data: {
                    transaction: {
                        ...transaction.toObject(),
                        order: orderDetails,
                        bankAccount: wallet.bankAccount,
                    },
                },
            });
        });
    }
}
exports.default = new WalletController();
