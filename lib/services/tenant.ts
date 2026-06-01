import { NextRequest } from 'next/server';
import connectDB from '@/lib/db';
import Tenant, { ITenant } from '@/lib/models/Tenant';

const DEFAULT_TENANT_SLUG = 'default-clinic';
const LEGACY_TENANT_SLUG = 'default-clinic';

export function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function getOrCreateDefaultTenant(): Promise<ITenant> {
  await connectDB();

  // Check current slug first, then fall back to the legacy slug for compatibility
  let tenant = await Tenant.findOne({ slug: DEFAULT_TENANT_SLUG });
  if (!tenant) {
    tenant = await Tenant.findOne({ slug: LEGACY_TENANT_SLUG });
  }

  if (!tenant) {
    tenant = await Tenant.create({
      name: 'Default Clinic',
      slug: DEFAULT_TENANT_SLUG,
      logoUrl: '',
      status: 'active',
      planKey: 'free',
      serviceAreas: [],
    });
  }

  return tenant;
}

export async function createTenantFromName(name: string, billingEmail?: string): Promise<ITenant> {
  await connectDB();

  const slug = `${normalizeSlug(name)}-${Date.now().toString().slice(-4)}`;
  const tenant = await Tenant.create({
    name,
    slug,
    billingEmail,
    logoUrl: '',
    status: 'active',
    planKey: 'free',
    serviceAreas: [],
  });

  return tenant;
}

export async function resolveTenantId(
  request: NextRequest | undefined,
  explicitTenantId?: string | null
): Promise<string> {
  if (explicitTenantId) {
    return explicitTenantId;
  }

  const headerTenantId = request?.headers.get('x-tenant-id');
  if (headerTenantId) {
    return headerTenantId;
  }

  const tenant = await getOrCreateDefaultTenant();
  return tenant._id.toString();
}