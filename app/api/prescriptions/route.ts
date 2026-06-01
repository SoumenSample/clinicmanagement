import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { createPrescription, listPrescriptions } from '@/lib/services/clinic';
import { prescriptionManualSchema } from '@/lib/validations/clinic';

export async function GET(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const prescriptions = await listPrescriptions(auth.tenantId);
      return NextResponse.json(prescriptions, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to fetch prescriptions' }, { status: 500 });
    }
  })(request);
}

export async function POST(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const body = await req.json();
      const data = prescriptionManualSchema.parse(body);
      const prescription = await createPrescription(auth.tenantId, auth.userId, {
        doctorId: data.doctorId,
        patientId: data.patientId,
        prescriptionType: 'manual',
        source: data.source || 'walk-in',
        previousHistory: data.previousHistory,
        investigationsGiven: data.investigationsGiven,
        medicinesGiven: data.medicinesGiven,
        rawText: data.rawText,
        notes: data.notes,
        issuedAt: data.issuedAt,
        expiryAt: data.expiryAt,
      });
      return NextResponse.json(prescription, { status: 201 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to create prescription' }, { status: 500 });
    }
  })(request);
}