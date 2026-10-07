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
const zod_1 = require("zod");
const restaurant_service_1 = __importDefault(require("../services/restaurant.service"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const restaurant_model_1 = __importStar(require("../models/restaurant.model"));
const partnerApplication_model_1 = __importDefault(require("../models/partnerApplication.model"));
const locationResolver_1 = require("../utils/locationResolver");
const daySchedule = zod_1.z.object({
    isOpen: zod_1.z.boolean(),
    open: zod_1.z.string(),
    close: zod_1.z.string(),
});
const openingHoursSchema = zod_1.z.object({
    Monday: daySchedule,
    Tuesday: daySchedule,
    Wednesday: daySchedule,
    Thursday: daySchedule,
    Friday: daySchedule,
    Saturday: daySchedule,
    Sunday: daySchedule,
});
const restaurantSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name is too short'),
    description: zod_1.z.string().min(10, 'Description is too short'),
    address: zod_1.z.object({
        street: zod_1.z.string(),
        city: zod_1.z.string(),
        state: zod_1.z.string(),
        zipCode: zod_1.z.string(),
    }),
    location: zod_1.z.object({
        type: zod_1.z.literal('Point'),
        coordinates: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number()]), // [lng, lat]
    }),
    cuisine: zod_1.z.array(zod_1.z.string()).optional(),
    isSponsored: zod_1.z.boolean().optional(),
    isTopSpot: zod_1.z.boolean().optional(),
    openingHours: openingHoursSchema,
});
const vendorUpdateRestaurantSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name is too short').optional(),
    description: zod_1.z.string().min(10, 'Description is too short').optional(),
    address: zod_1.z.object({
        street: zod_1.z.string(),
        city: zod_1.z.string(),
        state: zod_1.z.string(),
        zipCode: zod_1.z.string(),
    }).optional(),
    location: zod_1.z.object({
        type: zod_1.z.literal('Point'),
        coordinates: zod_1.z.tuple([zod_1.z.number(), zod_1.z.number()]),
    }).optional(),
    cuisine: zod_1.z.array(zod_1.z.string()).optional(),
    openingHours: openingHoursSchema.optional(),
    images: zod_1.z.object({
        logo: zod_1.z.string().optional(),
        cover: zod_1.z.string().optional(),
    }).optional(),
    businessPhone: zod_1.z.string().optional(),
    phone: zod_1.z.string().optional(),
    phoneNumber: zod_1.z.string().optional(),
    phoneContact: zod_1.z.string().optional(),
    businessEmail: zod_1.z.string().email().optional(),
    businessWebsite: zod_1.z.string().optional(),
    tradingName: zod_1.z.string().optional(),
    businessCategory: zod_1.z.string().optional(),
    bankDetails: zod_1.z.object({
        bankName: zod_1.z.string().optional(),
        accountNumber: zod_1.z.string().optional(),
        accountName: zod_1.z.string().optional(),
    }).optional(),
    autoAcceptOrders: zod_1.z.boolean().optional(),
    orderAlerts: zod_1.z.boolean().optional(),
    isSelfPickup: zod_1.z.boolean().optional(),
    specialDays: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        date: zod_1.z.string(),
        description: zod_1.z.string().optional(),
        isClosed: zod_1.z.boolean(),
        open: zod_1.z.string().optional(),
        close: zod_1.z.string().optional(),
    })).optional(),
    hasPromo: zod_1.z.boolean().optional(),
    acceptsPromos: zod_1.z.boolean().optional(),
    promoText: zod_1.z.string().optional(),
    allowStampCards: zod_1.z.boolean().optional(),
    allowFreeGift: zod_1.z.boolean().optional(),
    promos: zod_1.z.array(zod_1.z.any()).optional(),
    isSignatureChef: zod_1.z.boolean().optional(),
    chefProfile: zod_1.z.object({
        bio: zod_1.z.string().optional(),
        culinaryBackground: zod_1.z.string().optional(),
        specialties: zod_1.z.array(zod_1.z.string()).optional(),
        minimumLeadTimeHours: zod_1.z.number().optional(),
        profilePhoto: zod_1.z.string().optional(),
        bannerImage: zod_1.z.string().optional(),
    }).optional(),
    buildYourOwnMealEnabled: zod_1.z.boolean().optional(),
    availableBases: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        price: zod_1.z.number(),
    })).optional(),
    ingredients: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        category: zod_1.z.enum(['protein', 'side', 'sauce', 'extra']),
        price: zod_1.z.number(),
    })).optional(),
});
class RestaurantController {
    constructor() {
        /**
         * Create a new restaurant (For Vendors)
         */
        this.createRestaurant = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const validatedData = restaurantSchema.safeParse(req.body);
            if (!validatedData.success) {
                throw new appError_1.default(validatedData.error.issues.map(i => i.message).join(', '), 400);
            }
            const restaurant = await restaurant_service_1.default.createRestaurant({
                ...req.body,
                owner: req.user._id, // Assuming req.user is populated by auth middleware
            });
            res.status(201).json({
                status: 'success',
                data: { restaurant },
            });
        });
        /**
         * Get all active restaurants with optional filters
         */
        this.getAllRestaurants = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { cuisine, search, dist, isTopSpot, tags, sort, shuffle } = req.query;
            const { country, countryCode, lat, lng } = (0, locationResolver_1.resolveRequestLocation)(req);
            let restaurants;
            if (lat !== undefined && lng !== undefined) {
                // Find nearby if lat/lng are provided, filtered by country/countryCode if detected.
                // Automatically shuffle nearby outlets for fair exposure across user sessions unless explicitly disabled.
                const shouldShuffle = shuffle !== undefined
                    ? (shuffle === 'true' || shuffle === '1')
                    : true;
                restaurants = await restaurant_service_1.default.findNearbyRestaurants(lng, lat, dist ? parseInt(dist) : 10000, { country, countryCode }, {
                    sort: sort,
                    shuffle: shouldShuffle
                });
            }
            else {
                restaurants = await restaurant_service_1.default.getAllRestaurants({
                    cuisine,
                    search,
                    isTopSpot: isTopSpot === 'true',
                    tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
                    sort: sort,
                    country,
                    countryCode,
                    shuffle: shuffle === 'true' || shuffle === '1'
                });
            }
            res.status(200).json({
                status: 'success',
                results: restaurants.length,
                data: { restaurants },
            });
        });
        /**
         * Get a single restaurant by ID
         */
        this.getRestaurantById = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const restaurant = await restaurant_service_1.default.getRestaurantById(req.params.id);
            if (!restaurant) {
                throw new appError_1.default('No restaurant found with that ID', 404);
            }
            res.status(200).json({
                status: 'success',
                data: { restaurant },
            });
        });
        /**
         * Get logged in vendor's restaurant
         */
        this.getMyRestaurant = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const restaurant = await restaurant_model_1.default.findOne({ owner: req.user._id }).populate('owner', 'name email profileImage phoneNumber phone');
            if (!restaurant) {
                throw new appError_1.default('No restaurant profile found for this user', 404);
            }
            res.status(200).json({
                status: 'success',
                data: { restaurant },
            });
        });
        /**
         * Update logged in vendor's restaurant
         */
        this.updateMyRestaurant = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const restaurant = await restaurant_model_1.default.findOne({ owner: req.user._id });
            if (!restaurant) {
                throw new appError_1.default('No restaurant profile found for this user', 404);
            }
            const validatedData = vendorUpdateRestaurantSchema.safeParse(req.body);
            if (!validatedData.success) {
                throw new appError_1.default(validatedData.error.issues.map(i => i.message).join(', '), 400);
            }
            // validatedData.data now only contains the fields allowed in vendorUpdateRestaurantSchema
            // all extra fields (like status, isTopSpot, popularityScore) have been stripped out.
            const updatePayload = { ...validatedData.data };
            const phoneVal = updatePayload.businessPhone || updatePayload.phone || updatePayload.phoneNumber || updatePayload.phoneContact;
            if (phoneVal) {
                updatePayload.businessPhone = phoneVal;
                updatePayload.phone = phoneVal;
                updatePayload.phoneNumber = phoneVal;
                updatePayload.phoneContact = phoneVal;
            }
            const updatedRestaurant = await restaurant_service_1.default.updateRestaurant(restaurant._id.toString(), updatePayload);
            res.status(200).json({
                status: 'success',
                data: { restaurant: updatedRestaurant },
            });
        });
        /**
         * Get logged in vendor's verification status
         */
        this.getMyVerificationStatus = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const restaurant = await restaurant_model_1.default.findOne({ owner: req.user._id });
            if (!restaurant) {
                throw new appError_1.default('No restaurant profile found for this user', 404);
            }
            const isVerified = restaurant.complianceStatus === 'approved' &&
                restaurant.status === restaurant_model_1.RestaurantStatus.ACTIVE;
            const hasSubmittedDocuments = Boolean(restaurant.verificationDocuments?.ninUrl &&
                restaurant.verificationDocuments?.foodHygieneUrl);
            res.status(200).json({
                status: 'success',
                data: {
                    isVerified,
                    complianceStatus: restaurant.complianceStatus || 'pending',
                    status: restaurant.status,
                    hasSubmittedDocuments,
                    documents: restaurant.verificationDocuments || {},
                    ninVerification: restaurant.ninVerification || {},
                },
            });
        });
        /**
         * Upload or submit verification documents for vendor's restaurant
         */
        this.uploadVerificationDocuments = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const restaurant = await restaurant_model_1.default.findOne({ owner: req.user._id });
            if (!restaurant) {
                throw new appError_1.default('No restaurant profile found for this user', 404);
            }
            const files = req.files;
            let ninUrl = req.body.ninUrl || restaurant.verificationDocuments?.ninUrl || '';
            let foodHygieneUrl = req.body.foodHygieneUrl || restaurant.verificationDocuments?.foodHygieneUrl || '';
            let cacUrl = req.body.cacUrl || restaurant.verificationDocuments?.cacUrl || '';
            const idNumber = req.body.idNumber || req.body.nin || restaurant.verificationDocuments?.idNumber || '';
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
            if (!ninUrl && !foodHygieneUrl) {
                throw new appError_1.default('Please provide at least one verification document (NIN or Food Hygiene Certificate)', 400);
            }
            restaurant.verificationDocuments = {
                ninUrl,
                foodHygieneUrl,
                cacUrl,
                idNumber,
                submittedAt: new Date(),
            };
            if (idNumber) {
                restaurant.ninVerification = {
                    ...(restaurant.ninVerification || {}),
                    nin: idNumber,
                    identityStatus: 'pending',
                };
            }
            restaurant.complianceStatus = 'pending';
            await restaurant.save();
            // Also update any matching PartnerApplication
            try {
                await partnerApplication_model_1.default.findOneAndUpdate({
                    $or: [
                        { onboardedRestaurant: restaurant._id },
                        { email: req.user.email?.toLowerCase() },
                    ],
                }, {
                    $set: {
                        ninUrl,
                        foodHygieneUrl,
                        cacUrl,
                        'documents.ninUrl': ninUrl,
                        'documents.foodHygieneUrl': foodHygieneUrl,
                        'documents.cacUrl': cacUrl,
                        'documents.idNumber': idNumber,
                        status: 'under_review',
                    },
                });
            }
            catch (appErr) {
                // non-blocking
            }
            res.status(200).json({
                status: 'success',
                message: 'Verification documents submitted successfully. Our team will review them promptly.',
                data: {
                    restaurant,
                    verificationDocuments: restaurant.verificationDocuments,
                    complianceStatus: restaurant.complianceStatus,
                },
            });
        });
        /**
         * Update restaurant profile
         */
        this.updateRestaurant = (0, catchAsync_1.catchAsync)(async (req, res) => {
            // Check if the user is the owner (In a real app, use a middleware for this)
            const restaurant = await restaurant_service_1.default.getRestaurantById(req.params.id);
            if (!restaurant) {
                throw new appError_1.default('No restaurant found with that ID', 404);
            }
            if (restaurant.owner._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
                throw new appError_1.default('You do not have permission to perform this action', 403);
            }
            // We apply the strict vendor schema to strip unapproved fields if it is a vendor updating their own profile.
            // If it's an admin, we could allow more fields, but for safety, we'll apply it here too unless we want 
            // admins to be able to bypass it. Assuming we only want basic edits here.
            let updateData = req.body;
            if (req.user.role !== 'admin') {
                const validatedData = vendorUpdateRestaurantSchema.safeParse(req.body);
                if (!validatedData.success) {
                    throw new appError_1.default(validatedData.error.issues.map(i => i.message).join(', '), 400);
                }
                updateData = { ...validatedData.data };
            }
            else {
                updateData = { ...updateData };
            }
            const phoneVal = updateData.businessPhone || updateData.phone || updateData.phoneNumber || updateData.phoneContact;
            if (phoneVal) {
                updateData.businessPhone = phoneVal;
                updateData.phone = phoneVal;
                updateData.phoneNumber = phoneVal;
                updateData.phoneContact = phoneVal;
            }
            const updatedRestaurant = await restaurant_service_1.default.updateRestaurant(req.params.id, updateData);
            res.status(200).json({
                status: 'success',
                data: { restaurant: updatedRestaurant },
            });
        });
        /**
         * Deactivate restaurant
         */
        this.deleteRestaurant = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const restaurant = await restaurant_service_1.default.getRestaurantById(req.params.id);
            if (!restaurant) {
                throw new appError_1.default('No restaurant found with that ID', 404);
            }
            if (restaurant.owner._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
                throw new appError_1.default('You do not have permission to perform this action', 403);
            }
            await restaurant_service_1.default.deleteRestaurant(req.params.id);
            res.status(204).json({
                status: 'success',
                data: null,
            });
        });
        /**
         * Migrate and ensure promo fields on all existing restaurants
         */
        this.migratePromoFields = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const result = await restaurant_model_1.default.updateMany({ $or: [{ hasPromo: { $exists: false } }, { acceptsPromos: { $exists: false } }] }, { $set: { hasPromo: false, acceptsPromos: false, allowStampCards: false, promoText: '' } });
            res.status(200).json({
                status: 'success',
                message: 'Successfully migrated promo fields across all restaurants',
                data: {
                    modifiedCount: result.modifiedCount,
                    matchedCount: result.matchedCount,
                },
            });
        });
    }
}
exports.default = new RestaurantController();
