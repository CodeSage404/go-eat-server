import { Request, Response } from 'express';
import paymentService, { PaymentProvider } from '../services/payment.service';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import Order from '../models/order.model';
import Restaurant from '../models/restaurant.model';
import paystackModule from '../services/payments/paystack.module';

class PaymentController {
  /**
   * Initialize a new Payment (Paystack or Flutterwave)
   */
  public initializePayment = catchAsync(async (req: Request, res: Response) => {
    const { orderId, provider, callbackUrl } = req.body;
    if (!orderId) {
      throw new AppError('orderId is required', 400);
    }

    const paymentData = await paymentService.initializePayment(
      orderId,
      req.user!._id.toString(),
      provider as PaymentProvider,
      callbackUrl
    );

    res.status(200).json({
      status: 'success',
      data: {
        authorizationUrl: paymentData.authorizationUrl,
        accessCode: paymentData.accessCode,
        reference: paymentData.reference,
        provider: paymentData.provider,
      },
    });
  });

  /**
   * Verify Payment by Reference (Paystack or Flutterwave)
   */
  public verifyPayment = catchAsync(async (req: Request, res: Response) => {
    const refStr = Array.isArray(req.params.reference) ? req.params.reference[0] : String(req.params.reference || '');
    const provider = (req.query.provider as PaymentProvider) || 'paystack';

    if (!refStr) {
      throw new AppError('Payment reference is required', 400);
    }

    const verificationResult = await paymentService.verifyPayment(refStr, provider);

    res.status(200).json({
      status: 'success',
      data: verificationResult,
    });
  });

  /**
   * Webhook endpoint for Paystack
   */
  public handlePaystackWebhook = catchAsync(async (req: Request, res: Response) => {
    const signature = req.headers['x-paystack-signature'] as string;
    if (!signature) {
      res.status(400).send('Missing Paystack signature header');
      return;
    }

    await paymentService.processPaystackWebhook(req.body, signature);

    // Paystack expects a 200 OK response immediately
    res.status(200).send('Paystack webhook received successfully');
  });

  /**
   * Webhook endpoint for Flutterwave
   */
  public handleFlutterwaveWebhook = catchAsync(async (req: Request, res: Response) => {
    const signature = (req.headers['verif-hash'] || req.headers['x-flutterwave-signature']) as string;
    if (!signature) {
      res.status(400).send('Missing Flutterwave verif-hash header');
      return;
    }

    await paymentService.processFlutterwaveWebhook(req.body, signature);

    // Flutterwave expects a 200 OK response immediately
    res.status(200).send('Flutterwave webhook received successfully');
  });

  /**
   * Admin / System: Payout Delivery Rider
   */
  public payoutRider = catchAsync(async (req: Request, res: Response) => {
    const { riderId, amount, provider } = req.body;
    if (!riderId || !amount) {
      throw new AppError('riderId and amount are required', 400);
    }

    const payoutResult = await paymentService.payoutRider(
      riderId,
      Number(amount),
      provider as PaymentProvider
    );

    res.status(200).json({
      status: 'success',
      message: 'Rider payout completed successfully',
      data: payoutResult,
    });
  });

  /**
   * Admin / System: Payout Restaurant Vendor
   */
  public payoutRestaurant = catchAsync(async (req: Request, res: Response) => {
    const { restaurantId, amount, provider } = req.body;
    if (!restaurantId || !amount) {
      throw new AppError('restaurantId and amount are required', 400);
    }

    const payoutResult = await paymentService.payoutRestaurant(
      restaurantId,
      Number(amount),
      provider as PaymentProvider
    );

    res.status(200).json({
      status: 'success',
      message: 'Restaurant payout completed successfully',
      data: payoutResult,
    });
  });

