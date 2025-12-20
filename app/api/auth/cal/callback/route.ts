import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // Should be the Organization ID

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  try {
    // 1. Exchange Code for Token
    const res = await fetch('https://api.cal.com/v1/oauth/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: process.env.CAL_CLIENT_ID,
        client_secret: process.env.CAL_CLIENT_SECRET,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/cal/callback`,
        code
      })
    });

    const data = await res.json();

    if (!res.ok) {
        console.error('Cal OAuth Error:', data);
        return NextResponse.json({ error: 'Failed to exchange token', details: data }, { status: 400 });
    }

    const { access_token, refresh_token, user_id } = data;

    // 2. Save to Organization
    const { error } = await supabaseAdmin
      .from('organizations')
      .update({
        cal_access_token: access_token,
        cal_refresh_token: refresh_token,
        cal_user_id: user_id
      })
      .eq('id', state);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Calendar Connected!' });

  } catch (error) {
    console.error('OAuth Callback Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
