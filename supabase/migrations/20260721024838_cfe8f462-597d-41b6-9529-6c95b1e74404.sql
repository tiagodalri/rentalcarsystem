
-- ============================================================
-- WhatsApp / Z-API integration schema
-- ============================================================

-- 1) Connection status (singleton)
CREATE TABLE public.whatsapp_connection_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected','connecting','connected')),
  connected_phone text,
  last_heartbeat_at timestamptz,
  last_checked_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_connection_status TO authenticated;
GRANT ALL ON public.whatsapp_connection_status TO service_role;

ALTER TABLE public.whatsapp_connection_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view whatsapp connection status"
  ON public.whatsapp_connection_status FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]));

CREATE POLICY "Admin/operations can update whatsapp connection status"
  ON public.whatsapp_connection_status FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operations']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','operations']::app_role[]));

-- seed singleton row
INSERT INTO public.whatsapp_connection_status (status) VALUES ('disconnected');

CREATE TRIGGER trg_whatsapp_connection_status_updated_at
  BEFORE UPDATE ON public.whatsapp_connection_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Conversations
CREATE TABLE public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  external_conversation_id text,
  contact_name text,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  is_group boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','archived')),
  unread_count integer NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  last_message_preview text,
  assigned_to uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX whatsapp_conversations_phone_key ON public.whatsapp_conversations (phone);
CREATE INDEX whatsapp_conversations_last_message_at_idx ON public.whatsapp_conversations (last_message_at DESC NULLS LAST);
CREATE INDEX whatsapp_conversations_customer_id_idx ON public.whatsapp_conversations (customer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_conversations TO authenticated;
GRANT ALL ON public.whatsapp_conversations TO service_role;

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view whatsapp conversations"
  ON public.whatsapp_conversations FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]));

CREATE POLICY "Staff can insert whatsapp conversations"
  ON public.whatsapp_conversations FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]));

CREATE POLICY "Staff can update whatsapp conversations"
  ON public.whatsapp_conversations FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]));

CREATE POLICY "Admin can delete whatsapp conversations"
  ON public.whatsapp_conversations FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Messages
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  external_message_id text,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','image','audio','video','document','sticker','location','other')),
  content text,
  media_url text,
  media_mimetype text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','read','failed')),
  failure_reason text,
  sender_name text,
  sender_phone text,
  raw_payload jsonb,
  "timestamp" timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotency: same external id in the same conversation cannot be inserted twice
CREATE UNIQUE INDEX whatsapp_messages_conv_extid_uniq
  ON public.whatsapp_messages (conversation_id, external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE INDEX whatsapp_messages_conversation_id_idx ON public.whatsapp_messages (conversation_id, "timestamp" DESC);
CREATE INDEX whatsapp_messages_external_id_idx ON public.whatsapp_messages (external_message_id) WHERE external_message_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;
GRANT ALL ON public.whatsapp_messages TO service_role;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view whatsapp messages"
  ON public.whatsapp_messages FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]));

CREATE POLICY "Staff can insert whatsapp messages"
  ON public.whatsapp_messages FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]));

CREATE POLICY "Staff can update whatsapp messages"
  ON public.whatsapp_messages FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]));

CREATE POLICY "Admin can delete whatsapp messages"
  ON public.whatsapp_messages FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 4) Raw webhook events (zero-loss log)
CREATE TABLE public.whatsapp_events_raw (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text,
  external_message_id text,
  phone text,
  payload jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  error text,
  received_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX whatsapp_events_raw_received_at_idx ON public.whatsapp_events_raw (received_at DESC);
CREATE INDEX whatsapp_events_raw_unprocessed_idx ON public.whatsapp_events_raw (received_at) WHERE processed = false;

GRANT SELECT ON public.whatsapp_events_raw TO authenticated;
GRANT ALL ON public.whatsapp_events_raw TO service_role;

ALTER TABLE public.whatsapp_events_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view whatsapp raw events"
  ON public.whatsapp_events_raw FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 5) Z-API contacts cache / LID resolution
CREATE TABLE public.zapi_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  lid text,
  name text,
  profile_picture_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX zapi_contacts_lid_idx ON public.zapi_contacts (lid) WHERE lid IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zapi_contacts TO authenticated;
GRANT ALL ON public.zapi_contacts TO service_role;

ALTER TABLE public.zapi_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view zapi contacts"
  ON public.zapi_contacts FOR SELECT
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]));

CREATE POLICY "Staff can upsert zapi contacts"
  ON public.zapi_contacts FOR INSERT
  TO authenticated
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]));

CREATE POLICY "Staff can update zapi contacts"
  ON public.zapi_contacts FOR UPDATE
  TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','operations','support']::app_role[]));

CREATE TRIGGER trg_zapi_contacts_updated_at
  BEFORE UPDATE ON public.zapi_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime for inbox
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_connection_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
