import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/lib/models/User';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import Tenant from '@/lib/models/Tenant';
import { getOrCreateDefaultTenant } from '@/lib/services/tenant';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.enum(['admin', 'staff']).optional(),
  tenantId: z.string().optional(),
  tenantSlug: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { email, password, name, role, tenantId, tenantSlug } = registerSchema.parse(body);
    const normalizedEmail = email.toLowerCase().trim();

    let tenant = null;
    if (tenantId) {
      tenant = await Tenant.findById(tenantId);
    } else if (tenantSlug) {
      tenant = await Tenant.findOne({ slug: tenantSlug.toLowerCase() });
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

    const user = new User({
      tenantId: tenant._id,
      email: normalizedEmail,
      password: hashedPassword,
      name,
      role: role || 'staff',
    });

    await user.save();

    return NextResponse.json(
      { message: 'User registered successfully', tenantId: tenant._id, tenantSlug: tenant.slug },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Registration failed' },
      { status: 500 }
    );
  }
}
