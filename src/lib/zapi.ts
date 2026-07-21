// Typed client wrapper for the zapi-proxy edge function.
// Never call Z-API directly from the browser — always through this proxy.
import { supabase } from "@/integrations/supabase/client";

export type ZapiAction =
  | "get-qrcode"
  | "check-status"
  | "get-phone"
  | "disconnect"
  | "restart"
  | "send-text"
  | "send-image"
  | "send-document"
  | "send-audio"
  | "list-chats"
  | "list-contacts"
  | "read-message"
  | "save-config"
  | "get-config-status";

export interface ZapiConfigStatus {
  configured: boolean;
  source: "db" | "env";
  updated_at: string | null;
  values: {
    instance_id: string | null;
    token: string | null;
    client_token: string | null;
    webhook_secret: string | null;
  };
  has: {
    instance_id: boolean;
    token: boolean;
    client_token: boolean;
    webhook_secret: boolean;
  };
}

export interface ZapiConfigInput {
  instance_id?: string;
  token?: string;
  client_token?: string;
  webhook_secret?: string;
}

export const getZapiConfigStatus = () =>
  callProxy<never>("get-config-status") as Promise<
    ZapiResponse<never> & Partial<ZapiConfigStatus>
  >;

export const saveZapiConfig = (payload: ZapiConfigInput) =>
  callProxy<{ updated: number }>("save-config", payload as Record<string, unknown>);

export interface ZapiResponse<T = unknown> {
  ok: boolean;
  status?: number;
  data?: T;
  reason?: "not_configured" | "device_offline" | string;
  error?: string;
  /** true when the send action was persisted in demo mode (Z-API not configured). */
  simulated?: boolean;
}

async function callProxy<T = unknown>(
  action: ZapiAction,
  payload?: Record<string, unknown>,
): Promise<ZapiResponse<T>> {
  const { data, error } = await supabase.functions.invoke<ZapiResponse<T>>("zapi-proxy", {
    body: { action, payload },
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  return data ?? { ok: false, error: "empty_response" };
}

export const isNotConfigured = (r: ZapiResponse) => r.reason === "not_configured";
export const isDeviceOffline = (r: ZapiResponse) => r.reason === "device_offline";
export const isSimulated = (r: ZapiResponse) => r.simulated === true;

// -------- helpers --------
export const getWhatsAppQrCode = () =>
  callProxy<{ value?: string; qrcode?: string } | string>("get-qrcode");

export const checkWhatsAppStatus = () =>
  callProxy<{ connected?: boolean; smartphoneConnected?: boolean }>("check-status");

export const getWhatsAppPhone = () =>
  callProxy<{ phone?: string; name?: string }>("get-phone");

export const disconnectWhatsApp = () => callProxy("disconnect");
export const restartWhatsAppInstance = () => callProxy("restart");

export interface SendExtras {
  replyToMessageId?: string | null;
  forwardedFromMessageId?: string | null;
}

export const sendWhatsAppText = (
  phone: string,
  message: string,
  conversationId?: string,
  extras?: SendExtras,
) =>
  callProxy<{ externalId?: string; messageId?: string; zaapId?: string }>("send-text", {
    phone,
    message,
    conversationId,
    replyToMessageId: extras?.replyToMessageId ?? null,
    forwardedFromMessageId: extras?.forwardedFromMessageId ?? null,
  });

export const sendWhatsAppImage = (
  phone: string,
  image: string,
  caption?: string,
  conversationId?: string,
  extras?: SendExtras,
) => callProxy("send-image", {
  phone, image, caption, conversationId,
  replyToMessageId: extras?.replyToMessageId ?? null,
  forwardedFromMessageId: extras?.forwardedFromMessageId ?? null,
});

export const sendWhatsAppDocument = (
  phone: string,
  document: string,
  extension: string,
  fileName?: string,
  conversationId?: string,
  extras?: SendExtras,
) => callProxy("send-document", {
  phone, document, extension, fileName, conversationId,
  replyToMessageId: extras?.replyToMessageId ?? null,
  forwardedFromMessageId: extras?.forwardedFromMessageId ?? null,
});

export const sendWhatsAppAudio = (phone: string, audio: string) =>
  callProxy("send-audio", { phone, audio });

export const readWhatsAppMessage = (phone: string, messageId: string) =>
  callProxy("read-message", { phone, messageId });

export const listWhatsAppChats = () => callProxy("list-chats");
export const listWhatsAppContacts = () => callProxy("list-contacts");

export async function runWhatsAppHeartbeat(): Promise<ZapiResponse<{ connected: boolean; phone: string | null }>> {
  const { data, error } = await supabase.functions.invoke("zapi-heartbeat", { body: {} });
  if (error) return { ok: false, error: error.message };
  return (data as ZapiResponse<{ connected: boolean; phone: string | null }>) ?? { ok: false };
}
