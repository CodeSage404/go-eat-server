import { Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import PartnerApplication from '../models/partnerApplication.model';
import User, { UserRole, UserStatus } from '../models/user.model';
import Restaurant, { RestaurantStatus } from '../models/restaurant.model';
import emailService from '../services/email.service';
import logger from '../utils/logger';

/**
 * Public controller: submit a new partner application
 * Supports both Quick Registration (instant vendor account & app access with pending verification)
 * and Full Application (with mandatory NIN and Food Hygiene document review).
 */
export const applyForPartnership = catchAsync(async (req: Request, res: Response) => {
  const {
    businessName,
    businessAddress,
    businessType,
    ownerName,
    firstName,
    lastName,
    email,
    phoneNumber,
    city,
    applicationType = 'full',
  } = req.body;

  const isQuick = applicationType === 'quick';

  const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
  let ninUrl = req.body.ninUrl || req.body['ninUrl'] || '';
  let foodHygieneUrl = req.body.foodHygieneUrl || req.body['foodHygieneUrl'] || '';
  let cacUrl = req.body.cacUrl || req.body['cacUrl'] || '';

  if (files) {
    if (files['nin'] && files['nin'][0]) {
      ninUrl = files['nin'][0].path;
    }
    if (files['foodHygiene'] && files['foodHygiene'][0]) {
      foodHygieneUrl = files['foodHygiene'][0].path;
    }
    if (files['cac'] && files['cac'][0]) {
      cacUrl = files['cac'][0].path;
    }
  }

  const resolvedOwnerName =
    ownerName || `${firstName || ''} ${lastName || ''}`.trim() || 'Valued Partner';

  if (!businessName || !businessAddress || !email || !phoneNumber) {
    throw new AppError(
      'Business name, business address, email, and phone number are required',
      400
    );
  }

  const validTypes = ['restaurant', 'grocery', 'convenience', 'bakery', 'cafe', 'other'];
  const resolvedBusinessType = validTypes.includes((businessType || '').toLowerCase())
    ? (businessType || '').toLowerCase()
    : 'restaurant';

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedPhone = phoneNumber.trim();

  // If Full Application: NIN and Food Hygiene are mandatory, CAC is optional
  if (!isQuick) {
    if (!ninUrl) {
      throw new AppError(
        'National Identification Number (NIN) document is required for verification',
        400
      );
    }
    if (!foodHygieneUrl) {
      throw new AppError(
        'Food Hygiene Certificate is required for verification',
        400
      );
    }
  }

  // Handle Quick Setup (Instant Access Creation)
  if (isQuick) {
    // Check if user already exists
    let user = await User.findOne({
      $or: [{ email: normalizedEmail }, { phoneNumber: normalizedPhone }],
    });

    if (user && user.role !== UserRole.VENDOR) {
      throw new AppError(
        'An account with this email or phone number already exists under a different role',
        400
      );
    }

    const generatedPassword = `GoEat#${crypto.randomBytes(3).toString('hex').toUpperCase()}!`;

    if (!user) {
      user = await User.create({
        name: resolvedOwnerName,
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        password: generatedPassword,
        role: UserRole.VENDOR,
        status: UserStatus.ACTIVE,
        isVerified: true,
      });
    }

    // Check if restaurant already exists for this vendor
    let restaurant = await Restaurant.findOne({ owner: user._id });
    if (!restaurant) {
      restaurant = await Restaurant.create({
        owner: user._id,
        name: businessName.trim(),
        description: `Welcome to ${businessName.trim()}`,
        address: {
          street: businessAddress.trim(),
          city: city ? city.trim() : 'Lagos',
          state: 'Lagos',
          zipCode: '100001',
        },
        location: {
          type: 'Point',
          coordinates: [3.3792, 6.5244],
        },
        outletType: 'Restaurant',
        baseCurrency: 'NGN',
        status: RestaurantStatus.PENDING, // Pending full document review
        complianceStatus: 'pending',
        businessPhone: normalizedPhone,
        phone: normalizedPhone,
        phoneNumber: normalizedPhone,
        phoneContact: normalizedPhone,
        verificationDocuments: {
          ninUrl: ninUrl || '',
          foodHygieneUrl: foodHygieneUrl || '',
          cacUrl: cacUrl || '',
        },
      });

      user.restaurantId = restaurant._id as mongoose.Types.ObjectId;
      await user.save({ validateBeforeSave: false });
    }

    const application = await PartnerApplication.create({
      businessName: businessName.trim(),
      businessAddress: businessAddress.trim(),
      businessType: resolvedBusinessType,
      ownerName: resolvedOwnerName,
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      city: city ? city.trim() : '',
      applicationType: 'quick',
      hasAccessGranted: true,
      onboardedRestaurant: restaurant._id,
      documents: {
        ninUrl,
        foodHygieneUrl,
        cacUrl,
      },
      ninUrl,
      foodHygieneUrl,
      cacUrl,
      status: 'pending',
    });

    // Dispatch Welcome Partner email with generated credentials
    try {
      await emailService.sendTemplateEmail(
        normalizedEmail,
        'WELCOME_PARTNER',
        'Welcome to GoEat — Your Partner Account is Ready!',
        {
          partnerName: resolvedOwnerName,
          restaurantName: businessName.trim(),
          loginUrl: process.env.VENDOR_DASHBOARD_URL || 'https://partner.goeat.com',
          email: normalizedEmail,
          password: generatedPassword,
        },
        'partners'
      );
    } catch (mailErr: any) {
      logger.warn(`Failed to dispatch quick partner welcome email: ${mailErr.message}`);
    }

    return res.status(201).json({
      status: 'success',
      message: 'Vendor quick account created! Your login credentials have been emailed to you.',
      data: {
        application,
        restaurantId: restaurant._id,
        hasInstantAccess: true,
      },
    });
  }

  // Full Application Flow
  const application = await PartnerApplication.create({
    businessName: businessName.trim(),
    businessAddress: businessAddress.trim(),
    businessType: resolvedBusinessType,
    ownerName: resolvedOwnerName,
    email: normalizedEmail,
    phoneNumber: normalizedPhone,
    city: city ? city.trim() : '',
    applicationType: 'full',
    hasAccessGranted: false,
    documents: {
      ninUrl,
      foodHygieneUrl,
      cacUrl,
    },
    ninUrl,
    foodHygieneUrl,
    cacUrl,
    status: 'pending',
  });

  // Dispatch acknowledgement email to the applicant using EJS template
  try {
    await emailService.sendPartnerApplicationReceived(
      normalizedEmail,
      {
        ownerName: resolvedOwnerName,
        businessName,
        businessType: resolvedBusinessType,
        businessAddress,
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
      }
    );
  } catch (err: any) {
    logger.warn(`Failed to dispatch partner application confirmation email to ${email}: ${err.message}`);
  }

  res.status(201).json({
    status: 'success',
    message: 'Partner application submitted successfully. Confirmation email sent.',
    data: {
      application,
      hasInstantAccess: false,
    },
  });
});

/**
 * Admin: list all partner applications with filtering & pagination
 */
export const getAllPartnerApplications = catchAsync(async (req: Request, res: Response) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  const filter: any = {};

  if (status && status !== 'all') {
    filter.status = status;
  }

  if (search) {
    const s = String(search).trim();
    filter.$or = [
      { businessName: { $regex: s, $options: 'i' } },
      { ownerName: { $regex: s, $options: 'i' } },
      { email: { $regex: s, $options: 'i' } },
      { phoneNumber: { $regex: s, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(String(limit), 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const [applications, total] = await Promise.all([
    PartnerApplication.find(filter)
      .populate('reviewedBy', 'name email')
      .populate('onboardedRestaurant', 'name status address')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum),
    PartnerApplication.countDocuments(filter),
  ]);

  res.status(200).json({
    status: 'success',
    results: applications.length,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
    data: {
      applications,
    },
  });
});

/**
 * Admin: get single application by id
 */
export const getPartnerApplicationById = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const application = await PartnerApplication.findById(id)
    .populate('reviewedBy', 'name email')
    .populate('onboardedRestaurant', 'name status address');

  if (!application) {
    throw new AppError('Partner application not found', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      application,
    },
  });
});

/**
 * Admin: update application status or notes
 */
export const updatePartnerApplicationStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, adminNotes, onboardedRestaurant } = req.body;

  const updateData: any = {};
  if (status) {
    const validStatuses = ['pending', 'under_review', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      throw new AppError('Invalid application status', 400);
    }
    updateData.status = status;
    updateData.reviewedBy = req.user?._id;
    updateData.reviewedAt = new Date();
  }

  if (typeof adminNotes === 'string') {
    updateData.adminNotes = adminNotes;
  }

  if (onboardedRestaurant) {
    updateData.onboardedRestaurant = onboardedRestaurant;
  }

  const application = await PartnerApplication.findByIdAndUpdate(
    id,
    updateData,
    { returnDocument: 'after', runValidators: true }
  );

  if (!application) {
    throw new AppError('Partner application not found', 404);
  }

  res.status(200).json({
    status: 'success',
    message: 'Partner application updated successfully',
    data: {
      application,
    },
  });
});

