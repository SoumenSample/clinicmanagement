import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/lib/models/User';
import { withAdminAuth } from '@/middleware/auth';

export async function GET(request: NextRequest) {
  return withAdminAuth(async () => {
    try {
      await connectDB();
      const auth = (request as any).user;

      const users = await User.find({ tenantId: auth?.tenantId }, { password: 0 }).sort({ createdAt: -1 });

      const sanitizedUsers = users.map((item: any) => ({
        id: item._id.toString(),
        name: item.name,
        email: item.email,
        role: item.role,
        isVerified: item.isVerified,
        createdAt: item.createdAt,
      }));

      return NextResponse.json(sanitizedUsers, { status: 200 });
    } catch (error: any) {
      return NextResponse.json(
        { error: error.message || 'Failed to fetch users' },
        { status: 500 }
      );
    }
  })(request);
}
