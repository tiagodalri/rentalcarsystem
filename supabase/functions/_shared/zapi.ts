// Shared helpers for the Z-API integration edge functions.
// Never import from src/ — this runs on Deno.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export interface ZapiConfig {
  instanceId: string;
  token: string;
  clientToken: string;
}

export interface ZapiFullConfig extends ZapiConfig {
  webhookSecret: string | null;
  source: "db" | "env";
}

/** Legacy env-only reader (kept for callers that don't need async). */
export function readZapiConfig(): ZapiConfig | null {
  const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
  const token = Deno.env.get("ZAPI_TOKEN");
  const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN");
  if (!instanceId || !token || !clientToken) return null;
  return { instanceId, token, clientToken };
}

/**
 * Read the Z-API config, preferring the `zapi_config` DB row (written by the
 * admin settings UI). Falls back to env-var secrets if the row is empty or
 * missing any field. Uses the service role key — safe inside edge functions
 * only, never expose to the browser.
 */
export async function readZapiConfigAsync(): Promise<ZapiFullConfig | null> {
  const envInstance = Deno.env.get("ZAPI_INSTANCE_ID") ?? null;
  const envToken = Deno.env.get("ZAPI_TOKEN") ?? null;
  const envClient = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? null;
  const envSecret = Deno.env.get("ZAPI_WEBHOOK_SECRET") ?? null;

  let dbInstance: string | null = null;
  let dbToken: string | null = null;
  let dbClient: string | null = null;
  let dbSecret: string | null = null;
  let sawDbRow = false;
  try {
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await svc
      .from("zapi_config")
      .select("instance_id, token, client_token, webhook_secret")
      .eq("id", 1)
      .maybeSingle();
    if (data) {
      sawDbRow = true;
      dbInstance = (data as Record<string, string | null>).instance_id ?? null;
      dbToken = (data as Record<string, string | null>).token ?? null;
      dbClient = (data as Record<string, string | null>).client_token ?? null;
      dbSecret = (data as Record<string, string | null>).webhook_secret ?? null;
    }
  } catch (err) {
    console.warn("[zapi] failed to read zapi_config from DB, falling back to env", err);
  }

  const instanceId = dbInstance || envInstance;
  const token = dbToken || envToken;
  const clientToken = dbClient || envClient;
  const webhookSecret = dbSecret || envSecret;

  if (!instanceId || !token || !clientToken) return null;
  return {
    instanceId,
    token,
    clientToken,
    webhookSecret,
    source: sawDbRow && (dbInstance || dbToken || dbClient) ? "db" : "env",
  };
}

/** Read only the webhook secret, DB-first with env fallback. */
export async function readWebhookSecretAsync(): Promise<string | null> {
  try {
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data } = await svc
      .from("zapi_config")
      .select("webhook_secret")
      .eq("id", 1)
      .maybeSingle();
    const dbSecret = (data as { webhook_secret?: string | null } | null)?.webhook_secret ?? null;
    if (dbSecret) return dbSecret;
  } catch {
    // ignore, fall through to env
  }
  return Deno.env.get("ZAPI_WEBHOOK_SECRET") ?? null;
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

/** Return a masked view of a secret string ("abcd••••wxyz"). */
export function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = String(value);
  if (s.length <= 8) return "••••••••";
  return `${s.slice(0, 4)}${"•".repeat(Math.min(12, Math.max(4, s.length - 8)))}${s.slice(-4)}`;
}

/**
 * True when the incoming field value is either empty or looks like a masked
 * display value (contains the bullet character). In both cases the caller
 * should NOT overwrite the stored secret.
 */
export function isMaskedOrEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const s = String(value);
  if (s.length === 0) return true;
  return s.includes("•");
}
