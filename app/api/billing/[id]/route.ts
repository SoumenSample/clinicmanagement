import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { deleteSale, updateSale } from '@/lib/services/clinic';
import { z } from 'zod';

const updateSaleSchema = z.object({
  doctorId: z.string().min(1),
  patientName: z.string().min(2),
  patientPhone: z.string().trim().optional(),
  doctorName: z.string().trim().optional(),
  doctorFee: z.number().min(0).optional(),
  paymentMethod: z.enum(['cash', 'card', 'cheque', 'online']),
  notes: z.string().optional(),
});

export async function PATCH(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const saleId = req.nextUrl.pathname.split('/').pop();

      if (!saleId) {
        return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
      }

      const body = await req.json();
      const data = updateSaleSchema.parse(body);
      const sale = await updateSale(auth.tenantId, auth.userId, saleId, data);

      if (!sale) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      return NextResponse.json(sale, { status: 200 });
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Failed to update invoice' },
        { status: 500 }
      );
    }
  })(request);
}

export async function DELETE(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const saleId = req.nextUrl.pathname.split('/').pop();

      if (!saleId) {
        return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
      }

      const sale = await deleteSale(auth.tenantId, auth.userId, saleId);

      if (!sale) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      return NextResponse.json({ message: 'Invoice deleted successfully' }, { status: 200 });
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Failed to delete invoice' },
        { status: 500 }
      );
    }
  })(request);
}