  /**
   * Fetch payments for a vendor's restaurant
   */
  public getVendorPayments = catchAsync(async (req: Request, res: Response) => {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('User does not belong to any restaurant', 403);
    }

    const orders = await Order.find({ restaurant: restaurantId })
      .sort({ createdAt: -1 })
      .select('_id totalAmount paymentStatus paymentResult createdAt paymentMethod');

    res.status(200).json({
      status: 'success',
      results: orders.length,
      data: orders,
    });
  });

  /**
   * Update payment details manually (e.g. status or reference)
   */
  public updatePaymentDetails = catchAsync(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, reference } = req.body;

    const order = await Order.findById(id);
    if (!order) {
      throw new AppError('Payment/Order not found', 404);
    }

    if (status) {
      order.paymentStatus = status;
    }
    if (reference) {
      if (!order.paymentResult) {
        order.paymentResult = { id: reference, status: order.paymentStatus, update_time: new Date().toISOString(), email_address: '' };
      } else {
        order.paymentResult.id = reference;
      }
    }

    await order.save();

    res.status(200).json({
      status: 'success',
      data: order,
    });
  });

  /**
   * Fetch list of supported banks from Paystack
   */
  public getBanks = catchAsync(async (req: Request, res: Response) => {
    const country = (req.query.country as string) || 'nigeria';
    const banks = await paystackModule.getBanks(country);

    res.status(200).json({
      status: 'success',
      data: banks,
    });
  });

  /**
   * Resolve and verify Nigerian bank account number
   */
  public resolveAccountNumber = catchAsync(async (req: Request, res: Response) => {
    const { accountNumber, bankCode } = req.query;
    if (!accountNumber || !bankCode) {
      throw new AppError('accountNumber and bankCode query parameters are required', 400);
    }

    const result = await paystackModule.resolveAccountNumber(String(accountNumber), String(bankCode));
    res.status(200).json({
      status: 'success',
      data: result,
    });
  });

  /**
   * Vendor: Setup Bank Details & Paystack Subaccount
   */
  public setupSubaccount = catchAsync(async (req: Request, res: Response) => {
    const restaurantId = req.user?.restaurantId;
    if (!restaurantId) {
      throw new AppError('User does not belong to any restaurant', 403);
    }

    const { bankName, bankCode, accountNumber, accountName } = req.body;
    if (!bankName || !bankCode || !accountNumber || !accountName) {
      throw new AppError('bankName, bankCode, accountNumber, and accountName are required', 400);
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      throw new AppError('Restaurant not found', 404);
    }

    // Default percentage charge is 0, since we will override with transaction_charge per order
    const { subaccountCode } = await paystackModule.createSubaccount({
      businessName: restaurant.name,
      bankCode,
      accountNumber,
      percentageCharge: 0,
    });

    restaurant.paystackSubaccountCode = subaccountCode;
    restaurant.bankDetails = {
      bankName,
      bankCode,
      accountNumber,
      accountName,
      isVerified: true,
    };

    await restaurant.save();

    res.status(200).json({
      status: 'success',
      message: 'Bank details and subaccount configured successfully',
      data: {
        paystackSubaccountCode: subaccountCode,
        bankDetails: restaurant.bankDetails,
      },
    });
  });

  /**
   * Universal Payment Callback HTML Page
   * Served when Paystack / Flutterwave / Stripe redirects the WebView after payment.
   */
  public handlePaymentCallback = catchAsync(async (req: Request, res: Response) => {
    const reference = (req.query.reference || req.query.trxref || req.query.tx_ref || '') as string;
    const provider = String(req.query.provider || 'paystack');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Payment Completed - Go-Eat</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #0B291B;
      color: #FFFFFF;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }
    .card {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 24px;
      padding: 36px 24px;
      width: 100%;
      max-width: 360px;
      backdrop-filter: blur(12px);
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    }
    .icon-badge {
      width: 64px;
      height: 64px;
      border-radius: 32px;
      background: #10B981;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 32px;
      margin-bottom: 20px;
      box-shadow: 0 10px 20px rgba(16, 185, 129, 0.3);
    }
    h1 {
      font-size: 22px;
      margin: 0 0 10px;
      font-weight: 700;
    }
    p {
      margin: 0 0 16px;
      font-size: 14px;
      color: #D1D5DB;
      line-height: 1.5;
    }
    .ref-chip {
      display: inline-block;
      background: rgba(0,0,0,0.25);
      border: 1px solid rgba(255,255,255,0.1);
      padding: 6px 14px;
      border-radius: 12px;
      font-family: monospace;
      font-size: 12px;
      color: #34D399;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-badge">✓</div>
    <h1>Payment Completed</h1>
    <p>Your transaction has been processed by ${provider.toUpperCase()}. Returning you to Go-Eat to view your order...</p>
    ${reference ? `<div class="ref-chip">Ref: ${reference}</div>` : ''}
  </div>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(html);
  });
}

export default new PaymentController();
