import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { exchangeCodeForToken, getWhatsAppBusinessAccount } from '@/lib/integrations/whatsapp-cloud';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // Organization ID

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/whatsapp?error=missing_params`
      );
    }

    // 1. Exchange code for access token
    const accessToken = await exchangeCodeForToken(code);

    // 2. Get WhatsApp Business Account details (optional for test mode)
    const wabaDetails = await getWhatsAppBusinessAccount(accessToken);
    
    let phoneId, businessId, phoneNumber;
    
    if (wabaDetails?.phone_numbers?.[0]) {
      // Production mode: Use actual business phone
      const phone = wabaDetails.phone_numbers[0];
      phoneId = phone.id;
      businessId = wabaDetails.id;
      phoneNumber = phone.display_phone_number;
    } else {
      // Test mode: Use placeholder (you'll manually set phone_id later)
      phoneId = 'test_phone_id';
      businessId = 'test_business_id';
      phoneNumber = 'Test Number';
    }

    // 3. Save to database
    await supabaseAdmin
      .from('organizations')
      .update({
        whatsapp_access_token: accessToken,
        whatsapp_phone_id: phoneId,
        whatsapp_business_id: businessId,
        whatsapp_phone_number: phoneNumber
      })
      .eq('id', state);

    console.log(`[WHATSAPP OAUTH] Connected org ${state} to phone ${phoneNumber}`);

    // 4. Redirect back to settings
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/whatsapp?success=true`
    );

  } catch (error) {
    console.error('[WHATSAPP OAUTH ERROR]:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings/whatsapp?error=oauth_failed`
    );
  }
}
