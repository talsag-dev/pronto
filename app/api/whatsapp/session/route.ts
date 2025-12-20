import { NextResponse } from 'next/server';
import { terminateSession } from '@/lib/integrations/baileys';

export const dynamic = 'force-dynamic';

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ success: false, error: 'orgId required' }, { status: 400 });
    }

    // Terminate the session (closes socket, clears memory, deletes DB data)
    await terminateSession(orgId);

    console.log(`[API] Force reset completed for ${orgId}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Session terminated successfully. You can now generate a new QR code.' 
    });
  } catch (error: any) {
    console.error('[API] Error resetting session:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
