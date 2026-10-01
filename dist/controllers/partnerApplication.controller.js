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
    const files = req.files;
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
    const resolvedOwnerName = ownerName || `${firstName || ''} ${lastName || ''}`.trim() || 'Valued Partner';
    if (!businessName || !businessAddress || !email || !phoneNumber) {
        throw new appError_1.default('Business name, business address, email, and phone number are required', 400);
    }
    // Verification requirements: NIN and Food Hygiene are mandatory, CAC is optional
    if (!ninUrl) {
        throw new appError_1.default('National Identification Number (NIN) document is required for verification', 400);
    }
    if (!foodHygieneUrl) {
        throw new appError_1.default('Food Hygiene Certificate is required for verification', 400);
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
        await email_service_1.default.sendPartnerApplicationReceived(email.toLowerCase().trim(), {
            ownerName: resolvedOwnerName,
            businessName,
            businessType: resolvedBusinessType,
            businessAddress,
            email,
            phoneNumber,
        });
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
