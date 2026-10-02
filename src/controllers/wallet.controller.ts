import { Request, Response } from 'express';
import Wallet from '../models/wallet.model';
import Transaction, { TransactionType, TransactionStatus } from '../models/transaction.model';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import paystackModule from '../services/payments/paystack.module';
import notificationService from '../services/notification.service';

class WalletController {
  /**
   * Get my wallet, settlement balances, and recent transactions
   */
  public getMyWallet = catchAsync(async (req: Request, res: Response) => {
    let wallet = await Wallet.findOne({ user: req.user!._id });

    // Auto-create wallet if it doesn't exist
    if (!wallet) {
      wallet = await Wallet.create({ user: req.user!._id });
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
          bankAccount: wallet.bankAccount,
          bankDetails: wallet.bankAccount,
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
  public requestWithdrawal = catchAsync(async (req: Request, res: Response) => {
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      throw new AppError('A valid withdrawal amount is required', 400);
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
    });

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
  public updateBankDetails = catchAsync(async (req: Request, res: Response) => {
    const { accountNumber, bankCode, accountName, bankName } = req.body;

    if (!accountNumber || !bankCode || !accountName) {
      throw new AppError('accountNumber, bankCode, and accountName are required', 400);
    }

    let wallet = await Wallet.findOne({ user: req.user!._id });
    if (!wallet) {
      wallet = await Wallet.create({ user: req.user!._id });
    }

    wallet.bankAccount = {
      accountNumber,
      bankCode,
      accountName,
      bankName: bankName || undefined,
      recipientCode: undefined // reset recipient code so it gets regenerated on next payout
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
   * Get List of Supported Banks
   */
  public getBanks = catchAsync(async (req: Request, res: Response) => {
    const banks = await paystackModule.getBanks();
    res.status(200).json({
      status: 'success',
      results: banks.length,
      data: banks,
    });
  });
}

export default new WalletController();
