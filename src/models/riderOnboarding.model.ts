import mongoose, { Schema, Document } from 'mongoose';

export type RiderOnboardingStatus = 
  | 'pending_review' 
  | 'documents_submitted' 
  | 'verification_in_progress' 
  | 'training_pending' 
  | 'approved' 
  | 'active' 
  | 'suspended' 
  | 'deactivated';

export interface IRiderOnboarding extends Document {
  user: mongoose.Types.ObjectId;
  fullName: string;
  dob: string;
  phoneNumber: string;
  emailAddress: string;
  residentialAddress: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship?: string;
  };
  ninVerification: {
    nin: string;
    verifiedName?: string;
    status: 'pending' | 'verified' | 'failed';
  };
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
  };
  vehicle: {
    vehicleType: 'motorcycle' | 'bicycle' | 'car';
    registrationNumber?: string;
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
  status: RiderOnboardingStatus;
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
    emergencyContact: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      relationship: { type: String },
    },
    ninVerification: {
      nin: { type: String, required: true },
      verifiedName: { type: String },
      status: {
        type: String,
        enum: ['pending', 'verified', 'failed'],
        default: 'pending',
      },
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
    },
    vehicle: {
      vehicleType: {
        type: String,
        enum: ['motorcycle', 'bicycle', 'car'],
        required: true,
      },
      registrationNumber: { type: String },
      vehicleLicenseUrl: { type: String },
      insuranceCertificateUrl: { type: String },
      roadWorthinessCertificateUrl: { type: String },
      hackneyPermitUrl: { type: String },
      bicyclePhotoUrl: { type: String },
    },
    financialDetails: {
      bankName: { type: String, required: true },
      accountNumber: { type: String, required: true },
      accountName: { type: String, required: true },
      bvn: { type: String },
      isVerified: { type: Boolean, default: false },
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
    status: {
      type: String,
      enum: [
        'pending_review',
        'documents_submitted',
        'verification_in_progress',
        'training_pending',
        'approved',
        'active',
        'suspended',
        'deactivated',
      ],
      default: 'pending_review',
    },
  },
  {
    timestamps: true,
  }
);

riderOnboardingSchema.index({ status: 1 });
riderOnboardingSchema.index({ 'ninVerification.status': 1 });

const RiderOnboarding = mongoose.model<IRiderOnboarding>('RiderOnboarding', riderOnboardingSchema);

export default RiderOnboarding;
