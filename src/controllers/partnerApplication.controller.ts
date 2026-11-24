import { Request, Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import PartnerApplication from '../models/partnerApplication.model';
import User, { UserRole, UserStatus } from '../models/user.model';
import Restaurant, { RestaurantStatus } from '../models/restaurant.model';
import emailService from '../services/email.service';
import authService from '../services/auth.service';
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
  let businessImageUrl = req.body.businessImageUrl || req.body['businessImageUrl'] || '';
  let coverImageUrl = req.body.coverImageUrl || req.body['coverImageUrl'] || '';

  const ninExpiryDate = req.body.ninExpiryDate ? new Date(req.body.ninExpiryDate) : undefined;
  const foodHygieneExpiryDate = req.body.foodHygieneExpiryDate ? new Date(req.body.foodHygieneExpiryDate) : undefined;
  const cacExpiryDate = req.body.cacExpiryDate ? new Date(req.body.cacExpiryDate) : undefined;

  const now = new Date();
  const expiredDocsList: string[] = [];
  if (ninExpiryDate && ninExpiryDate < now) expiredDocsList.push('NIN / Identity Document');
  if (foodHygieneExpiryDate && foodHygieneExpiryDate < now) expiredDocsList.push('Food Safety Certificate');
  if (cacExpiryDate && cacExpiryDate < now) expiredDocsList.push('CAC Certificate');
  const isDocumentExpired = expiredDocsList.length > 0;

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
    if (files['businessImage'] && files['businessImage'][0]) {
      businessImageUrl = files['businessImage'][0].path;
    }
    if (files['coverImage'] && files['coverImage'][0]) {
      coverImageUrl = files['coverImage'][0].path;
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

  const resolvedCountry = req.body.country || 'Nigeria';

  // Check if an application or vendor account already exists with this email or phone
  const existingApp = await PartnerApplication.findOne({
    $or: [{ email: normalizedEmail }, { phoneNumber: normalizedPhone }],
  });
  if (existingApp) {
    throw new AppError(
      'An application with this email address or phone number already exists. Please log in to your partner account or contact support if you need assistance.',
      400
    );
  }

  // Check if user already exists
  let user = await User.findOne({
    $or: [{ email: normalizedEmail }, { phoneNumber: normalizedPhone }],
  });

  if (user && user.role === UserRole.VENDOR) {
    throw new AppError(
      'A partner account with this email address or phone number already exists. Please log in to your partner account.',
      400
    );
  }

  const generatedPassword = `GoEatOne#${crypto.randomBytes(3).toString('hex').toUpperCase()}!`;
  let isNewUser = false;

  if (!user) {
    user = await User.create({
      name: resolvedOwnerName,
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      password: generatedPassword,
      role: UserRole.VENDOR,
      status: UserStatus.ACTIVE,
      isVerified: true,
      country: resolvedCountry,
    });
    isNewUser = true;
  } else {
    // SECURITY INTEGRITY CHECK: A Courier (RIDER), Admin, or Staff/SuperAdmin account must NEVER be overwritten to VENDOR!
    if (user.role === UserRole.RIDER || user.role === UserRole.ADMIN || user.role === UserRole.STAFF || (user.role as string) === 'superadmin') {
      throw new AppError(
        `This email or phone number is already registered as an active ${user.role} account. For security, please use a separate email address to onboard your partner store.`,
        400
      );
    }

    // Existing customer upgrading to partner
    user.name = resolvedOwnerName || user.name;
    user.role = UserRole.VENDOR;
    user.status = UserStatus.ACTIVE;
    user.isVerified = true;
    user.country = resolvedCountry;
    user.password = generatedPassword;
    await user.save();
    isNewUser = true;
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
      businessPhone: normalizedPhone,
      phone: normalizedPhone,
      phoneNumber: normalizedPhone,
      phoneContact: normalizedPhone,
      images: {
        logo: businessImageUrl || '',
        cover: coverImageUrl || '',
      },
      verificationDocuments: {
        ninUrl: ninUrl || '',
        ninExpiryDate,
        foodHygieneUrl: foodHygieneUrl || '',
        foodHygieneExpiryDate,
        cacUrl: cacUrl || '',
        cacExpiryDate,
      },
      isDocumentExpired,
      expiredDocumentsList: expiredDocsList,
      complianceStatus: isDocumentExpired ? 'expired' : 'pending',
      documentExpiryFlagReason: isDocumentExpired ? `Operating documents have expired: ${expiredDocsList.join(', ')}` : '',
    });

    user.restaurantId = restaurant._id as mongoose.Types.ObjectId;
    await user.save({ validateBeforeSave: false });
  } else {
    // If restaurant already exists, update verification documents and images if new files were provided
    if (!restaurant.verificationDocuments) {
      restaurant.verificationDocuments = {};
    }
    if (ninUrl) restaurant.verificationDocuments.ninUrl = ninUrl;
    if (ninExpiryDate) restaurant.verificationDocuments.ninExpiryDate = ninExpiryDate;
    if (foodHygieneUrl) restaurant.verificationDocuments.foodHygieneUrl = foodHygieneUrl;
    if (foodHygieneExpiryDate) restaurant.verificationDocuments.foodHygieneExpiryDate = foodHygieneExpiryDate;
    if (cacUrl) restaurant.verificationDocuments.cacUrl = cacUrl;
    if (cacExpiryDate) restaurant.verificationDocuments.cacExpiryDate = cacExpiryDate;

    if (isDocumentExpired) {
      restaurant.isDocumentExpired = true;
      restaurant.expiredDocumentsList = expiredDocsList;
      restaurant.complianceStatus = 'expired';
      restaurant.documentExpiryFlagReason = `Operating documents have expired: ${expiredDocsList.join(', ')}`;
    }

    if (!restaurant.images) {
      restaurant.images = { logo: '', cover: '' };
    }
    if (businessImageUrl && !restaurant.images.logo) restaurant.images.logo = businessImageUrl;
    if (coverImageUrl && !restaurant.images.cover) restaurant.images.cover = coverImageUrl;
    await restaurant.save();
  }

  const application = await PartnerApplication.create({
    businessName: businessName.trim(),
    businessAddress: businessAddress.trim(),
    businessType: resolvedBusinessType,
    ownerName: resolvedOwnerName,
    email: normalizedEmail,
    phoneNumber: normalizedPhone,
    city: city ? city.trim() : '',
    applicationType: isQuick ? 'quick' : 'full',
    hasAccessGranted: true,
    onboardedRestaurant: restaurant._id,
    documents: {
      ninUrl,
      ninExpiryDate,
      foodHygieneUrl,
      foodHygieneExpiryDate,
      cacUrl,
      cacExpiryDate,
      isDocumentExpired,
      expiredDocuments: expiredDocsList,
    },
    ninUrl,
    ninExpiryDate,
    foodHygieneUrl,
    foodHygieneExpiryDate,
    cacUrl,
    cacExpiryDate,
    isDocumentExpired,
    expiredDocuments: expiredDocsList,
    businessImageUrl,
    coverImageUrl,
    status: 'pending',
  });

  // 1. Dispatch application confirmation email to the applicant with their login credentials
  try {
    await emailService.sendPartnerApplicationReceived(
      normalizedEmail,
      {
        ownerName: resolvedOwnerName,
        businessName: businessName.trim(),
        businessType: resolvedBusinessType,
        businessAddress: businessAddress.trim(),
        email: normalizedEmail,
        phoneNumber: normalizedPhone,
        password: generatedPassword,
        loginUrl: process.env.VENDOR_DASHBOARD_URL || 'https://go-eat-webapp.vercel.app/partners/login',
        country: resolvedCountry,
      }
    );
    logger.info(`📧 Partner application received email with credentials dispatched to ${normalizedEmail}`);
  } catch (err: any) {
    logger.warn(`Failed to dispatch partner application confirmation email to ${email}: ${err.message}`);
  }

  // 2. Dispatch operational alert to support@goeatone.com (Awaiting admin review & approval)
  try {
    const uploadedDocs: string[] = [];
    if (cacUrl) uploadedDocs.push('CAC Certificate');
    if (ninUrl) uploadedDocs.push('NIN / Identity Document');
    if (foodHygieneUrl) uploadedDocs.push('Food Hygiene Certificate');
    if (businessImageUrl) uploadedDocs.push('Business Storefront Photo');
    if (coverImageUrl) uploadedDocs.push('Cover Image');
    const documentsList = uploadedDocs.length > 0 ? uploadedDocs.join(', ') : 'Standard Merchant Registration Details';

    await emailService.sendAdminPartnerSubmissionAlert({
      businessName: businessName.trim(),
      ownerName: resolvedOwnerName,
      email: normalizedEmail,
      phoneNumber: normalizedPhone,
      businessAddress: businessAddress.trim(),
      businessType: resolvedBusinessType,
      country: resolvedCountry,
      documentsList,
      applicationId: application._id.toString(),
    });
  } catch (adminMailErr: any) {
    logger.warn(`Failed to dispatch admin partner submission alert: ${adminMailErr.message}`);
  }

  return res.status(201).json({
    status: 'success',
    message: isQuick
      ? 'Vendor account created! Your login credentials have been dispatched to your email. Please log in to access your partner dashboard.'
      : 'Partner application submitted! Your vendor account has been registered and login credentials sent via email.',
    data: {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      restaurantId: restaurant._id,
      requiresLogin: true,
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

  // If status is updated to approved in the admin dashboard, activate restaurant and dispatch Founding Partner Onboarding Email
  if (status === 'approved') {
    try {
      if (application.onboardedRestaurant) {
        await Restaurant.findByIdAndUpdate(application.onboardedRestaurant, {
          status: RestaurantStatus.ACTIVE,
          complianceStatus: 'approved',
        });
      }
      await emailService.sendFoundingPartnerOnboarded(application.email.toLowerCase().trim(), {
        partnerName: application.ownerName,
        ownerName: application.ownerName,
        businessName: application.businessName,
        restaurantName: application.businessName,
        businessType: application.businessType || 'Restaurant',
        outletType: application.businessType || 'Restaurant',
        businessAddress: application.businessAddress || '',
        address: application.businessAddress || '',
        phone: application.phoneNumber,
        phoneNumber: application.phoneNumber,
        email: application.email.toLowerCase().trim(),
        country: (application as any).country || 'Nigeria',
        isFoundingPartner: true,
        loginUrl: process.env.VENDOR_DASHBOARD_URL || 'https://go-eat-webapp.vercel.app/partners/login',
      });
      logger.info(`📧 Founding partner onboarding email dispatched upon status approval for ${application.email}`);
    } catch (appMailErr: any) {
      logger.warn(`Failed to dispatch founding partner email on status update to approved: ${appMailErr.message}`);
    }
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
        loginUrl: process.env.VENDOR_DASHBOARD_URL || 'https://go-eat-webapp.vercel.app/partners/login',
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

  // Dispatch Founding Partner Onboarding Email with verified business details (No login credentials)
  try {
    await emailService.sendFoundingPartnerOnboarded(normalizedEmail, {
      partnerName: application.ownerName,
      ownerName: application.ownerName,
      businessName: application.businessName,
      restaurantName: application.businessName,
      businessType: application.businessType || restaurant.outletType || 'Restaurant',
      outletType: restaurant.outletType || application.businessType || 'Restaurant',
      businessAddress: application.businessAddress || (typeof restaurant.address === 'object' ? (restaurant.address as any)?.street : restaurant.address) || '',
      address: application.businessAddress || (typeof restaurant.address === 'object' ? (restaurant.address as any)?.street : restaurant.address) || '',
      phone: normalizedPhone,
      phoneNumber: normalizedPhone,
      email: normalizedEmail,
      country: (application as any).country || 'Nigeria',
      isFoundingPartner: true,
      loginUrl: process.env.VENDOR_DASHBOARD_URL || 'https://go-eat-webapp.vercel.app/partners/login',
    });
    logger.info(`📧 Founding partner onboarding email dispatched upon approval to ${normalizedEmail}`);
  } catch (mailErr: any) {
    logger.warn(`Failed to dispatch founding partner onboarding email: ${mailErr.message}`);
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
