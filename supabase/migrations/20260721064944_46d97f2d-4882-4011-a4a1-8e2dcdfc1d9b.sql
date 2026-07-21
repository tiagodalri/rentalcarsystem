
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS location_lat double precision,
  ADD COLUMN IF NOT EXISTS location_lng double precision,
  ADD COLUMN IF NOT EXISTS location_label text;

ALTER TABLE public.whatsapp_messages DROP CONSTRAINT IF EXISTS whatsapp_messages_message_type_check;
ALTER TABLE public.whatsapp_messages ADD CONSTRAINT whatsapp_messages_message_type_check
  CHECK (message_type = ANY (ARRAY['text','image','audio','video','document','sticker','location','contact','other']));
