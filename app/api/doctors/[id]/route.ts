// app/api/doctors/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { deleteDoctor, updateDoctor } from '@/lib/services/clinic';
import { doctorSchema } from '@/lib/validations/clinic';

export async function PATCH(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const doctorId = req.nextUrl.pathname.split('/').pop();

      if (!doctorId) {
        return NextResponse.json({ error: 'Doctor ID is required' }, { status: 400 });
      }

      const body = await req.json();
      const data = doctorSchema.partial().parse(body);

      // ✅ auth.userId is the admin actor for audit — correct
      const doctor = await updateDoctor(auth.tenantId, auth.userId, doctorId, data);

      if (!doctor) {
        return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
      }

      return NextResponse.json(doctor, { status: 200 });
    } catch (error: any) {
      const status = error?.statusCode || 500;
      return NextResponse.json(
        { error: error.message || 'Failed to update doctor' },
        { status }
      );
    }
  })(request);
}

export async function DELETE(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const doctorId = req.nextUrl.pathname.split('/').pop();

      if (!doctorId) {
        return NextResponse.json({ error: 'Doctor ID is required' }, { status: 400 });
      }

      const doctor = await deleteDoctor(auth.tenantId, auth.userId, doctorId);

      if (!doctor) {
        return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
      }

      return NextResponse.json({ message: 'Doctor deleted successfully' }, { status: 200 });
    } catch (error: any) {
      const status = error?.statusCode || 500;
      return NextResponse.json(
        { error: error.message || 'Failed to delete doctor' },
        { status }
      );
    }
  })(request);
}