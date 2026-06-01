import connectDB from '@/lib/db';
import AuditLog from '@/lib/models/AuditLog';

export interface AuditLogInput {
  tenantId: string;
  actorUserId?: string;
  module: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function writeAuditLog(input: AuditLogInput) {
  try {
    await connectDB();

    await AuditLog.create({
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      module: input.module,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before,
      after: input.after,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
  } catch (error) {
    console.warn('Audit log write failed', error);
  }
}