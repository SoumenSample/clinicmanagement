import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Tenant from '@/lib/models/Tenant';
import User from '@/lib/models/User';
import { withSuperAdminAuth } from '@/middleware/auth';
import { createTenantFromName } from '@/lib/services/tenant';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const createTenantSchema = z.object({
  tenantName: z.string().trim().min(2),
  billingEmail: z.string().email().optional(),
  adminName: z.string().trim().min(2),
  adminEmail: z.string().email(),
  adminPassword: z.string().min(6),
});

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export const GET = withSuperAdminAuth(async () => {
  try {
    await connectDB();

    const tenants = await Tenant.find()
      .sort({ createdAt: -1 })
      .lean();

    const tenantIds = tenants.map((tenant: any) => tenant._id);
    const adminCounts = await User.aggregate([
      { $match: { tenantId: { $in: tenantIds }, role: { $in: ['owner', 'admin'] } } },
      { $group: { _id: '$tenantId', count: { $sum: 1 } } },
    ]);

    const adminCountMap = new Map(
      adminCounts.map((entry: any) => [entry._id.toString(), entry.count as number])
    );

    return NextResponse.json(
      tenants.map((tenant: any) => ({
        id: tenant._id.toString(),
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        planKey: tenant.planKey,
        createdAt: tenant.createdAt,
        adminCount: adminCountMap.get(tenant._id.toString()) || 0,
      })),
      { status: 200 }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to load tenants') },
      { status: 500 }
    );
  }
});

export const POST = withSuperAdminAuth(async (request: NextRequest) => {
  try {
    await connectDB();

    const body = await request.json();
    const data = createTenantSchema.parse(body);

    const tenant = await createTenantFromName(
      data.tenantName,
      data.billingEmail || data.adminEmail
    );

    const existingUser = await User.findOne({
      email: data.adminEmail.toLowerCase().trim(),
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(data.adminPassword, 10);

    const adminUser = new User({
      tenantId: tenant._id,
      email: data.adminEmail.toLowerCase().trim(),
      password: hashedPassword,
      name: data.adminName,
      role: 'admin',
      isVerified: true,
      otp: null,
      otpExpires: null,
    });

    await adminUser.save();

    return NextResponse.json(
      {
        message: 'Tenant and admin created successfully',
        tenant: {
          id: tenant._id.toString(),
          name: tenant.name,
          slug: tenant.slug,
          status: tenant.status,
        },
        admin: {
          id: adminUser._id.toString(),
          name: adminUser.name,
          email: adminUser.email,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to create tenant') },
      { status: 500 }
    );
  }
});
