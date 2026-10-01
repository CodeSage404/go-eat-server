"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePartnerApplicationStatus = exports.getPartnerApplicationById = exports.getAllPartnerApplications = exports.applyForPartnership = void 0;
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const partnerApplication_model_1 = __importDefault(require("../models/partnerApplication.model"));
const email_service_1 = __importDefault(require("../services/email.service"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Public controller: submit a new partner application
 */
exports.applyForPartnership = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { businessName, businessAddress, businessType, ownerName, firstName, lastName, email, phoneNumber, city, } = req.body;
    const resolvedOwnerName = ownerName || `${firstName || ''} ${lastName || ''}`.trim() || 'Valued Partner';
    if (!businessName || !businessAddress || !email || !phoneNumber) {
        throw new appError_1.default('Business name, business address, email, and phone number are required', 400);
    }
    const validTypes = ['restaurant', 'grocery', 'convenience', 'bakery', 'cafe', 'other'];
    const resolvedBusinessType = validTypes.includes((businessType || '').toLowerCase())
        ? (businessType || '').toLowerCase()
        : 'restaurant';
    const application = await partnerApplication_model_1.default.create({
        businessName: businessName.trim(),
        businessAddress: businessAddress.trim(),
        businessType: resolvedBusinessType,
        ownerName: resolvedOwnerName,
        email: email.toLowerCase().trim(),
        phoneNumber: phoneNumber.trim(),
        city: city ? city.trim() : '',
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
        await email_service_1.default.sendEmail(email.toLowerCase().trim(), 'Your GoEat Partner Application has been received!', confirmationHtml, 'partners');
    }
    catch (err) {
        logger_1.default.warn(`Failed to dispatch partner application confirmation email to ${email}: ${err.message}`);
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
exports.getAllPartnerApplications = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { status, search, page = 1, limit = 20 } = req.query;
    const filter = {};
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
        partnerApplication_model_1.default.find(filter)
            .populate('reviewedBy', 'name email')
            .populate('onboardedRestaurant', 'name status address')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum),
        partnerApplication_model_1.default.countDocuments(filter),
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
exports.getPartnerApplicationById = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { id } = req.params;
    const application = await partnerApplication_model_1.default.findById(id)
        .populate('reviewedBy', 'name email')
        .populate('onboardedRestaurant', 'name status address');
    if (!application) {
        throw new appError_1.default('Partner application not found', 404);
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
exports.updatePartnerApplicationStatus = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { id } = req.params;
    const { status, adminNotes, onboardedRestaurant } = req.body;
    const updateData = {};
    if (status) {
        const validStatuses = ['pending', 'under_review', 'approved', 'rejected'];
        if (!validStatuses.includes(status)) {
            throw new appError_1.default('Invalid application status', 400);
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
    const application = await partnerApplication_model_1.default.findByIdAndUpdate(id, updateData, { returnDocument: 'after', runValidators: true });
    if (!application) {
        throw new appError_1.default('Partner application not found', 404);
    }
    res.status(200).json({
        status: 'success',
        message: 'Partner application updated successfully',
        data: {
            application,
        },
    });
});
