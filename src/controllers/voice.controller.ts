import { Request, Response } from 'express';
import voiceService from '../services/voice.service';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';

class VoiceController {
  /**
   * Issue Twilio Voice Access Token for in-app VoIP calling
   */
  public getToken = catchAsync(async (req: Request, res: Response) => {
    const { orderId, role } = req.body;
    if (!orderId) {
      throw new AppError('orderId is required', 400);
    }

    const userId = req.user!._id.toString();
    const tokenData = await voiceService.generateVoiceToken(userId, orderId, role || 'customer');

    res.status(200).json({
      status: 'success',
      data: tokenData,
    });
  });

  /**
   * Handle incoming TwiML request from Twilio Voice SDK
   */
  public handleTwiml = (req: Request, res: Response) => {
    const to = (req.body.To || req.query.To || '') as string;
    const twiml = voiceService.generateCallTwiml(to);

    res.type('text/xml');
    res.send(twiml);
  };

  /**
   * Initiate masked cellular call bridge between customer and courier
   */
  public initiateMaskedBridge = catchAsync(async (req: Request, res: Response) => {
    const { orderId } = req.body;
    if (!orderId) {
      throw new AppError('orderId is required', 400);
    }

    const userId = req.user!._id.toString();
    const result = await voiceService.initiateMaskedBridgeCall(orderId, userId);

    res.status(200).json({
      status: 'success',
      data: result,
    });
  });
}

export default new VoiceController();
