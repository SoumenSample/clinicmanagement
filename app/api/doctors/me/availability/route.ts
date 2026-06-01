import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { doctorAvailabilitySchema } from '@/lib/validations/appointments';
import { getDoctorAvailability, updateDoctorAvailability } from '@/lib/services/appointments';

export async function GET(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;

      if (auth.role !== 'doctor') {
        return NextResponse.json({ error: 'Doctor access required' }, { status: 403 });
      }

      const doctor: any = await getDoctorAvailability({ tenantId: auth.tenantId, userId: auth.userId });
      if (!doctor) {
        return NextResponse.json({ error: 'Doctor profile not found' }, { status: 404 });
      }

      return NextResponse.json({
        availableDays: doctor.availableDays || [],
        availabilityNotes: doctor.availabilityNotes || '',
        availabilitySlotMinutes: doctor.availabilitySlotMinutes || 15,
        availabilityWindows: doctor.availabilityWindows || [],
        availabilityExceptions: doctor.availabilityExceptions || [],
      });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to load availability' }, { status: error?.statusCode || 500 });
    }
  })(request);
}

export async function PATCH(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;

      if (auth.role !== 'doctor') {
        return NextResponse.json({ error: 'Doctor access required' }, { status: 403 });
      }

      const body = await req.json();
      const parsed = doctorAvailabilitySchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid availability data', issues: parsed.error.flatten() }, { status: 400 });
      }

      const doctor = await updateDoctorAvailability({
        tenantId: auth.tenantId,
        userId: auth.userId,
        availableDays: parsed.data.availableDays,
        availabilityNotes: parsed.data.availabilityNotes,
        availabilitySlotMinutes: parsed.data.availabilitySlotMinutes,
        availabilityWindows: parsed.data.availabilityWindows,
        availabilityExceptions: parsed.data.availabilityExceptions,
      });

      const derivedDays = Array.from(
        new Set(
          (doctor.availabilityWindows || [])
            .flatMap((window: any) => window?.daysOfWeek || [])
            .filter(Boolean)
        )
      );

      if (derivedDays.length > 0 && JSON.stringify(doctor.availableDays || []) !== JSON.stringify(derivedDays)) {
        doctor.availableDays = derivedDays;
        await doctor.save();
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
      return NextResponse.json({ error: error.message || 'Failed to update availability' }, { status: error?.statusCode || 500 });
    }
  })(request);
}