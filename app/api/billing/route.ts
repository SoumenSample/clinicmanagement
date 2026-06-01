import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { createSale } from '@/lib/services/clinic';
import Sale from '@/lib/models/Sale';
import { withAuth } from '@/middleware/auth';
import { z } from 'zod';

const createSaleSchema = z.object({
  doctorId: z.string().min(1),
  patientName: z.string().min(2),
  patientPhone: z.string().trim().optional(),
  doctorName: z.string().trim().optional(),
  doctorFee: z.number().min(0).optional(),
  paymentMethod: z.enum(['cash', 'card', 'cheque', 'online']),
  notes: z.string().optional(),
});

function generateInvoiceNumber() {
  const timestamp = Date.now().toString().slice(-8);
  const randomPart = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `INV-${timestamp}-${randomPart}`;
}

export async function GET(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      await connectDB();

      const auth = (req as any).user;

      const startDate = req.nextUrl.searchParams.get('startDate');
      const endDate = req.nextUrl.searchParams.get('endDate');

      let query: any = {};
      if (auth?.tenantId) {
        query.tenantId = auth.tenantId;
      }
      if (startDate && endDate) {
        query.saleDate = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
      }

      const sales = await Sale.find(query)
        .sort({ saleDate: -1 })
        .lean();

      const normalizedSales = sales.map((sale: any) => {
        const saleObj = sale;
        const invoiceFallback = saleObj?._id
          ? `INV-${String(saleObj._id).slice(-6).toUpperCase()}`
          : 'N/A';

        return {
          ...saleObj,
          invoiceNumber: saleObj.invoiceNumber || saleObj.invoiceNo || invoiceFallback,
          patientName:
            saleObj.patientName || saleObj.customerName || saleObj.customer?.name || saleObj.clientName || 'N/A',
          patientPhone:
            saleObj.patientPhone || saleObj.customerPhone || saleObj.customer?.phone || saleObj.clientPhone || 'N/A',
          doctorName: saleObj.doctorName || saleObj.doctorId?.name || saleObj.doctor?.name || 'N/A',
          doctorFee: saleObj.doctorFee ?? saleObj.doctorId?.consultationFee ?? 0,
          staffName: saleObj.staffId?.name || saleObj.staffName || saleObj.staff?.name || 'N/A',
        };
      });

      return NextResponse.json(normalizedSales, { status: 200 });
    } catch (error: any) {
      console.error('Billing API GET Error:', error);
      console.error('Error stack:', error?.stack);
      console.error('Error name:', error?.name);
      return NextResponse.json(
        { 
          error: error.message || 'Failed to fetch sales',
          errorName: error?.name,
          details: process.env.NODE_ENV === 'development' ? error.toString() : undefined 
        },
        { status: 500 }
      );
    }
  })(request);
}

export async function POST(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const user = (req as any).user;
      const body = await req.json();
      const { doctorId, patientName, patientPhone, doctorName, doctorFee, paymentMethod, notes } = createSaleSchema.parse(body);
      const sale = await createSale(user.tenantId, user.userId, {
        doctorId,
        patientName,
        patientPhone,
        doctorName,
        doctorFee,
        paymentMethod,
        notes,
      });

      return NextResponse.json(sale, { status: 201 });
    } catch (error: any) {
      console.error('Billing API POST Error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to create sale', details: process.env.NODE_ENV === 'development' ? error.toString() : undefined },
        { status: 500 }
      );
    }
  })(request);
}
