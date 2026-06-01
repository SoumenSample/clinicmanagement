import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { createPurchaseOrder, listPurchaseOrders } from '@/lib/services/procurement';
import { purchaseOrderSchema } from '@/lib/validations/procurement';

export async function GET(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const orders = await listPurchaseOrders(auth.tenantId);
      return NextResponse.json(orders, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to fetch purchase orders' }, { status: 500 });
    }
  })(request);
}

export async function POST(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const body = await req.json();
      const data = purchaseOrderSchema.parse(body);
      const purchaseOrder = await createPurchaseOrder(auth.tenantId, auth.userId, data);
      return NextResponse.json(purchaseOrder, { status: 201 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to create purchase order' }, { status: 500 });
    }
  })(request);
}