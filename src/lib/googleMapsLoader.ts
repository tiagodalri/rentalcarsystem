// Singleton loader for Google Maps JavaScript API.
// Loads once, returns the same promise on subsequent calls.

let loaderPromise: Promise<typeof google> | null = null;

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps requires a browser environment"));
  }

  if ((window as any).google?.maps) {
    return Promise.resolve((window as any).google);
  }

  if (loaderPromise) return loaderPromise;

  const apiKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
  const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

  if (!apiKey) {
    return Promise.reject(new Error("Google Maps browser key não configurada"));
  }

  loaderPromise = new Promise((resolve, reject) => {
    const cbName = `__zeusInitGmaps_${Date.now()}`;
    (window as any)[cbName] = () => {
      resolve((window as any).google);
      delete (window as any)[cbName];
    };

    const params = new URLSearchParams({
      key: apiKey,
      loading: "async",
      callback: cbName,
      libraries: "geometry",
      v: "weekly",
    });
    if (channel) params.set("channel", channel);

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      loaderPromise = null;
      reject(new Error("Falha ao carregar Google Maps"));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}
