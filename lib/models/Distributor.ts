import mongoose, { Schema, Document } from 'mongoose';

export interface IDistributorAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface IDistributor extends Document {
  tenantId: Schema.Types.ObjectId;
  name: string;
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  gstNumber?: string;
  billingAddress?: IDistributorAddress;
  shippingAddress?: IDistributorAddress;
  serviceAreas: string[];
  paymentTermsDays: number;
  status: 'active' | 'inactive';
  notes?: string;
}

const AddressSchema = new Schema(
  {
    line1: String,
    line2: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
  },
  { _id: false }
);

const DistributorSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    companyName: {
      type: String,
      required: true,
      trim: true,
    },
    contactName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    gstNumber: {
      type: String,
      trim: true,
    },
    billingAddress: {
      type: AddressSchema,
      default: undefined,
    },
    shippingAddress: {
      type: AddressSchema,
      default: undefined,
    },
    serviceAreas: {
      type: [String],
      default: [],
    },
    paymentTermsDays: {
      type: Number,
      default: 30,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    notes: String,
  },
  { timestamps: true }
);

DistributorSchema.index({ tenantId: 1, name: 1 });
DistributorSchema.index({ tenantId: 1, gstNumber: 1 }, { unique: false, sparse: true });

export default mongoose.models.Distributor || mongoose.model<IDistributor>('Distributor', DistributorSchema);