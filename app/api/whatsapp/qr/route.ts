/**
 * WhatsApp QR Code (WAHA Proxy)
 * GET /api/whatsapp/qr
 *
 * Proxies requests to WAHA (WhatsApp HTTP API) to fetch QR code image.
 * Returns the QR code as a PNG image for WhatsApp authentication.
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/shared/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const WAHA_URL = process.env.WAHA_BASE_URL || 'http://localhost:3001';
  const WAHA_API_KEY = process.env.WAHA_API_KEY || 'secret_api_key_123';

  try {
    // 1. Fetch QR code from WAHA service
    logger.info('Proxying QR code request to WAHA', { wahaUrl: WAHA_URL });

    const response = await fetch(
      `${WAHA_URL}/api/default/auth/qr?format=image`,
      {
        headers: {
          'X-Api-Key': WAHA_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('WAHA QR code fetch failed', {
        status: response.status,
        error: errorText,
      });

      return NextResponse.json(
        { error: 'Failed to fetch QR code from WAHA', details: errorText },
        { status: response.status }
      );
    }

    // 2. Return the image directly
    const imageBuffer = await response.arrayBuffer();

    logger.info('QR code fetched successfully from WAHA');

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    logger.error('WAHA proxy error', { error });

    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
