import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { receivePurchaseOrder } from '@/lib/services/procurement';
import { receiveStockSchema } from '@/lib/validations/procurement';

export async function POST(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const purchaseOrderId = req.nextUrl.pathname.split('/')[3];
      if (!purchaseOrderId) {
        return NextResponse.json({ error: 'Purchase order ID is required' }, { status: 400 });
      }

      const body = await req.json();
      const data = receiveStockSchema.parse(body);
      const purchaseOrder = await receivePurchaseOrder(auth.tenantId, auth.userId, purchaseOrderId, data);

      if (!purchaseOrder) {
        return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
      }

      return NextResponse.json(purchaseOrder, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to receive stock' }, { status: 500 });
    }
  })(request);
}