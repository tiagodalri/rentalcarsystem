import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "zeus_activity_session_id";

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "no-session";
  }
}

function detectDevice(): { device: string; browser: string; os: string } {
  const ua = navigator.userAgent;
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  const isTablet = /iPad|Tablet/i.test(ua);
  const device = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";
  let browser = "unknown";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";
  let os = "unknown";
  if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad/.test(ua)) os = "iOS";
  else if (/Linux/.test(ua)) os = "Linux";
  return { device, browser, os };
}

type LogInput = {
  event_type: string;
  event_name?: string;
  path?: string;
  target_id?: string;
  metadata?: Record<string, any>;
  duration_ms?: number;
};

export async function logActivity(input: LogInput) {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth?.user;
    if (!user) return; // RLS requires user_id = auth.uid()
    const { device, browser, os } = detectDevice();
    await supabase.from("activity_logs").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      user_name:
        (user.user_metadata as any)?.full_name ||
        (user.user_metadata as any)?.name ||
        null,
      event_type: input.event_type,
      event_name: input.event_name ?? null,
      path: input.path ?? (typeof window !== "undefined" ? window.location.pathname : null),
      referrer: typeof document !== "undefined" ? document.referrer || null : null,
      target_id: input.target_id ?? null,
      metadata: input.metadata ?? null,
      device,
      browser,
      os,
      session_id: getSessionId(),
      duration_ms: input.duration_ms ?? null,
    });
  } catch {
    // never break UX on logger errors
  }
}

let authBound = false;
export function bindAuthLogging() {
  if (authBound) return;
  authBound = true;
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN") logActivity({ event_type: "auth.login", event_name: "Login" });
    if (event === "SIGNED_OUT") logActivity({ event_type: "auth.logout", event_name: "Logout" });
    if (event === "PASSWORD_RECOVERY")
      logActivity({ event_type: "auth.password_recovery", event_name: "Recuperação de senha" });
  });
}
