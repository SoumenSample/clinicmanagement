import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import connectDB from '@/lib/db';
import Doctor from '@/lib/models/Doctor';

export async function GET(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;

      if (auth.role !== 'doctor') {
        return NextResponse.json({ error: 'Doctor access required' }, { status: 403 });
      }

      await connectDB();
      const doctor = await Doctor.findOne({ tenantId: auth.tenantId, userId: auth.userId });

      if (!doctor) {
        return NextResponse.json({ error: 'Doctor profile not found' }, { status: 404 });
      }

      return NextResponse.json(doctor, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to load doctor profile' }, { status: 500 });
    }
  })(request);
}
