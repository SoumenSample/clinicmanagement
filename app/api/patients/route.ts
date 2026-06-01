import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { createPatient, listPatients } from '@/lib/services/clinic';
import { patientSchema } from '@/lib/validations/clinic';

export async function GET(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const patients = await listPatients(auth.tenantId);
      return NextResponse.json(patients, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to fetch patients' }, { status: 500 });
    }
  })(request);
}

export async function POST(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const body = await req.json();
      const data = patientSchema.parse(body);
      const patient = await createPatient(auth.tenantId, auth.userId, data);
      return NextResponse.json(patient, { status: 201 });
    } catch (error: any) {
      const status = error?.statusCode || (error?.name === 'ZodError' ? 400 : 500);
      return NextResponse.json({ error: error.message || 'Failed to create patient' }, { status });
    }
  })(request);
}