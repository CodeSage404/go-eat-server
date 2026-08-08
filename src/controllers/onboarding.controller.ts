import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import Restaurant from '../models/restaurant.model';
import RiderOnboarding from '../models/riderOnboarding.model';
import { MAIN_OUTLETS_ARRAY, MainOutletType } from '../constants/outlets';
import emailService from '../services/email.service';

export const getMainOutlets = catchAsync(async (req: Request, res: Response) => {
  res.status(200).json({
    status: 'success',
    results: MAIN_OUTLETS_ARRAY.length,
    data: {
      outlets: MAIN_OUTLETS_ARRAY,
    },
  });
});

export const vendorStep1SelectOutlet = catchAsync(async (req: Request, res: Response) => {
  const { restaurantId, outletType } = req.body as {
    restaurantId: string;
    outletType: MainOutletType;
  };

  const validOutlets: MainOutletType[] = [
    'Restaurant',
    'Smokey Wheel',
    'Grocery',
    'Specialty Store',
    'Convenience',
    'Health & Wellness',
    'Lifestyle',
  ];

  if (!validOutlets.includes(outletType)) {
    throw new AppError('Invalid outlet type selected', 400);
  }

  const restaurant = await Restaurant.findByIdAndUpdate(
    restaurantId,
    { outletType },
    { new: true, runValidators: true }
  );

  if (!restaurant) {
    throw new AppError('Vendor / Restaurant profile not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      restaurant,
    },
  });
});

export const vendorStep2BusinessDetails = catchAsync(async (req: Request, res: Response) => {
  const {
    restaurantId,
    tradingName,
    businessCategory,
    lga,
    deliveryRadius,
    businessPhone,
    businessEmail,
    businessWebsite,
    bankDetails,
  } = req.body;

  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) {
    throw new AppError('Vendor / Restaurant profile not found', 404);
  }

  // Perform automatic bank account name matching check against verified NIN or CAC if present
  let isBankVerified = false;
  if (bankDetails && bankDetails.accountName) {
    const verifiedNinName = restaurant.ninVerification?.verifiedName?.toLowerCase();
    const accountNameLower = String(bankDetails.accountName).toLowerCase();
    if (verifiedNinName && accountNameLower.includes(verifiedNinName)) {
      isBankVerified = true;
    } else if (!verifiedNinName) {
      // If NIN not yet verified, mark bank as unverified until NIN match
      isBankVerified = false;
    }
  }

  const updatedRestaurant = await Restaurant.findByIdAndUpdate(
    restaurantId,
    {
      tradingName,
      businessCategory,
      lga,
      deliveryRadius,
      businessPhone,
      businessEmail,
      businessWebsite,
      bankDetails: bankDetails
        ? {
            ...bankDetails,
            isVerified: isBankVerified,
          }
        : undefined,
    },
    { new: true, runValidators: true }
  );

  res.status(200).json({
    status: 'success',
    data: {
      restaurant: updatedRestaurant,
    },
  });
});

export const vendorStep3IdentityVerification = catchAsync(async (req: Request, res: Response) => {
  const { restaurantId, ninVerification, cacRegistration } = req.body;

  const restaurant = await Restaurant.findByIdAndUpdate(
    restaurantId,
    {
      ninVerification: ninVerification
        ? {
            ...ninVerification,
            identityStatus: 'verified', // Simulated verified status from API integration
          }
        : undefined,
      cacRegistration,
    },
    { new: true, runValidators: true }
  );

  if (!restaurant) {
    throw new AppError('Vendor / Restaurant profile not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      restaurant,
    },
  });
});

export const vendorStep4Compliance = catchAsync(async (req: Request, res: Response) => {
  const { restaurantId, complianceStatus } = req.body;

  const restaurant = await Restaurant.findByIdAndUpdate(
    restaurantId,
    {
      complianceStatus: complianceStatus || 'approved',
    },
    { new: true, runValidators: true }
  );

  if (!restaurant) {
    throw new AppError('Vendor / Restaurant profile not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      restaurant,
    },
  });
});

export const riderRegisterOnboarding = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  if (!userId) {
    throw new AppError('User not authenticated', 401);
  }

  const onboardingData = {
    ...req.body,
    user: userId,
  };

  const existingProfile = await RiderOnboarding.findOne({ user: userId as any });

  let riderProfile;
  if (existingProfile) {
    riderProfile = await RiderOnboarding.findByIdAndUpdate(
      existingProfile._id,
      onboardingData,
      { new: true, runValidators: true }
    );
  } else {
    riderProfile = await RiderOnboarding.create(onboardingData);
  }

  res.status(200).json({
    status: 'success',
    data: {
      riderProfile,
    },
  });
});

export const getRiderOnboardingStatus = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?._id;

  const riderProfile = await RiderOnboarding.findOne({ user: userId as any });

  if (!riderProfile) {
    throw new AppError('Rider onboarding profile not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      riderProfile,
    },
  });
});

export const registerInterest = catchAsync(async (req: Request, res: Response) => {
  const { type, Email, ...formData } = req.body; // 'Email' maps to the form field 'Email'

  if (!Email) {
    throw new AppError('Email is required', 400);
  }

  const subject = `Go Eat Registration Received - ${type === 'vendor' ? 'Business' : 'Rider'}`;
  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
      <h2 style="color: #103E27;">Thank you for your interest!</h2>
      <p>Hello,</p>
      <p>We have successfully received your information to register as a <strong>${type === 'vendor' ? 'business' : 'rider'}</strong> on Go-Eat.</p>
      <p>Your application is currently <strong>under review</strong>. Our team will get back to you shortly with the next steps.</p>
      <br />
      <p>Best regards,</p>
      <p><strong>The Go-Eat Team</strong></p>
      <hr style="border: 0; border-top: 1px solid #eee; margin-top: 20px;" />
      <p style="color: #999; font-size: 12px;">This is an automated message. Please do not reply directly to this email.</p>
    </div>
  `;

  // Send confirmation to user
  await emailService.sendEmail(Email, subject, htmlContent, 'partners');

  res.status(200).json({
    status: 'success',
    message: 'Information received and confirmation email sent.',
  });
});
