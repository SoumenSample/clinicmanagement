import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { deletePrescription, updatePrescription } from '@/lib/services/clinic';
import { prescriptionUpdateSchema } from '@/lib/validations/clinic';

export async function PUT(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const prescriptionId = req.nextUrl.pathname.split('/')[3];
      if (!prescriptionId) {
        return NextResponse.json({ error: 'Prescription ID is required' }, { status: 400 });
      }

      const body = await req.json();
      const data = prescriptionUpdateSchema.parse(body);
      const prescription = await updatePrescription(auth.tenantId, auth.userId, prescriptionId, data);

      if (!prescription) {
        return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
      }

      return NextResponse.json(prescription, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to update prescription' }, { status: 500 });
    }
  })(request);
}

export async function DELETE(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const prescriptionId = req.nextUrl.pathname.split('/')[3];
      if (!prescriptionId) {
        return NextResponse.json({ error: 'Prescription ID is required' }, { status: 400 });
      }

      const prescription = await deletePrescription(auth.tenantId, auth.userId, prescriptionId);

      if (!prescription) {
        return NextResponse.json({ error: 'Prescription not found' }, { status: 404 });
      }

      return NextResponse.json({ message: 'Prescription deleted successfully' }, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to delete prescription' }, { status: 500 });
    }
  })(request);
}
