import mongoose, { Schema, Document } from 'mongoose';

export interface IPurchaseOrder extends Document {
  tenantId: Schema.Types.ObjectId;
  poNumber: string;
  distributorId: Schema.Types.ObjectId;
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
  orderDate: Date;
  expectedDeliveryDate?: Date;
  receivedAt?: Date;
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  invoiceFile?: {
    fileUrl?: string;
    fileName?: string;
    uploadedAt?: Date;
  };
  notes?: string;
  createdBy: Schema.Types.ObjectId;
  updatedBy?: Schema.Types.ObjectId;
}

const PurchaseOrderSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    poNumber: {
      type: String,
      required: true,
      trim: true,
    },
    distributorId: {
      type: Schema.Types.ObjectId,
      ref: 'Distributor',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },
    orderDate: {
      type: Date,
      default: Date.now,
    },
    expectedDeliveryDate: Date,
    receivedAt: Date,
    subtotal: {
      type: Number,
      default: 0,
    },
    taxTotal: {
      type: Number,
      default: 0,
    },
    discountTotal: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    amountPaid: {
      type: Number,
      default: 0,
    },
    balanceDue: {
      type: Number,
      default: 0,
    },
    invoiceFile: {
      fileUrl: String,
      fileName: String,
      uploadedAt: Date,
    },
    notes: String,
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

PurchaseOrderSchema.index({ tenantId: 1, poNumber: 1 }, { unique: true });
PurchaseOrderSchema.index({ tenantId: 1, distributorId: 1, status: 1 });

export default mongoose.models.PurchaseOrder || mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);