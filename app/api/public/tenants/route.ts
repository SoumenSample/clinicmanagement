import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Tenant from '@/lib/models/Tenant';

export const GET = async () => {
  try {
    await connectDB();

    const tenants = await Tenant.find({ status: 'active' })
      .sort({ name: 1 })
      .lean();

    return NextResponse.json(
      tenants.map((t: any) => ({ id: t._id.toString(), name: t.name, slug: t.slug })),
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error('GET public tenants error:', error);
    return NextResponse.json({ error: 'Failed to load tenants' }, { status: 500 });
  }
};
