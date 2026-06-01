import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { createDistributor, listDistributors } from '@/lib/services/procurement';
import { distributorSchema } from '@/lib/validations/procurement';

export async function GET(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const distributors = await listDistributors(auth.tenantId);
      return NextResponse.json(distributors, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to fetch distributors' }, { status: 500 });
    }
  })(request);
}

export async function POST(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const body = await req.json();
      const data = distributorSchema.parse(body);
      const distributor = await createDistributor(auth.tenantId, auth.userId, data);
      return NextResponse.json(distributor, { status: 201 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to create distributor' }, { status: 500 });
    }
  })(request);
}