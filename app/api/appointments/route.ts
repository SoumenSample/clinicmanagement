import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { appointmentCreateSchema } from '@/lib/validations/appointments';
import { createAppointment, listAppointments } from '@/lib/services/appointments';

export async function GET(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const url = new URL(req.url);
      const doctorId = url.searchParams.get('doctorId') || undefined;
      const patientId = url.searchParams.get('patientId') || undefined;

      const appointments = await listAppointments({
        tenantId: auth.tenantId,
        role: auth.role,
        userId: auth.userId,
        doctorId,
        patientId,
      });

      return NextResponse.json(appointments, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to fetch appointments' }, { status: error?.statusCode || 500 });
    }
  })(request);
}

export async function POST(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const body = await req.json();
      const parsed = appointmentCreateSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid appointment data', issues: parsed.error.flatten() }, { status: 400 });
      }

      if (!['patient', 'staff', 'admin', 'owner'].includes(auth.role)) {
        return NextResponse.json({ error: 'Not authorized to book appointments' }, { status: 403 });
      }

      const appointment = await createAppointment({
        tenantId: auth.tenantId,
        role: auth.role,
        userId: auth.userId,
        doctorId: parsed.data.doctorId,
        patientId: parsed.data.patientId,
        appointmentDate: parsed.data.appointmentDate,
        timeSlot: parsed.data.timeSlot,
        reason: parsed.data.reason,
        notes: parsed.data.notes,
      });

      return NextResponse.json(appointment, { status: 201 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to create appointment' }, { status: error?.statusCode || 500 });
    }
  })(request);
}