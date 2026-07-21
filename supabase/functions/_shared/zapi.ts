// Shared helpers for the Z-API integration edge functions.
// Never import from src/ — this runs on Deno.

export interface ZapiConfig {
  instanceId: string;
  token: string;
  clientToken: string;
}

export function readZapiConfig(): ZapiConfig | null {
  const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
  const token = Deno.env.get("ZAPI_TOKEN");
  const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");
  if (!instanceId || !token || !clientToken) return null;
  return { instanceId, token, clientToken };
}

export function zapiBaseUrl(cfg: ZapiConfig): string {
  return `https://api.z-api.io/instances/${cfg.instanceId}/token/${cfg.token}`;
}

export function zapiHeaders(cfg: ZapiConfig): HeadersInit {
  return {
    "Content-Type": "application/json",
    "Client-Token": cfg.clientToken,
  };
}

/** Timing-safe string compare to protect webhook token from timing attacks. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Normalize a phone to digits-only (E.164 without +). */
export function normalizePhone(input: string | null | undefined): string {
  if (!input) return "";
  return String(input).replace(/[^\d]/g, "");
}

/** Build a stable external conversation id from a phone number. */
export function externalConversationId(phone: string): string {
  return `wa_${normalizePhone(phone)}`;
}

export interface ZapiCallResult {
  ok: boolean;
  status: number;
  data: unknown;
  reason?: string;
}

/** Perform a Z-API HTTP call and normalize known "device offline" case. */
export async function callZapi(
  cfg: ZapiConfig,
  path: string,
  init: RequestInit = {},
): Promise<ZapiCallResult> {
  const url = `${zapiBaseUrl(cfg)}${path.startsWith("/") ? path : `/${path}`}`;
  const resp = await fetch(url, {
    ...init,
    headers: {
      ...zapiHeaders(cfg),
      ...(init.headers || {}),
    },
  });

  let data: unknown = null;
  const ct = resp.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      data = await resp.json();
    } else {
      data = await resp.text();
    }
  } catch {
    data = null;
  }

  // Detect the well-known "smartphone is not responding" case
  const asString =
    typeof data === "string"
      ? data
      : data && typeof data === "object"
      ? JSON.stringify(data)
      : "";
  if (asString.toLowerCase().includes("smartphone is not responding")) {
    return { ok: false, status: resp.status, data, reason: "device_offline" };
  }

  return { ok: resp.ok, status: resp.status, data };
}
