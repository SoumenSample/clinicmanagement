import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import connectDB from '@/lib/db';
import Patient from '@/lib/models/Patient';

export async function GET(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;

      if (auth.role !== 'patient') {
        return NextResponse.json({ error: 'Patient access required' }, { status: 403 });
      }

      await connectDB();
      const patient = await Patient.findOne({ tenantId: auth.tenantId, userId: auth.userId });

      if (!patient) {
        return NextResponse.json({ error: 'Patient profile not found' }, { status: 404 });
      }

      return NextResponse.json(patient, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to load patient profile' }, { status: 500 });
    }
  })(request);
}