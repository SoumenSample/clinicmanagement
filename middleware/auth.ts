import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { getOrCreateDefaultTenant } from '@/lib/services/tenant';
import connectDB from '@/lib/db';
import Tenant from '@/lib/models/Tenant';

export interface DecodedToken {
  userId: string;
  email: string;
  role: 'owner' | 'admin' | 'staff' | 'super_admin' | 'doctor' | 'patient';
  tenantId?: string;
  tenantSlug?: string;
  iat: number;
  exp: number;
}

export interface AuthContext extends DecodedToken {
  tenantId: string;
  tenantSlug: string;
}

export function verifyToken(token: string): DecodedToken | null {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as DecodedToken;
    return decoded;
  } catch (error) {
    return null;
  }
}

export function getTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}

async function buildAuthContext(decoded: DecodedToken, request?: NextRequest): Promise<AuthContext> {
  if (decoded.role === 'super_admin' && request) {
    const headerTenantId = request.headers.get('x-tenant-id');
    if (headerTenantId && mongoose.isValidObjectId(headerTenantId)) {
      await connectDB();
      const tenant = await Tenant.findById(headerTenantId).lean();
      if (tenant) {
        return {
          ...decoded,
          tenantId: (tenant as any)._id.toString(),
          tenantSlug: (tenant as any).slug,
        };
      }
    }

    const defaultTenant = await getOrCreateDefaultTenant();
    return {
      ...decoded,
      tenantId: (defaultTenant as any)._id.toString(),
      tenantSlug: (defaultTenant as any).slug,
    };
  }

  if (decoded.tenantId && decoded.tenantSlug && mongoose.isValidObjectId(decoded.tenantId)) {
    return {
      ...decoded,
      tenantId: decoded.tenantId,
      tenantSlug: decoded.tenantSlug,
    };
  }

  const defaultTenant = await getOrCreateDefaultTenant();
  return {
    ...decoded,
    tenantId: (defaultTenant as any)._id.toString(),
    tenantSlug: (defaultTenant as any).slug,
  };
}

function isAdminRole(role?: DecodedToken['role']) {
  return role === 'admin' || role === 'owner' || role === 'super_admin';
}

export function withAuth(handler: Function) {
  return async (request: NextRequest) => {
    try {
      const token = getTokenFromRequest(request);

      if (!token) {
        return NextResponse.json(
          { error: 'No authorization token' },
          { status: 401 }
        );
      }

      const decoded = verifyToken(token);

      if (!decoded) {
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        );
      }

      const authContext = await buildAuthContext(decoded, request);
      (request as any).user = authContext;
      (request as any).auth = authContext;
      return handler(request);
    } catch (error: any) {
      console.error('Auth middleware error:', error);
      return NextResponse.json(
        { error: 'Authentication error', details: process.env.NODE_ENV === 'development' ? error.message : undefined },
        { status: 500 }
      );
    }
  };
}

export function withAdminAuth(handler: Function) {
  return async (request: NextRequest) => {
    try {
      const token = getTokenFromRequest(request);

      if (!token) {
        return NextResponse.json(
          { error: 'No authorization token' },
          { status: 401 }
        );
      }

      const decoded = verifyToken(token);

      if (!decoded) {
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        );
      }

      const authContext = await buildAuthContext(decoded, request);

      if (!isAdminRole(authContext.role)) {
        return NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        );
      }

      (request as any).user = authContext;
      (request as any).auth = authContext;
      return handler(request);
    } catch (error) {
      return NextResponse.json(
        { error: 'Authorization error' },
        { status: 500 }
      );
    }
  };
}

export function withSuperAdminAuth(handler: Function) {
  return async (request: NextRequest) => {
    try {
      const token = getTokenFromRequest(request);

      if (!token) {
        return NextResponse.json(
          { error: 'No authorization token' },
          { status: 401 }
        );
      }

      const decoded = verifyToken(token);

      if (!decoded) {
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        );
      }

      if (decoded.role !== 'super_admin') {
        return NextResponse.json(
          { error: 'Super admin access required' },
          { status: 403 }
        );
      }

      const authContext = await buildAuthContext(decoded, request);
      (request as any).user = authContext;
      (request as any).auth = authContext;
      return handler(request);
    } catch (error) {
      return NextResponse.json(
        { error: 'Authorization error' },
        { status: 500 }
      );
    }
  };
}
