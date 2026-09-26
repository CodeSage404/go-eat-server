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
const riderOnboarding_model_1 = __importDefault(require("../models/riderOnboarding.model"));
const user_model_1 = __importStar(require("../models/user.model"));
const notification_service_1 = __importDefault(require("../services/notification.service"));
const catchAsync_1 = require("../utils/catchAsync");
const appError_1 = __importDefault(require("../utils/appError"));
const logger_1 = __importDefault(require("../utils/logger"));
class RiderVerificationController {
    constructor() {
        /**
         * GET /api/v1/riders/verification
         * Returns current courier's onboarding verification status, progress, and requirements
         */
        this.getRiderVerification = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const userId = req.user._id;
            let profile = await riderOnboarding_model_1.default.findOne({ user: userId });
            if (!profile) {
                // Auto-provision initial draft from User account details
                profile = await riderOnboarding_model_1.default.create({
                    user: userId,
                    fullName: req.user.name || '',
                    phoneNumber: req.user.phoneNumber || '',
                    emailAddress: req.user.email || '',
                    residentialAddress: '',
                    dob: '',
                    country: req.user.country || 'Nigeria',
                    countryCode: req.user.countryCode || (req.user.isNigeria ? 'NG' : 'GB'),
                    deliveryMethod: 'motorcycle',
                    emergencyContact: { name: '', phone: '' },
                    ninVerification: { nin: '', status: 'pending' },
                    financialDetails: { bankName: '', accountNumber: '', accountName: '', isVerified: false },
                    status: 'pending',
                    currentStep: 1,
                });
            }
            const checklist = this.getRequiredChecklist(profile.deliveryMethod);
            res.status(200).json({
                status: 'success',
                data: {
                    verification: profile,
                    checklist,
                    userStatus: req.user.status,
                    riderVerificationStatus: req.user.riderVerificationStatus || profile.status,
                    hasSkippedRiderOnboarding: Boolean(req.user.hasSkippedRiderOnboarding),
                },
            });
        });
        /**
         * POST /api/v1/riders/verification/submit
         * Saves partial step progress or submits completed application for review
         */
        this.submitRiderVerification = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const userId = req.user._id;
            const body = req.body || {};
            const { isFinalSubmit, ...dataToSave } = body;
            let profile = await riderOnboarding_model_1.default.findOne({ user: userId });
            if (!profile) {
                profile = new riderOnboarding_model_1.default({ user: userId });
            }
            // Merge incoming fields
            if (dataToSave.fullName)
                profile.fullName = dataToSave.fullName.trim();
            if (dataToSave.dob)
                profile.dob = dataToSave.dob.trim();
            if (dataToSave.phoneNumber)
                profile.phoneNumber = dataToSave.phoneNumber.trim();
            if (dataToSave.emailAddress)
                profile.emailAddress = dataToSave.emailAddress.trim().toLowerCase();
            if (dataToSave.residentialAddress)
                profile.residentialAddress = dataToSave.residentialAddress.trim();
            if (dataToSave.profilePhotoUrl)
                profile.profilePhotoUrl = dataToSave.profilePhotoUrl;
            if (dataToSave.country)
                profile.country = dataToSave.country;
            if (dataToSave.countryCode)
                profile.countryCode = dataToSave.countryCode.toUpperCase();
            if (dataToSave.emergencyContact) {
                profile.emergencyContact = {
                    name: dataToSave.emergencyContact.name || profile.emergencyContact?.name || '',
                    phone: dataToSave.emergencyContact.phone || profile.emergencyContact?.phone || '',
                    relationship: dataToSave.emergencyContact.relationship || profile.emergencyContact?.relationship || '',
                };
            }
            if (dataToSave.ninVerification) {
                profile.ninVerification = {
                    nin: dataToSave.ninVerification.nin || profile.ninVerification?.nin || '',
                    verifiedName: dataToSave.ninVerification.verifiedName || profile.ninVerification?.verifiedName,
                    status: dataToSave.ninVerification.status || profile.ninVerification?.status || 'pending',
                    verifiedAt: dataToSave.ninVerification.verifiedAt || profile.ninVerification?.verifiedAt,
                };
            }
            if (dataToSave.deliveryMethod) {
                profile.deliveryMethod = dataToSave.deliveryMethod;
                profile.vehicle.vehicleType = dataToSave.deliveryMethod;
            }
            if (dataToSave.vehicle) {
                profile.vehicle = {
                    ...profile.vehicle,
                    ...dataToSave.vehicle,
                    vehicleType: profile.deliveryMethod,
                };
            }
            if (dataToSave.documents) {
                profile.documents = {
                    ...profile.documents,
                    ...dataToSave.documents,
                };
            }
            if (dataToSave.financialDetails) {
                profile.financialDetails = {
                    ...profile.financialDetails,
                    ...dataToSave.financialDetails,
                };
            }
            if (dataToSave.safetyAcknowledgements) {
                profile.safetyAcknowledgements = {
                    ...profile.safetyAcknowledgements,
                    ...dataToSave.safetyAcknowledgements,
                    acknowledgedAt: new Date(),
                };
            }
            if (dataToSave.agreements) {
                profile.agreements = {
                    ...profile.agreements,
                    ...dataToSave.agreements,
                    acceptedAt: new Date(),
                };
            }
            if (typeof dataToSave.currentStep === 'number') {
                profile.currentStep = dataToSave.currentStep;
            }
            // Handle Final Submission for Admin Review
            if (isFinalSubmit) {
                const isMotorized = profile.deliveryMethod === 'motorcycle' || profile.deliveryMethod === 'car';
                // Validation according to spec
                if (!profile.fullName || !profile.dob || !profile.phoneNumber || !profile.residentialAddress) {
                    throw new appError_1.default('Personal details are incomplete.', 400);
                }
                if (!profile.ninVerification?.nin) {
                    throw new appError_1.default('NIN or Identity document number is required.', 400);
                }
                if (isMotorized) {
                    if (!profile.vehicle?.registrationNumber) {
                        throw new appError_1.default('Vehicle registration number is required for motorized delivery.', 400);
                    }
                    if (!profile.documents?.driverLicense) {
                        throw new appError_1.default('Driving licence upload is required for motorized delivery.', 400);
                    }
                    if (!profile.documents?.vehiclePhoto && !profile.vehicle?.vehiclePhotoUrl) {
                        throw new appError_1.default('A clear vehicle photograph is required for motorized delivery.', 400);
                    }
                }
                if (!profile.financialDetails?.accountNumber || !profile.financialDetails?.bankName) {
                    throw new appError_1.default('Payout bank account details are required.', 400);
                }
                if (!profile.agreements?.courierAgreementAccepted || !profile.agreements?.accuracyDeclarationAccepted) {
                    throw new appError_1.default('You must accept the Courier Agreements and Accuracy Declaration.', 400);
                }
                profile.status = 'under_review';
                await user_model_1.default.findByIdAndUpdate(userId, {
                    riderVerificationStatus: 'under_review',
                    hasSkippedRiderOnboarding: false,
                });
                logger_1.default.info(`📋 Courier ${userId} submitted verification for review [Vehicle: ${profile.deliveryMethod}]`);
            }
            await profile.save();
            res.status(200).json({
                status: 'success',
                message: isFinalSubmit
                    ? 'Application submitted successfully! Your documents are under review.'
                    : 'Progress saved successfully.',
                data: {
                    verification: profile,
                },
            });
        });
        /**
         * POST /api/v1/riders/verification/skip
         * Rider skips onboarding to explore the hub; cannot go online or accept jobs
         */
        this.skipOnboarding = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const userId = req.user._id;
            await user_model_1.default.findByIdAndUpdate(userId, {
                hasSkippedRiderOnboarding: true,
            });
            res.status(200).json({
                status: 'success',
                message: 'Onboarding deferred. You can complete verification anytime from your profile.',
            });
        });
        /**
         * GET /api/v1/admin/riders/verifications
         * List submitted rider applications for admin review
         */
        this.adminListRiderVerifications = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { status, deliveryMethod, countryCode, search, page = 1, limit = 20 } = req.query;
            const query = {};
            if (status && status !== 'all') {
                if (status === 'pending') {
                    query.status = { $in: ['pending', 'under_review', 'pending_review', 'documents_submitted'] };
                }
                else {
                    query.status = status;
                }
            }
            if (deliveryMethod && deliveryMethod !== 'all') {
                query.deliveryMethod = deliveryMethod;
            }
            if (countryCode && countryCode !== 'ALL') {
                query.countryCode = countryCode.toUpperCase();
            }
            if (search) {
                const searchRegex = new RegExp(search.trim(), 'i');
                query.$or = [
                    { fullName: searchRegex },
                    { emailAddress: searchRegex },
                    { phoneNumber: searchRegex },
                    { 'vehicle.registrationNumber': searchRegex },
                ];
            }
            const skip = (Number(page) - 1) * Number(limit);
            const [applications, total] = await Promise.all([
                riderOnboarding_model_1.default.find(query)
                    .populate('user', 'name email phoneNumber profileImage isOnline status createdAt')
                    .sort({ updatedAt: -1 })
                    .skip(skip)
                    .limit(Number(limit)),
                riderOnboarding_model_1.default.countDocuments(query),
            ]);
            // Mask sensitive NIN numbers in list view for staff/admin data protection
            const sanitized = applications.map((app) => {
                const obj = app.toObject();
                if (obj.ninVerification?.nin && obj.ninVerification.nin.length > 4) {
                    const raw = obj.ninVerification.nin;
                    obj.ninVerification.ninMasked = '******' + raw.slice(-4);
                }
                return obj;
            });
            res.status(200).json({
                status: 'success',
                results: sanitized.length,
                total,
                page: Number(page),
                totalPages: Math.ceil(total / Number(limit)),
                data: {
                    applications: sanitized,
                },
            });
        });
        /**
         * GET /api/v1/admin/riders/verifications/:id
         * Get single rider onboarding application details for deep inspection
         */
        this.adminGetRiderVerificationDetails = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const application = await riderOnboarding_model_1.default.findById(id).populate('user', 'name email phoneNumber profileImage isOnline status createdAt');
            if (!application) {
                throw new appError_1.default('Rider verification application not found', 404);
            }
            const obj = application.toObject();
            if (obj.ninVerification?.nin && obj.ninVerification.nin.length > 4) {
                obj.ninVerification.ninMasked = '******' + obj.ninVerification.nin.slice(-4);
            }
            res.status(200).json({
                status: 'success',
                data: {
                    application: obj,
                },
            });
        });
        /**
         * PATCH /api/v1/admin/riders/verifications/:id/approve
         * Approve courier onboarding, set user active, and dispatch activation notifications
         */
        this.adminApproveRider = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const { notes } = req.body || {};
            const application = await riderOnboarding_model_1.default.findById(id);
            if (!application) {
                throw new appError_1.default('Rider verification application not found', 404);
            }
            application.status = 'approved';
            application.adminReview = {
                reviewedBy: req.user._id,
                reviewedAt: new Date(),
                notes: notes || 'Application approved by Admin.',
            };
            await application.save();
            // Activate User
            const user = await user_model_1.default.findByIdAndUpdate(application.user, {
                status: user_model_1.UserStatus.ACTIVE,
                riderVerificationStatus: 'approved',
                hasSkippedRiderOnboarding: false,
            }, { returnDocument: 'after' });
            // Send push notification & in-app alert to courier
            try {
                if (user) {
                    await notification_service_1.default.sendNotification(user._id.toString(), "You're Approved! 🚀", 'Your GoEatOne courier verification has been approved. You can now toggle Online and start accepting deliveries!', { type: 'RIDER_APPROVED' });
                }
            }
            catch (notifErr) {
                logger_1.default.warn('Failed to send rider approval notification:', notifErr.message);
            }
            logger_1.default.info(`✅ Admin ${req.user._id} approved courier application ${id} for user ${application.user}`);
            res.status(200).json({
                status: 'success',
                message: 'Courier application approved and activated successfully.',
                data: {
                    application,
                    user,
                },
            });
        });
        /**
         * PATCH /api/v1/admin/riders/verifications/:id/reject
         * Reject or request changes with reasons
         */
        this.adminRejectRider = (0, catchAsync_1.catchAsync)(async (req, res) => {
            const { id } = req.params;
            const { rejectionReason, notes } = req.body;
            if (!rejectionReason) {
                throw new appError_1.default('Please provide a reason for rejection or action required.', 400);
            }
            const application = await riderOnboarding_model_1.default.findById(id);
            if (!application) {
                throw new appError_1.default('Rider verification application not found', 404);
            }
            application.status = 'action_required';
            application.adminReview = {
                reviewedBy: req.user._id,
                reviewedAt: new Date(),
                rejectionReason,
                notes,
            };
            await application.save();
            const user = await user_model_1.default.findByIdAndUpdate(application.user, {
                riderVerificationStatus: 'action_required',
            }, { returnDocument: 'after' });
            // Send alert to courier
            try {
                if (user) {
                    await notification_service_1.default.sendNotification(user._id.toString(), 'Action Required on Your Application ⚠️', `Your verification needs attention: ${rejectionReason}`, { type: 'RIDER_ACTION_REQUIRED', reason: rejectionReason });
                }
            }
            catch (notifErr) {
                logger_1.default.warn('Failed to send rider action required notification:', notifErr.message);
            }
            logger_1.default.info(`⚠️ Admin ${req.user._id} requested action on courier application ${id}: ${rejectionReason}`);
            res.status(200).json({
                status: 'success',
                message: 'Rider notification sent with requested actions.',
                data: {
                    application,
                    user,
                },
            });
        });
    }
    /**
     * Helper: compute dynamic checklist requirements based on delivery method and country
     */
    getRequiredChecklist(deliveryMethod) {
        const isMotorized = deliveryMethod === 'motorcycle' || deliveryMethod === 'car';
        return {
            personalDetails: true,
            identityNIN: true,
            selfieMatch: true,
            deliveryMethod: true,
            drivingLicense: isMotorized,
            vehicleDetails: true,
            vehiclePhoto: isMotorized,
            registrationOwnership: isMotorized,
            insuranceEvidence: isMotorized,
            roadworthinessInspection: isMotorized,
            payoutAccount: true,
            safetyOperational: true,
            riderAgreements: true,
        };
    }
}
exports.default = new RiderVerificationController();
