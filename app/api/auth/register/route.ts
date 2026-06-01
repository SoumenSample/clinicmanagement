import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/lib/models/User';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { sendVerificationEmail } from '@/lib/mailer';
import { createTenantFromName, getOrCreateDefaultTenant } from '@/lib/services/tenant';
import Tenant from '@/lib/models/Tenant';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.enum(['owner', 'admin', 'staff', 'doctor', 'patient']).optional(),
  tenantName: z.string().min(2).optional(),
  tenantSlug: z.string().min(2).optional(),
  tenantId: z.string().optional(),
  billingEmail: z.string().email().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { email, password, name, role, tenantName, tenantSlug, tenantId, billingEmail } = registerSchema.parse(body);
    const normalizedEmail = email.toLowerCase().trim();

    let tenant = null;
    if (tenantId) {
      tenant = await Tenant.findById(tenantId);
    } else if (tenantSlug) {
      tenant = await Tenant.findOne({ slug: tenantSlug.toLowerCase() });
    } else if (tenantName) {
      tenant = await createTenantFromName(tenantName, billingEmail || email);
    }

    if (!tenant) {
      tenant = await getOrCreateDefaultTenant();
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const user = new User({
      tenantId: tenant._id,
      email: normalizedEmail,
      password: hashedPassword,
      name,
      role: role || (tenantName ? 'owner' : 'staff'),
      isVerified: false,
      otp,
      otpExpires,
    });

    await user.save();

    // send verification email (best-effort)
    try {
      await sendVerificationEmail(email, name, otp);
    } catch (e) {
      console.warn('Failed to send verification email', e);
    }

    return NextResponse.json(
      { message: 'User registered successfully', userId: user._id, tenantId: tenant._id, tenantSlug: tenant.slug },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Registration failed' },
      { status: 500 }
    );
  }
}
