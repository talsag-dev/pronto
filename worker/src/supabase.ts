import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '../../.env.local') }); // Load from root .env.local, assuming running from dist/ so __dirname is dist/

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('[WORKER] Missing Supabase credentials in .env.local');
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
