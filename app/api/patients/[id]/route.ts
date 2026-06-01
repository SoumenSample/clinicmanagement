import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { deletePatient, updatePatient } from '@/lib/services/clinic';
import { patientSchema } from '@/lib/validations/clinic';

export async function PATCH(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const patientId = req.nextUrl.pathname.split('/').pop();
      if (!patientId) {
        return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
      }

      const body = await req.json();
      const data = patientSchema.partial().parse(body);
      const patient = await updatePatient(auth.tenantId, auth.userId, patientId, data);

      if (!patient) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
      }

      return NextResponse.json(patient, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to update patient' }, { status: 500 });
    }
  })(request);
}

export async function DELETE(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const patientId = req.nextUrl.pathname.split('/').pop();

      if (!patientId) {
        return NextResponse.json({ error: 'Patient ID is required' }, { status: 400 });
      }

      const patient = await deletePatient(auth.tenantId, auth.userId, patientId);

      if (!patient) {
        return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
      }

      return NextResponse.json({ message: 'Patient deleted successfully' }, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to delete patient' }, { status: 500 });
    }
  })(request);
}