/**
 * Admin: Grant access without document review
 * Immediately provisions a vendor account & pending restaurant profile and emails credentials,
 * allowing the vendor to access the vendor app while their verification documents remain pending.
 */
export const adminGrantAccess = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const application = await PartnerApplication.findById(id);
  if (!application) {
    throw new AppError('Partner application not found', 404);
  }

  const normalizedEmail = application.email.toLowerCase().trim();
  const normalizedPhone = application.phoneNumber.trim();

  let user = await User.findOne({
    $or: [{ email: normalizedEmail }, { phoneNumber: normalizedPhone }],
  });

  const generatedPassword = `GoEat#${crypto.randomBytes(3).toString('hex').toUpperCase()}!`;

  if (!user) {
    user = await User.create({
      name: application.ownerName,
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      password: generatedPassword,
      role: UserRole.VENDOR,
      status: UserStatus.ACTIVE,
      isVerified: true,
    });
  }

  let restaurant = await Restaurant.findOne({ owner: user._id });
  if (!restaurant) {
    restaurant = await Restaurant.create({
      owner: user._id,
      name: application.businessName,
      description: `Welcome to ${application.businessName}`,
      address: {
        street: application.businessAddress,
        city: application.city || 'Lagos',
        state: 'Lagos',
        zipCode: '100001',
      },
      location: {
        type: 'Point',
        coordinates: [3.3792, 6.5244],
      },
      outletType: 'Restaurant',
      baseCurrency: 'NGN',
      status: RestaurantStatus.PENDING,
      complianceStatus: 'pending',
      businessPhone: normalizedPhone,
      phone: normalizedPhone,
      phoneNumber: normalizedPhone,
      phoneContact: normalizedPhone,
      verificationDocuments: {
        ninUrl: application.ninUrl || application.documents?.ninUrl || '',
        foodHygieneUrl: application.foodHygieneUrl || application.documents?.foodHygieneUrl || '',
        cacUrl: application.cacUrl || application.documents?.cacUrl || '',
      },
    });

    user.restaurantId = restaurant._id as mongoose.Types.ObjectId;
    await user.save({ validateBeforeSave: false });
  }

  application.hasAccessGranted = true;
  application.onboardedRestaurant = restaurant._id as mongoose.Types.ObjectId;
  application.reviewedBy = req.user?._id;
  application.reviewedAt = new Date();
  if (application.status === 'pending') {
    application.status = 'under_review';
  }
  await application.save();

  // Send credentials email
  try {
    await emailService.sendTemplateEmail(
      normalizedEmail,
      'WELCOME_PARTNER',
      'GoEat Vendor Portal — Access Granted!',
      {
        partnerName: application.ownerName,
        restaurantName: application.businessName,
        loginUrl: process.env.VENDOR_DASHBOARD_URL || 'https://partner.goeat.com',
        email: normalizedEmail,
        password: generatedPassword,
      },
      'partners'
    );
  } catch (mailErr: any) {
    logger.warn(`Failed to dispatch grant access email to ${normalizedEmail}: ${mailErr.message}`);
  }

  res.status(200).json({
    status: 'success',
    message: 'Vendor access granted successfully. Login credentials sent via email.',
    data: {
      application,
      restaurant,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
});

/**
 * Admin: Full approval of partner application & business verification
 * Marks both the application and the restaurant as ACTIVE and compliant.
 */
export const adminApproveApplication = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;

  const application = await PartnerApplication.findById(id);
  if (!application) {
    throw new AppError('Partner application not found', 404);
  }

  const normalizedEmail = application.email.toLowerCase().trim();
  const normalizedPhone = application.phoneNumber.trim();

  let user = await User.findOne({
    $or: [{ email: normalizedEmail }, { phoneNumber: normalizedPhone }],
  });

  const generatedPassword = `GoEat#${crypto.randomBytes(3).toString('hex').toUpperCase()}!`;
  let newlyCreatedUser = false;

  if (!user) {
    user = await User.create({
      name: application.ownerName,
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      password: generatedPassword,
      role: UserRole.VENDOR,
      status: UserStatus.ACTIVE,
      isVerified: true,
    });
    newlyCreatedUser = true;
  }

  let restaurant = application.onboardedRestaurant
    ? await Restaurant.findById(application.onboardedRestaurant)
    : await Restaurant.findOne({ owner: user._id });

  if (!restaurant) {
    restaurant = await Restaurant.create({
      owner: user._id,
      name: application.businessName,
      description: `Welcome to ${application.businessName}`,
      address: {
        street: application.businessAddress,
        city: application.city || 'Lagos',
        state: 'Lagos',
        zipCode: '100001',
      },
      location: {
        type: 'Point',
        coordinates: [3.3792, 6.5244],
      },
      outletType: 'Restaurant',
      baseCurrency: 'NGN',
      status: RestaurantStatus.ACTIVE,
      complianceStatus: 'approved',
      businessPhone: normalizedPhone,
      phone: normalizedPhone,
      phoneNumber: normalizedPhone,
      phoneContact: normalizedPhone,
      verificationDocuments: {
        ninUrl: application.ninUrl || application.documents?.ninUrl || '',
        foodHygieneUrl: application.foodHygieneUrl || application.documents?.foodHygieneUrl || '',
        cacUrl: application.cacUrl || application.documents?.cacUrl || '',
      },
    });

    user.restaurantId = restaurant._id as mongoose.Types.ObjectId;
    await user.save({ validateBeforeSave: false });
  } else {
    restaurant.status = RestaurantStatus.ACTIVE;
    restaurant.complianceStatus = 'approved';
    if (!restaurant.verificationDocuments) {
      restaurant.verificationDocuments = {
        ninUrl: application.ninUrl || application.documents?.ninUrl || '',
        foodHygieneUrl: application.foodHygieneUrl || application.documents?.foodHygieneUrl || '',
        cacUrl: application.cacUrl || application.documents?.cacUrl || '',
      };
    }
    await restaurant.save();
  }

  application.status = 'approved';
  application.hasAccessGranted = true;
  application.onboardedRestaurant = restaurant._id as mongoose.Types.ObjectId;
  application.reviewedBy = req.user?._id;
  application.reviewedAt = new Date();
  await application.save();

  // If user was newly created, send their welcome credentials
  if (newlyCreatedUser) {
    try {
      await emailService.sendTemplateEmail(
        normalizedEmail,
        'WELCOME_PARTNER',
        'Welcome to GoEat — Application Approved!',
        {
          partnerName: application.ownerName,
          restaurantName: application.businessName,
          loginUrl: process.env.VENDOR_DASHBOARD_URL || 'https://partner.goeat.com',
          email: normalizedEmail,
          password: generatedPassword,
        },
        'partners'
      );
    } catch (mailErr: any) {
      logger.warn(`Failed to dispatch approval email: ${mailErr.message}`);
    }
  }

  res.status(200).json({
    status: 'success',
    message: 'Partner application fully approved and restaurant activated!',
    data: {
      application,
      restaurant,
    },
  });
});
