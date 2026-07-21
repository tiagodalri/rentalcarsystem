
-- 1. whatsapp_messages: new columns
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid NULL REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS forwarded_from_message_id uuid NULL REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_reply_to ON public.whatsapp_messages(reply_to_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_forwarded_from ON public.whatsapp_messages(forwarded_from_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_pinned ON public.whatsapp_messages(conversation_id) WHERE pinned = true;

-- 2. whatsapp_message_reactions
CREATE TABLE public.whatsapp_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.whatsapp_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);
CREATE INDEX idx_wa_reactions_message ON public.whatsapp_message_reactions(message_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_message_reactions TO authenticated;
GRANT ALL ON public.whatsapp_message_reactions TO service_role;
ALTER TABLE public.whatsapp_message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view whatsapp reactions" ON public.whatsapp_message_reactions
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role, 'support'::app_role]));
CREATE POLICY "Staff can insert whatsapp reactions" ON public.whatsapp_message_reactions
  FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role, 'support'::app_role]));
CREATE POLICY "Staff can update whatsapp reactions" ON public.whatsapp_message_reactions
  FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role, 'support'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role, 'support'::app_role]));
CREATE POLICY "Admin can delete whatsapp reactions" ON public.whatsapp_message_reactions
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. scheduled_messages
CREATE TABLE public.scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  content text,
  media_url text,
  media_mimetype text,
  message_type text NOT NULL DEFAULT 'text',
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','cancelled','failed')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  failure_reason text
);
CREATE INDEX idx_scheduled_messages_conversation ON public.scheduled_messages(conversation_id);
CREATE INDEX idx_scheduled_messages_due ON public.scheduled_messages(scheduled_for) WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_messages TO authenticated;
GRANT ALL ON public.scheduled_messages TO service_role;
ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view scheduled messages" ON public.scheduled_messages
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role, 'support'::app_role]));
CREATE POLICY "Staff can insert scheduled messages" ON public.scheduled_messages
  FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role, 'support'::app_role]));
CREATE POLICY "Staff can update scheduled messages" ON public.scheduled_messages
  FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role, 'support'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role, 'support'::app_role]));
CREATE POLICY "Admin can delete scheduled messages" ON public.scheduled_messages
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. conversation_participants
CREATE TABLE public.conversation_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);
CREATE INDEX idx_conv_participants_conversation ON public.conversation_participants(conversation_id);
CREATE INDEX idx_conv_participants_user ON public.conversation_participants(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_participants TO authenticated;
GRANT ALL ON public.conversation_participants TO service_role;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view conversation participants" ON public.conversation_participants
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role, 'support'::app_role]));
CREATE POLICY "Staff can insert conversation participants" ON public.conversation_participants
  FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role, 'support'::app_role]));
CREATE POLICY "Staff can update conversation participants" ON public.conversation_participants
  FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role, 'support'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role, 'support'::app_role]));
CREATE POLICY "Admin can delete conversation participants" ON public.conversation_participants
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. whatsapp_links
CREATE TABLE public.whatsapp_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  target_phone text,
  prefilled_message text,
  click_count int NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_whatsapp_links_slug ON public.whatsapp_links(slug);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_links TO authenticated;
GRANT ALL ON public.whatsapp_links TO service_role;
ALTER TABLE public.whatsapp_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view whatsapp links" ON public.whatsapp_links
  FOR SELECT TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role, 'support'::app_role]));
CREATE POLICY "Staff can insert whatsapp links" ON public.whatsapp_links
  FOR INSERT TO authenticated
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role, 'support'::app_role]));
CREATE POLICY "Staff can update whatsapp links" ON public.whatsapp_links
  FOR UPDATE TO authenticated
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role, 'support'::app_role]))
  WITH CHECK (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'operations'::app_role, 'support'::app_role]));
CREATE POLICY "Admin can delete whatsapp links" ON public.whatsapp_links
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 6. whatsapp_quick_replies: new columns
ALTER TABLE public.whatsapp_quick_replies
  ADD COLUMN IF NOT EXISTS category text NULL,
  ADD COLUMN IF NOT EXISTS media_url text NULL,
  ADD COLUMN IF NOT EXISTS media_mimetype text NULL,
  ADD COLUMN IF NOT EXISTS usage_count int NOT NULL DEFAULT 0;
