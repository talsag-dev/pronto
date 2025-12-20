-- Add whatsapp_status column to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS whatsapp_status text DEFAULT 'disconnected';

-- Add comment for clarity
COMMENT ON COLUMN organizations.whatsapp_status IS 'Current status of the WhatsApp connection: disconnected, connected, qr, etc.';
