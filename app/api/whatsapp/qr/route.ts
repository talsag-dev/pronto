import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const WAHA_URL = process.env.WAHA_BASE_URL || 'http://localhost:3001';
  const WAHA_API_KEY = process.env.WAHA_API_KEY || 'secret_api_key_123';

  try {
    // 1. Check if session is 'SCANNING' (needs QR) or 'WORKING'
    // We can just try to get the QR. If it returns 404 or image, we handle it.
    // Actually, devlikeapro/waha docs say:
    // GET /api/{session}/auth/qr returns the image.
    
    const response = await fetch(`${WAHA_URL}/api/default/auth/qr?format=image`, {
      headers: {
        'X-Api-Key': WAHA_API_KEY,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('WAHA Error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch QR code from WAHA', details: errorText }, 
        { status: response.status }
      );
    }

    // 2. Return the image directly
    const imageBuffer = await response.arrayBuffer();
    
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, max-age=0',
      },
    });

  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message }, 
      { status: 500 }
    );
  }
}
