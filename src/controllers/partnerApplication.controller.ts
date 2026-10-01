import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import AppError from '../utils/appError';
import PartnerApplication from '../models/partnerApplication.model';
import emailService from '../services/email.service';
import logger from '../utils/logger';

/**
 * Public controller: submit a new partner application
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
  } = req.body;

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

  // Verification requirements: NIN and Food Hygiene are mandatory, CAC is optional
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

  const validTypes = ['restaurant', 'grocery', 'convenience', 'bakery', 'cafe', 'other'];
  const resolvedBusinessType = validTypes.includes((businessType || '').toLowerCase())
    ? (businessType || '').toLowerCase()
    : 'restaurant';

  const application = await PartnerApplication.create({
    businessName: businessName.trim(),
    businessAddress: businessAddress.trim(),
    businessType: resolvedBusinessType,
    ownerName: resolvedOwnerName,
    email: email.toLowerCase().trim(),
    phoneNumber: phoneNumber.trim(),
    city: city ? city.trim() : '',
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

  // Dispatch acknowledgement email to the applicant
  try {
    const confirmationHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; color: #1f2937; border-radius: 16px; border: 1px solid #f3f4f6;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #103E27; font-size: 26px; font-weight: 800; margin: 0;">GoEat Partner Portal</h1>
          <p style="color: #6b7280; font-size: 14px; margin-top: 4px;">Application Received</p>
        </div>
        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h2 style="color: #15803d; font-size: 18px; margin: 0 0 8px 0; font-weight: 700;">Hello ${resolvedOwnerName},</h2>
          <p style="margin: 0; color: #166534; font-size: 14px; line-height: 1.5;">
            Thank you for applying to partner with GoEat for <strong>${businessName}</strong>. We have received your application and it is now under review by our onboarding team.
          </p>
        </div>
        <div style="background-color: #fafafa; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <h3 style="font-size: 13px; color: #374151; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 12px 0;">Submitted Details:</h3>
          <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px; color: #4b5563; line-height: 1.8;">
            <li><strong>Business Name:</strong> ${businessName}</li>
            <li><strong>Business Type:</strong> ${resolvedBusinessType}</li>
            <li><strong>Address:</strong> ${businessAddress}</li>
            <li><strong>Contact Email:</strong> ${email}</li>
            <li><strong>Phone Number:</strong> ${phoneNumber}</li>
          </ul>
        </div>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.6;">
          <strong>What happens next?</strong><br />
          Our merchant review team will inspect your application. Once approved, you will receive an onboarding confirmation email containing your Partner Portal access credentials (email and temporary password) so you can begin configuring your menu and accepting live orders.
        </p>
        <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px;">
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} GoEat. All rights reserved.</p>
          <p style="margin: 4px 0 0 0;">This is an automated notification. Please do not reply directly to this email.</p>
        </div>
      </div>
    `;

    await emailService.sendEmail(
      email.toLowerCase().trim(),
      'Your GoEat Partner Application has been received!',
      confirmationHtml,
      'partners'
    );
  } catch (err: any) {
    logger.warn(`Failed to dispatch partner application confirmation email to ${email}: ${err.message}`);
  }

  res.status(201).json({
    status: 'success',
    message: 'Partner application submitted successfully. Confirmation email sent.',
    data: {
      application,
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
