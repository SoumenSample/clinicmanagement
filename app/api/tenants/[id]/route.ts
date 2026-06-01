import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Tenant from '@/lib/models/Tenant';
import User from '@/lib/models/User';
import { withSuperAdminAuth } from '@/middleware/auth';
import { z } from 'zod';
import mongoose from 'mongoose';

const updateTenantSchema = z.object({
  name: z.string().trim().min(2).optional(),
  logoUrl: z.string().optional(),
  gstinNumber: z.string().optional(),
  status: z.enum(['active', 'suspended', 'closed']).optional(),
  planKey: z.string().optional(),
  billingEmail: z.string().email().optional(),
  primaryPhone: z.string().optional(),
  address: z.string().optional(),
  serviceAreas: z.array(z.string()).optional(),
});

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export const GET = withSuperAdminAuth(async (request: NextRequest) => {
  try {
    await connectDB();

    const { pathname } = new URL(request.url);
    const id = pathname.split('/').pop();

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid tenant ID' },
        { status: 400 }
      );
    }

    const tenant = await Tenant.findById(id).lean();

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Get admin count for this tenant
    const adminCount = await User.countDocuments({
      tenantId: (tenant as any)._id,
      role: { $in: ['admin', 'owner'] },
    });

    return NextResponse.json(
      {
        id: (tenant as any)._id.toString(),
        name: (tenant as any).name,
        slug: (tenant as any).slug,
        logoUrl: (tenant as any).logoUrl || '',
        gstinNumber: (tenant as any).gstinNumber || '',
        status: (tenant as any).status,
        planKey: (tenant as any).planKey,
        billingEmail: (tenant as any).billingEmail || '',
        primaryPhone: (tenant as any).primaryPhone || '',
        address: (tenant as any).address || '',
        serviceAreas: (tenant as any).serviceAreas || [],
        adminCount,
        createdAt: (tenant as any).createdAt,
        updatedAt: (tenant as any).updatedAt,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('GET tenant error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch tenant') },
      { status: 500 }
    );
  }
});

export const PATCH = withSuperAdminAuth(async (request: NextRequest) => {
  try {
    await connectDB();

    const { pathname } = new URL(request.url);
    const id = pathname.split('/').pop();

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid tenant ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = updateTenantSchema.parse(body);

    const tenant = await Tenant.findById(id);

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Update allowed fields
    if (data.name !== undefined) tenant.name = data.name;
    if (data.logoUrl !== undefined) tenant.logoUrl = data.logoUrl;
    if (data.gstinNumber !== undefined) tenant.gstinNumber = data.gstinNumber;
    if (data.status !== undefined) tenant.status = data.status;
    if (data.planKey !== undefined) tenant.planKey = data.planKey;
    if (data.billingEmail !== undefined) tenant.billingEmail = data.billingEmail;
    if (data.primaryPhone !== undefined) tenant.primaryPhone = data.primaryPhone;
    if (data.address !== undefined) tenant.address = data.address;
    if (data.serviceAreas !== undefined) tenant.serviceAreas = data.serviceAreas;

    await tenant.save();

    const adminCount = await User.countDocuments({
      tenantId: (tenant as any)._id,
      role: { $in: ['admin', 'owner'] },
    });

    return NextResponse.json(
      {
        message: 'Tenant updated successfully',
        tenant: {
          id: (tenant as any)._id.toString(),
          name: (tenant as any).name,
          slug: (tenant as any).slug,
          logoUrl: (tenant as any).logoUrl || '',
          gstinNumber: (tenant as any).gstinNumber || '',
          status: (tenant as any).status,
          planKey: (tenant as any).planKey,
          billingEmail: (tenant as any).billingEmail || '',
          primaryPhone: (tenant as any).primaryPhone || '',
          address: (tenant as any).address || '',
          serviceAreas: (tenant as any).serviceAreas || [],
          adminCount,
          createdAt: (tenant as any).createdAt,
          updatedAt: (tenant as any).updatedAt,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('PATCH tenant error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to update tenant') },
      { status: 500 }
    );
  }
});

export const DELETE = withSuperAdminAuth(async (request: NextRequest) => {
  try {
    await connectDB();

    const { pathname } = new URL(request.url);
    const id = pathname.split('/').pop();

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: 'Invalid tenant ID' },
        { status: 400 }
      );
    }

    const tenant = await Tenant.findById(id);

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Don't delete the default tenant
    if (tenant.slug === 'default') {
      return NextResponse.json(
        { error: 'Cannot delete the default tenant' },
        { status: 400 }
      );
    }

    // Delete all users associated with this tenant
    await User.deleteMany({ tenantId: (tenant as any)._id });

    // Delete the tenant
    await Tenant.deleteOne({ _id: (tenant as any)._id });

    return NextResponse.json(
      {
        message: 'Tenant and associated users deleted successfully',
        tenantId: id,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('DELETE tenant error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to delete tenant') },
      { status: 500 }
    );
  }
});
