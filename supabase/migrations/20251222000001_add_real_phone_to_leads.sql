-- Migration to add real_phone to leads for LID mapping
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS real_phone TEXT;
