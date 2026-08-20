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
const transaction_model_1 = __importStar(require("../models/transaction.model"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const paystack_module_1 = __importDefault(require("../services/payments/paystack.module"));
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
                        isSettlementOnHold: wallet.isSettlementOnHold || false,
                        holdReason: wallet.holdReason,
                        lastPayoutDate: wallet.lastPayoutDate,
                        isActive: wallet.isActive,
                        createdAt: wallet.createdAt,
                        updatedAt: wallet.updatedAt,
                    },
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
            const { amount } = req.body;
            if (!amount || amount <= 0) {
                throw new appError_1.default('A valid withdrawal amount is required', 400);
            }
            const wallet = await wallet_model_1.default.findOne({ user: req.user._id });
            if (!wallet) {
                throw new appError_1.default('Wallet not found', 404);
            }
            if (wallet.isSettlementOnHold) {
                throw new appError_1.default(`Settlement is temporarily on hold: ${wallet.holdReason || 'Account investigation or dispute'}`, 400);
            }
            const withdrawableBalance = wallet.availableBalance || wallet.balance;
            if (withdrawableBalance < amount) {
                throw new appError_1.default(`Insufficient available balance. Available: ${withdrawableBalance}, Requested: ${amount}. (Note: Pending funds cannot be withdrawn until order completion).`, 400);
            }
            // Deduct from available balance
            wallet.balance -= amount;
            wallet.availableBalance -= amount;
            wallet.lastPayoutDate = new Date();
            await wallet.save();
            // Create withdrawal transaction
            const transaction = await transaction_model_1.default.create({
                wallet: wallet._id,
                amount,
                type: transaction_model_1.TransactionType.WITHDRAWAL,
                status: transaction_model_1.TransactionStatus.COMPLETED, // Mocking instant processing for now
                description: 'Payout to verified bank account',
            });
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
         * Update Bank Details
         */
        this.updateBankDetails = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { accountNumber, bankCode, accountName } = req.body;
            if (!accountNumber || !bankCode || !accountName) {
                throw new appError_1.default('accountNumber, bankCode, and accountName are required', 400);
            }
            let wallet = await wallet_model_1.default.findOne({ user: req.user._id });
            if (!wallet) {
                wallet = await wallet_model_1.default.create({ user: req.user._id });
            }
            wallet.bankAccount = {
                accountNumber,
                bankCode,
                accountName,
                recipientCode: undefined // reset recipient code so it gets regenerated on next payout
            };
            await wallet.save();
            res.status(200).json({
                status: 'success',
                message: 'Bank details updated successfully',
                data: wallet,
            });
        });
        /**
         * Get List of Supported Banks
         */
        this.getBanks = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const banks = await paystack_module_1.default.getBanks();
            res.status(200).json({
                status: 'success',
                results: banks.length,
                data: banks,
            });
        });
    }
}
exports.default = new WalletController();
