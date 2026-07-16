import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, MapPin, Gauge, Clock, AlertTriangle, Lock, Navigation } from "lucide-react";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";

const GOLD = "#D4AF37";
const FN_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/public-vehicle-track`;
const POLL_MS = 5000;

type TrackData = {
  label: string | null;
  vehicle: { name: string; plate: string | null; color?: string | null; year?: number | null };
  position: {
    lat: number; lng: number; speed: number | null; heading: number | null;
    address: string | null; last_seen: string | null; status: string | null;
    fuel_percent: number | null; odometer_mi: number | null;
  } | null;
  trip: {
    id: string; started_at: string; ended_at: string | null; in_progress: boolean;
    distance_mi: number | null; max_speed_mph: number | null; avg_speed_mph: number | null;
    gps: string | null;
  } | null;
  server_time: string;
};

export default function PublicTrack() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<TrackData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const mapHost = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const pathRef = useRef<any>(null);
  const firstFit = useRef(true);

  // Polling
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    let timer: number | null = null;

    const fetchOnce = async () => {
      try {
        const r = await fetch(`${FN_URL}?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const j = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          setErr(j?.error ?? "unknown_error");
          setData(null);
          setLoading(false);
          return;
        }
        setErr(null);
        setData(j);
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setErr("network_error"); setLoading(false); }
      }
    };
    fetchOnce();
    timer = window.setInterval(fetchOnce, POLL_MS);
    return () => { cancelled = true; if (timer) clearInterval(timer); };
  }, [token]);

  // Init map
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps().then((google) => {
      if (cancelled || !mapHost.current) return;
      mapRef.current = new google.maps.Map(mapHost.current, {
        center: { lat: 28.5, lng: -81.4 },
        zoom: 11,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy",
        clickableIcons: false,
        backgroundColor: "#e5e3df",
      });
    }).catch(console.error);
    return () => { cancelled = true; };
  }, []);

  // Sync map with data
  useEffect(() => {
    if (!data?.position || !mapRef.current) return;
    const google = (window as any).google;
    const center = { lat: data.position.lat, lng: data.position.lng };

    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({
        map: mapRef.current,
        position: center,
        zIndex: 9999,
        icon: carIcon(data.position.heading ?? 0),
        optimized: false,
        title: data.vehicle.name,
      });
    } else {
      markerRef.current.setPosition(center);
      markerRef.current.setIcon(carIcon(data.position.heading ?? 0));
    }

    // Draw trip path
    if (data.trip?.gps) {
      try {
        const path = google.maps.geometry.encoding.decodePath(data.trip.gps);
        if (!pathRef.current) {
          pathRef.current = new google.maps.Polyline({
            map: mapRef.current,
            path,
            strokeColor: GOLD,
            strokeOpacity: 0.85,
            strokeWeight: 5,
            zIndex: 5,
          });
        } else {
          pathRef.current.setPath(path);
        }
      } catch {}
    }

    if (firstFit.current) {
      firstFit.current = false;
      mapRef.current.panTo(center);
      mapRef.current.setZoom(15);
    } else if (data.trip?.in_progress) {
      mapRef.current.panTo(center);
    }
  }, [data]);

  if (!token) return <ErrorScreen title="Link inválido" detail="Token ausente na URL." />;
  if (err) return <ErrorScreenForCode code={err} />;

  return (
    <div className="fixed inset-0 bg-[#050505] flex flex-col">
      {/* Top bar */}
      <header className="shrink-0 px-4 py-3 border-b border-white/5 bg-black/70 backdrop-blur-md flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${GOLD}, #b8941f)` }}>
          <Navigation size={16} className="text-black" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.25em] font-bold" style={{ color: GOLD }}>
            Rastreamento ao vivo · GoDrive
          </p>
          <h1 className="text-sm font-bold text-white truncate">
            {data?.vehicle?.name ?? (loading ? "Carregando…" : "")}
            {data?.vehicle?.plate && <span className="ml-2 text-white/50 font-mono text-[11px]">{data.vehicle.plate}</span>}
          </h1>
        </div>
        {data?.trip?.in_progress && (
          <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Em viagem
          </span>
        )}
      </header>

      {/* Map */}
      <div className="relative flex-1 min-h-0">
        <div ref={mapHost} className="absolute inset-0" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
            <Loader2 size={22} className="animate-spin text-white" />
          </div>
        )}

        {/* HUD */}
        {data?.position && (
          <div className="absolute top-3 left-3 z-10 rounded-xl bg-black/80 backdrop-blur-md border p-3 shadow-2xl max-w-[260px]"
               style={{ borderColor: `${GOLD}40` }}>
            <div className="flex items-center gap-2 mb-2">
              <Gauge size={14} style={{ color: GOLD }} />
              <p className="text-2xl font-bold text-white tabular-nums leading-none">
                {Math.round(data.position.speed ?? 0)}
                <span className="text-[10px] text-white/50 ml-1 uppercase font-normal">mph</span>
              </p>
            </div>
            {data.position.address && (
              <p className="text-[11px] text-white/70 flex items-start gap-1.5 leading-snug">
                <MapPin size={11} className="mt-0.5 shrink-0" style={{ color: GOLD }} />
                <span>{data.position.address}</span>
              </p>
            )}
            {data.position.last_seen && (
              <p className="text-[10px] text-white/40 mt-1.5 flex items-center gap-1.5 tabular-nums">
                <Clock size={10} />
                visto {timeAgo(data.position.last_seen)}
              </p>
            )}
          </div>
        )}

        {/* Footer with privacy notice */}
        <div className="absolute bottom-3 right-3 z-10 rounded-full bg-black/70 backdrop-blur-md border border-white/10 px-3 py-1.5 text-[9px] uppercase tracking-wider text-white/50 flex items-center gap-1.5">
          <Lock size={9} /> Atualiza a cada {POLL_MS / 1000}s
        </div>
      </div>
    </div>
  );
}

