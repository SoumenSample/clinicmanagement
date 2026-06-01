import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import connectDB from '@/lib/db';
import Report from '@/lib/models/Report';
import Patient from '@/lib/models/Patient';
import Doctor from '@/lib/models/Doctor';

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withAuth(async (req: NextRequest) => {
    try {
      await connectDB();
      const auth = (req as any).user;
      const { id } = await params;

      if (!id) {
        return NextResponse.json({ error: 'report id is required' }, { status: 400 });
      }

      const report = await Report.findOne({ _id: id, tenantId: auth.tenantId });
      if (!report) {
        return NextResponse.json({ error: 'Report not found' }, { status: 404 });
      }

      if (auth.role === 'patient') {
        const patient = await Patient.findOne({ userId: auth.userId, tenantId: auth.tenantId }).lean();
        if (!patient) {
          return NextResponse.json({ error: 'Patient profile not found' }, { status: 404 });
        }

        if (report.patientId.toString() !== patient._id.toString()) {
          return NextResponse.json({ error: 'Not authorized to delete this report' }, { status: 403 });
        }
      } else if (auth.role === 'doctor') {
        const doctor = await Doctor.findOne({ userId: auth.userId, tenantId: auth.tenantId }).lean();
        if (!doctor) {
          return NextResponse.json({ error: 'Doctor profile not found' }, { status: 404 });
        }

        if (report.doctorId && report.doctorId.toString() !== doctor._id.toString()) {
          return NextResponse.json({ error: 'Not authorized to delete this report' }, { status: 403 });
        }
      } else if (auth.role !== 'admin' && auth.role !== 'owner') {
        return NextResponse.json({ error: 'Not authorized to delete this report' }, { status: 403 });
      }

      await report.deleteOne();
      return NextResponse.json({ message: 'Report deleted successfully' }, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to delete report' }, { status: 500 });
    }
  })(request);
}