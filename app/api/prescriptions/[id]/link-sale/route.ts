import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth';

export async function POST(request: NextRequest) {
  return withAuth(async (req: NextRequest) => {
    return NextResponse.json(
      { error: 'Linking prescriptions to sales has been removed' },
      { status: 410 }
    );
  })(request);
}