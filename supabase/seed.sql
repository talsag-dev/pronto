-- Seed Data for Multi-Tenant Testing

-- 1. Create Organization (Your Business)
-- REPLACE '972501234567' with your actual Waha Session Number (or WhatsApp Phone)
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
);

-- 2. Create another Org (Competitor)
insert into organizations (name, business_phone, config)
values (
  'Sarah Salon',
  '972555555555',
  '{
    "system_prompt": "You are a Salon Receptionist. Be sweet.",
    "operating_hours": "10:00-20:00"
  }'::jsonb
);

