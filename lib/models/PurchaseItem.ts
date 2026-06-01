import mongoose, { Schema, Document } from 'mongoose';

export interface IPurchaseItem extends Document {
  tenantId: Schema.Types.ObjectId;
  purchaseOrderId: Schema.Types.ObjectId;
  medicineId: Schema.Types.ObjectId;
  medicineNameSnapshot: string;
  batchNumber?: string;
  expiryDate?: Date;
  qtyOrdered: number;
  qtyReceived: number;
  unitCost: number;
  taxRate: number;
  lineTotal: number;
  receivedStatus: 'pending' | 'partial' | 'received';
}

const PurchaseItemSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    purchaseOrderId: {
      type: Schema.Types.ObjectId,
      ref: 'PurchaseOrder',
      required: true,
      index: true,
    },
    medicineId: {
      type: Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
    },
    medicineNameSnapshot: {
      type: String,
      // required: true,
      trim: true,
    },
    batchNumber: String,
    expiryDate: Date,
    qtyOrdered: {
      type: Number,
      required: true,
      min: 1,
    },
    qtyReceived: {
      type: Number,
      default: 0,
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },
    taxRate: {
      type: Number,
      default: 0,
    },
    lineTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    receivedStatus: {
      type: String,
      enum: ['pending', 'partial', 'received'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

PurchaseItemSchema.index({ tenantId: 1, purchaseOrderId: 1 });
PurchaseItemSchema.index({ tenantId: 1, medicineId: 1 });

export default mongoose.models.PurchaseItem || mongoose.model<IPurchaseItem>('PurchaseItem', PurchaseItemSchema);