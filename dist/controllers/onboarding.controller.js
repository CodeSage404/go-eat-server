"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInterest = exports.getRiderOnboardingStatus = exports.riderRegisterOnboarding = exports.vendorStep4Compliance = exports.vendorStep3IdentityVerification = exports.vendorStep2BusinessDetails = exports.vendorStep1SelectOutlet = exports.getMainOutlets = void 0;
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const restaurant_model_1 = __importDefault(require("../models/restaurant.model"));
const riderOnboarding_model_1 = __importDefault(require("../models/riderOnboarding.model"));
const outlets_1 = require("../constants/outlets");
const email_service_1 = __importDefault(require("../services/email.service"));
exports.getMainOutlets = (0, catchAsync_1.catchAsync)(async (req, res) => {
    res.status(200).json({
        status: 'success',
        results: outlets_1.MAIN_OUTLETS_ARRAY.length,
        data: {
            outlets: outlets_1.MAIN_OUTLETS_ARRAY,
        },
    });
});
exports.vendorStep1SelectOutlet = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { restaurantId, outletType } = req.body;
    const validOutlets = [
        'Restaurant',
        'Smokey Wheel',
        'Grocery',
        'Specialty Store',
        'Convenience',
        'Health & Wellness',
        'Lifestyle',
    ];
    if (!validOutlets.includes(outletType)) {
        throw new appError_1.default('Invalid outlet type selected', 400);
    }
    const restaurant = await restaurant_model_1.default.findByIdAndUpdate(restaurantId, { outletType }, { new: true, runValidators: true });
    if (!restaurant) {
        throw new appError_1.default('Vendor / Restaurant profile not found', 404);
    }
    res.status(200).json({
        status: 'success',
        data: {
            restaurant,
        },
    });
});
exports.vendorStep2BusinessDetails = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { restaurantId, tradingName, businessCategory, lga, deliveryRadius, businessPhone, businessEmail, businessWebsite, bankDetails, } = req.body;
    const restaurant = await restaurant_model_1.default.findById(restaurantId);
    if (!restaurant) {
        throw new appError_1.default('Vendor / Restaurant profile not found', 404);
    }
    // Perform automatic bank account name matching check against verified NIN or CAC if present
    let isBankVerified = false;
    if (bankDetails && bankDetails.accountName) {
        const verifiedNinName = restaurant.ninVerification?.verifiedName?.toLowerCase();
        const accountNameLower = String(bankDetails.accountName).toLowerCase();
        if (verifiedNinName && accountNameLower.includes(verifiedNinName)) {
            isBankVerified = true;
        }
        else if (!verifiedNinName) {
            // If NIN not yet verified, mark bank as unverified until NIN match
            isBankVerified = false;
        }
    }
    const updatedRestaurant = await restaurant_model_1.default.findByIdAndUpdate(restaurantId, {
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
    }, { new: true, runValidators: true });
    res.status(200).json({
        status: 'success',
        data: {
            restaurant: updatedRestaurant,
        },
    });
});
exports.vendorStep3IdentityVerification = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { restaurantId, ninVerification, cacRegistration } = req.body;
    const restaurant = await restaurant_model_1.default.findByIdAndUpdate(restaurantId, {
        ninVerification: ninVerification
            ? {
                ...ninVerification,
                identityStatus: 'verified', // Simulated verified status from API integration
            }
            : undefined,
        cacRegistration,
    }, { new: true, runValidators: true });
    if (!restaurant) {
        throw new appError_1.default('Vendor / Restaurant profile not found', 404);
    }
    res.status(200).json({
        status: 'success',
        data: {
            restaurant,
        },
    });
});
exports.vendorStep4Compliance = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { restaurantId, complianceStatus } = req.body;
    const restaurant = await restaurant_model_1.default.findByIdAndUpdate(restaurantId, {
        complianceStatus: complianceStatus || 'approved',
    }, { new: true, runValidators: true });
    if (!restaurant) {
        throw new appError_1.default('Vendor / Restaurant profile not found', 404);
    }
    res.status(200).json({
        status: 'success',
        data: {
            restaurant,
        },
    });
});
exports.riderRegisterOnboarding = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) {
        throw new appError_1.default('User not authenticated', 401);
    }
    const onboardingData = {
        ...req.body,
        user: userId,
    };
    const existingProfile = await riderOnboarding_model_1.default.findOne({ user: userId });
    let riderProfile;
    if (existingProfile) {
        riderProfile = await riderOnboarding_model_1.default.findByIdAndUpdate(existingProfile._id, onboardingData, { new: true, runValidators: true });
    }
    else {
        riderProfile = await riderOnboarding_model_1.default.create(onboardingData);
    }
    res.status(200).json({
        status: 'success',
        data: {
            riderProfile,
        },
    });
});
exports.getRiderOnboardingStatus = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const userId = req.user?._id;
    const riderProfile = await riderOnboarding_model_1.default.findOne({ user: userId });
    if (!riderProfile) {
        throw new appError_1.default('Rider onboarding profile not found', 404);
    }
    res.status(200).json({
        status: 'success',
        data: {
            riderProfile,
        },
    });
});
exports.registerInterest = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const { type, Email, ...formData } = req.body; // 'Email' maps to the form field 'Email'
    if (!Email) {
        throw new appError_1.default('Email is required', 400);
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
    await email_service_1.default.sendEmail(Email, subject, htmlContent, 'partners');
    res.status(200).json({
        status: 'success',
        message: 'Information received and confirmation email sent.',
    });
});
