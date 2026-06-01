import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/lib/models/User';
import Tenant from '@/lib/models/Tenant';
import { withSuperAdminAuth } from '@/middleware/auth';
import mongoose from 'mongoose';
import { z } from 'zod';

const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    email: z.string().email().optional(),
    role: z.enum(['owner', 'admin', 'staff', 'doctor', 'patient']).optional(),
  })
  .refine((value) => value.name !== undefined || value.email !== undefined || value.role !== undefined, {
    message: 'At least one field must be provided',
  });

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export const PATCH = withSuperAdminAuth(async (request: NextRequest) => {
  try {
    await connectDB();

    const { pathname } = new URL(request.url);
    const pathParts = pathname.split('/');
    const tenantId = pathParts[pathParts.indexOf('tenants') + 1];
    const userId = pathParts[pathParts.indexOf('users') + 1];

    if (!tenantId || !mongoose.Types.ObjectId.isValid(tenantId)) {
      return NextResponse.json(
        { error: 'Invalid tenant ID' },
        { status: 400 }
      );
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    const tenant = await Tenant.findById(tenantId);

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, email, role } = updateUserSchema.parse(body);

    const user = await User.findOne({
      _id: userId,
      tenantId: tenant._id,
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in this tenant' },
        { status: 404 }
      );
    }

    if (email !== undefined) {
      const normalizedEmail = email.toLowerCase();
      const duplicateUser = await User.findOne({
        tenantId: tenant._id,
        email: normalizedEmail,
        _id: { $ne: user._id },
      });

      if (duplicateUser) {
        return NextResponse.json(
          { error: 'Another user with this email already exists in this business' },
          { status: 400 }
        );
      }

      user.email = normalizedEmail;
    }

    if (name !== undefined) {
      user.name = name.trim();
    }

    if (role !== undefined) {
      user.role = role;
    }

    await user.save();

    return NextResponse.json(
      {
        message: 'User updated successfully',
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          createdAt: user.createdAt,
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('PATCH tenant user error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to update user') },
      { status: 500 }
    );
  }
});

export const DELETE = withSuperAdminAuth(async (request: NextRequest) => {
  try {
    await connectDB();

    const { pathname } = new URL(request.url);
    const pathParts = pathname.split('/');
    const tenantId = pathParts[pathParts.indexOf('tenants') + 1];
    const userId = pathParts[pathParts.indexOf('users') + 1];

    if (!tenantId || !mongoose.Types.ObjectId.isValid(tenantId)) {
      return NextResponse.json(
        { error: 'Invalid tenant ID' },
        { status: 400 }
      );
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: 'Invalid user ID' },
        { status: 400 }
      );
    }

    const tenant = await Tenant.findById(tenantId);

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    const user = await User.findOne({
      _id: userId,
      tenantId: tenant._id,
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found in this tenant' },
        { status: 404 }
      );
    }

    await User.deleteOne({ _id: user._id });

    return NextResponse.json(
      {
        message: 'User deleted successfully',
        userId,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('DELETE tenant user error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to delete user') },
      { status: 500 }
    );
  }
});
