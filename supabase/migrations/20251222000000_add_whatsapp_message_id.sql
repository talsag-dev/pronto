-- Migration to add whatsapp_message_id to messages for deduplication
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_whatsapp_id ON public.messages(whatsapp_message_id);

-- Enable realtime for messages table (this is the SQL part of it, 
-- though often done in Supabase UI via Replication tab)
-- This command is a generic way to ensure the table is in the publication
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