function carIcon(heading: number) {
  const google = (window as any).google;
  return {
    url:
      "data:image/svg+xml;charset=UTF-8," +
      encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
        <g transform="rotate(${heading} 20 20)">
          <circle cx="20" cy="20" r="16" fill="#0a0a0a" stroke="${GOLD}" stroke-width="2.5"/>
          <path d="M20 7 L27 20 L20 17 L13 20 Z" fill="${GOLD}"/>
          <circle cx="20" cy="20" r="3" fill="#fff"/>
        </g>
      </svg>`),
    scaledSize: new google.maps.Size(40, 40),
    anchor: new google.maps.Point(20, 20),
  };
}

function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)} dias atrás`;
}

function ErrorScreenForCode({ code }: { code: string }) {
  const map: Record<string, { title: string; detail: string }> = {
    not_found: { title: "Link não encontrado", detail: "Esse link de rastreamento não existe ou foi removido." },
    revoked: { title: "Link revogado", detail: "O proprietário revogou este compartilhamento." },
    expired: { title: "Link expirado", detail: "Este compartilhamento já passou da validade." },
    invalid_token: { title: "Link inválido", detail: "Confira a URL e tente novamente." },
    vehicle_missing: { title: "Veículo indisponível", detail: "O veículo não está mais disponível." },
  };
  const { title, detail } = map[code] ?? { title: "Não foi possível abrir", detail: "Tente novamente em alguns instantes." };
  return <ErrorScreen title={title} detail={detail} />;
}

function ErrorScreen({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#050505] p-6">
      <div className="max-w-sm w-full rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 text-center">
        <AlertTriangle size={28} className="mx-auto mb-3" style={{ color: GOLD }} />
        <h1 className="text-base font-bold text-white">{title}</h1>
        <p className="text-xs text-white/60 mt-2 leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}
