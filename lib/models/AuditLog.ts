import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  tenantId: Schema.Types.ObjectId;
  actorUserId?: Schema.Types.ObjectId;
  module: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

const AuditLogSchema = new Schema(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    module: {
      type: String,
      required: true,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    entityType: {
      type: String,
      required: true,
      trim: true,
    },
    entityId: {
      type: String,
      required: true,
      trim: true,
    },
    before: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    after: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true }
);

AuditLogSchema.index({ tenantId: 1, createdAt: -1 });

export default mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);