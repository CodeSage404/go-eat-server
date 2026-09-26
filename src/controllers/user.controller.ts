import { Request, Response } from 'express';
import crypto from 'crypto';
import User, { UserRole } from '../models/user.model';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import emailService from '../services/email.service';
import notificationService from '../services/notification.service';
import { sendSMS } from '../utils/sms.util';
import logger from '../utils/logger';

class UserController {
  /**
   * Add a new saved address
   */
  public addAddress = catchAsync(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!._id);
    if (!user) throw new AppError('User not found', 404);

    // If setting as default, unset others
    if (req.body.isDefault) {
      user.savedAddresses.forEach(addr => addr.isDefault = false);
    }

    user.savedAddresses.push(req.body);
    await user.save();

    res.status(200).json({
      status: 'success',
      data: { addresses: user.savedAddresses },
    });
  });

  /**
   * Get all saved addresses
   */
  public getAddresses = catchAsync(async (req: Request, res: Response) => {
    res.status(200).json({
      status: 'success',
      data: { addresses: req.user!.savedAddresses },
    });
  });

  /**
   * Delete a saved address
   */
  public deleteAddress = catchAsync(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!._id);
    if (!user) throw new AppError('User not found', 404);

    user.savedAddresses = user.savedAddresses.filter(
      (addr: any) => addr._id.toString() !== req.params.id
    );

    await user.save();

    res.status(200).json({
      status: 'success',
      data: { addresses: user.savedAddresses },
    });
  });

  /**
   * Toggle a restaurant in favorites
   */
  public toggleFavorite = catchAsync(async (req: Request, res: Response) => {
    const { restaurantId } = req.body;
    const user = await User.findById(req.user!._id);
    if (!user) throw new AppError('User not found', 404);

    const index = user.favorites.indexOf(restaurantId);
    if (index === -1) {
      user.favorites.push(restaurantId);
    } else {
      user.favorites.splice(index, 1);
    }

    await user.save();

    res.status(200).json({
      status: 'success',
      data: { favorites: user.favorites },
    });
  });

  /**
   * Get all favorite restaurants
   */
  public getFavorites = catchAsync(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!._id).populate('favorites');
    res.status(200).json({
      status: 'success',
      data: { favorites: user?.favorites || [] },
    });
  });

  /**
   * Get authenticated user profile
   */
  public getProfile = catchAsync(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!._id).select('-password');
    if (!user) {
      throw new AppError('User not found', 404);
    }
    res.status(200).json({
      status: 'success',
      data: { user },
    });
  });

  /**
   * Update user profile
   */
  public updateProfile = catchAsync(async (req: Request, res: Response) => {
    // Filter out unwanted fields that shouldn't be manually updated here
    const { name, email, phoneNumber, profileImage } = req.body;
    const updateData: any = {};
    if (name) updateData.name = name;
    if (email && email.trim() !== '') updateData.email = email.toLowerCase();
    if (phoneNumber && phoneNumber.trim() !== '') updateData.phoneNumber = phoneNumber;
    if (profileImage) updateData.profileImage = profileImage;

    // If an explicitly empty string is sent for a unique field, unset it using $unset so it doesn't trigger E11000
    const unsetData: any = {};
    if (email !== undefined && email.trim() === '') unsetData.email = 1;
    if (phoneNumber !== undefined && phoneNumber.trim() === '') unsetData.phoneNumber = 1;

    const updatePayload: any = { $set: updateData };
    if (Object.keys(unsetData).length > 0) {
      updatePayload.$unset = unsetData;
    }

    const user = await User.findByIdAndUpdate(
      req.user!._id,
      updatePayload,
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.status(200).json({
      status: 'success',
      data: { user },
    });
  });

  /**
   * Update user FCM / Push notification token
   */
  public updateFcmToken = catchAsync(async (req: Request, res: Response) => {
    const { fcmToken } = req.body;
    if (!fcmToken) {
      throw new AppError('FCM push token is required', 400);
    }

    const user = await User.findByIdAndUpdate(
      req.user!._id,
      { fcmToken },
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    res.status(200).json({
      status: 'success',
      data: { user },
    });
  });

  /**
   * Toggle Rider / Vendor Online Shift Status
   */
  public toggleOnlineStatus = catchAsync(async (req: Request, res: Response) => {
    const { isOnline } = req.body;
    const requestedOnline = Boolean(isOnline);

    // Gatekeeping: Courier must be approved by admin before going online
    if (requestedOnline && req.user?.role === UserRole.RIDER) {
      if (req.user.riderVerificationStatus !== 'approved') {
        throw new AppError(
          'Your courier account is pending document verification and admin approval. You cannot go online until approved.',
          403
        );
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user!._id,
      { isOnline: requestedOnline },
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    res.status(200).json({
      status: 'success',
      message: `Shift status set to ${requestedOnline ? 'Online' : 'Offline'}`,
      data: { user },
    });
  });

  /**
   * Get Responsible Purchasing Settings & GoEat Buddy
   */
  public getResponsiblePurchasing = catchAsync(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!._id).select('responsiblePurchasing');
    const rp = (user?.responsiblePurchasing as any)?.toObject ? (user!.responsiblePurchasing as any).toObject() : user?.responsiblePurchasing;

    const sanitizedRp = rp ? {
      ...rp,
      buddy: (rp.buddy && rp.buddy.name && rp.buddy.name.trim()) ? rp.buddy : undefined,
    } : {
      spendingLimit: { enabled: false, period: 'week' },
      orderLimit: { enabled: false, period: 'week' },
      takeABreak: { enabled: false, durationDays: 0 },
      selfExclusion: { enabled: false },
      buddy: undefined,
    };

    res.status(200).json({
      status: 'success',
      data: {
        responsiblePurchasing: sanitizedRp,
      },
    });
  });

  /**
   * Update Responsible Purchasing Settings & GoEat Buddy
   */
  public updateResponsiblePurchasing = catchAsync(async (req: Request, res: Response) => {
    const { responsiblePurchasing } = req.body;
    if (!responsiblePurchasing) {
      throw new AppError('responsiblePurchasing settings payload is required', 400);
    }

    const payload = { ...responsiblePurchasing };
    let shouldSendInvite = false;
    let inviteToken: string | undefined;

    if (payload.buddy && (!payload.buddy.name || !payload.buddy.name.trim())) {
      delete payload.buddy;
    } else if (payload.buddy && payload.buddy.name && payload.buddy.contact) {
      inviteToken = crypto.randomBytes(24).toString('hex');
      payload.buddy.inviteToken = inviteToken;
      payload.buddy.status = 'pending';
      payload.buddy.invitedAt = new Date();
      shouldSendInvite = true;
    }

    let updateQuery: any = { responsiblePurchasing: payload };
    if (!payload.buddy) {
      updateQuery = {
        ...updateQuery,
        $unset: { 'responsiblePurchasing.buddy': 1 },
      };
    }

    const user = await User.findByIdAndUpdate(
      req.user!._id,
      updateQuery,
      { returnDocument: 'after', runValidators: true }
    ).select('-password');

    // Trigger outbound invitation dispatch asynchronously
    if (shouldSendInvite && payload.buddy && inviteToken) {
      const baseUrl = (process.env.RENDER_EXTERNAL_URL || 'https://go-eat-server-z96s.onrender.com').replace(/\/$/, '');
      const acceptUrl = `${baseUrl}/api/v1/users/buddy/respond?token=${inviteToken}&action=accept`;
      const declineUrl = `${baseUrl}/api/v1/users/buddy/respond?token=${inviteToken}&action=decline`;
      const isEmail = payload.buddy.contact.includes('@');
      const senderName = user?.name || 'A friend';

      if (isEmail) {
        emailService.sendBuddyInvitation(payload.buddy.contact, {
          buddyName: payload.buddy.name,
          userName: senderName,
          acceptUrl,
          declineUrl,
        });
      } else {
        sendSMS(
          payload.buddy.contact,
          `Hi ${payload.buddy.name}, ${senderName} invited you to be their GoEatOne Buddy on Go-Eat. Tap here to accept: ${acceptUrl}`
        );
      }
    }

    const resultRp = (user?.responsiblePurchasing as any)?.toObject ? (user!.responsiblePurchasing as any).toObject() : user?.responsiblePurchasing;
    const sanitizedResult = resultRp ? {
      ...resultRp,
      buddy: (resultRp.buddy && resultRp.buddy.name && resultRp.buddy.name.trim()) ? resultRp.buddy : undefined,
    } : undefined;

    res.status(200).json({
      status: 'success',
      message: 'Responsible purchasing settings updated successfully',
      data: {
        responsiblePurchasing: sanitizedResult,
      },
    });
  });

  /**
   * Resend GoEatOne Buddy invitation SMS/Email
   */
  public resendBuddyInvite = catchAsync(async (req: Request, res: Response) => {
    const user = await User.findById(req.user!._id);
    if (!user) throw new AppError('User not found', 404);

    const buddy = user.responsiblePurchasing?.buddy;
    if (!buddy || !buddy.name || !buddy.contact) {
      throw new AppError('No buddy has been designated on this account', 400);
    }

    const inviteToken = crypto.randomBytes(24).toString('hex');
    user.responsiblePurchasing!.buddy!.inviteToken = inviteToken;
    user.responsiblePurchasing!.buddy!.status = 'pending';
    user.responsiblePurchasing!.buddy!.invitedAt = new Date();
    await user.save({ validateBeforeSave: false });

    const baseUrl = (process.env.RENDER_EXTERNAL_URL || 'https://go-eat-server-z96s.onrender.com').replace(/\/$/, '');
    const acceptUrl = `${baseUrl}/api/v1/users/buddy/respond?token=${inviteToken}&action=accept`;
    const declineUrl = `${baseUrl}/api/v1/users/buddy/respond?token=${inviteToken}&action=decline`;
    const isEmail = buddy.contact.includes('@');
    const senderName = user.name || 'A friend';

    if (isEmail) {
      emailService.sendBuddyInvitation(buddy.contact, {
        buddyName: buddy.name,
        userName: senderName,
        acceptUrl,
        declineUrl,
      });
    } else {
      sendSMS(
        buddy.contact,
        `Hi ${buddy.name}, ${senderName} invited you to be their GoEatOne Buddy on Go-Eat. Tap here to accept: ${acceptUrl}`
      );
    }

    res.status(200).json({
      status: 'success',
      message: `Invitation resent to ${buddy.name}`,
    });
  });

  /**
   * Public Web Hook: Buddy accepts or declines an invitation via mobile browser
   */
  public respondToBuddyInvite = catchAsync(async (req: Request, res: Response) => {
    const { token, action } = req.query as { token?: string; action?: string };

    if (!token || !action) {
      return res.status(400).send(renderBuddyResponseHtml({
        status: 'error',
        title: 'Invalid Request',
        message: 'This invitation link is missing required parameters or is improperly formatted.',
      }));
    }

    const user = await User.findOne({ 'responsiblePurchasing.buddy.inviteToken': token });
    if (!user || !user.responsiblePurchasing?.buddy) {
      return res.status(404).send(renderBuddyResponseHtml({
        status: 'error',
        title: 'Link Expired or Invalid',
        message: 'This invitation link has either expired, already been accepted, or is no longer valid.',
      }));
    }

    const buddy = user.responsiblePurchasing.buddy;
    const buddyName = buddy.name;
    const userName = user.name || 'Your friend';

    if (action === 'decline') {
      buddy.status = 'declined';
      buddy.inviteToken = undefined;
      await user.save({ validateBeforeSave: false });

      return res.status(200).send(renderBuddyResponseHtml({
        status: 'declined',
        title: 'Invitation Declined',
        message: `You have declined the GoEatOne Buddy invitation from ${userName}. No further messages or notifications will be sent to you.`,
      }));
    }

    if (action === 'accept') {
      buddy.status = 'active';
      buddy.acceptedAt = new Date();
      buddy.inviteToken = undefined;
      await user.save({ validateBeforeSave: false });

      // Send real-time push notification and in-app message to user
      notificationService.sendNotification(
        user._id.toString(),
        'GoEatOne Buddy Accepted! 🎉',
        `${buddyName} accepted your invitation and is now your GoEatOne Buddy.`,
        { type: 'BUDDY_ACCEPTED' }
      ).catch(err => logger.error('Failed to send buddy accepted notification:', err));

      return res.status(200).send(renderBuddyResponseHtml({
        status: 'success',
        title: `You're now ${userName}'s GoEatOne Buddy!`,
        message: `Thank you for being someone ${userName} can count on for responsible purchasing support. You will never see their orders, food choices, or payment details.`,
      }));
    }

    return res.status(400).send(renderBuddyResponseHtml({
      status: 'error',
      title: 'Unknown Action',
      message: 'The requested action is not recognized.',
    }));
  });
}

function renderBuddyResponseHtml(options: {
  status: 'success' | 'declined' | 'error';
  title: string;
  message: string;
}): string {
  const isSuccess = options.status === 'success';
  const isDeclined = options.status === 'declined';
  const iconSvg = isSuccess
    ? `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
    : isDeclined
    ? `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#6B7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
    : `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${options.title} | Go-Eat</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: #F3F4F6;
      color: #1F2937;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: #FFFFFF;
      max-width: 480px;
      width: 100%;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.08), 0 10px 10px -5px rgba(0,0,0,0.04);
      text-align: center;
    }
    .header {
      background: #004320;
      padding: 32px 24px 28px;
      color: #FFFFFF;
    }
    .brand {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .subhead {
      font-size: 13px;
      color: #A7F3D0;
      margin-top: 4px;
      font-weight: 500;
    }
    .content {
      padding: 36px 28px;
    }
    .icon-container {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: ${isSuccess ? '#ECFDF5' : isDeclined ? '#F3F4F6' : '#FEF2F2'};
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
    }
    h2 {
      font-size: 22px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 12px;
      line-height: 1.3;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #4B5563;
      margin-bottom: 24px;
    }
    .badge-box {
      background: #F9FAFB;
      border: 1px solid #E5E7EB;
      border-radius: 14px;
      padding: 16px;
      font-size: 13px;
      color: #6B7280;
      line-height: 1.5;
      margin-bottom: 24px;
      text-align: left;
    }
    .footer-note {
      font-size: 12px;
      color: #9CA3AF;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="brand">Go-Eat</div>
      <div class="subhead">Responsible Purchasing Safeguard</div>
    </div>
    <div class="content">
      <div class="icon-container">
        ${iconSvg}
      </div>
      <h2>${options.title}</h2>
      <p>${options.message}</p>
      ${isSuccess ? `
      <div class="badge-box">
        🛡️ <strong>Privacy Protection:</strong> You will never see purchase amounts, ordered items, delivery locations, or billing details. You are only registered to support responsible choices.
      </div>
      ` : ''}
      <div class="footer-note">You may now safely close this browser window.</div>
    </div>
  </div>
</body>
</html>`;
}

export default new UserController();

