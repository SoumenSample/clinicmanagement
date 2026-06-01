// app/api/doctors/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { createDoctor, listDoctors } from '@/lib/services/clinic';
import { doctorSchema } from '@/lib/validations/clinic';

export async function GET(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const doctors = await listDoctors(auth.tenantId);
      return NextResponse.json(doctors, { status: 200 });
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Failed to fetch doctors' },
        { status: 500 }
      );
    }
  })(request);
}

export async function POST(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const body = await req.json();
      const parsed = doctorSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid doctor data', issues: parsed.error.flatten() },
          { status: 400 }
        );
      }

      // ✅ auth.userId is correct here — it's the admin actor for audit log,
      // NOT the doctor's own userId. The service handles that internally.
      const doctor = await createDoctor(auth.tenantId, auth.userId, parsed.data);
      return NextResponse.json(doctor, { status: 201 });
    } catch (error: any) {
      // ✅ Fix: respect statusCode set by throwHttpError (e.g. 409 on duplicate email)
      const status =
        error?.statusCode ||
        (error?.name === 'ZodError' ? 400 : 500);
      return NextResponse.json(
        { error: error.message || 'Failed to create doctor' },
        { status }
      );
    }
  })(request);
}