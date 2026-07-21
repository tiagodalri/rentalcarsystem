ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS is_vip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS whatsapp_messages_content_trgm_idx
  ON public.whatsapp_messages
  USING gin (content gin_trgm_ops);

CREATE INDEX IF NOT EXISTS whatsapp_conversations_is_vip_idx
  ON public.whatsapp_conversations (is_vip) WHERE is_vip = true;

CREATE INDEX IF NOT EXISTS whatsapp_conversations_is_urgent_idx
  ON public.whatsapp_conversations (is_urgent) WHERE is_urgent = true;