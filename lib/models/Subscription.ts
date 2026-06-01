import mongoose, { Schema, Document } from 'mongoose';

export interface ISubscription extends Document {
  tenantId: Schema.Types.ObjectId;
  planId: Schema.Types.ObjectId;
  billingCycle: 'monthly' | 'yearly';
  status: 'trial' | 'active' | 'past_due' | 'expired' | 'cancelled';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  trialEndsAt?: Date;
  graceEndsAt?: Date;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  nextBillingAt?: Date;
}

const SubscriptionSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
      unique: true,
    },
    planId: {
      type: Schema.Types.ObjectId,
      ref: 'Plan',
      required: true,
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
    },
    status: {
      type: String,
      enum: ['trial', 'active', 'past_due', 'expired', 'cancelled'],
      default: 'trial',
    },
    currentPeriodStart: {
      type: Date,
      default: Date.now,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
    },
    trialEndsAt: Date,
    graceEndsAt: Date,
    autoRenew: {
      type: Boolean,
      default: true,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    nextBillingAt: Date,
  },
  { timestamps: true }
);

export default mongoose.models.Subscription || mongoose.model<ISubscription>('Subscription', SubscriptionSchema);