import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { withAuth } from '@/middleware/auth';

const CLOUDINARY_FOLDER = 'pharmamanage/reports';

function buildSignature(params: Record<string, string>, apiSecret: string) {
  const signaturePayload = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  return crypto.createHash('sha1').update(`${signaturePayload}${apiSecret}`).digest('hex');
}

export const GET = withAuth(async () => {
  try {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Cloudinary is not configured on the server' },
        { status: 500 }
      );
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const params = {
      folder: CLOUDINARY_FOLDER,
      timestamp,
    };

    return NextResponse.json(
      {
        cloudName,
        apiKey,
        folder: CLOUDINARY_FOLDER,
        timestamp,
        signature: buildSignature(params, apiSecret),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create Cloudinary signature';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});