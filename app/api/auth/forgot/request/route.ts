import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/lib/models/User';
import { sendPasswordResetEmail } from '@/lib/mailer';
import { z } from 'zod';

const requestSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { email } = requestSchema.parse(body);

    const user = await User.findOne({ email });
    if (!user) {
      // For security, respond with success even if user not found
      return NextResponse.json({ message: 'If an account exists, a reset code was sent' }, { status: 200 });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    await sendPasswordResetEmail(user.email, user.name, otp);

    return NextResponse.json({ message: 'If an account exists, a reset code was sent' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Reset request failed' }, { status: 500 });
  }
}
