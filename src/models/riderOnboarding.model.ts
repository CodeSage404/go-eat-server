import mongoose, { Schema, Document } from 'mongoose';

export type RiderOnboardingStatus =
  | 'pending'
  | 'pending_review'
  | 'under_review'
  | 'action_required'
  | 'approved'
  | 'active'
  | 'rejected'
  | 'suspended'
  | 'deactivated';

export interface IRiderOnboarding extends Document {
  user: mongoose.Types.ObjectId;
  country: string;
  countryCode: string;
  fullName: string;
  dob: string;
  phoneNumber: string;
  emailAddress: string;
  residentialAddress: string;
  profilePhotoUrl?: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship?: string;
  };
  ninVerification: {
    nin: string;
    verifiedName?: string;
    status: 'pending' | 'verified' | 'failed';
    verifiedAt?: Date;
  };
  deliveryMethod: 'bicycle' | 'ebike' | 'motorcycle' | 'car';
  documents: {
    ninDoc?: string;
    driverLicense?: string;
    riderPhoto?: string;
    selfieVerification?: string;
    proofOfAddress?: string;
    policeCharacterCert?: string;
    guarantorInfo?: {
      name: string;
      phone: string;
      address: string;
      documentUrl?: string;
    };
    signedAgreementUrl?: string;
    governmentIdUrl?: string;
    bicycleOwnershipDetails?: string;
    vehiclePhoto?: string;
    vehicleInsurance?: string;
    vehicleRegistration?: string;
    roadworthinessDoc?: string;
  };
  vehicle: {
    vehicleType: 'bicycle' | 'ebike' | 'motorcycle' | 'car';
    make?: string;
    model?: string;
    color?: string;
    registrationNumber?: string;
    vehiclePhotoUrl?: string;
    vehicleLicenseUrl?: string;
    insuranceCertificateUrl?: string;
    roadWorthinessCertificateUrl?: string;
    hackneyPermitUrl?: string;
    bicyclePhotoUrl?: string;
  };
  financialDetails: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    bvn?: string;
    isVerified: boolean;
  };
  safetyAcknowledgements: {
    foodSafetyHygiene: boolean;
    tamperEvidentDelivery: boolean;
    customerPrivacy: boolean;
    incidentReporting: boolean;
    acknowledgedAt?: Date;
  };
  agreements: {
    courierAgreementAccepted: boolean;
    privacyNoticeAccepted: boolean;
    codeOfConductAccepted: boolean;
    healthSafetyAccepted: boolean;
    foodHygieneAccepted: boolean;
    verificationConsentAccepted: boolean;
    accuracyDeclarationAccepted: boolean;
    acceptedAt?: Date;
  };
  equipmentChecklist: {
    deliveryBag: boolean;
    helmet: boolean;
    reflectiveJacket: boolean;
    goEatRiderIdCard: boolean;
    phoneHolder: boolean;
    smartphoneCompatibilityCheck: boolean;
  };
  trainingChecklist: {
    foodSafetyHandling: boolean;
    customerService: boolean;
    deliveryProcedures: boolean;
    appUsageTraining: boolean;
    cashHandling: boolean;
    emergencyIncidentReporting: boolean;
  };
  adminReview?: {
    reviewedBy?: mongoose.Types.ObjectId;
    reviewedAt?: Date;
    rejectionReason?: string;
    notes?: string;
  };
  status: RiderOnboardingStatus;
  currentStep: number;
  createdAt: Date;
  updatedAt: Date;
}

