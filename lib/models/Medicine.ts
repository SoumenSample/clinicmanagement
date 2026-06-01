import mongoose, { Schema, Document } from 'mongoose';

export interface IMedicine extends Document {
  tenantId?: Schema.Types.ObjectId;
  shelfId?: Schema.Types.ObjectId | null;
  barcode?: string | null;
  name: string;
  brand: string;
  batchNumber: string;
  quantity: number;
  mrp: number;
  price: number;
  costPrice?: number;
  expiryDate: Date;
  dosage: string;
  category: string;
  minimumStock: number;
  preferredDistributorId?: Schema.Types.ObjectId;
  reorderLevel?: number;
  createdAt: Date;
  updatedAt: Date;
}

const MedicineSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
    },
    shelfId: {
      type: Schema.Types.ObjectId,
      ref: 'Shelf',
      default: null,
      index: true,
    },
    barcode: {
      type: String,
      default: null,
      unique: true,
      sparse: true,
      index: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
    },
    brand: {
      type: String,
      required: true,
    },
    batchNumber: {
      type: String,
      required: true,
      unique: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
    },
    mrp: {
      type: Number,
      required: true,
      default: 0,
    },
    price: {
      type: Number,
      required: false,
      default: 0,
    },
    costPrice: {
      type: Number,
      default: 0,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    dosage: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    minimumStock: {
      type: Number,
      required: true,
      default: 10,
    },
    preferredDistributorId: {
      type: Schema.Types.ObjectId,
      ref: 'Distributor',
      default: null,
    },
    reorderLevel: {
      type: Number,
      default: 10,
    },
  },
  { timestamps: true }
);

if (mongoose.models.Medicine) {
  mongoose.deleteModel('Medicine');
}

export default mongoose.model<IMedicine>('Medicine', MedicineSchema);
