import mongoose, { Document, Schema } from 'mongoose';

export type JobType = 'full-time' | 'part-time' | 'contract' | 'internship';
export type WorkplaceType = 'remote' | 'hybrid' | 'on-site';
export type JobStatus = 'active' | 'closed' | 'draft';

export interface IJob extends Document {
  title: string;
  slug: string;
  department: string;
  location: string;
  country: string;
  countryCode: string;
  type: JobType;
  workplaceType: WorkplaceType;
  salary?: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
  applyEmail: string;
  status: JobStatus;
  featured: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const JobSchema = new Schema<IJob>(
  {
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      maxlength: [150, 'Job title cannot exceed 150 characters'],
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    department: {
      type: String,
      required: [true, 'Department is required'],
      trim: true,
    },
    location: {
      type: String,
      required: [true, 'Job location is required'],
      trim: true,
      default: 'Remote',
    },
    country: {
      type: String,
      default: 'Global',
    },
    countryCode: {
      type: String,
      default: 'ALL',
      uppercase: true,
    },
    type: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'internship'],
      default: 'full-time',
    },
    workplaceType: {
      type: String,
      enum: ['remote', 'hybrid', 'on-site'],
      default: 'remote',
    },
    salary: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
    },
    responsibilities: {
      type: [String],
      default: [],
    },
    requirements: {
      type: [String],
      default: [],
    },
    benefits: {
      type: [String],
      default: [],
    },
    applyEmail: {
      type: String,
      default: 'support@goeatone.com',
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ['active', 'closed', 'draft'],
      default: 'active',
      index: true,
    },
    featured: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast searching and sorting
JobSchema.index({ status: 1, createdAt: -1 });
JobSchema.index({ department: 1, status: 1 });
JobSchema.index({ title: 'text', description: 'text', department: 'text' });

const Job = mongoose.model<IJob>('Job', JobSchema);
export default Job;
