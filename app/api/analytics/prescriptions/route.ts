import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';
import { analyzePrescriptions } from '@/lib/services/clinic';

export async function GET(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      const auth = (req as any).user;
      const analytics = await analyzePrescriptions(auth.tenantId);
      return NextResponse.json(analytics, { status: 200 });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to fetch prescription analytics' }, { status: 500 });
    }
  })(request);
}