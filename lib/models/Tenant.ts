import mongoose, { Schema, Document } from 'mongoose';

export interface ITenant extends Document {
  name: string;
  slug: string;
  logoUrl?: string;
  gstinNumber?: string;
  status: 'active' | 'suspended' | 'closed';
  planKey: string;
  billingEmail?: string;
  primaryPhone?: string;
  address?: string;
  serviceAreas: string[];
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    logoUrl: {
      type: String,
      trim: true,
      default: '',
    },
    gstinNumber: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'closed'],
      default: 'active',
    },
    planKey: {
      type: String,
      default: 'free',
    },
    billingEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    primaryPhone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    serviceAreas: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.models.Tenant || mongoose.model<ITenant>('Tenant', TenantSchema);