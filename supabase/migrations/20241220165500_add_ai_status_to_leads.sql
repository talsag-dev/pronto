-- Add ai_status column to leads table
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS ai_status text DEFAULT 'active';

-- Add check constraint to ensure valid values
-- Add check constraint to ensure valid values (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_ai_status') THEN
        ALTER TABLE leads 
        ADD CONSTRAINT check_ai_status CHECK (ai_status IN ('active', 'paused'));
    END IF;
END $$;

-- Add comment
COMMENT ON COLUMN leads.ai_status IS 'Status of AI agent for this lead: active (AI replies) or paused (human replies)';
