import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import connectDB from '@/lib/db';
import Prescription from '@/lib/models/Prescription';

export async function GET(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      await connectDB();
      const auth = (req as any).user;

      const prescriptions = await Prescription.find({
        tenantId: auth.tenantId,
        $or: [{ linkedSaleId: { $exists: false } }, { linkedSaleId: null }, { status: { $ne: 'linked' } }],
      })
        .populate('doctorId', 'name specialization')
        .populate('patientId', 'name phone')
        .sort({ issuedAt: -1 });

      return NextResponse.json(prescriptions, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to fetch unlinked prescriptions' }, { status: 500 });
    }
  })(request);
}
