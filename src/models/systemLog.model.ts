import mongoose, { Schema, Document } from 'mongoose';

export interface ISystemLog extends Document {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  service: string;
  createdAt: Date;
}

const systemLogSchema = new Schema<ISystemLog>(
  {
    level: {
      type: String,
      enum: ['info', 'warn', 'error', 'debug'],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    service: {
      type: String,
      default: 'api-service',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const SystemLog = mongoose.model<ISystemLog>('SystemLog', systemLogSchema);

export default SystemLog;
