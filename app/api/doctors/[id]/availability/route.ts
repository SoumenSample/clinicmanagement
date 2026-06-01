import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { doctorAvailabilitySchema } from '@/lib/validations/appointments';
import { getDoctorAvailabilityByDoctorId, updateDoctorAvailabilityByDoctorId } from '@/lib/services/appointments';

function canManageDoctorAvailability(role: string) {
  return ['doctor', 'staff', 'admin', 'owner'].includes(role);
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const { id } = await context.params;

      if (!canManageDoctorAvailability(auth.role)) {
        return NextResponse.json({ error: 'Doctor access required' }, { status: 403 });
      }

      const doctor: any = await getDoctorAvailabilityByDoctorId({ tenantId: auth.tenantId, doctorId: id });
      if (!doctor) {
        return NextResponse.json({ error: 'Doctor profile not found' }, { status: 404 });
      }

      if (auth.role === 'doctor' && doctor.userId?.toString() !== auth.userId) {
        return NextResponse.json({ error: 'Not authorized to view this doctor availability' }, { status: 403 });
      }

      return NextResponse.json(
        {
          availableDays: doctor.availableDays || [],
          availabilityNotes: doctor.availabilityNotes || '',
          availabilitySlotMinutes: doctor.availabilitySlotMinutes || 15,
          availabilityWindows: doctor.availabilityWindows || [],
          availabilityExceptions: doctor.availabilityExceptions || [],
        },
        { status: 200 }
      );
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to load availability' }, { status: error?.statusCode || 500 });
    }
  })(request);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const { id } = await context.params;

      if (!canManageDoctorAvailability(auth.role)) {
        return NextResponse.json({ error: 'Doctor access required' }, { status: 403 });
      }

      const body = await req.json();
      const parsed = doctorAvailabilitySchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid availability data', issues: parsed.error.flatten() }, { status: 400 });
      }

      const doctor = await updateDoctorAvailabilityByDoctorId({
        tenantId: auth.tenantId,
        actorUserId: auth.userId,
        doctorId: id,
        availableDays: parsed.data.availableDays,
        availabilityNotes: parsed.data.availabilityNotes,
        availabilitySlotMinutes: parsed.data.availabilitySlotMinutes,
        availabilityWindows: parsed.data.availabilityWindows,
        availabilityExceptions: parsed.data.availabilityExceptions,
      });

      return NextResponse.json(
        {
          availableDays: doctor.availableDays || [],
          availabilityNotes: doctor.availabilityNotes || '',
          availabilitySlotMinutes: doctor.availabilitySlotMinutes || 15,
          availabilityWindows: doctor.availabilityWindows || [],
          availabilityExceptions: doctor.availabilityExceptions || [],
        },
        { status: 200 }
      );
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to update availability' }, { status: error?.statusCode || 500 });
    }
  })(request);
}