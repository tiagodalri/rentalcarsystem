// Singleton loader for Google Maps JavaScript API.
// - Tries available keys in order for the current host.
// - Suppresses Google's default `gm_authFailure` full-page overlay and
//   automatically retries with the next candidate key (eliminates the
//   intermittent "Ops! Algo deu errado / Esta página não carregou o
//   Google Maps corretamente" screen).
// - Remembers which key worked in sessionStorage for stability across navigations.

// v3: bumped after key consolidation — invalidates any stale key cached under v2.
const KEY_CACHE_STORAGE = "zeus:gmaps:working-key:v3";

// Single source of truth for the Google Maps browser key. Referrer-restricted
// in Google Cloud (godalz.com, www.godalz.com, *.lovable.app,
// rentalcarsystem.lovable.app), so it is safe to embed in the bundle.
const GOOGLE_MAPS_BROWSER_KEY = "AIzaSyCJpffmY5NsZSzo_gHniRSEdPlE16jlBeA";

let loaderPromise: Promise<any> | null = null;
let resolvedKey: string | undefined;

function getCandidateKeys(): string[] {
  if (typeof window === "undefined") return [];

  const envCustom = import.meta.env.VITE_ZEUS_GOOGLE_MAPS_CUSTOM_BROWSER_KEY as string | undefined;
  const ordered = [GOOGLE_MAPS_BROWSER_KEY, envCustom].filter(
    (k): k is string => !!k,
  );

  const seen = new Set<string>();
  const out: string[] = [];

  try {
    const cached = window.sessionStorage?.getItem(KEY_CACHE_STORAGE) || undefined;
    if (cached && ordered.includes(cached)) {
      out.push(cached);
      seen.add(cached);
    }
  } catch (_) { /* ignore */ }

  for (const k of ordered) {
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

export function getGoogleMapsBrowserKey(): string | undefined {
  if (resolvedKey) return resolvedKey;
  return getCandidateKeys()[0];
}

export function getGoogleMapsTrackingId(): string | undefined {
  return (import.meta.env.VITE_ZEUS_GOOGLE_MAPS_TRACKING_ID ||
    import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID) as string | undefined;
}

function loadWithKey(apiKey: string, channel: string | undefined): Promise<any> {
  return new Promise((resolve, reject) => {
    const cbName = `__zeusInitGmaps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    let settled = false;
    let authFailed = false;
    (window as any).__gmapsAuthFailed = false;

    const cleanup = () => {
      try { delete (window as any)[cbName]; } catch (_) { /* ignore */ }
    };

    // Intercept Google's auth failure callback. Google calls this AFTER the script
    // loads successfully but the key is rejected for this referrer. By defining it
    // ourselves we suppress the default full-page overlay.
    const prevAuthFailure = (window as any).gm_authFailure;
    (window as any).gm_authFailure = () => {
      authFailed = true;
      (window as any).__gmapsAuthFailed = true;
      window.dispatchEvent(new CustomEvent("google-maps-auth-failure"));
      // Tear down the broken google object so the next key attempt can re-init.
      try {
        delete (window as any).google;
      } catch (_) {
        (window as any).google = undefined;
      }
      // Remove any maps script tags so a retry can re-inject cleanly.
      document
        .querySelectorAll<HTMLScriptElement>('script[src*="maps.googleapis.com/maps/api/js"]')
        .forEach((s) => s.parentElement?.removeChild(s));
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error("gm_authFailure"));
      }
      // Restore any pre-existing handler so we don't leak our shim long-term.
      (window as any).gm_authFailure = prevAuthFailure;
    };

    (window as any)[cbName] = () => {
      if (settled || authFailed) return;
      window.setTimeout(() => {
        if (settled || authFailed || (window as any).__gmapsAuthFailed) return;
        settled = true;
        cleanup();
        resolve((window as any).google);
      }, 800);
    };

    const params = new URLSearchParams({
      key: apiKey,
      loading: "async",
      callback: cbName,
      libraries: "geometry,places",
      v: "weekly",
    });
    if (channel) params.set("channel", channel);

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Falha ao carregar Google Maps (network)"));
    };
    document.head.appendChild(script);
  });
}

export function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps requires a browser environment"));
  }

  if ((window as any).google?.maps) {
    return Promise.resolve((window as any).google);
  }

  if (loaderPromise) return loaderPromise;

  const candidates = getCandidateKeys();
  const channel = getGoogleMapsTrackingId();

  if (candidates.length === 0) {
    return Promise.reject(new Error("Google Maps browser key não configurada"));
  }

  loaderPromise = (async () => {
    let lastErr: unknown = null;
    for (const key of candidates) {
      try {
        const google = await loadWithKey(key, channel);
        resolvedKey = key;
        try { window.sessionStorage?.setItem(KEY_CACHE_STORAGE, key); } catch (_) { /* ignore */ }
        return google;
      } catch (e) {
        lastErr = e;
        // Invalidate the cached key if it just failed.
        try {
          if (window.sessionStorage?.getItem(KEY_CACHE_STORAGE) === key) {
            window.sessionStorage.removeItem(KEY_CACHE_STORAGE);
          }
        } catch (_) { /* ignore */ }
        // Try next candidate on next loop iteration.
      }
    }
    // All candidates failed — clear singleton so next call can retry from scratch.
    loaderPromise = null;
    throw (lastErr instanceof Error ? lastErr : new Error("Falha ao carregar Google Maps"));
  })();

  return loaderPromise;
}
