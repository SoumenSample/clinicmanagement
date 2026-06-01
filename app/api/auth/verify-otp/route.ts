import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/lib/models/User';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { userId, otp } = body;

    if (!userId || !otp) {
      return NextResponse.json({ error: 'Missing userId or otp' }, { status: 400 });
    }

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.isVerified) {
      return NextResponse.json({ message: 'User already verified' }, { status: 200 });
    }

    if (!user.otp || !user.otpExpires) {
      return NextResponse.json({ error: 'No OTP set for user' }, { status: 400 });
    }

    if (new Date() > new Date(user.otpExpires)) {
      return NextResponse.json({ error: 'OTP expired' }, { status: 400 });
    }

    if (user.otp !== String(otp)) {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    return NextResponse.json({ message: 'User verified successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Verification failed' }, { status: 500 });
  }
}
