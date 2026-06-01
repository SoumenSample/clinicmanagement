import mongoose, { Schema, Document } from 'mongoose';

export interface IStockAlert extends Document {
  tenantId?: Schema.Types.ObjectId;
  medicineId: string;
  medicineName: string;
  alertType: 'low_stock' | 'expiry_soon' | 'expired';
  message: string;
  isResolved: boolean;
  createdAt: Date;
  resolvedAt?: Date;
}

const StockAlertSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      index: true,
    },
    medicineId: {
      type: Schema.Types.ObjectId,
      ref: 'Medicine',
      required: true,
    },
    medicineName: {
      type: String,
      required: true,
    },
    alertType: {
      type: String,
      enum: ['low_stock', 'expiry_soon', 'expired'],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isResolved: {
      type: Boolean,
      default: false,
    },
    resolvedAt: Date,
  },
  { timestamps: true }
);

export default mongoose.models.StockAlert || mongoose.model<IStockAlert>('StockAlert', StockAlertSchema);
