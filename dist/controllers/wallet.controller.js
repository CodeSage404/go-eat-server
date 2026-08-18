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
         * Get my wallet and recent transactions
         */
        this.getMyWallet = (0, catchAsync_1.catchAsync)(async (req, res) => {
            let wallet = await wallet_model_1.default.findOne({ user: req.user._id });
            // Auto-create wallet if it doesn't exist
            if (!wallet) {
                wallet = await wallet_model_1.default.create({ user: req.user._id });
            }
            const transactions = await transaction_model_1.default.find({ wallet: wallet._id })
                .sort({ createdAt: -1 })
                .limit(20);
            res.status(200).json({
                status: 'success',
                data: {
                    wallet,
                    transactions,
                },
            });
        });
        /**
         * Request a withdrawal (simulates processing weekly payouts)
         */
        this.requestWithdrawal = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { amount } = req.body;
            const wallet = await wallet_model_1.default.findOne({ user: req.user._id });
            if (!wallet) {
                throw new appError_1.default('Wallet not found', 404);
            }
            if (wallet.balance < amount) {
                throw new appError_1.default('Insufficient balance', 400);
            }
            // Deduct from wallet
            wallet.balance -= amount;
            wallet.lastPayoutDate = new Date();
            await wallet.save();
            // Create withdrawal transaction
            const transaction = await transaction_model_1.default.create({
                wallet: wallet._id,
                amount,
                type: transaction_model_1.TransactionType.WITHDRAWAL,
                status: transaction_model_1.TransactionStatus.COMPLETED, // Mocking instant processing for now
                description: 'Weekly Payout to Bank Account',
            });
            res.status(200).json({
                status: 'success',
                data: {
                    wallet,
                    transaction,
                },
            });
        });
        /**
         * Update Bank Details
         * @openapi
         * ... we will add swagger later or just skip it since we already did openapi
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
