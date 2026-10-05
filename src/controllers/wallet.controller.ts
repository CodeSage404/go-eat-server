import { Request, Response } from 'express';
import Wallet from '../models/wallet.model';
import User from '../models/user.model';
import Transaction, { TransactionType, TransactionStatus } from '../models/transaction.model';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import paystackModule from '../services/payments/paystack.module';
import stripeModule from '../services/payments/stripe.module';
import { resolveRequestLocation } from '../utils/locationResolver';
import notificationService from '../services/notification.service';
import emailService from '../services/email.service';
import Order from '../models/order.model';
import Restaurant from '../models/restaurant.model';
import mongoose from 'mongoose';
import logger from '../utils/logger';

class WalletController {
  /**
   * Get my wallet, settlement balances, and recent transactions
   */
  public getMyWallet = catchAsync(async (req: Request, res: Response) => {
    let wallet = await Wallet.findOne({ user: req.user!._id });

    const userDoc = await User.findById(req.user!._id);
    const hasWithdrawalPin = Boolean(userDoc?.hasWithdrawalPin);

    // Auto-resolve wallet currency based on vendor outlet or courier country
    let resolvedCurrency = 'NGN';
    const vendorRestaurant = await Restaurant.findOne({ owner: req.user!._id });
    if (vendorRestaurant?.baseCurrency) {
      resolvedCurrency = vendorRestaurant.baseCurrency;
    } else {
      const cCode = String(userDoc?.countryCode || (userDoc as any)?.country || '').toUpperCase();
      const isUk = Boolean((userDoc as any)?.isUk || cCode === 'GB' || cCode === 'UK');
      const isItaly = Boolean((userDoc as any)?.isItaly || cCode === 'IT');
      if (isUk) {
        resolvedCurrency = 'GBP';
      } else if (isItaly) {
        resolvedCurrency = 'EUR';
      } else {
        resolvedCurrency = 'NGN';
      }
    }

    // Auto-create wallet if it doesn't exist
    if (!wallet) {
      wallet = await Wallet.create({ user: req.user!._id, currency: resolvedCurrency });
    } else if (wallet.currency !== resolvedCurrency && resolvedCurrency !== 'NGN') {
      wallet.currency = resolvedCurrency;
      await wallet.save();
    }

    const transactions = await Transaction.find({ wallet: wallet._id })
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
          currencySymbol: wallet.currency === 'GBP' ? '£' : wallet.currency === 'EUR' ? '€' : wallet.currency === 'USD' ? '$' : '₦',
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
  public requestWithdrawal = catchAsync(async (req: Request, res: Response) => {
    const { amount, pin } = req.body;

    if (!amount || amount <= 0) {
      throw new AppError('A valid withdrawal amount is required', 400);
    }

    // Security Verification: Require 4-digit withdrawal PIN
    const userDoc = await User.findById(req.user!._id).select('+withdrawalPin');
    if (!userDoc || !userDoc.hasWithdrawalPin || !userDoc.withdrawalPin) {
      throw new AppError('Please set up a withdrawal PIN before requesting a withdrawal', 403);
    }

    if (!pin || pin.toString().length !== 4) {
      throw new AppError('Please enter your 4-digit withdrawal PIN', 400);
    }

    const isPinCorrect = await userDoc.compareWithdrawalPin!(pin.toString());
    if (!isPinCorrect) {
      throw new AppError('Incorrect withdrawal PIN. Please try again.', 400);
    }

    // Atomically check available balance and deduct in a single database operation to prevent race conditions
    const wallet = await Wallet.findOneAndUpdate(
      {
        user: req.user!._id,
        isSettlementOnHold: { $ne: true },
        $or: [
          { availableBalance: { $gte: amount } },
          { availableBalance: { $exists: false }, balance: { $gte: amount } },
        ],
      },
      {
        $inc: { balance: -amount, availableBalance: -amount },
        $set: { lastPayoutDate: new Date() },
      },
      { new: true }
    );

    if (!wallet) {
      // Find wallet to provide a specific, informative error message
      const existingWallet = await Wallet.findOne({ user: req.user!._id });
      if (!existingWallet) {
        throw new AppError('Wallet not found', 404);
      }
      if (existingWallet.isSettlementOnHold) {
        throw new AppError(
          `Settlement is temporarily on hold: ${existingWallet.holdReason || 'Account investigation or dispute'}`,
          400
        );
      }
      const currentAvailable = existingWallet.availableBalance ?? existingWallet.balance ?? 0;
      throw new AppError(
        `Insufficient available balance. Available: ₦${currentAvailable.toLocaleString()}, Requested: ₦${amount.toLocaleString()}. (Note: Pending funds cannot be withdrawn until order completion).`,
        400
      );
    }

    // Create withdrawal transaction
    const transaction = await Transaction.create({
      wallet: wallet._id,
      amount,
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.PENDING,
      description: 'Payout to verified bank account',
      reference: `WDR-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    });

    // Send email receipt to user mailbox
    if (req.user?.email) {
      const userDoc = await User.findById(req.user._id);
      const recipientName = userDoc?.name || 'Valued Partner';
      const bankAcc = wallet.bankAccount;
      
      const currencySymbol = wallet.currency === 'GBP' ? '£' : wallet.currency === 'EUR' ? '€' : wallet.currency === 'USD' ? '$' : '₦';

      emailService.sendWithdrawalReceipt(req.user.email, {
        userName: recipientName,
        reference: transaction.reference || transaction._id.toString().slice(-8).toUpperCase(),
        date: new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
        bankName: bankAcc?.bankName || 'Verified Bank Account',
        accountNumber: bankAcc?.accountNumber || '••••',
        accountName: bankAcc?.accountName || recipientName,
        status: 'Processing',
        currencySymbol,
        amount,
      }).catch(err => logger.error('Failed to dispatch withdrawal receipt email:', err));
    }

    // Notify user via In-App, Real-Time Socket, and Push Notification
    notificationService.notifyWalletTransaction(
      req.user!._id.toString(),
      'Withdrawal Initiated 💸',
      `Your payout request of ₦${amount.toLocaleString()} has been received and processed.`,
      amount,
      transaction._id.toString()
    ).catch(() => {});

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
  public updateBankDetails = catchAsync(async (req: Request, res: Response) => {
    const {
      accountNumber,
      bankCode,
      accountName,
      bankName,
      bankSlug,
      bankLogo,
      sortCode,
      routingNumber,
      iban,
      countryCode,
      provider,
    } = req.body;

    if (!accountNumber || !accountName) {
      throw new AppError('accountNumber and accountName are required', 400);
    }

    const loc = resolveRequestLocation(req);
    const activeCountry = (countryCode || loc.countryCode || 'NG').toUpperCase();
    const effectiveBankCode = bankCode || sortCode || (iban ? iban.slice(5, 10) : 'INTERNATIONAL');

    let wallet = await Wallet.findOne({ user: req.user!._id });
    if (!wallet) {
      wallet = await Wallet.create({ user: req.user!._id });
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
  public getBanks = catchAsync(async (req: Request, res: Response) => {
    const loc = resolveRequestLocation(req);
    const countryCode = ((req.query.countryCode as string) || loc.countryCode || 'NG').toUpperCase();

    if (countryCode === 'GB' || countryCode === 'UK') {
      const banks = stripeModule.getBanksByCountry('GB');
      return res.status(200).json({
        status: 'success',
        results: banks.length,
        data: banks,
      });
    } else if (countryCode === 'IT') {
      const banks = stripeModule.getBanksByCountry('IT');
      return res.status(200).json({
        status: 'success',
        results: banks.length,
        data: banks,
      });
    } else if (countryCode === 'US') {
      const banks = stripeModule.getBanksByCountry('US');
      return res.status(200).json({
        status: 'success',
        results: banks.length,
        data: banks,
      });
    }

    const country = (req.query.country as string) || (countryCode === 'GH' ? 'ghana' : 'nigeria');
    const banks = await paystackModule.getBanks(country);
    res.status(200).json({
      status: 'success',
      results: banks.length,
      data: banks,
    });
  });

  /**
   * Check if authenticated user has set up a withdrawal PIN
   */
  public checkWithdrawalPin = catchAsync(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!._id).select('hasWithdrawalPin');
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
  public setWithdrawalPin = catchAsync(async (req: Request, res: Response) => {
    const { pin, currentPin } = req.body;

    const pinStr = pin ? pin.toString().trim() : '';

    if (!pinStr || pinStr.length !== 4 || !/^\d{4}$/.test(pinStr)) {
      throw new AppError('Withdrawal PIN must be exactly 4 numeric digits', 400);
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
      throw new AppError('This PIN is too simple or predictable (e.g. repeated or sequential digits). Please choose a stronger 4-digit PIN.', 400);
    }

    const user = await User.findById(req.user!._id).select('+withdrawalPin +password');
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // If user already has a withdrawal PIN, require verification of the current PIN
    if (user.hasWithdrawalPin && user.withdrawalPin) {
      if (!currentPin) {
        throw new AppError('Please provide your current 4-digit PIN to update your PIN', 400);
      }
      const isCurrentCorrect = await user.compareWithdrawalPin!(currentPin.toString());
      if (!isCurrentCorrect) {
        throw new AppError('Current withdrawal PIN is incorrect', 400);
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
  public getTransactionById = catchAsync(async (req: Request, res: Response) => {
    const id = req.params.id as string;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid transaction ID', 400);
    }

    const wallet = await Wallet.findOne({ user: req.user!._id });
    if (!wallet) {
      throw new AppError('Wallet not found', 404);
    }

    const transaction = await Transaction.findOne({ _id: id, wallet: wallet._id });
    if (!transaction) {
      throw new AppError('Transaction not found', 404);
    }

    // If transaction has reference and it could be an Order ID, attempt to populate linked order details
    let orderDetails: any = null;
    if (transaction.reference) {
      const cleanRef = transaction.reference.trim();
      if (mongoose.Types.ObjectId.isValid(cleanRef)) {
        orderDetails = await Order.findById(cleanRef)
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

export default new WalletController();
