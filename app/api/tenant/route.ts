import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Tenant from '@/lib/models/Tenant';
import { AuthContext, withAuth, withAdminAuth } from '@/middleware/auth';
import { z } from 'zod';

const tenantUpdateSchema = z.object({
  name: z.string().trim().min(2),
  logoUrl: z.string().trim().optional().or(z.literal('')),
  gstinNumber: z.string().trim().optional().or(z.literal('')),
  billingEmail: z.string().email().optional().or(z.literal('')),
  primaryPhone: z.string().trim().optional().or(z.literal('')),
  address: z.string().trim().optional().or(z.literal('')),
  serviceAreas: z.array(z.string().trim().min(1)).default([]),
});

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export const GET = withAuth(async (request: NextRequest) => {
  try {
    await connectDB();

    const auth = (request as NextRequest & { user: AuthContext }).user;
    const tenant = await Tenant.findById(auth.tenantId).lean();

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json({ tenant }, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error, 'Failed to load tenant') }, { status: 500 });
  }
});

export const PATCH = withAdminAuth(async (request: NextRequest) => {
  try {
    await connectDB();

    const auth = (request as NextRequest & { user: AuthContext }).user;
    const body = await request.json();
    const data = tenantUpdateSchema.parse(body);

    const tenant = await Tenant.findByIdAndUpdate(
      auth.tenantId,
      {
        $set: {
          name: data.name,
          logoUrl: data.logoUrl?.trim() || '',
            gstinNumber: data.gstinNumber?.trim() || '',
          billingEmail: data.billingEmail?.trim() || '',
          primaryPhone: data.primaryPhone?.trim() || '',
          address: data.address?.trim() || '',
          serviceAreas: data.serviceAreas.map((area) => area.trim()).filter(Boolean),
        },
      },
      { new: true }
    ).lean();

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        message: 'Clinic details updated successfully',
        tenant,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error, 'Failed to update tenant') }, { status: 500 });
  }
});