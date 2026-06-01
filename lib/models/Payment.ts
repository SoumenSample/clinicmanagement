import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  tenantId: Schema.Types.ObjectId;
  subscriptionId?: Schema.Types.ObjectId;
  amount: number;
  currency: string;
  provider: string;
  providerRef?: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  paidAt?: Date;
  invoiceUrl?: string;
  metadata?: Record<string, unknown>;
}

const PaymentSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    subscriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'Subscription',
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    providerRef: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
    },
    paidAt: Date,
    invoiceUrl: String,
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

export default mongoose.models.Payment || mongoose.model<IPayment>('Payment', PaymentSchema);