create table if not exists whatsapp_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text not null,
  key text not null,
  value text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(session_id, key)
);

-- Enable RLS
alter table whatsapp_sessions enable row level security;

-- Policy: Only service role can do anything
create policy "Service role can manage whatsapp sessions" on whatsapp_sessions
  using (true)
  with check (true);
