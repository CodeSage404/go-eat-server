"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminApproveApplication = exports.adminGrantAccess = exports.updatePartnerApplicationStatus = exports.getPartnerApplicationById = exports.getAllPartnerApplications = exports.applyForPartnership = void 0;
const crypto_1 = __importDefault(require("crypto"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const partnerApplication_model_1 = __importDefault(require("../models/partnerApplication.model"));
const user_model_1 = __importStar(require("../models/user.model"));
const restaurant_model_1 = __importStar(require("../models/restaurant.model"));
const email_service_1 = __importDefault(require("../services/email.service"));
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Public controller: submit a new partner application
 * Supports both Quick Registration (instant vendor account & app access with pending verification)
 * and Full Application (with mandatory NIN and Food Hygiene document review).
 */
exports.applyForPartnership = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { businessName, businessAddress, businessType, ownerName, firstName, lastName, email, phoneNumber, city, applicationType = 'full', } = req.body;
    const isQuick = applicationType === 'quick';
    const files = req.files;
    let ninUrl = req.body.ninUrl || req.body['ninUrl'] || '';
    let foodHygieneUrl = req.body.foodHygieneUrl || req.body['foodHygieneUrl'] || '';
    let cacUrl = req.body.cacUrl || req.body['cacUrl'] || '';
    let businessImageUrl = req.body.businessImageUrl || req.body['businessImageUrl'] || '';
    let coverImageUrl = req.body.coverImageUrl || req.body['coverImageUrl'] || '';
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
    const resolvedOwnerName = ownerName || `${firstName || ''} ${lastName || ''}`.trim() || 'Valued Partner';
    if (!businessName || !businessAddress || !email || !phoneNumber) {
        throw new appError_1.default('Business name, business address, email, and phone number are required', 400);
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
            throw new appError_1.default('National Identification Number (NIN) document is required for verification', 400);
        }
        if (!foodHygieneUrl) {
            throw new appError_1.default('Food Hygiene Certificate is required for verification', 400);
        }
    }
    // Handle Quick Setup (Instant Access Creation)
    if (isQuick) {
        // Check if user already exists
        let user = await user_model_1.default.findOne({
            $or: [{ email: normalizedEmail }, { phoneNumber: normalizedPhone }],
        });
        if (user && user.role !== user_model_1.UserRole.VENDOR) {
            throw new appError_1.default('An account with this email or phone number already exists under a different role', 400);
        }
        const generatedPassword = `GoEat#${crypto_1.default.randomBytes(3).toString('hex').toUpperCase()}!`;
        if (!user) {
            user = await user_model_1.default.create({
                name: resolvedOwnerName,
                email: normalizedEmail,
                phoneNumber: normalizedPhone,
                password: generatedPassword,
                role: user_model_1.UserRole.VENDOR,
                status: user_model_1.UserStatus.ACTIVE,
                isVerified: true,
            });
        }
        // Check if restaurant already exists for this vendor
        let restaurant = await restaurant_model_1.default.findOne({ owner: user._id });
        if (!restaurant) {
            restaurant = await restaurant_model_1.default.create({
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
                status: restaurant_model_1.RestaurantStatus.PENDING, // Pending full document review
                complianceStatus: 'pending',
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
                    foodHygieneUrl: foodHygieneUrl || '',
                    cacUrl: cacUrl || '',
                },
            });
            user.restaurantId = restaurant._id;
            await user.save({ validateBeforeSave: false });
        }
        const application = await partnerApplication_model_1.default.create({
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
            businessImageUrl,
            coverImageUrl,
            status: 'pending',
        });
        // Dispatch Welcome Partner email with generated credentials
        try {
            await email_service_1.default.sendTemplateEmail(normalizedEmail, 'WELCOME_PARTNER', 'Welcome to GoEat — Your Partner Account is Ready!', {
                partnerName: resolvedOwnerName,
                restaurantName: businessName.trim(),
                loginUrl: process.env.VENDOR_DASHBOARD_URL || 'https://partner.goeat.com',
                email: normalizedEmail,
                password: generatedPassword,
            }, 'partners');
        }
        catch (mailErr) {
            logger_1.default.warn(`Failed to dispatch quick partner welcome email: ${mailErr.message}`);
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
    const application = await partnerApplication_model_1.default.create({
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
        businessImageUrl,
        coverImageUrl,
        status: 'pending',
    });
    // Dispatch acknowledgement email to the applicant using EJS template
    try {
        await email_service_1.default.sendPartnerApplicationReceived(normalizedEmail, {
            ownerName: resolvedOwnerName,
            businessName,
            businessType: resolvedBusinessType,
            businessAddress,
            email: normalizedEmail,
            phoneNumber: normalizedPhone,
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
            hasInstantAccess: false,
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
/**
 * Admin: Grant access without document review
 * Immediately provisions a vendor account & pending restaurant profile and emails credentials,
 * allowing the vendor to access the vendor app while their verification documents remain pending.
 */
exports.adminGrantAccess = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { id } = req.params;
    const application = await partnerApplication_model_1.default.findById(id);
    if (!application) {
        throw new appError_1.default('Partner application not found', 404);
    }
    const normalizedEmail = application.email.toLowerCase().trim();
    const normalizedPhone = application.phoneNumber.trim();
    let user = await user_model_1.default.findOne({
        $or: [{ email: normalizedEmail }, { phoneNumber: normalizedPhone }],
    });
    const generatedPassword = `GoEat#${crypto_1.default.randomBytes(3).toString('hex').toUpperCase()}!`;
    if (!user) {
        user = await user_model_1.default.create({
            name: application.ownerName,
            email: normalizedEmail,
            phoneNumber: normalizedPhone,
            password: generatedPassword,
            role: user_model_1.UserRole.VENDOR,
            status: user_model_1.UserStatus.ACTIVE,
            isVerified: true,
        });
    }
    let restaurant = await restaurant_model_1.default.findOne({ owner: user._id });
    if (!restaurant) {
        restaurant = await restaurant_model_1.default.create({
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
            status: restaurant_model_1.RestaurantStatus.PENDING,
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
        user.restaurantId = restaurant._id;
        await user.save({ validateBeforeSave: false });
    }
    application.hasAccessGranted = true;
    application.onboardedRestaurant = restaurant._id;
    application.reviewedBy = req.user?._id;
    application.reviewedAt = new Date();
    if (application.status === 'pending') {
        application.status = 'under_review';
    }
    await application.save();
    // Send credentials email
    try {
        await email_service_1.default.sendTemplateEmail(normalizedEmail, 'WELCOME_PARTNER', 'GoEat Vendor Portal — Access Granted!', {
            partnerName: application.ownerName,
            restaurantName: application.businessName,
            loginUrl: process.env.VENDOR_DASHBOARD_URL || 'https://partner.goeat.com',
            email: normalizedEmail,
            password: generatedPassword,
        }, 'partners');
    }
    catch (mailErr) {
        logger_1.default.warn(`Failed to dispatch grant access email to ${normalizedEmail}: ${mailErr.message}`);
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
exports.adminApproveApplication = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { id } = req.params;
    const application = await partnerApplication_model_1.default.findById(id);
    if (!application) {
        throw new appError_1.default('Partner application not found', 404);
    }
    const normalizedEmail = application.email.toLowerCase().trim();
    const normalizedPhone = application.phoneNumber.trim();
    let user = await user_model_1.default.findOne({
        $or: [{ email: normalizedEmail }, { phoneNumber: normalizedPhone }],
    });
    const generatedPassword = `GoEat#${crypto_1.default.randomBytes(3).toString('hex').toUpperCase()}!`;
    let newlyCreatedUser = false;
    if (!user) {
        user = await user_model_1.default.create({
            name: application.ownerName,
            email: normalizedEmail,
            phoneNumber: normalizedPhone,
            password: generatedPassword,
            role: user_model_1.UserRole.VENDOR,
            status: user_model_1.UserStatus.ACTIVE,
            isVerified: true,
        });
        newlyCreatedUser = true;
    }
    let restaurant = application.onboardedRestaurant
        ? await restaurant_model_1.default.findById(application.onboardedRestaurant)
        : await restaurant_model_1.default.findOne({ owner: user._id });
    if (!restaurant) {
        restaurant = await restaurant_model_1.default.create({
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
            status: restaurant_model_1.RestaurantStatus.ACTIVE,
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
        user.restaurantId = restaurant._id;
        await user.save({ validateBeforeSave: false });
    }
    else {
        restaurant.status = restaurant_model_1.RestaurantStatus.ACTIVE;
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
    application.onboardedRestaurant = restaurant._id;
    application.reviewedBy = req.user?._id;
    application.reviewedAt = new Date();
    await application.save();
    // If user was newly created, send their welcome credentials
    if (newlyCreatedUser) {
        try {
            await email_service_1.default.sendTemplateEmail(normalizedEmail, 'WELCOME_PARTNER', 'Welcome to GoEat — Application Approved!', {
                partnerName: application.ownerName,
                restaurantName: application.businessName,
                loginUrl: process.env.VENDOR_DASHBOARD_URL || 'https://partner.goeat.com',
                email: normalizedEmail,
                password: generatedPassword,
            }, 'partners');
        }
        catch (mailErr) {
            logger_1.default.warn(`Failed to dispatch approval email: ${mailErr.message}`);
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
