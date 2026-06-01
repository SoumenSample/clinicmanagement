import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { deleteDistributor, updateDistributor } from '@/lib/services/procurement';
import { distributorSchema } from '@/lib/validations/procurement';

export async function PATCH(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const distributorId = req.nextUrl.pathname.split('/').pop();
      if (!distributorId) {
        return NextResponse.json({ error: 'Distributor ID is required' }, { status: 400 });
      }

      const body = await req.json();
      const data = distributorSchema.partial().parse(body);
      const distributor = await updateDistributor(auth.tenantId, auth.userId, distributorId, data);

      if (!distributor) {
        return NextResponse.json({ error: 'Distributor not found' }, { status: 404 });
      }

      return NextResponse.json(distributor, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to update distributor' }, { status: 500 });
    }
  })(request);
}

export async function DELETE(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const distributorId = req.nextUrl.pathname.split('/').pop();
      if (!distributorId) {
        return NextResponse.json({ error: 'Distributor ID is required' }, { status: 400 });
      }

      const distributor = await deleteDistributor(auth.tenantId, auth.userId, distributorId);
      if (!distributor) {
        return NextResponse.json({ error: 'Distributor not found' }, { status: 404 });
      }

      return NextResponse.json({ message: 'Distributor deleted successfully' }, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to delete distributor' }, { status: 500 });
    }
  })(request);
}