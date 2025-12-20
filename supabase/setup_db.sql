-- 1. Schema
create extension if not exists "uuid-ossp";

create table if not exists organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  business_phone text unique not null,
  config jsonb default '{}'::jsonb,
  integrations jsonb default '{}'::jsonb,
  cal_access_token text,
  cal_refresh_token text,
  cal_user_id text,
  created_at timestamptz default now()
);

create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  phone text not null,
  name text,
  status text default 'new',
  conversation_stage text,
  metadata jsonb default '{}'::jsonb,
  language_preference text default 'he',
  last_message_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(organization_id, phone)
);

create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  role text not null,
  content text,
  type text default 'text',
  token_usage int, 
  created_at timestamptz default now()
);

create table if not exists members (
  id uuid primary key references auth.users(id),
  organization_id uuid references organizations(id),
  role text default 'owner',
  created_at timestamptz default now()
);

alter table organizations enable row level security;
alter table leads enable row level security;
alter table messages enable row level security;
alter table members enable row level security;

-- Policies (Simplified for now, you might need to drop existing ones if re-running)
-- DROP POLICY IF EXISTS "Members can view own org" ON organizations;
-- create policy "Members can view own org" on organizations for select using (true); -- TEMPORARY OPEN POLICY FOR DEV

-- 2. Seed Data
insert into organizations (name, business_phone, config, integrations)
values (
  'My Realty Business',
  '972501234567', 
  '{
    "system_prompt": "You are a Real Estate Agent. Be aggressive.",
    "operating_hours": "09:00-18:00"
  }'::jsonb,
  '{
    "cal_api_key": "YOUR_CAL_API_KEY_HERE"
  }'::jsonb
) on conflict (business_phone) do nothing;
