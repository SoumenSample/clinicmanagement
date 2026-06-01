import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import StockAlert from '@/lib/models/StockAlert';
import { withAuth } from '@/middleware/auth';

export async function GET(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      await connectDB();
      const auth = (req as any).user;

      const unresolved = req.nextUrl.searchParams.get('unresolved') === 'true';

      let query: any = {};
      if (auth?.tenantId) {
        query.tenantId = auth.tenantId;
      }
      if (unresolved) {
        query.isResolved = false;
      }

      const alerts = await StockAlert.find(query).sort({ createdAt: -1 });

      return NextResponse.json(alerts, { status: 200 });
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Failed to fetch alerts' },
        { status: 500 }
      );
    }
  })(request);
}

export async function PUT(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    try {
      await connectDB();

      const id = req.nextUrl.searchParams.get('id');
      if (!id) {
        return NextResponse.json(
          { error: 'Alert ID is required' },
          { status: 400 }
        );
      }

      const alert = await StockAlert.findByIdAndUpdate(
        id,
        {
          isResolved: true,
          resolvedAt: new Date(),
        },
        { new: true }
      );

      if (!alert) {
        return NextResponse.json(
          { error: 'Alert not found' },
          { status: 404 }
        );
      }

      return NextResponse.json(alert, { status: 200 });
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Failed to update alert' },
        { status: 500 }
      );
    }
  })(request);
}
