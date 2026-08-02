import { Request, Response } from 'express';
import paymentService, { PaymentProvider } from '../services/payment.service';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';

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
}

export default new PaymentController();
