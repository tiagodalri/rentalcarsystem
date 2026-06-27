const RECOVERY_STARTED_KEY = "__zeus_recovery_started_at__";
const RECOVERY_DONE_KEY = "__zeus_recovery_done_at__";
const RECOVERY_COOLDOWN_MS = 15_000;

const CHUNK_LOAD_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk/i,
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /Unable to preload CSS/i,
  /vite:preloadError/i,
  /module script failed/i,
  /Load failed/i,
  /NetworkError when attempting to fetch resource/i,
];

export function isRecoverableChunkLoadError(message: string | undefined | null): boolean {
  if (!message) return false;
  return CHUNK_LOAD_PATTERNS.some((pattern) => pattern.test(message));
}

export async function clearPwaState(): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  if (typeof window !== "undefined" && "caches" in window) {
    tasks.push(
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
    );
  }

  if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    tasks.push(
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))),
    );
  }

  await Promise.allSettled(tasks);
}

export async function recoverFromStaleApp(options: { force?: boolean } = {}): Promise<void> {
  const now = Date.now();

  try {
    const lastStarted = Number(sessionStorage.getItem(RECOVERY_STARTED_KEY) || 0);
    if (!options.force && lastStarted && now - lastStarted < RECOVERY_COOLDOWN_MS) return;
    sessionStorage.setItem(RECOVERY_STARTED_KEY, String(now));
  } catch {
    /* Safari private mode / storage unavailable */
  }

  await clearPwaState();

  try {
    sessionStorage.setItem(RECOVERY_DONE_KEY, String(Date.now()));
  } catch {
    /* noop */
  }

  const url = new URL(window.location.href);
  url.searchParams.set("__zeus_refresh", String(Date.now()));
  window.location.replace(url.toString());
}
