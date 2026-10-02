import { Request, Response } from 'express';
import zegoService from '../services/zego.service';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';

class ZegoController {
  /**
   * Issue ZEGOCLOUD token04 and room credentials for in-app VoIP calling
   */
  public getToken = catchAsync(async (req: Request, res: Response) => {
    const { orderId, role, target } = req.body;
    const userId = req.user!._id.toString();

    const data = await zegoService.generateCallToken(
      userId,
      orderId || undefined,
      role || (req.user!.role as any) || 'customer',
      target || 'customer'
    );

    res.status(200).json({
      status: 'success',
      data,
    });
  });

  /**
   * Notify call recipient when an outgoing call is placed
   */
  public notifyRecipient = catchAsync(async (req: Request, res: Response) => {
    const { orderId, role, target } = req.body;
    if (!orderId) {
      throw new AppError('orderId is required', 400);
    }

    const userId = req.user!._id.toString();
    await zegoService.notifyCallRecipient(
      userId,
      orderId,
      role || (req.user!.role as any) || 'customer',
      target || 'customer'
    );

    res.status(200).json({
      status: 'success',
      message: 'Recipient notified',
    });
  });
}

export default new ZegoController();