const riderOnboardingSchema = new Schema<IRiderOnboarding>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    country: {
      type: String,
      default: 'Nigeria',
      trim: true,
    },
    countryCode: {
      type: String,
      default: 'NG',
      uppercase: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    dob: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
    },
    emailAddress: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    residentialAddress: {
      type: String,
      required: true,
    },
    profilePhotoUrl: {
      type: String,
    },
    emergencyContact: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      relationship: { type: String },
    },
    ninVerification: {
      nin: { type: String, default: '' },
      verifiedName: { type: String },
      status: {
        type: String,
        enum: ['pending', 'verified', 'failed'],
        default: 'pending',
      },
      verifiedAt: { type: Date },
    },
    deliveryMethod: {
      type: String,
      enum: ['bicycle', 'ebike', 'motorcycle', 'car'],
      default: 'motorcycle',
    },
    documents: {
      ninDoc: { type: String },
      driverLicense: { type: String },
      riderPhoto: { type: String },
      selfieVerification: { type: String },
      proofOfAddress: { type: String },
      policeCharacterCert: { type: String },
      guarantorInfo: {
        name: { type: String },
        phone: { type: String },
        address: { type: String },
        documentUrl: { type: String },
      },
      signedAgreementUrl: { type: String },
      governmentIdUrl: { type: String },
      bicycleOwnershipDetails: { type: String },
      vehiclePhoto: { type: String },
      vehicleInsurance: { type: String },
      vehicleRegistration: { type: String },
      roadworthinessDoc: { type: String },
    },
    vehicle: {
      vehicleType: {
        type: String,
        enum: ['bicycle', 'ebike', 'motorcycle', 'car'],
        default: 'motorcycle',
      },
      make: { type: String, trim: true },
      model: { type: String, trim: true },
      color: { type: String, trim: true },
      registrationNumber: { type: String, trim: true },
      vehiclePhotoUrl: { type: String },
      vehicleLicenseUrl: { type: String },
      insuranceCertificateUrl: { type: String },
      roadWorthinessCertificateUrl: { type: String },
      hackneyPermitUrl: { type: String },
      bicyclePhotoUrl: { type: String },
    },
    financialDetails: {
      bankName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      accountName: { type: String, default: '' },
      bvn: { type: String },
      isVerified: { type: Boolean, default: false },
    },
    safetyAcknowledgements: {
      foodSafetyHygiene: { type: Boolean, default: false },
      tamperEvidentDelivery: { type: Boolean, default: false },
      customerPrivacy: { type: Boolean, default: false },
      incidentReporting: { type: Boolean, default: false },
      acknowledgedAt: { type: Date },
    },
    agreements: {
      courierAgreementAccepted: { type: Boolean, default: false },
      privacyNoticeAccepted: { type: Boolean, default: false },
      codeOfConductAccepted: { type: Boolean, default: false },
      healthSafetyAccepted: { type: Boolean, default: false },
      foodHygieneAccepted: { type: Boolean, default: false },
      verificationConsentAccepted: { type: Boolean, default: false },
      accuracyDeclarationAccepted: { type: Boolean, default: false },
      acceptedAt: { type: Date },
    },
    equipmentChecklist: {
      deliveryBag: { type: Boolean, default: false },
      helmet: { type: Boolean, default: false },
      reflectiveJacket: { type: Boolean, default: false },
      goEatRiderIdCard: { type: Boolean, default: false },
      phoneHolder: { type: Boolean, default: false },
      smartphoneCompatibilityCheck: { type: Boolean, default: false },
    },
    trainingChecklist: {
      foodSafetyHandling: { type: Boolean, default: false },
      customerService: { type: Boolean, default: false },
      deliveryProcedures: { type: Boolean, default: false },
      appUsageTraining: { type: Boolean, default: false },
      cashHandling: { type: Boolean, default: false },
      emergencyIncidentReporting: { type: Boolean, default: false },
    },
    adminReview: {
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: { type: Date },
      rejectionReason: { type: String },
      notes: { type: String },
    },
    status: {
      type: String,
      enum: [
        'pending',
        'pending_review',
        'under_review',
        'action_required',
        'approved',
        'active',
        'rejected',
        'suspended',
        'deactivated',
      ],
      default: 'pending',
    },
    currentStep: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

riderOnboardingSchema.index({ status: 1 });
riderOnboardingSchema.index({ 'ninVerification.status': 1 });
riderOnboardingSchema.index({ countryCode: 1 });

const RiderOnboarding = mongoose.model<IRiderOnboarding>('RiderOnboarding', riderOnboardingSchema);

export default RiderOnboarding;
