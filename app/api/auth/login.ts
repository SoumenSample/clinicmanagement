import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/lib/models/User';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import Tenant from '@/lib/models/Tenant';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { email, password } = loginSchema.parse(body);
    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    let tenantIdString = '';
    let tenantSlugString = '';

    if (user.role !== 'super_admin') {
      if (!user.tenantId) {
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        );
      }

      const tenant = await Tenant.findById(user.tenantId);
      if (!tenant) {
        return NextResponse.json(
          { error: 'Invalid credentials' },
          { status: 401 }
        );
      }

      tenantIdString = tenant._id.toString();
      tenantSlugString = tenant.slug;

      console.info('[AUTH] login attempt', { email: normalizedEmail, tenantId: tenantIdString, tenantSlug: tenantSlugString });
    } else {
      console.info('[AUTH] super-admin login', { email: normalizedEmail });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      console.error('[AUTH] invalid password', { email: normalizedEmail, userId: user._id.toString() });
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        tenantId: tenantIdString,
        tenantSlug: tenantSlugString,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    return NextResponse.json(
      {
        token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: tenantIdString,
          tenantSlug: tenantSlugString,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Login failed' },
      { status: 500 }
    );
  }
}
