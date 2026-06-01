import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { withAuth } from '@/middleware/auth';
import { appointmentUpdateSchema } from '@/lib/validations/appointments';
import { updateAppointment } from '@/lib/services/appointments';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const { id } = await context.params;

      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: 'Invalid appointment ID' }, { status: 400 });
      }

      const body = await req.json();
      const parsed = appointmentUpdateSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid appointment data', issues: parsed.error.flatten() }, { status: 400 });
      }

      const appointment = await updateAppointment({
        tenantId: auth.tenantId,
        role: auth.role,
        userId: auth.userId,
        appointmentId: id,
        updates: parsed.data,
      });

      return NextResponse.json(appointment, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to update appointment' }, { status: error?.statusCode || 500 });
    }
  })(request);
}