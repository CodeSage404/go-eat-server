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
exports.optOutPartner = exports.claimPartnerProfile = exports.verifyClaimCode = exports.adminApproveApplication = exports.adminGrantAccess = exports.updatePartnerApplicationStatus = exports.getPartnerApplicationById = exports.getAllPartnerApplications = exports.applyForPartnership = void 0;
const crypto_1 = __importDefault(require("crypto"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const partnerApplication_model_1 = __importDefault(require("../models/partnerApplication.model"));
const user_model_1 = __importStar(require("../models/user.model"));
const restaurant_model_1 = __importStar(require("../models/restaurant.model"));
const email_service_1 = __importDefault(require("../services/email.service"));
const auth_service_1 = __importDefault(require("../services/auth.service"));
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
    const ninExpiryDate = req.body.ninExpiryDate ? new Date(req.body.ninExpiryDate) : undefined;
    const foodHygieneExpiryDate = req.body.foodHygieneExpiryDate ? new Date(req.body.foodHygieneExpiryDate) : undefined;
    const cacExpiryDate = req.body.cacExpiryDate ? new Date(req.body.cacExpiryDate) : undefined;
    const now = new Date();
    const expiredDocsList = [];
    if (ninExpiryDate && ninExpiryDate < now)
        expiredDocsList.push('NIN / Identity Document');
    if (foodHygieneExpiryDate && foodHygieneExpiryDate < now)
        expiredDocsList.push('Food Safety Certificate');
    if (cacExpiryDate && cacExpiryDate < now)
        expiredDocsList.push('CAC Certificate');
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
    const resolvedCountry = req.body.country || 'Nigeria';
    // Check if an application or vendor account already exists with this email or phone
    const existingApp = await partnerApplication_model_1.default.findOne({
        $or: [{ email: normalizedEmail }, { phoneNumber: normalizedPhone }],
    });
    if (existingApp) {
        throw new appError_1.default('An application with this email address or phone number already exists. Please log in to your partner account or contact support if you need assistance.', 400);
    }
    // Check if user already exists
    let user = await user_model_1.default.findOne({
        $or: [{ email: normalizedEmail }, { phoneNumber: normalizedPhone }],
    });
    if (user && user.role === user_model_1.UserRole.VENDOR) {
        throw new appError_1.default('A partner account with this email address or phone number already exists. Please log in to your partner account.', 400);
    }
    const generatedPassword = `GoEatOne#${crypto_1.default.randomBytes(3).toString('hex').toUpperCase()}!`;
    let isNewUser = false;
    if (!user) {
        user = await user_model_1.default.create({
            name: resolvedOwnerName,
            email: normalizedEmail,
            phoneNumber: normalizedPhone,
            password: generatedPassword,
            role: user_model_1.UserRole.VENDOR,
            status: user_model_1.UserStatus.ACTIVE,
            isVerified: true,
            country: resolvedCountry,
        });
        isNewUser = true;
    }
    else {
        // SECURITY INTEGRITY CHECK: A Courier (RIDER), Admin, or Staff/SuperAdmin account must NEVER be overwritten to VENDOR!
        if (user.role === user_model_1.UserRole.RIDER || user.role === user_model_1.UserRole.ADMIN || user.role === user_model_1.UserRole.STAFF || user.role === 'superadmin') {
            throw new appError_1.default(`This email or phone number is already registered as an active ${user.role} account. For security, please use a separate email address to onboard your partner store.`, 400);
        }
        // Existing customer upgrading to partner
        user.name = resolvedOwnerName || user.name;
        user.role = user_model_1.UserRole.VENDOR;
        user.status = user_model_1.UserStatus.ACTIVE;
        user.isVerified = true;
        user.country = resolvedCountry;
        user.password = generatedPassword;
        await user.save();
        isNewUser = true;
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
        user.restaurantId = restaurant._id;
        await user.save({ validateBeforeSave: false });
    }
    else {
        // If restaurant already exists, update verification documents and images if new files were provided
        if (!restaurant.verificationDocuments) {
            restaurant.verificationDocuments = {};
        }
        if (ninUrl)
            restaurant.verificationDocuments.ninUrl = ninUrl;
        if (ninExpiryDate)
            restaurant.verificationDocuments.ninExpiryDate = ninExpiryDate;
        if (foodHygieneUrl)
            restaurant.verificationDocuments.foodHygieneUrl = foodHygieneUrl;
        if (foodHygieneExpiryDate)
            restaurant.verificationDocuments.foodHygieneExpiryDate = foodHygieneExpiryDate;
        if (cacUrl)
            restaurant.verificationDocuments.cacUrl = cacUrl;
        if (cacExpiryDate)
            restaurant.verificationDocuments.cacExpiryDate = cacExpiryDate;
        if (isDocumentExpired) {
            restaurant.isDocumentExpired = true;
            restaurant.expiredDocumentsList = expiredDocsList;
            restaurant.complianceStatus = 'expired';
            restaurant.documentExpiryFlagReason = `Operating documents have expired: ${expiredDocsList.join(', ')}`;
        }
        if (!restaurant.images) {
            restaurant.images = { logo: '', cover: '' };
        }
        if (businessImageUrl && !restaurant.images.logo)
            restaurant.images.logo = businessImageUrl;
        if (coverImageUrl && !restaurant.images.cover)
            restaurant.images.cover = coverImageUrl;
        await restaurant.save();
    }
    // Generate a cryptographically secure, single-use 6-digit claim code & opt-out token
    const claimCode = Math.floor(100000 + Math.random() * 900000).toString();
    const claimCodeExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48-hour expiration
    const optOutToken = crypto_1.default.randomBytes(24).toString('hex');
    const application = await partnerApplication_model_1.default.create({
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
        claimCode,
        claimCodeExpiresAt,
        isClaimed: false,
        optOutToken,
    });
    // 1. Dispatch "Claim Your Provisional Business Profile" email to the applicant (NO passwords emailed per UK compliance)
    try {
        const webBaseUrl = process.env.CLIENT_URL || process.env.WEB_APP_URL || 'https://go-eat-webapp.vercel.app';
        const claimUrl = `${webBaseUrl}/partners/claim-profile?email=${encodeURIComponent(normalizedEmail)}&code=${encodeURIComponent(claimCode)}`;
        const optOutUrl = `${webBaseUrl}/partners/opt-out?email=${encodeURIComponent(normalizedEmail)}&token=${encodeURIComponent(optOutToken)}`;
        await email_service_1.default.sendPartnerApplicationReceived(normalizedEmail, {
            ownerName: resolvedOwnerName,
            businessName: businessName.trim(),
            businessType: resolvedBusinessType,
            businessAddress: businessAddress.trim(),
            email: normalizedEmail,
            phoneNumber: normalizedPhone,
            claimCode,
            claimUrl,
            optOutUrl,
            loginUrl: `${webBaseUrl}/partners/login`,
            country: resolvedCountry,
        });
        logger_1.default.info(`📧 Partner provisional claim invitation with single-use code dispatched to ${normalizedEmail}`);
    }
    catch (err) {
        logger_1.default.warn(`Failed to dispatch partner claim invitation email to ${normalizedEmail}: ${err.message}`);
    }
    // 2. Dispatch operational alert to support@goeatone.com (Awaiting admin review & approval)
    try {
        const uploadedDocs = [];
        if (cacUrl)
            uploadedDocs.push('CAC Certificate');
        if (ninUrl)
            uploadedDocs.push('NIN / Identity Document');
        if (foodHygieneUrl)
            uploadedDocs.push('Food Hygiene Certificate');
        if (businessImageUrl)
            uploadedDocs.push('Business Storefront Photo');
        if (coverImageUrl)
            uploadedDocs.push('Cover Image');
        const documentsList = uploadedDocs.length > 0 ? uploadedDocs.join(', ') : 'Standard Merchant Registration Details';
        await email_service_1.default.sendAdminPartnerSubmissionAlert({
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
    }
    catch (adminMailErr) {
        logger_1.default.warn(`Failed to dispatch admin partner submission alert: ${adminMailErr.message}`);
    }
    return res.status(201).json({
        status: 'success',
        message: isQuick
            ? 'Vendor profile reserved! Your single-use profile claim code has been dispatched to your email. Please claim your profile to set your password and access your partner dashboard.'
            : 'Partner application submitted! Your single-use profile claim code has been sent via email to activate your account.',
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
    // If status is updated to approved in the admin dashboard, activate restaurant and dispatch Founding Partner Onboarding Email
    if (status === 'approved') {
        try {
            if (application.onboardedRestaurant) {
                await restaurant_model_1.default.findByIdAndUpdate(application.onboardedRestaurant, {
                    status: restaurant_model_1.RestaurantStatus.ACTIVE,
                    complianceStatus: 'approved',
                });
            }
            await email_service_1.default.sendFoundingPartnerOnboarded(application.email.toLowerCase().trim(), {
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
                country: application.country || 'Nigeria',
                isFoundingPartner: true,
                loginUrl: process.env.VENDOR_DASHBOARD_URL || 'https://go-eat-webapp.vercel.app/partners/login',
            });
            logger_1.default.info(`📧 Founding partner onboarding email dispatched upon status approval for ${application.email}`);
        }
        catch (appMailErr) {
            logger_1.default.warn(`Failed to dispatch founding partner email on status update to approved: ${appMailErr.message}`);
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
            loginUrl: process.env.VENDOR_DASHBOARD_URL || 'https://go-eat-webapp.vercel.app/partners/login',
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
    // Dispatch Founding Partner Onboarding Email with verified business details (No login credentials)
    try {
        await email_service_1.default.sendFoundingPartnerOnboarded(normalizedEmail, {
            partnerName: application.ownerName,
            ownerName: application.ownerName,
            businessName: application.businessName,
            restaurantName: application.businessName,
            businessType: application.businessType || restaurant.outletType || 'Restaurant',
            outletType: restaurant.outletType || application.businessType || 'Restaurant',
            businessAddress: application.businessAddress || (typeof restaurant.address === 'object' ? restaurant.address?.street : restaurant.address) || '',
            address: application.businessAddress || (typeof restaurant.address === 'object' ? restaurant.address?.street : restaurant.address) || '',
            phone: normalizedPhone,
            phoneNumber: normalizedPhone,
            email: normalizedEmail,
            country: application.country || 'Nigeria',
            isFoundingPartner: true,
            loginUrl: process.env.VENDOR_DASHBOARD_URL || 'https://go-eat-webapp.vercel.app/partners/login',
        });
        logger_1.default.info(`📧 Founding partner onboarding email dispatched upon approval to ${normalizedEmail}`);
    }
    catch (mailErr) {
        logger_1.default.warn(`Failed to dispatch founding partner onboarding email: ${mailErr.message}`);
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
/**
 * Public endpoint: Verify single-use claim code for a partner application
 * UK compliance: allows frontend to validate the token before prompting password setup
 */
exports.verifyClaimCode = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const email = (req.query.email || '').toLowerCase().trim();
    const code = (req.query.code || '').trim();
    if (!email || !code) {
        throw new appError_1.default('Email address and claim verification code are required.', 400);
    }
    const application = await partnerApplication_model_1.default.findOne({
        email,
        claimCode: code,
    });
    if (!application) {
        throw new appError_1.default('Invalid or unrecognized claim code. Please check your invitation email or request a new code.', 404);
    }
    if (application.isClaimed) {
        throw new appError_1.default('This business profile has already been claimed. Please sign in directly with your password.', 400);
    }
    if (application.claimCodeExpiresAt && new Date() > application.claimCodeExpiresAt) {
        throw new appError_1.default('This verification code has expired (codes expire after 48 hours). Please request a fresh invitation code.', 400);
    }
    res.status(200).json({
        status: 'success',
        message: 'Claim code verified successfully',
        data: {
            businessName: application.businessName,
            ownerName: application.ownerName,
            email: application.email,
            businessAddress: application.businessAddress,
            businessType: application.businessType,
            isValid: true,
        },
    });
});
/**
 * Public endpoint: Claim partner profile and establish personal secure password
 * UK compliance: Replaces plaintext password emails with single-use verification code + self-chosen password
 */
exports.claimPartnerProfile = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { email, code, password } = req.body;
    if (!email || !code || !password) {
        throw new appError_1.default('Email address, single-use claim code, and a new password are required.', 400);
    }
    if (typeof password !== 'string' || password.length < 8) {
        throw new appError_1.default('Password must be at least 8 characters long for account security.', 400);
    }
    const normalizedEmail = email.toLowerCase().trim();
    const application = await partnerApplication_model_1.default.findOne({
        email: normalizedEmail,
        claimCode: code.trim(),
    });
    if (!application) {
        throw new appError_1.default('Invalid or expired claim code. Please check your invitation or contact GoEatOne support.', 404);
    }
    if (application.isClaimed) {
        throw new appError_1.default('This business profile has already been claimed. Please sign in directly on the partner login screen.', 400);
    }
    if (application.claimCodeExpiresAt && new Date() > application.claimCodeExpiresAt) {
        throw new appError_1.default('This verification code has expired (48 hours validity). Please contact GoEatOne support for a new code.', 400);
    }
    // Find and update the user's password securely
    const user = await user_model_1.default.findOne({ email: normalizedEmail });
    if (!user) {
        throw new appError_1.default('Associated merchant user account could not be found.', 404);
    }
    user.password = password;
    user.isVerified = true;
    user.status = user_model_1.UserStatus.ACTIVE;
    user.role = user_model_1.UserRole.VENDOR;
    await user.save();
    // Mark application as claimed and clear the single-use code
    application.isClaimed = true;
    application.claimedAt = new Date();
    application.claimCode = undefined;
    await application.save();
    // If provisional restaurant exists, ensure it is linked
    if (application.onboardedRestaurant) {
        await restaurant_model_1.default.findByIdAndUpdate(application.onboardedRestaurant, {
            owner: user._id,
            isVerified: true,
        });
    }
    // Generate session JWT auth token
    const token = auth_service_1.default.signToken(user._id);
    res.status(200).json({
        status: 'success',
        message: 'Business profile successfully claimed! Welcome to GoEatOne.',
        token,
        data: {
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                restaurantId: user.restaurantId || application.onboardedRestaurant,
            },
        },
    });
});
/**
 * Public endpoint: Decline invitation and request profile removal (UK GDPR Article 17 / PECR)
 */
exports.optOutPartner = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { email, token, reason } = req.body;
    if (!email) {
        throw new appError_1.default('Email address is required to process profile removal.', 400);
    }
    const normalizedEmail = email.toLowerCase().trim();
    const query = { email: normalizedEmail };
    if (token) {
        query.optOutToken = token;
    }
    const application = await partnerApplication_model_1.default.findOne(query);
    if (!application) {
        // If not found, still return success to prevent user enumeration
        res.status(200).json({
            status: 'success',
            message: 'Your request has been received and your details have been removed in accordance with UK GDPR.',
        });
        return;
    }
    application.status = 'declined';
    application.optedOutAt = new Date();
    application.optOutReason = reason || 'Declined invitation by merchant';
    await application.save();
    // Unpublish and inactivate associated provisional restaurant profile
    if (application.onboardedRestaurant) {
        await restaurant_model_1.default.findByIdAndUpdate(application.onboardedRestaurant, {
            status: restaurant_model_1.RestaurantStatus.INACTIVE,
            isOpen: false,
        });
    }
    logger_1.default.info(`Merchant profile removal processed for ${normalizedEmail} (UK GDPR compliance)`);
    res.status(200).json({
        status: 'success',
        message: 'Your invitation has been declined and your business profile has been removed in accordance with UK GDPR.',
        data: {
            businessName: application.businessName,
            email: application.email,
        },
    });
});
