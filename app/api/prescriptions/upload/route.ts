import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { createPrescription } from '@/lib/services/clinic';

async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${file.type};base64,${buffer.toString('base64')}`;
}

export async function POST(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const formData = await req.formData();

      const doctorId = String(formData.get('doctorId') || '');
      const patientId = String(formData.get('patientId') || '');
      const previousHistory = String(formData.get('previousHistory') || '');
      const investigationsGiven = String(formData.get('investigationsGiven') || '');
      const medicinesGiven = String(formData.get('medicinesGiven') || '');
      const rawText = String(formData.get('rawText') || '');
      const notes = String(formData.get('notes') || '');
      const source = String(formData.get('source') || 'upload') as 'clinic' | 'walk-in' | 'upload';
      const issuedAt = String(formData.get('issuedAt') || '');
      const expiryAt = String(formData.get('expiryAt') || '');
      const file = formData.get('file');

      if (!doctorId || !patientId) {
        return NextResponse.json({ error: 'doctorId and patientId are required' }, { status: 400 });
      }

      let fileUrl: string | undefined;
      let fileName: string | undefined;
      let mimeType: string | undefined;
      let fileSize: number | undefined;

      if (file instanceof File) {
        fileUrl = await fileToDataUrl(file);
        fileName = file.name;
        mimeType = file.type;
        fileSize = file.size;
      }

      const prescription = await createPrescription(auth.tenantId, auth.userId, {
        doctorId,
        patientId,
        prescriptionType: file instanceof File ? (file.type.includes('pdf') ? 'pdf' : 'image') : 'manual',
        source,
        fileUrl,
        fileName,
        mimeType,
        fileSize,
        previousHistory: previousHistory || undefined,
        investigationsGiven: investigationsGiven || undefined,
        medicinesGiven: medicinesGiven || undefined,
        rawText: rawText || undefined,
        notes: notes || undefined,
        issuedAt: issuedAt || undefined,
        expiryAt: expiryAt || undefined,
      });

      return NextResponse.json(prescription, { status: 201 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to upload prescription' }, { status: 500 });
    }
  })(request);
}