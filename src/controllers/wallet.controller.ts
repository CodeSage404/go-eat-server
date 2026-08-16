import { Request, Response } from 'express';
import Wallet from '../models/wallet.model';
import Transaction, { TransactionType, TransactionStatus } from '../models/transaction.model';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import paystackModule from '../services/payments/paystack.module';

class WalletController {
  /**
   * Get my wallet and recent transactions
   */
  public getMyWallet = catchAsync(async (req: Request, res: Response) => {
    let wallet = await Wallet.findOne({ user: req.user!._id });

    // Auto-create wallet if it doesn't exist
    if (!wallet) {
      wallet = await Wallet.create({ user: req.user!._id });
    }

    const transactions = await Transaction.find({ wallet: wallet._id })
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
  public requestWithdrawal = catchAsync(async (req: Request, res: Response) => {
    const { amount } = req.body;

    const wallet = await Wallet.findOne({ user: req.user!._id });
    if (!wallet) {
      throw new AppError('Wallet not found', 404);
    }

    if (wallet.balance < amount) {
      throw new AppError('Insufficient balance', 400);
    }

    // Deduct from wallet
    wallet.balance -= amount;
    wallet.lastPayoutDate = new Date();
    await wallet.save();

    // Create withdrawal transaction
    const transaction = await Transaction.create({
      wallet: wallet._id,
      amount,
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.COMPLETED, // Mocking instant processing for now
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
  public updateBankDetails = catchAsync(async (req: Request, res: Response) => {
    const { accountNumber, bankCode, accountName } = req.body;

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
