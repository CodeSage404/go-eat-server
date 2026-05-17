import { Request, Response } from 'express';
import paymentService from '../services/payment.service';
import { catchAsync } from '../utils/catchAsync';

class PaymentController {
  /**
   * Initialize a new Paystack payment
   */
  public initializePayment = catchAsync(async (req: Request, res: Response) => {
    const { orderId } = req.body;
    
    // We expect the customer to be the one requesting the payment link
    const paymentData = await paymentService.initializePayment(orderId, req.user!._id.toString());

    res.status(200).json({
      status: 'success',
      data: {
        authorizationUrl: paymentData.authorization_url,
        accessCode: paymentData.access_code,
        reference: paymentData.reference,
      },
    });
  });

  /**
   * Webhook endpoint for Paystack to hit
   */
  public handleWebhook = catchAsync(async (req: Request, res: Response) => {
    const signature = req.headers['x-paystack-signature'] as string;
    
    if (!signature) {
      res.status(400).send('Missing signature');
      return;
    }

    // Process the webhook in the service
    await paymentService.processWebhook(req.body, signature);

    // Paystack expects a 200 OK response immediately
    res.status(200).send('Webhook received successfully');
  });
}

export default new PaymentController();
