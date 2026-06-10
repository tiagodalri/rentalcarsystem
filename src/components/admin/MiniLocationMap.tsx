import { useEffect, useRef, useState } from "react";
import { MapPin, ExternalLink } from "lucide-react";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";

type Props = {
  address: string;
  height?: number;
  className?: string;
};

// Module-level cache so we don't re-geocode repeated addresses in the session
const geoCache = new Map<string, { lat: number; lng: number } | null>();

export default function MiniLocationMap({ address, height = 160, className = "" }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    if (!address) {
      setState("error");
      return;
    }

    (async () => {
      try {
        const google = await loadGoogleMaps();
        if (cancelled || !ref.current) return;

        let coords = geoCache.get(address);
        if (coords === undefined) {
          const geocoder = new google.maps.Geocoder();
          const result = await new Promise<google.maps.GeocoderResult[] | null>((resolve) => {
            geocoder.geocode({ address }, (res: any, status: any) => {
              if (status === "OK" && res && res.length) resolve(res);
              else resolve(null);
            });
          });
          coords = result?.[0]?.geometry?.location
            ? { lat: result[0].geometry.location.lat(), lng: result[0].geometry.location.lng() }
            : null;
          geoCache.set(address, coords);
        }

        if (cancelled || !ref.current) return;
        if (!coords) {
          setState("error");
          return;
        }

        const map = new google.maps.Map(ref.current, {
          center: coords,
          zoom: 14,
          disableDefaultUI: true,
          gestureHandling: "cooperative",
          clickableIcons: false,
          backgroundColor: "transparent",
        });
        new google.maps.Marker({ position: coords, map });
        setState("ok");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address]);

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <div className={`relative rounded-xl overflow-hidden border border-border/40 bg-muted/30 ${className}`} style={{ height }}>
      <div ref={ref} className="absolute inset-0" />
      {state !== "ok" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground bg-muted/40">
          <MapPin size={18} className="opacity-60" />
          <span className="text-[11px]">{state === "loading" ? "Carregando mapa…" : "Mapa indisponível"}</span>
        </div>
      )}
      {state === "ok" && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-semibold bg-background/95 text-foreground hover:bg-background px-2 py-1 rounded-md shadow-sm"
        >
          <ExternalLink size={10} /> Abrir
        </a>
      )}
    </div>
  );
}
