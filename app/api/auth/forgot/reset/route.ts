import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/lib/models/User';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const resetSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(4),
  password: z.string().min(6),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { email, otp, password } = resetSchema.parse(body);

    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: 'Invalid email or code' }, { status: 400 });
    }

    if (!user.otp || !user.otpExpires) {
      return NextResponse.json({ error: 'No reset code set' }, { status: 400 });
    }

    if (new Date() > new Date(user.otpExpires)) {
      return NextResponse.json({ error: 'Reset code expired' }, { status: 400 });
    }

    if (user.otp !== String(otp)) {
      return NextResponse.json({ error: 'Invalid reset code' }, { status: 400 });
    }

    const hashed = await bcrypt.hash(password, 10);
    user.password = hashed;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    return NextResponse.json({ message: 'Password reset successfully' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Reset failed' }, { status: 500 });
  }
}
