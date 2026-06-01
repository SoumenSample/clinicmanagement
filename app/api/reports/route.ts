import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import connectDB from '@/lib/db';
import Report from '@/lib/models/Report';
import Doctor from '@/lib/models/Doctor';
import Patient from '@/lib/models/Patient';

export async function GET(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      await connectDB();
      const auth = (req as any).user;

      if (auth.role === 'doctor') {
        // find doctor record for this user
        const doctor = await Doctor.findOne({ userId: auth.userId, tenantId: auth.tenantId }).lean() as { _id: any } | null;
        if (!doctor) return NextResponse.json({ error: 'Doctor profile not found' }, { status: 404 });

        const reports = await Report.find({ tenantId: auth.tenantId, doctorId: doctor._id })
          .populate('patientId', 'name phone')
          .populate('doctorId', 'name specialization')
          .sort({ createdAt: -1 })
          .lean();
        return NextResponse.json(reports, { status: 200 });
      }

      if (auth.role === 'patient') {
        const patient = await Patient.findOne({ userId: auth.userId, tenantId: auth.tenantId }).lean() as { _id: any } | null;
        if (!patient) return NextResponse.json({ error: 'Patient profile not found' }, { status: 404 });

        const reports = await Report.find({ tenantId: auth.tenantId, patientId: patient._id })
          .populate('patientId', 'name phone')
          .populate('doctorId', 'name specialization')
          .sort({ createdAt: -1 })
          .lean();
        return NextResponse.json(reports, { status: 200 });
      }

      // admin/owner: return all reports for tenant
      const reports = await Report.find({ tenantId: auth.tenantId })
        .populate('patientId', 'name phone')
        .populate('doctorId', 'name specialization')
        .sort({ createdAt: -1 })
        .lean();
      return NextResponse.json(reports, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to fetch reports' }, { status: 500 });
    }
  })(request);
}

export async function POST(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      await connectDB();
      const auth = (req as any).user;
      const body = await req.json();

      if (auth.role !== 'patient') {
        return NextResponse.json({ error: 'Only patients can upload reports' }, { status: 403 });
      }

      const patient = await Patient.findOne({ userId: auth.userId, tenantId: auth.tenantId });
      if (!patient) return NextResponse.json({ error: 'Patient profile not found' }, { status: 404 });

      const { fileUrl, filename, doctorId } = body || {};
      if (!fileUrl) return NextResponse.json({ error: 'fileUrl is required' }, { status: 400 });

      const report = await Report.create({
        tenantId: auth.tenantId,
        patientId: patient._id,
        doctorId: doctorId || undefined,
        uploadedBy: auth.userId,
        fileUrl,
        filename,
      });

      return NextResponse.json(report, { status: 201 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to create report' }, { status: 500 });
    }
  })(request);
}

export async function PATCH(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      await connectDB();
      const auth = (req as any).user;
      const body = await req.json();

      const { reportId, comment } = body || {};
      if (!reportId || !comment) return NextResponse.json({ error: 'reportId and comment required' }, { status: 400 });

      if (auth.role !== 'doctor') return NextResponse.json({ error: 'Only doctors can comment' }, { status: 403 });

      const doctor = await Doctor.findOne({ userId: auth.userId, tenantId: auth.tenantId });
      if (!doctor) return NextResponse.json({ error: 'Doctor profile not found' }, { status: 404 });

      const report = await Report.findOne({ _id: reportId, tenantId: auth.tenantId });
      if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

      // ensure doctor is assigned to this report (or allow commenting regardless?)
      if (report.doctorId && report.doctorId.toString() !== doctor._id.toString()) {
        return NextResponse.json({ error: 'Not authorized to comment on this report' }, { status: 403 });
      }

      report.comments.push({ doctorId: doctor._id, comment, createdAt: new Date() } as any);
      await report.save();

      return NextResponse.json(report, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to update report' }, { status: 500 });
    }
  })(request);
}
