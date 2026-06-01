import mongoose, { Schema, Document } from 'mongoose';

export interface IPlan extends Document {
  key: 'free' | 'basic' | 'premium' | string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  limits: {
    staffCount: number;
    transactionsCount: number;
    storageMB: number;
    notificationsCount: number;
  };
  features: {
    discountOnPrice: boolean;
    subscriptions: boolean;
    whatsapp: boolean;
    sms: boolean;
    doctorModule: boolean;
    analytics: boolean;
  };
  isActive: boolean;
}

const PlanSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    monthlyPrice: {
      type: Number,
      default: 0,
    },
    yearlyPrice: {
      type: Number,
      default: 0,
    },
    limits: {
      staffCount: { type: Number, default: 1 },
      transactionsCount: { type: Number, default: 100 },
      storageMB: { type: Number, default: 500 },
      notificationsCount: { type: Number, default: 100 },
    },
    features: {
      discountOnPrice: { type: Boolean, default: false },
      subscriptions: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      sms: { type: Boolean, default: false },
      doctorModule: { type: Boolean, default: false },
      analytics: { type: Boolean, default: false },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Plan || mongoose.model<IPlan>('Plan', PlanSchema);