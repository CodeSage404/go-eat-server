import mongoose, { Schema, Document } from 'mongoose';

export interface IRolePermission extends Document {
  roleName: string; // e.g. 'admin' | 'vendor' | 'rider'
  permissions: string[]; // e.g. ['users.crud', 'restaurants.crud', 'orders.view', 'payouts.manage']
  createdAt: Date;
  updatedAt: Date;
}

const rolePermissionSchema = new Schema<IRolePermission>(
  {
    roleName: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    permissions: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const RolePermission = mongoose.model<IRolePermission>('RolePermission', rolePermissionSchema);

export default RolePermission;
