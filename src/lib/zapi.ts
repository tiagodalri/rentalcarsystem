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
  | "read-message";

export interface ZapiResponse<T = unknown> {
  ok: boolean;
  status?: number;
  data?: T;
  reason?: "not_configured" | "device_offline" | string;
  error?: string;
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

// -------- helpers --------
export const getWhatsAppQrCode = () =>
  callProxy<{ value?: string; qrcode?: string } | string>("get-qrcode");

export const checkWhatsAppStatus = () =>
  callProxy<{ connected?: boolean; smartphoneConnected?: boolean }>("check-status");

export const getWhatsAppPhone = () =>
  callProxy<{ phone?: string; name?: string }>("get-phone");

export const disconnectWhatsApp = () => callProxy("disconnect");
export const restartWhatsAppInstance = () => callProxy("restart");

export const sendWhatsAppText = (phone: string, message: string) =>
  callProxy<{ zaapId?: string; messageId?: string }>("send-text", { phone, message });

export const sendWhatsAppImage = (phone: string, image: string, caption?: string) =>
  callProxy("send-image", { phone, image, caption });

export const sendWhatsAppDocument = (
  phone: string,
  document: string,
  extension: string,
  fileName?: string,
) => callProxy("send-document", { phone, document, extension, fileName });

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
