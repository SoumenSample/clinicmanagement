import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Tenant from '@/lib/models/Tenant';

function extractSubdomain(host: string | null) {
  if (!host) return null;
  // strip port
  const hostname = host.split(':')[0];
  // if ip or localhost, no subdomain
  if (hostname === 'localhost' || hostname === '127.0.0.1' || /^[0-9.]+$/.test(hostname)) return null;
  const parts = hostname.split('.');
  if (parts.length <= 2) return null; // domain.tld or localhost
  return parts[0].toLowerCase();
}

export const GET = async (request: NextRequest) => {
  try {
    await connectDB();

    const hostHeader = request.headers.get('host');
    const subdomain = extractSubdomain(hostHeader);
    if (!subdomain) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    // try slug match
    const tenant = (await Tenant.findOne({ slug: subdomain, status: 'active' }).lean()) as
      | { _id: { toString(): string }; name: string; slug: string }
      | null;
    if (!tenant) {
      return NextResponse.json({ found: false }, { status: 200 });
    }

    return NextResponse.json({ found: true, tenant: { id: tenant._id.toString(), name: tenant.name, slug: tenant.slug } }, { status: 200 });
  } catch (error) {
    console.error('GET tenant resolve error:', error);
    return NextResponse.json({ found: false }, { status: 500 });
  }
};
