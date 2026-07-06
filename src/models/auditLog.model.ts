import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  user: string;
  action: string;
  category: string;
  ipAddress: string;
  status: 'success' | 'failed';
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    user: {
      type: String,
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1',
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      default: 'success',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);

export default AuditLog;
