import mongoose, { Schema, Document } from 'mongoose';

export interface ISaleItem {
  medicineId: string;
  medicineName: string;
  quantity: number;
  mrp: number;
  price: number;
  basePrice: number;
  gstRate: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  subtotal: number;
}

export interface ISale extends Document {
  tenantId?: Schema.Types.ObjectId;
  invoiceNumber: string;
  saleDate: Date;
  items: ISaleItem[];
  doctorId?: Schema.Types.ObjectId;
  doctorFee?: number;
  grossAmount: number;
  discountPercent?: number;
  discountAmount?: number;
  cgstTotal?: number;
  sgstTotal?: number;
  totalAmount: number;
  customerName: string;
  customerPhone?: string;
  patientName: string;
  patientPhone?: string;
  doctorName: string;
  paymentMethod: string;
  staffId: string;
  notes?: string;
  createdAt: Date;
}

const SaleItemSchema = new Schema({
  medicineId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  medicineName: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  mrp: {
    type: Number,
    required: true,
  },
  basePrice: {
    type: Number,
    required: true,
  },
  gstRate: {
    type: Number,
    required: true,
    default: 0,
  },
  gstAmount: {
    type: Number,
    required: true,
    default: 0,
  },
  cgstAmount: {
    type: Number,
    required: true,
    default: 0,
  },
  sgstAmount: {
    type: Number,
    required: true,
    default: 0,
  },
  subtotal: {
    type: Number,
    required: true,
  },
});

const SaleSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    saleDate: {
      type: Date,
      default: Date.now,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: 'Doctor',
      index: true,
    },
    doctorFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    items: {
      type: [SaleItemSchema],
      default: [],
    },
    grossAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    discountPercent: {
      type: Number,
      default: 0,
    },
    discountAmount: {
      type: Number,
      default: 0,
    },
    cgstTotal: {
      type: Number,
      default: 0,
    },
    sgstTotal: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
    },
    patientName: {
      type: String,
      required: true,
      trim: true,
    },
    patientPhone: {
      type: String,
      trim: true,
    },
    doctorName: {
      type: String,
      required: true,
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'cheque', 'online'],
      default: 'cash',
    },
    staffId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    notes: String,
  },
  { timestamps: true }
);

export default mongoose.models.Sale || mongoose.model<ISale>('Sale', SaleSchema);
