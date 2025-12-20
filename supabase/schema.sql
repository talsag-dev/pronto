-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Organizations (Tenants)
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  business_phone text unique not null, -- The WhatsApp number for this business (Waha Session ID or Phone)
  config jsonb default '{}'::jsonb, -- AI prompts, Operating hours
  integrations jsonb default '{}'::jsonb, -- API Keys (Cal, etc.)
  cal_access_token text,
  cal_refresh_token text,
  cal_user_id text,
  whatsapp_access_token text,
  whatsapp_phone_id text,
  whatsapp_business_id text,
  whatsapp_phone_number text,
  created_at timestamptz default now()
);

-- Leads (Scoped to Org)
create table leads (
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
  unique(organization_id, phone) -- A person can be a lead for multiple orgs
);

-- Messages (Scoped to Org)
create table messages (
  id uuid primary key default uuid_generate_v4(),
  organization_id uuid references organizations(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  role text not null, -- 'user', 'assistant', 'system'
  content text,
  type text default 'text', -- 'text', 'audio'
  token_usage int, 
  created_at timestamptz default now()
);

-- Members (Users who log in to dashboard)
create table members (
  id uuid primary key references auth.users(id),
  organization_id uuid references organizations(id),
  role text default 'owner',
  created_at timestamptz default now()
);

-- RLS Policies
alter table organizations enable row level security;
alter table leads enable row level security;
alter table messages enable row level security;
alter table members enable row level security;

-- Policy: Members can see their own Org
create policy "Members can view own org" on organizations
  for select using (
    id in (select organization_id from members where id = auth.uid())
  );

-- Policy: Members can view leads in their Org
create policy "Members can view org leads" on leads
  for select using (
    organization_id in (select organization_id from members where id = auth.uid())
  );

create policy "Members can view org messages" on messages
  for select using (
    organization_id in (select organization_id from members where id = auth.uid())
  );
