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
const setting_model_1 = __importDefault(require("../models/setting.model"));
const transaction_model_1 = __importStar(require("../models/transaction.model"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const paystack_module_1 = __importDefault(require("../services/payments/paystack.module"));
const stripe_module_1 = __importDefault(require("../services/payments/stripe.module"));
const locationResolver_1 = require("../utils/locationResolver");
const notification_service_1 = __importDefault(require("../services/notification.service"));
const email_service_1 = __importDefault(require("../services/email.service"));
const order_model_1 = __importDefault(require("../models/order.model"));
const restaurant_model_1 = __importDefault(require("../models/restaurant.model"));
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Helper to verify 4-digit transaction/withdrawal PIN with security lockout:
 * - Maximum 4 consecutive failed attempts.
 * - Locks account transaction PIN for 12 hours on the 4th incorrect attempt.
 * - Resets failed counter on success.
 */
async function verifyPinWithLockout(userDoc, candidatePin) {
    // 1. Check if user is currently locked
    if (userDoc.withdrawalPinLockedUntil && new Date(userDoc.withdrawalPinLockedUntil) > new Date()) {
        const diffMs = new Date(userDoc.withdrawalPinLockedUntil).getTime() - Date.now();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const mins = Math.ceil((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} minute(s)`;
        throw new appError_1.default(`Your transaction PIN is temporarily locked for 12 hours due to 4 consecutive incorrect attempts. Remaining lock time: ${timeStr}. You can reset it immediately using "Forgot PIN".`, 423);
    }
    // 2. Compare candidate PIN
    const isPinCorrect = await userDoc.compareWithdrawalPin(candidatePin);
    if (!isPinCorrect) {
        const currentFailed = (userDoc.withdrawalPinFailedAttempts || 0) + 1;
        if (currentFailed >= 4) {
            userDoc.withdrawalPinLockedUntil = new Date(Date.now() + 12 * 60 * 60 * 1000);
            userDoc.withdrawalPinFailedAttempts = 0;
            await userDoc.save();
            throw new appError_1.default('You have entered an incorrect transaction PIN 4 times. Your account transaction PIN is now locked for 12 hours. Tap "Forgot PIN" to reset your PIN.', 423);
        }
        else {
            userDoc.withdrawalPinFailedAttempts = currentFailed;
            await userDoc.save();
            const remaining = 4 - currentFailed;
            throw new appError_1.default(`Incorrect transaction PIN. ${remaining} attempt(s) remaining before a 12-hour lockout.`, 401);
        }
    }
    // 3. On success, reset failed attempts & lockout
    if (userDoc.withdrawalPinFailedAttempts > 0 || userDoc.withdrawalPinLockedUntil) {
        userDoc.withdrawalPinFailedAttempts = 0;
        userDoc.withdrawalPinLockedUntil = null;
        await userDoc.save();
    }
}
/**
 * Fuzzy Name Matching Helper:
 * Ensures the bank account holder's name retrieved from Paystack/Stripe
 * matches the rider/partner's registered KYC identity name.
 */
function isNameMatching(registeredName, bankAccountName) {
    if (!registeredName || !bankAccountName)
        return false;
    const clean = (s) => s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\b(mr|mrs|ms|dr|chief|barr|engr|alhaji|pastor|prof)\b/g, '')
        .trim();
    const regTokens = clean(registeredName).split(/\s+/).filter((t) => t.length >= 2);
    const bankTokens = clean(bankAccountName).split(/\s+/).filter((t) => t.length >= 2);
    if (regTokens.length === 0 || bankTokens.length === 0)
        return false;
    let matchedTokens = 0;
    for (const token of regTokens) {
        if (bankTokens.some((bt) => bt === token || (token.length >= 4 && bt.includes(token)) || (bt.length >= 4 && token.includes(bt)))) {
            matchedTokens++;
        }
    }
    // At least 2 matching tokens (e.g. First and Last name), or all tokens if registered name is a single word
    const requiredMatches = Math.min(2, regTokens.length);
    return matchedTokens >= requiredMatches;
}
class WalletController {
    constructor() {
        /**
         * Get my wallet, settlement balances, and recent transactions
         */
        this.getMyWallet = (0, catchAsync_1.catchAsync)(async (req, res) => {
            let wallet = await wallet_model_1.default.findOne({ user: req.user._id });
            const userDoc = await user_model_1.default.findById(req.user._id);
            const hasWithdrawalPin = Boolean(userDoc?.hasWithdrawalPin);
            // Auto-resolve wallet currency based on vendor outlet or courier country
            let resolvedCurrency = 'NGN';
            const vendorRestaurant = await restaurant_model_1.default.findOne({ owner: req.user._id });
            if (vendorRestaurant?.baseCurrency) {
                resolvedCurrency = vendorRestaurant.baseCurrency;
            }
            else {
                const cCode = String(userDoc?.countryCode || userDoc?.country || '').toUpperCase();
                const isUk = Boolean(userDoc?.isUk || cCode === 'GB' || cCode === 'UK');
                const isItaly = Boolean(userDoc?.isItaly || cCode === 'IT');
                if (isUk) {
                    resolvedCurrency = 'GBP';
                }
                else if (isItaly) {
                    resolvedCurrency = 'EUR';
                }
                else {
                    resolvedCurrency = 'NGN';
                }
            }
            // Auto-create wallet if it doesn't exist
            if (!wallet) {
                wallet = await wallet_model_1.default.create({ user: req.user._id, currency: resolvedCurrency });
            }
            else if (wallet.currency !== resolvedCurrency && resolvedCurrency !== 'NGN') {
                wallet.currency = resolvedCurrency;
                await wallet.save();
            }
            const transactions = await transaction_model_1.default.find({ wallet: wallet._id })
                .sort({ createdAt: -1 })
                .limit(30);
            const platformSettings = await setting_model_1.default.findOne();
            const payoutSchedule = {
                schedule: platformSettings?.riderPayoutSchedule || 'weekly',
                payoutDayOfWeek: platformSettings?.riderPayoutDayOfWeek || 'friday',
            };
            const isPayoutCoolingOff = Boolean(wallet.payoutCooldownUntil && new Date(wallet.payoutCooldownUntil) > new Date());
            // Weekly withdrawal counter calculation
            const now = new Date();
            const day = now.getDay();
            const diffToMonday = (day === 0 ? -6 : 1) - day;
            const startOfWeek = new Date(now);
            startOfWeek.setDate(now.getDate() + diffToMonday);
            startOfWeek.setHours(0, 0, 0, 0);
            const weeklyWithdrawalsUsed = await transaction_model_1.default.countDocuments({
                wallet: wallet._id,
                type: transaction_model_1.TransactionType.WITHDRAWAL,
                createdAt: { $gte: startOfWeek },
                status: { $ne: transaction_model_1.TransactionStatus.FAILED },
            });
            const maxWeeklyWithdrawals = platformSettings?.maxWeeklyWithdrawals || 3;
            const weeklyWithdrawalsRemaining = Math.max(0, maxWeeklyWithdrawals - weeklyWithdrawalsUsed);
            const weeklyWithdrawals = {
                used: weeklyWithdrawalsUsed,
                remaining: weeklyWithdrawalsRemaining,
                limit: maxWeeklyWithdrawals,
            };
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
                        currencySymbol: wallet.currency === 'GBP' ? '£' : wallet.currency === 'EUR' ? '€' : wallet.currency === 'USD' ? '$' : '₦',
                        bankAccount: wallet.bankAccount,
                        bankDetails: wallet.bankAccount,
                        isSettlementOnHold: wallet.isSettlementOnHold || false,
                        holdReason: wallet.holdReason,
                        payoutCooldownUntil: wallet.payoutCooldownUntil || null,
                        payoutCooldownReason: wallet.payoutCooldownReason || null,
                        isPayoutCoolingOff,
                        weeklyWithdrawals,
                        lastPayoutDate: wallet.lastPayoutDate,
                        isActive: wallet.isActive,
                        hasWithdrawalPin,
                        createdAt: wallet.createdAt,
                        updatedAt: wallet.updatedAt,
                    },
                    hasWithdrawalPin,
                    isPayoutCoolingOff,
                    weeklyWithdrawals,
                    payoutSchedule,
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
            await verifyPinWithLockout(userDoc, pin.toString());
            // Security Check: Enforce 24-Hour Payout Cooling-Off Period (PIN Reset / Bank Update)
            const existingWalletDoc = await wallet_model_1.default.findOne({ user: req.user._id });
            if (existingWalletDoc?.payoutCooldownUntil && new Date(existingWalletDoc.payoutCooldownUntil) > new Date()) {
                const diffMs = new Date(existingWalletDoc.payoutCooldownUntil).getTime() - Date.now();
                const hours = Math.floor(diffMs / (1000 * 60 * 60));
                const mins = Math.ceil((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                const timeStr = hours > 0 ? `${hours} hour(s) and ${mins} minute(s)` : `${mins} minute(s)`;
                const unlockDateStr = new Date(existingWalletDoc.payoutCooldownUntil).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
                throw new appError_1.default(`For your financial security, a 24-hour payout cooling-off period is active on your account following a recent security change. Withdrawals will unlock in ${timeStr} (${unlockDateStr}). If this security change was not made by you, please contact support immediately.`, 423);
            }
            // Admin Payout Schedule Policy Enforcement (Riders)
            if (req.user?.role === 'rider') {
                const platformSettings = await setting_model_1.default.findOne();
                const scheduleMode = platformSettings?.riderPayoutSchedule || 'weekly';
                if (scheduleMode === 'weekly') {
                    const requiredDay = platformSettings?.riderPayoutDayOfWeek || 'friday';
                    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                    const currentDayIndex = new Date().getDay();
                    const currentDayName = dayNames[currentDayIndex];
                    if (currentDayName !== requiredDay) {
                        const capitalizedTargetDay = requiredDay.charAt(0).toUpperCase() + requiredDay.slice(1);
                        throw new appError_1.default(`Courier payouts are configured on a Weekly schedule and can only be requested on ${capitalizedTargetDay}s. Please check back then.`, 400);
                    }
                }
                // Weekly Withdrawal Limit Enforcement (Riders)
                if (existingWalletDoc) {
                    const maxWeeklyWithdrawals = platformSettings?.maxWeeklyWithdrawals || 3;
                    const now = new Date();
                    const day = now.getDay();
                    const diffToMonday = (day === 0 ? -6 : 1) - day;
                    const startOfWeek = new Date(now);
                    startOfWeek.setDate(now.getDate() + diffToMonday);
                    startOfWeek.setHours(0, 0, 0, 0);
                    const weeklyWithdrawalsUsed = await transaction_model_1.default.countDocuments({
                        wallet: existingWalletDoc._id,
                        type: transaction_model_1.TransactionType.WITHDRAWAL,
                        createdAt: { $gte: startOfWeek },
                        status: { $ne: transaction_model_1.TransactionStatus.FAILED },
                    });
                    if (weeklyWithdrawalsUsed >= maxWeeklyWithdrawals) {
                        throw new appError_1.default(`You have reached your limit of ${maxWeeklyWithdrawals} withdrawals this week (${maxWeeklyWithdrawals} of ${maxWeeklyWithdrawals} used). You can request payouts again next week.`, 400);
                    }
                }
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
                const currencySymbol = existingWallet.currency === 'GBP' ? '£' : existingWallet.currency === 'EUR' ? '€' : existingWallet.currency === 'USD' ? '$' : '₦';
                throw new appError_1.default(`Insufficient available balance. Available: ${currencySymbol}${currentAvailable.toLocaleString()}, Requested: ${currencySymbol}${amount.toLocaleString()}. (Note: Pending funds cannot be withdrawn until order completion).`, 400);
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
            const currencySymbol = wallet.currency === 'GBP' ? '£' : wallet.currency === 'EUR' ? '€' : wallet.currency === 'USD' ? '$' : '₦';
            // Send email receipt to user mailbox
            if (req.user?.email) {
                const userDoc = await user_model_1.default.findById(req.user._id);
                const recipientName = userDoc?.name || 'Valued Partner';
                const bankAcc = wallet.bankAccount;
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
            notification_service_1.default.notifyWalletTransaction(req.user._id.toString(), 'Withdrawal Initiated 💸', `Your payout request of ${currencySymbol}${amount.toLocaleString()} has been received and processed.`, amount, transaction._id.toString()).catch(() => { });
            res.status(200).json({
                status: 'success',
                message: 'Withdrawal successful',
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
            // Automated Bank Account Name Matching Enforcement
            const currentUser = await user_model_1.default.findById(req.user._id);
            const platformSettings = await setting_model_1.default.findOne();
            const shouldEnforceNameMatch = platformSettings?.enforceStrictBankNameMatch !== false;
            if (shouldEnforceNameMatch && currentUser?.name) {
                const isMatch = isNameMatching(currentUser.name, String(accountName).trim());
                if (!isMatch) {
                    throw new appError_1.default(`Bank account name mismatch: The bank account name "${accountName}" does not match your registered courier identity name "${currentUser.name}". Couriers may only link settlement accounts registered under their own verified identity.`, 400);
                }
            }
            const loc = (0, locationResolver_1.resolveRequestLocation)(req);
            const activeCountry = (countryCode || loc.countryCode || 'NG').toUpperCase();
            const effectiveBankCode = bankCode || sortCode || (iban ? iban.slice(5, 10) : 'INTERNATIONAL');
            let wallet = await wallet_model_1.default.findOne({ user: req.user._id });
            if (!wallet) {
                wallet = await wallet_model_1.default.create({ user: req.user._id });
            }
            // Security Check: If wallet already has a linked bank account, require 4-digit PIN verification
            const hasExistingBank = Boolean(wallet.bankAccount && wallet.bankAccount.accountNumber);
            if (hasExistingBank) {
                const userDoc = await user_model_1.default.findById(req.user._id).select('+withdrawalPin');
                if (!userDoc || !userDoc.hasWithdrawalPin || !userDoc.withdrawalPin) {
                    throw new appError_1.default('Please configure a 4-digit security PIN before modifying your linked settlement bank account.', 403);
                }
                const { pin } = req.body;
                if (!pin || pin.toString().length !== 4) {
                    throw new appError_1.default('Please enter your 4-digit security PIN to authorize changing your bank account.', 400);
                }
                await verifyPinWithLockout(userDoc, pin.toString());
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
            // If an existing bank was modified/replaced, enforce 24-hour security cooling-off
            if (hasExistingBank) {
                const cooldownHours = 24;
                const cooldownUntil = new Date(Date.now() + cooldownHours * 60 * 60 * 1000);
                wallet.payoutCooldownUntil = cooldownUntil;
                wallet.payoutCooldownReason = 'Security cooling-off period following settlement bank account modification';
                // Send security alert email to user
                if (req.user?.email) {
                    const userDoc = await user_model_1.default.findById(req.user._id);
                    const recipientName = userDoc?.name || 'Valued Partner';
                    const cleanAcc = String(accountNumber).trim();
                    const maskedAcc = cleanAcc.length > 4 ? `•••• •••• ${cleanAcc.slice(-4)}` : cleanAcc;
                    const cooldownStr = cooldownUntil.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
                    const nowStr = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
                    email_service_1.default.sendBankUpdateSecurityAlert(req.user.email, {
                        name: recipientName,
                        email: req.user.email,
                        bankName: wallet.bankAccount.bankName || 'Settlement Bank',
                        accountNumberMasked: maskedAcc,
                        timestamp: nowStr,
                        cooldownUntil: cooldownStr,
                    }).catch(err => logger_1.default.error('Failed to dispatch bank update security email:', err));
                }
            }
            await wallet.save();
            res.status(200).json({
                status: 'success',
                message: hasExistingBank
                    ? 'Bank details updated. For your security, a 24-hour payout cooling-off period has been activated.'
                    : 'Bank details linked successfully',
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
         * Verify 4-digit transaction / withdrawal PIN
         */
        this.verifyWithdrawalPin = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { pin } = req.body;
            const pinStr = pin ? pin.toString().trim() : '';
            if (!pinStr || pinStr.length !== 4) {
                throw new appError_1.default('Please provide your 4-digit transaction PIN', 400);
            }
            const user = await user_model_1.default.findById(req.user._id).select('+withdrawalPin');
            if (!user || !user.hasWithdrawalPin || !user.withdrawalPin) {
                throw new appError_1.default('Please configure a 4-digit transaction PIN before proceeding', 403);
            }
            await verifyPinWithLockout(user, pinStr);
            res.status(200).json({
                status: 'success',
                message: 'Transaction PIN verified successfully',
                data: {
                    verified: true,
                },
            });
        });
        /**
         * Reset / Recover 4-digit transaction PIN using account password
         * Unlocks account if locked out and sets a new 4-digit PIN
         */
        this.resetWithdrawalPin = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { password, newPin } = req.body;
            if (!password) {
                throw new appError_1.default('Please provide your account password to verify your identity', 400);
            }
            const pinStr = newPin ? newPin.toString().trim() : '';
            if (!pinStr || pinStr.length !== 4 || !/^\d{4}$/.test(pinStr)) {
                throw new appError_1.default('New transaction PIN must be exactly 4 numeric digits', 400);
            }
            const isAllSame = /^(\d)\1{3}$/.test(pinStr);
            const isSequentialAscending = '0123456789'.includes(pinStr);
            const isSequentialDescending = '9876543210'.includes(pinStr);
            const hasThreeConsecutiveSame = /^(\d)\1{2}\d$/.test(pinStr) || /^\d(\d)\1{2}$/.test(pinStr);
            if (isAllSame || isSequentialAscending || isSequentialDescending || hasThreeConsecutiveSame) {
                throw new appError_1.default('This PIN is too simple or predictable (e.g. repeated or sequential digits). Please choose a stronger 4-digit PIN.', 400);
            }
            const user = await user_model_1.default.findById(req.user._id).select('+password +withdrawalPin');
            if (!user) {
                throw new appError_1.default('User not found', 404);
            }
            const isPasswordCorrect = await user.comparePassword(password);
            if (!isPasswordCorrect) {
                throw new appError_1.default('Incorrect account password. Identity verification failed.', 401);
            }
            user.withdrawalPin = pinStr;
            user.hasWithdrawalPin = true;
            user.withdrawalPinFailedAttempts = 0;
            user.withdrawalPinLockedUntil = null;
            await user.save();
            // Enforce 24-hour payout cooling-off on wallet
            let wallet = await wallet_model_1.default.findOne({ user: user._id });
            if (!wallet) {
                wallet = await wallet_model_1.default.create({ user: user._id });
            }
            const cooldownHours = 24;
            const cooldownUntil = new Date(Date.now() + cooldownHours * 60 * 60 * 1000);
            wallet.payoutCooldownUntil = cooldownUntil;
            wallet.payoutCooldownReason = 'Security cooling-off period following transaction PIN reset';
            await wallet.save();
            // Send security alert email
            if (user.email) {
                const cooldownStr = cooldownUntil.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
                const nowStr = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
                email_service_1.default.sendPinResetSecurityAlert(user.email, {
                    name: user.name || 'Partner',
                    email: user.email,
                    timestamp: nowStr,
                    cooldownUntil: cooldownStr,
                }).catch(err => logger_1.default.error('Failed to dispatch PIN reset alert email:', err));
            }
            res.status(200).json({
                status: 'success',
                message: 'Transaction PIN has been reset successfully. Security lock removed. For your protection, a 24-hour payout cooling-off period is active.',
                data: {
                    hasWithdrawalPin: true,
                    payoutCooldownUntil: cooldownUntil,
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
            const hadExistingPin = Boolean(user.hasWithdrawalPin && user.withdrawalPin);
            // If user already has a withdrawal PIN, require verification of the current PIN
            if (hadExistingPin) {
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
            user.withdrawalPinFailedAttempts = 0;
            user.withdrawalPinLockedUntil = null;
            await user.save();
            // If updating an existing PIN, enforce 24-hour cooling off and send security email
            if (hadExistingPin) {
                let wallet = await wallet_model_1.default.findOne({ user: user._id });
                if (!wallet) {
                    wallet = await wallet_model_1.default.create({ user: user._id });
                }
                const cooldownHours = 24;
                const cooldownUntil = new Date(Date.now() + cooldownHours * 60 * 60 * 1000);
                wallet.payoutCooldownUntil = cooldownUntil;
                wallet.payoutCooldownReason = 'Security cooling-off period following transaction PIN update';
                await wallet.save();
                if (user.email) {
                    const cooldownStr = cooldownUntil.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
                    const nowStr = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
                    email_service_1.default.sendPinResetSecurityAlert(user.email, {
                        name: user.name || 'Partner',
                        email: user.email,
                        timestamp: nowStr,
                        cooldownUntil: cooldownStr,
                    }).catch(err => logger_1.default.error('Failed to dispatch PIN update alert email:', err));
                }
            }
            res.status(200).json({
                status: 'success',
                message: hadExistingPin
                    ? 'Withdrawal PIN updated successfully. For your protection, a 24-hour payout cooling-off period has been activated.'
                    : 'Withdrawal PIN configured successfully',
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
