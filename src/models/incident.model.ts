import mongoose, { Schema, Document } from 'mongoose';

export interface IIncident extends Document {
  courier: mongoose.Types.ObjectId;
  order?: mongoose.Types.ObjectId;
  issueType: string;
  issueTitle: string;
  notes: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'reviewed' | 'resolved';
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const incidentSchema = new Schema<IIncident>(
  {
    courier: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Incident must be submitted by a courier'],
    },
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
    issueType: {
      type: String,
      required: [true, 'Incident issue type is required'],
      trim: true,
    },
    issueTitle: {
      type: String,
      required: [true, 'Incident issue title is required'],
      trim: true,
    },
    notes: {
      type: String,
      required: [true, 'Incident details/notes are required'],
      trim: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['pending', 'reviewed', 'resolved'],
      default: 'pending',
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    resolutionNotes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

incidentSchema.index({ courier: 1 });
incidentSchema.index({ order: 1 });
incidentSchema.index({ status: 1 });
incidentSchema.index({ createdAt: -1 });

const Incident = mongoose.model<IIncident>('Incident', incidentSchema);

export default Incident;
