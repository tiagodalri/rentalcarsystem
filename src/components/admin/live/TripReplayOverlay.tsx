import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X, Play, Pause, Loader2, Maximize2, MapPin, Flag, AlertTriangle,
  Zap, PauseCircle, Gauge, Clock, Route, TrendingUp, SkipBack, SkipForward,
  RotateCcw, Fuel, Activity, Trophy, Download,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip } from "recharts";
import { getGoogleMapsBrowserKey, loadGoogleMaps } from "@/lib/googleMapsLoader";
import { useTripReplay, speedBand, type ReplayEvent, type ReplayPoint } from "@/hooks/useTripReplay";

const GOLD = "#D4AF37";

function fmtClock(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}
function fmtTimeOfDay(d: Date, tz?: string) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: tz });
}
function fmtMins(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}min`;
}

function lerp(a: number, b: number, f: number) { return a + (b - a) * f; }
function lerpAngle(a: number, b: number, f: number) {
  let diff = ((b - a + 540) % 360) - 180;
  return (a + diff * f + 360) % 360;
}

/** Find point index whose cumulative time bracket contains playbackMs */
function findIndex(points: ReplayPoint[], playbackMs: number): number {
  // Points have monotonically-increasing t. Binary search for performance.
  let lo = 0, hi = points.length - 1;
  if (playbackMs <= points[0].t) return 0;
  if (playbackMs >= points[hi].t) return hi - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t <= playbackMs) lo = mid; else hi = mid;
  }
  return lo;
}

type EventCfg = { color: string; icon: any; label: string };
const EVENT_CFG: Record<ReplayEvent["kind"], EventCfg> = {
  start:       { color: "#22c55e", icon: Flag,           label: "Partida" },
  end:         { color: "#6366f1", icon: Flag,           label: "Chegada" },
  hard_brake:  { color: "#ef4444", icon: AlertTriangle,  label: "Freada" },
  hard_accel:  { color: "#f97316", icon: Zap,            label: "Aceleração" },
  stop:        { color: "#a3a3a3", icon: PauseCircle,    label: "Parada" },
  peak_speed:  { color: GOLD,      icon: TrendingUp,     label: "Pico" },
};

type Props = {
  vehicleId: string;
  vehicleName: string;
  tripId: string;
  onClose: () => void;
};

export function TripReplayOverlay({ vehicleName, tripId, onClose }: Props) {
  const { data, loading, error } = useTripReplay(tripId);
  const mapHostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const carMarkerRef = useRef<any>(null);
  const ghostPolyRef = useRef<any>(null);
  const traveledSegsRef = useRef<any[]>([]);
  const cometRef = useRef<any[]>([]);
  const eventMarkersRef = useRef<any[]>([]);
  const startPinRef = useRef<any>(null);
  const endPinRef = useRef<any>(null);

  const [mapReady, setMapReady] = useState(false);
  const [playing, setPlaying] = useState(false); // start paused, intro plays first
  const SPEED_OPTIONS = [10, 14, 18, 20, 24, 30, 60] as const;
  type SpeedOpt = typeof SPEED_OPTIONS[number];
  const [speed, setSpeed] = useState<SpeedOpt>(18);
  const [playbackMs, setPlaybackMs] = useState(0);
  const [followCam, setFollowCam] = useState(true);
  const [intro, setIntro] = useState(true); // cinematic opening
  const [showSummary, setShowSummary] = useState(false);

  // Mutable refs for rAF
  const playbackRef = useRef(0);
  const playingRef = useRef(false);
  const speedRef = useRef<SpeedOpt>(18);
  const lastTickRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const followRef = useRef(true);
  const lastPanRef = useRef(0);

  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { followRef.current = followCam; }, [followCam]);

  // Init map
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !mapHostRef.current) return;
        mapRef.current = new google.maps.Map(mapHostRef.current, {
          center: { lat: 28.5, lng: -81.4 },
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
          backgroundColor: "#e5e3df",
          clickableIcons: false,
        });
        setMapReady(true);
      })
      .catch((e) => console.error("[Replay map]", e));
    return () => { cancelled = true; };
  }, []);

  // Build ghost route + start/end + event markers when data + map ready
  useEffect(() => {
    if (!mapReady || !data || !mapRef.current) return;
    const google = (window as any).google;
    const map = mapRef.current;

    // Clean previous
    ghostPolyRef.current?.setMap(null);
    traveledSegsRef.current.forEach((p) => p.setMap(null));
    traveledSegsRef.current = [];
    cometRef.current.forEach((c) => c.setMap(null));
    cometRef.current = [];
    eventMarkersRef.current.forEach((m) => m.setMap(null));
    eventMarkersRef.current = [];
    startPinRef.current?.setMap(null);
    endPinRef.current?.setMap(null);
    carMarkerRef.current?.setMap(null);

    // Ghost polyline (full route, faded)
    ghostPolyRef.current = new google.maps.Polyline({
      path: data.points.map((p) => ({ lat: p.lat, lng: p.lng })),
      map,
      strokeColor: "#94a3b8",
      strokeOpacity: 0.35,
      strokeWeight: 5,
      zIndex: 1,
    });

    // Pre-create traveled colored segments (one per point pair). We'll show/hide as we progress.
    for (let i = 0; i < data.points.length - 1; i++) {
      const p = data.points[i];
      const np = data.points[i + 1];
      const seg = new google.maps.Polyline({
        path: [{ lat: p.lat, lng: p.lng }, { lat: np.lat, lng: np.lng }],
        map: null,
        strokeColor: speedBand((p.speed + np.speed) / 2),
        strokeOpacity: 0.95,
        strokeWeight: 6,
        zIndex: 2,
      });
      traveledSegsRef.current.push(seg);
    }

    // Comet trail circles (last ~10 points behind car)
    for (let i = 0; i < 10; i++) {
      const c = new google.maps.Circle({
        map: null,
        center: { lat: data.points[0].lat, lng: data.points[0].lng },
        radius: 8,
        strokeOpacity: 0,
        fillColor: GOLD,
        fillOpacity: 0.18 - i * 0.015,
        clickable: false,
        zIndex: 3,
      });
      cometRef.current.push(c);
    }

    // Start / End pins
    const last = data.points[data.points.length - 1];
    startPinRef.current = new google.maps.Marker({
      map,
      position: { lat: data.points[0].lat, lng: data.points[0].lng },
      zIndex: 50,
      icon: {
        url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
            <path d="M16 0 C7 0 0 7 0 16 C0 28 16 40 16 40 C16 40 32 28 32 16 C32 7 25 0 16 0 Z" fill="#22c55e" stroke="#fff" stroke-width="2"/>
            <circle cx="16" cy="15" r="6" fill="#fff"/>
          </svg>`),
        scaledSize: new google.maps.Size(32, 40),
        anchor: new google.maps.Point(16, 40),
      },
      title: "Partida",
    });
    endPinRef.current = new google.maps.Marker({
      map,
      position: { lat: last.lat, lng: last.lng },
      zIndex: 50,
      icon: {
        url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
            <path d="M16 0 C7 0 0 7 0 16 C0 28 16 40 16 40 C16 40 32 28 32 16 C32 7 25 0 16 0 Z" fill="#0a0a0a" stroke="#fff" stroke-width="2"/>
            <g transform="translate(8,7)">
              <rect width="4" height="4" fill="#fff"/><rect x="8" width="4" height="4" fill="#fff"/>
              <rect x="4" y="4" width="4" height="4" fill="#fff"/><rect x="12" y="4" width="4" height="4" fill="#fff"/>
              <rect y="8" width="4" height="4" fill="#fff"/><rect x="8" y="8" width="4" height="4" fill="#fff"/>
            </g>
          </svg>`),
        scaledSize: new google.maps.Size(32, 40),
        anchor: new google.maps.Point(16, 40),
      },
      title: "Chegada",
    });

    // Event markers (skip start/end since we have pins)
    for (const ev of data.events) {
      if (ev.kind === "start" || ev.kind === "end") continue;
      const cfg = EVENT_CFG[ev.kind];
      const m = new google.maps.Marker({
        map,
        position: { lat: ev.lat, lng: ev.lng },
        zIndex: 40,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
              <circle cx="11" cy="11" r="9" fill="${cfg.color}" stroke="#fff" stroke-width="2"/>
            </svg>`),
          scaledSize: new google.maps.Size(22, 22),
          anchor: new google.maps.Point(11, 11),
        },
        title: ev.label,
      });
      m.addListener("click", () => seekTo(ev.t));
      eventMarkersRef.current.push(m);
    }

    // Car marker
    carMarkerRef.current = new google.maps.Marker({
      map,
      position: { lat: data.points[0].lat, lng: data.points[0].lng },
      zIndex: 100,
      icon: makeCarIcon(data.points[0].heading),
      optimized: false,
    });

    // Cinematic intro: fit bounds, wait, then zoom in on start point and start playing
    const b = new google.maps.LatLngBounds(
      { lat: data.bounds.south, lng: data.bounds.west },
      { lat: data.bounds.north, lng: data.bounds.east },
    );
    map.fitBounds(b, 120);

    // Reset state
    playbackRef.current = 0;
    setPlaybackMs(0);
    setShowSummary(false);
    setIntro(true);
    setPlaying(false);

    // After a short beat, zoom into the start and begin replay
    const t1 = window.setTimeout(() => {
      try {
        map.panTo({ lat: data.points[0].lat, lng: data.points[0].lng });
        const targetZoom = Math.min(17, Math.max(14, (map.getZoom() ?? 13) + 2));
        map.setZoom(targetZoom);
      } catch {}
    }, 600);
    const t2 = window.setTimeout(() => {
      setIntro(false);
      setPlaying(true);
    }, 1700);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, data]);

  function makeCarIcon(heading: number) {
    const google = (window as any).google;
    return {
      url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
          <g transform="rotate(${heading} 22 22)">
            <circle cx="22" cy="22" r="18" fill="#0a0a0a" stroke="${GOLD}" stroke-width="2.5"/>
            <path d="M22 8 L29 22 L22 19 L15 22 Z" fill="${GOLD}"/>
            <circle cx="22" cy="22" r="3" fill="#fff"/>
          </g>
        </svg>`),
      scaledSize: new google.maps.Size(44, 44),
      anchor: new google.maps.Point(22, 22),
    };
  }

  // rAF loop
  useEffect(() => {
    if (!mapReady || !data) return;
    lastTickRef.current = performance.now();

    const tick = () => {
      const now = performance.now();
      const dr = now - lastTickRef.current;
      lastTickRef.current = now;
      if (playingRef.current) {
        playbackRef.current = Math.min(data.durationMs, playbackRef.current + dr * speedRef.current);
        if (playbackRef.current >= data.durationMs) {
          playingRef.current = false;
          setPlaying(false);
          setShowSummary(true);
        }
        setPlaybackMs(playbackRef.current);
      }
      renderFrame();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, data]);

  const renderFrame = useCallback(() => {
    const d = data;
    if (!d || !carMarkerRef.current) return;
    const points = d.points;
    const i = findIndex(points, playbackRef.current);
    const cur = points[i];
    const nxt = points[i + 1] ?? points[i];
    const span = Math.max(1, nxt.t - cur.t);
    const f = Math.min(1, Math.max(0, (playbackRef.current - cur.t) / span));
    const lat = lerp(cur.lat, nxt.lat, f);
    const lng = lerp(cur.lng, nxt.lng, f);
    const hdg = lerpAngle(cur.heading, nxt.heading, f);

    carMarkerRef.current.setPosition({ lat, lng });
    carMarkerRef.current.setIcon(makeCarIcon(hdg));

    // Traveled segments: show those with start point before current i
    for (let k = 0; k < traveledSegsRef.current.length; k++) {
      const seg = traveledSegsRef.current[k];
      const shown = k < i;
      if (shown && !seg.getMap()) seg.setMap(mapRef.current);
      else if (!shown && seg.getMap()) seg.setMap(null);
    }

    // Comet trail behind car
    for (let k = 0; k < cometRef.current.length; k++) {
      const idx = i - k * 2;
      if (idx < 0) { cometRef.current[k].setMap(null); continue; }
      cometRef.current[k].setCenter({ lat: points[idx].lat, lng: points[idx].lng });
      if (!cometRef.current[k].getMap()) cometRef.current[k].setMap(mapRef.current);
    }

    // Camera follow (throttled)
    if (followRef.current) {
      const t = performance.now();
      if (t - lastPanRef.current > 400) {
        lastPanRef.current = t;
        mapRef.current.panTo({ lat, lng });
      }
    }
  }, [data]);

  const seekTo = useCallback((ms: number) => {
    if (!data) return;
    playbackRef.current = Math.min(data.durationMs, Math.max(0, ms));
    setPlaybackMs(playbackRef.current);
    renderFrame();
  }, [data, renderFrame]);

  const fitWhole = useCallback(() => {
    if (!data || !mapRef.current) return;
    const google = (window as any).google;
    setFollowCam(false);
    const b = new google.maps.LatLngBounds(
      { lat: data.bounds.south, lng: data.bounds.west },
      { lat: data.bounds.north, lng: data.bounds.east },
    );
    mapRef.current.fitBounds(b, 80);
  }, [data]);

  // ===== Render the animation OFFSCREEN to MP4 =====
  // No screen capture, no permission dialogs. Builds a 1280x720 canvas with
  // a Google Static Maps background + animated route/car/HUD drawn frame-by-
  // frame, recorded via canvas.captureStream() + MediaRecorder.
  const [recording, setRecording] = useState(false);
  const [recProgress, setRecProgress] = useState(0);
  const recCancelRef = useRef<() => void>(() => { });

  const downloadMp4 = useCallback(async () => {
    if (!data || recording) return;

    const MR: any = (window as any).MediaRecorder;
    if (typeof MR === "undefined") {
      alert("Seu navegador não suporta gravação de vídeo. Use Chrome, Edge ou Safari atualizado.");
      return;
    }

    setRecording(true);
    setRecProgress(0);
    let cancelled = false;
    recCancelRef.current = () => { cancelled = true; };

    try {
      // ===== Canvas (1600x900 — 16:9 horizontal) =====
      const W = 1600, H = 900;
      const canvas = document.createElement("canvas");
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d")!;

      // ===== Mercator helpers =====
      const lngToMx = (lng: number) => (lng + 180) / 360 * 256;
      const latToMy = (lat: number) => {
        const s = Math.sin(Math.max(-89.9, Math.min(89.9, lat)) * Math.PI / 180);
        return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256;
      };

      // ===== Layout regions =====
      const TOP_BAR_H = 64;
      const RIGHT_PANEL_W = 340;
      const mapX1 = 0, mapY1 = TOP_BAR_H, mapX2 = W - RIGHT_PANEL_W, mapY2 = H;
      const mapW = mapX2 - mapX1;
      const mapH = mapY2 - mapY1;

      // ===== Fit zoom for the MAP area =====
      // Static map will be requested at full canvas size; we project onto the map sub-area
      // by adjusting center to the map sub-area's center.
      const cssW = 800, cssH = 450, scale = 2; // static map css size; image returns 1600x900
      const pad = 60;
      const b = data.bounds;
      // Compute fit zoom against the MAP sub-area in image pixels.
      const subW_img = mapW, subH_img = mapH;
      const dx = lngToMx(b.east) - lngToMx(b.west);
      const dy = latToMy(b.south) - latToMy(b.north);
      const zX = Math.log2((subW_img - 2 * pad) / Math.max(0.0001, dx * scale * 2)); // dx*scale gives css px? rewritten below
      void zX;
      // Easier formulation: pixels-per-merc-unit = (2 ** zoom) * scale.
      // Need (dx + 2*pad/ppmu) <= subW_img / ppmu  =>  ppmu <= (subW_img - 2*pad)/dx ...
      // Solve for zoom such that ppmu * dx + 2*pad <= subW_img (image px).
      const ppmuMaxX = (subW_img - 2 * pad) / Math.max(0.0001, dx);
      const ppmuMaxY = (subH_img - 2 * pad) / Math.max(0.0001, dy);
      const ppmuMax = Math.min(ppmuMaxX, ppmuMaxY);
      const zoom = Math.max(2, Math.min(19, Math.floor(Math.log2(ppmuMax / scale))));
      const ppmu = Math.pow(2, zoom) * scale; // image-pixels per merc-unit

      // Center of route
      const routeCMx = (lngToMx(b.east) + lngToMx(b.west)) / 2;
      const routeCMy = (latToMy(b.north) + latToMy(b.south)) / 2;

      // We want route to be centered inside the MAP sub-area, not the full canvas.
      // Compute the geographic center that places route center at sub-area center
      // when projecting onto full canvas.
      // canvas projection of (lat,lng): cx = (mercX - imgCenterMx)*ppmu + W/2
      // We want canvas_cx of route_center == mapX1 + mapW/2.
      // Solve: (routeCMx - imgCenterMx)*ppmu + W/2 = mapX1 + mapW/2
      // imgCenterMx = routeCMx - (mapX1 + mapW/2 - W/2)/ppmu
      const imgCenterMx = routeCMx - ((mapX1 + mapW / 2) - W / 2) / ppmu;
      const imgCenterMy = routeCMy - ((mapY1 + mapH / 2) - H / 2) / ppmu;

      // Convert center merc -> lat/lng for the Static Maps request
      const mxToLng = (mx: number) => (mx / 256) * 360 - 180;
      const myToLat = (my: number) => {
        const n = Math.PI - 2 * Math.PI * (my / 256);
        return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
      };
      const centerLat = myToLat(imgCenterMy);
      const centerLng = mxToLng(imgCenterMx);

      const project = (lat: number, lng: number) => ({
        x: (lngToMx(lng) - imgCenterMx) * ppmu + W / 2,
        y: (latToMy(lat) - imgCenterMy) * ppmu + H / 2,
      });

      // ===== Static map URL =====
      const apiKey = getGoogleMapsBrowserKey();
      if (!apiKey) throw new Error("Google Maps key não configurada");
      const mapUrl =
        `https://maps.googleapis.com/maps/api/staticmap` +
        `?center=${centerLat},${centerLng}` +
        `&zoom=${zoom}` +
        `&size=${cssW}x${cssH}` +
        `&scale=${scale}` +
        `&maptype=roadmap` +
        `&style=feature:poi|visibility:simplified` +
        `&style=feature:transit|visibility:off` +
        `&key=${apiKey}`;

      const bg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Falha ao carregar mapa estático"));
        img.src = mapUrl;
      });

      // Pre-project all points
      const proj = data.points.map((p) => project(p.lat, p.lng));

      // ===== Stream + recorder =====
      const stream = (canvas as any).captureStream(30) as MediaStream;
      const candidates = [
        "video/mp4;codecs=avc1.640028",
        "video/mp4;codecs=avc1.42E01F",
        "video/mp4",
        "video/webm;codecs=h264",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      const mime = candidates.find((m) => MR.isTypeSupported?.(m)) || "video/webm";
      const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
      const rec: MediaRecorder = new MR(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000 });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.start(250);

      // ===== Drawing helpers =====
      const FONT = "Inter, system-ui, sans-serif";
      const TZ = data.timeZone;

      const drawText = (text: string, x: number, y: number, opts: {
        size: number; weight?: number | string; color?: string; align?: CanvasTextAlign; tracking?: number;
      }) => {
        ctx.font = `${opts.weight ?? 400} ${opts.size}px ${FONT}`;
        ctx.fillStyle = opts.color ?? "#fff";
        ctx.textAlign = opts.align ?? "left";
        if (opts.tracking) {
          // crude letter-spacing
          const chars = text.split("");
          let xx = x;
          if (opts.align === "right") {
            const total = chars.reduce((s, c) => s + ctx.measureText(c).width + opts.tracking!, -opts.tracking!);
            xx = x - total;
          } else if (opts.align === "center") {
            const total = chars.reduce((s, c) => s + ctx.measureText(c).width + opts.tracking!, -opts.tracking!);
            xx = x - total / 2;
          }
          ctx.textAlign = "left";
          for (const c of chars) {
            ctx.fillText(c, xx, y);
            xx += ctx.measureText(c).width + opts.tracking;
          }
        } else {
          ctx.fillText(text, x, y);
        }
        ctx.textAlign = "left";
      };

      const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
      };

      // Sample events for timeline (max 14)
      const tlEvents = data.events.slice(0, 14);

      const drawFrameAt = (playMs: number) => {
        // ===== 1) Background map =====
        ctx.drawImage(bg, 0, 0, W, H);

        // ===== 2) Route layers =====
        ctx.lineCap = "round"; ctx.lineJoin = "round";
        // Ghost full route
        ctx.strokeStyle = "rgba(15,23,42,0.35)";
        ctx.lineWidth = 8;
        ctx.beginPath();
        for (let i = 0; i < proj.length; i++) {
          const p = proj[i];
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();

        // Current position
        const pts = data.points;
        const idx = findIndex(pts, playMs);
        const a = pts[idx], nb = pts[idx + 1] ?? a;
        const span = Math.max(1, nb.t - a.t);
        const f = Math.min(1, Math.max(0, (playMs - a.t) / span));
        const carX = lerp(proj[idx].x, proj[Math.min(proj.length - 1, idx + 1)].x, f);
        const carY = lerp(proj[idx].y, proj[Math.min(proj.length - 1, idx + 1)].y, f);
        const heading = lerpAngle(a.heading, nb.heading, f);
        const curSpeed = lerp(a.speed, nb.speed, f);

        // Traveled colored segments
        ctx.lineWidth = 7;
        for (let i = 0; i < idx; i++) {
          ctx.strokeStyle = speedBand((pts[i].speed + pts[i + 1].speed) / 2);
          ctx.beginPath();
          ctx.moveTo(proj[i].x, proj[i].y);
          ctx.lineTo(proj[i + 1].x, proj[i + 1].y);
          ctx.stroke();
        }
        if (idx < proj.length - 1) {
          ctx.strokeStyle = speedBand((a.speed + nb.speed) / 2);
          ctx.beginPath();
          ctx.moveTo(proj[idx].x, proj[idx].y);
          ctx.lineTo(carX, carY);
          ctx.stroke();
        }

        // Start/End pins
        const drawPin = (px: number, py: number, fill: string, glyph?: "flag" | "checker") => {
          ctx.save();
          ctx.translate(px, py - 22);
          // teardrop
          ctx.fillStyle = fill;
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(0, 12);
          ctx.bezierCurveTo(-14, -2, -14, -18, 0, -18);
          ctx.bezierCurveTo(14, -18, 14, -2, 0, 12);
          ctx.closePath();
          ctx.fill(); ctx.stroke();
          // inner circle
          ctx.fillStyle = "#fff";
          ctx.beginPath(); ctx.arc(0, -8, 5, 0, Math.PI * 2); ctx.fill();
          if (glyph === "checker") {
            ctx.fillStyle = "#0a0a0a";
            const cs = 2;
            for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
              if ((r + c) % 2 === 0) ctx.fillRect(-3 + c * cs, -11 + r * cs, cs, cs);
            }
          }
          ctx.restore();
        };
        drawPin(proj[0].x, proj[0].y, "#22c55e");
        drawPin(proj[proj.length - 1].x, proj[proj.length - 1].y, "#0a0a0a", "checker");

        // Car marker (rotated)
        ctx.save();
        ctx.translate(carX, carY);
        // halo
        ctx.fillStyle = "rgba(212,175,55,0.22)";
        ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(10,10,10,0.95)";
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
        ctx.rotate((heading * Math.PI) / 180);
        ctx.fillStyle = GOLD;
        ctx.beginPath();
        ctx.moveTo(0, -9);
        ctx.lineTo(6, 6);
        ctx.lineTo(0, 3);
        ctx.lineTo(-6, 6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // ===== 3) TOP BAR =====
        ctx.fillStyle = "rgba(0,0,0,0.78)";
        ctx.fillRect(0, 0, W, TOP_BAR_H);
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(0, TOP_BAR_H - 1, W, 1);

        // Logo square + title
        const logoX = 18, logoY = 14, logoS = 36;
        const lg = ctx.createLinearGradient(logoX, logoY, logoX + logoS, logoY + logoS);
        lg.addColorStop(0, GOLD); lg.addColorStop(1, "#b8941f");
        ctx.fillStyle = lg;
        roundRect(logoX, logoY, logoS, logoS, 8); ctx.fill();
        // Play triangle
        ctx.fillStyle = "#0a0a0a";
        ctx.beginPath();
        ctx.moveTo(logoX + 13, logoY + 10);
        ctx.lineTo(logoX + 27, logoY + 18);
        ctx.lineTo(logoX + 13, logoY + 26);
        ctx.closePath(); ctx.fill();

        drawText("REPLAY DE VIAGEM", logoX + logoS + 12, 27, { size: 10, weight: 700, color: GOLD, tracking: 1.5 });
        drawText(vehicleName, logoX + logoS + 12, 47, { size: 14, weight: 700, color: "#fff" });

        // Level badge
        const badgeX = logoX + logoS + 12 + ctx.measureText(vehicleName).width + 50;
        const badgeText = data.level === 2 ? "REPLAY DETALHADO" : "REPLAY RESUMIDO";
        ctx.font = "700 9px " + FONT;
        const bw = ctx.measureText(badgeText).width + 22;
        ctx.fillStyle = data.level === 2 ? "rgba(212,175,55,0.10)" : "rgba(255,255,255,0.05)";
        ctx.strokeStyle = data.level === 2 ? "rgba(212,175,55,0.45)" : "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1;
        roundRect(badgeX, 22, bw, 18, 9); ctx.fill(); ctx.stroke();
        ctx.fillStyle = data.level === 2 ? GOLD : "rgba(255,255,255,0.7)";
        ctx.beginPath(); ctx.arc(badgeX + 9, 31, 2, 0, Math.PI * 2); ctx.fill();
        drawText(badgeText, badgeX + 16, 34, { size: 9, weight: 700, color: data.level === 2 ? GOLD : "rgba(255,255,255,0.75)", tracking: 1.2 });

        // Stats inline
        type S = { icon: string; label: string; value: string };
        const stats: S[] = [
          { icon: "→", label: "DISTÂNCIA", value: `${data.totalDistanceMi.toFixed(1).replace(".", ",")} mi` },
          { icon: "◷", label: "DURAÇÃO", value: fmtClock(data.durationMs) },
          { icon: "◐", label: "VEL. MÉDIA", value: `${Math.round(data.avgSpeedMph)} mph` },
          { icon: "▲", label: "VEL. MÁX", value: `${Math.round(data.maxSpeedMph)} mph` },
          { icon: "!", label: "FREADAS", value: `${data.hardBrakes}` },
          { icon: "⚡", label: "ACEL.", value: `${data.hardAccels}` },
        ];
        if (data.totalIdleSeconds > 60) stats.push({ icon: "‖", label: "PARADO", value: fmtMins(data.totalIdleSeconds) });
        if (data.fuelConsumedGal != null && data.fuelConsumedGal > 0)
          stats.push({ icon: "⛽", label: "COMBUST.", value: `${data.fuelConsumedGal.toFixed(2).replace(".", ",")} gal` });
        if (data.avgMpg != null && data.avgMpg > 0)
          stats.push({ icon: "≈", label: "CONSUMO", value: `${data.avgMpg.toFixed(1).replace(".", ",")} mpg` });
        if (data.startOdometerMi != null && data.endOdometerMi != null)
          stats.push({ icon: "◎", label: "ODÔMETRO", value: `${Math.round(data.startOdometerMi)} → ${Math.round(data.endOdometerMi)} mi` });

        // Layout stats from the right edge of top bar going left, fitting before close area
        const statsRight = W - 24;
        const statsLeft = badgeX + bw + 30;
        ctx.font = "700 10px " + FONT;
        const widths = stats.map((s) => {
          ctx.font = "700 10px " + FONT;
          const lw = ctx.measureText(s.label).width;
          ctx.font = "700 12px " + FONT;
          const vw = ctx.measureText(s.value).width;
          return Math.max(lw, vw) + 14;
        });
        const totalW = widths.reduce((s, w) => s + w, 0);
        let drawAll = totalW <= (statsRight - statsLeft);
        let curX = statsLeft;
        for (let i = 0; i < stats.length; i++) {
          if (!drawAll && curX + widths[i] > statsRight - 4) break;
          const s = stats[i];
          drawText(s.label, curX, 26, { size: 9, weight: 700, color: "rgba(255,255,255,0.5)", tracking: 0.8 });
          drawText(s.value, curX, 46, { size: 12, weight: 700, color: "#fff" });
          curX += widths[i];
        }

        // ===== 4) LEFT INSTRUMENT PANEL =====
        const ipX = 16, ipY = TOP_BAR_H + 12, ipW = 230;
        ctx.fillStyle = "rgba(10,10,10,0.88)";
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        roundRect(ipX, ipY, ipW, 290, 14); ctx.fill(); ctx.stroke();

        // Speedometer (semicircular gauge)
        const gCx = ipX + ipW / 2, gCy = ipY + 110, gR = 78;
        // Bands
        const bands = [
          { from: 0,   to: 35, color: "#f59e0b" },
          { from: 35,  to: 45, color: "#22c55e" },
          { from: 45,  to: 50, color: "#3b82f6" },
          { from: 50,  to: 65, color: "#ec4899" },
          { from: 65,  to: 90, color: "#ef4444" },
        ];
        const MAX_SP = 90;
        const a0 = Math.PI, a1 = 2 * Math.PI; // 180° to 360° (top half)
        ctx.lineWidth = 14;
        ctx.lineCap = "butt";
        for (const band of bands) {
          const start = a0 + (band.from / MAX_SP) * (a1 - a0);
          const end = a0 + (band.to / MAX_SP) * (a1 - a0);
          ctx.strokeStyle = band.color;
          ctx.beginPath();
          ctx.arc(gCx, gCy, gR, start, end);
          ctx.stroke();
        }
        // Tick marks
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1.5;
        for (let mph = 0; mph <= MAX_SP; mph += 10) {
          const a = a0 + (mph / MAX_SP) * (a1 - a0);
          const r1 = gR - 16, r2 = gR - 22;
          ctx.beginPath();
          ctx.moveTo(gCx + Math.cos(a) * r1, gCy + Math.sin(a) * r1);
          ctx.lineTo(gCx + Math.cos(a) * r2, gCy + Math.sin(a) * r2);
          ctx.stroke();
        }
        // Needle
        const needleA = a0 + Math.min(MAX_SP, Math.max(0, curSpeed)) / MAX_SP * (a1 - a0);
        ctx.save();
        ctx.translate(gCx, gCy);
        ctx.rotate(needleA);
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.moveTo(-3, 0);
        ctx.lineTo(gR - 8, -1.5);
        ctx.lineTo(gR - 8, 1.5);
        ctx.lineTo(-3, 0);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(gCx, gCy, 5, 0, Math.PI * 2); ctx.fill();

        // Current speed number + labels (centered below pivot)
        drawText(`${Math.round(curSpeed)}`, gCx, gCy + 36, { size: 42, weight: 800, color: "#fff", align: "center" });
        drawText("mph", gCx, gCy + 54, { size: 10, weight: 600, color: "rgba(255,255,255,0.55)", align: "center", tracking: 1.5 });

        // Média / Pico
        drawText("MÉDIA", gCx - 38, gCy + 78, { size: 9, weight: 700, color: "rgba(255,255,255,0.5)", align: "center", tracking: 1 });
        drawText(`${Math.round(data.avgSpeedMph)}`, gCx - 38, gCy + 94, { size: 14, weight: 700, color: "#fff", align: "center" });
        drawText("PICO", gCx + 38, gCy + 78, { size: 9, weight: 700, color: GOLD, align: "center", tracking: 1 });
        drawText(`${Math.round(data.maxSpeedMph)}`, gCx + 38, gCy + 94, { size: 14, weight: 700, color: GOLD, align: "center" });

        // Percorrido / Decorrido boxes
        const boxY = ipY + 218;
        const boxW = (ipW - 24) / 2;
        const distMi = (pts[idx].dist + (pts[idx + 1] ? (pts[idx + 1].dist - pts[idx].dist) * f : 0)) / 1609.34;
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.strokeStyle = "rgba(255,255,255,0.07)";
        roundRect(ipX + 8, boxY, boxW, 44, 8); ctx.fill(); ctx.stroke();
        drawText("PERCORRIDO", ipX + 16, boxY + 14, { size: 8, weight: 700, color: "rgba(255,255,255,0.45)", tracking: 1 });
        drawText(`${distMi.toFixed(1).replace(".", ",")} mi`, ipX + 16, boxY + 33, { size: 14, weight: 700, color: "#fff" });
        roundRect(ipX + 16 + boxW, boxY, boxW, 44, 8); ctx.fill(); ctx.stroke();
        drawText("DECORRIDO", ipX + 24 + boxW, boxY + 14, { size: 8, weight: 700, color: "rgba(255,255,255,0.45)", tracking: 1 });
        drawText(fmtClock(playMs), ipX + 24 + boxW, boxY + 33, { size: 14, weight: 700, color: "#fff" });

        // Real-time clock under the panel
        const realTime = new Date(data.startedAt.getTime() + playMs);
        const tStr = realTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: TZ });
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        roundRect(ipX, ipY + 290 + 8, ipW, 32, 10); ctx.fill();
        ctx.fillStyle = GOLD;
        ctx.beginPath(); ctx.arc(ipX + 14, ipY + 290 + 24, 3, 0, Math.PI * 2); ctx.fill();
        drawText(tStr, ipX + 26, ipY + 290 + 28, { size: 13, weight: 700, color: "#fff" });

        // Odometer card (above clock — squeeze in if room)
        if (data.startOdometerMi != null) {
          // overlay over instrument panel just below boxes
          const odY = boxY + 50;
          ctx.fillStyle = "rgba(255,255,255,0.04)";
          ctx.strokeStyle = "rgba(255,255,255,0.07)";
          roundRect(ipX + 8, odY, ipW - 16, 30, 8); ctx.fill(); ctx.stroke();
          drawText("ODÔMETRO", ipX + 16, odY + 12, { size: 8, weight: 700, color: "rgba(255,255,255,0.45)", tracking: 1 });
          const curOdo = Math.round((data.startOdometerMi ?? 0) + distMi);
          drawText(`${curOdo.toLocaleString("pt-BR")} mi`, ipX + 16, odY + 25, { size: 12, weight: 700, color: "#fff" });
        }

        // ===== 5) LEGEND (bottom-left) =====
        const lgX = 16, lgY = H - 150, lgW = 220, lgH = 134;
        ctx.fillStyle = "rgba(10,10,10,0.88)";
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        roundRect(lgX, lgY, lgW, lgH, 12); ctx.fill(); ctx.stroke();
        drawText("VELOCIDADE NO TRAJETO", lgX + 14, lgY + 20, { size: 9, weight: 700, color: "rgba(255,255,255,0.55)", tracking: 1.2 });
        const legendRows = [
          { c: "#f59e0b", t: "até 35 mph" },
          { c: "#22c55e", t: "3545 mph" },
          { c: "#3b82f6", t: "4550 mph" },
          { c: "#ec4899", t: "5065 mph" },
          { c: "#ef4444", t: "acima de 65 mph" },
        ];
        for (let i = 0; i < legendRows.length; i++) {
          const r = legendRows[i];
          const ry = lgY + 38 + i * 18;
          ctx.fillStyle = r.c;
          ctx.fillRect(lgX + 14, ry, 18, 3);
          drawText(r.t, lgX + 40, ry + 6, { size: 11, weight: 500, color: "rgba(255,255,255,0.8)" });
        }

        // ===== 6) RIGHT TIMELINE PANEL =====
        ctx.fillStyle = "rgba(8,8,8,0.95)";
        ctx.fillRect(W - RIGHT_PANEL_W, TOP_BAR_H, RIGHT_PANEL_W, H - TOP_BAR_H);
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(W - RIGHT_PANEL_W, TOP_BAR_H, 1, H - TOP_BAR_H);

        const tlX = W - RIGHT_PANEL_W + 20;
        drawText("LINHA DO TEMPO", tlX, TOP_BAR_H + 28, { size: 10, weight: 700, color: GOLD, tracking: 1.5 });
        drawText("Cronologia da viagem", tlX, TOP_BAR_H + 48, { size: 11, weight: 500, color: "rgba(255,255,255,0.55)" });

        // Items
        let tlY = TOP_BAR_H + 80;
        for (const ev of tlEvents) {
          const cfg = EVENT_CFG[ev.kind];
          const passed = playMs >= ev.t;
          // pill background
          ctx.fillStyle = passed ? "rgba(212,175,55,0.06)" : "rgba(255,255,255,0.03)";
          ctx.strokeStyle = passed ? "rgba(212,175,55,0.25)" : "rgba(255,255,255,0.07)";
          roundRect(tlX, tlY, RIGHT_PANEL_W - 40, 56, 10); ctx.fill(); ctx.stroke();
          // dot
          ctx.fillStyle = cfg.color;
          ctx.beginPath(); ctx.arc(tlX + 18, tlY + 28, 7, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
          ctx.stroke();
          // text
          const lbl = ev.label.length > 32 ? ev.label.slice(0, 30) + "…" : ev.label;
          drawText(lbl, tlX + 36, tlY + 22, { size: 11, weight: 700, color: passed ? "#fff" : "rgba(255,255,255,0.7)" });
          const tEv = new Date(data.startedAt.getTime() + ev.t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
          drawText(`${tEv}  •  ${fmtClock(ev.t)}`, tlX + 36, tlY + 40, { size: 10, weight: 500, color: "rgba(255,255,255,0.5)" });
          tlY += 64;
          if (tlY > H - 30) break;
        }

        // ===== 7) Progress bar bottom of map area =====
        const barX = 0, barY = H - 4, barW = mapW;
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(barX, barY, barW, 4);
        ctx.fillStyle = GOLD;
        ctx.fillRect(barX, barY, barW * Math.min(1, playMs / data.durationMs), 4);
      };

      // ===== Render loop (real-time so MediaRecorder timestamps are correct) =====
      const recordSpeed = speedRef.current;
      const playbackDurMs = data.durationMs / recordSpeed;
      const tailMs = 1000;
      const totalMs = playbackDurMs + tailMs;
      const frameMs = 1000 / 30;

      // First draw to get one keyframe before recorder is hungry
      drawFrameAt(0);

      const t0 = performance.now();
      while (true) {
        if (cancelled) break;
        const elapsed = performance.now() - t0;
        if (elapsed > totalMs) break;
        const playMs = Math.min(data.durationMs, elapsed * recordSpeed);
        drawFrameAt(playMs);
        setRecProgress(Math.min(1, elapsed / totalMs));
        await new Promise((r) => setTimeout(r, frameMs));
      }

      // Stop & save
      await new Promise<void>((res) => {
        if (rec.state === "inactive") return res();
        rec.onstop = () => res();
        try { rec.stop(); } catch { res(); }
      });
      stream.getTracks().forEach((t) => t.stop());

      if (chunks.length && !cancelled) {
        const blob = new Blob(chunks, { type: mime });
        const url = URL.createObjectURL(blob);
        const aEl = document.createElement("a");
        const safe = vehicleName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
        const stamp = new Date().toISOString().slice(0, 10);
        aEl.href = url;
        aEl.download = `replay-${safe}-${stamp}-${recordSpeed}x.${ext}`;
        document.body.appendChild(aEl);
        aEl.click();
        aEl.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
      }
    } catch (e: any) {
      console.error("[downloadMp4]", e);
      alert("Não foi possível gerar o vídeo: " + (e?.message ?? "erro desconhecido"));
    } finally {
      setRecording(false);
      setRecProgress(0);
    }
  }, [data, recording, vehicleName]);




  // Derived current values for HUD
  const hud = useMemo(() => {
    if (!data) return null;
    const i = findIndex(data.points, playbackMs);
    const cur = data.points[i];
    const nxt = data.points[i + 1] ?? cur;
    const span = Math.max(1, nxt.t - cur.t);
    const f = (playbackMs - cur.t) / span;
    const speed = lerp(cur.speed, nxt.speed, Math.min(1, Math.max(0, f)));
    const dist = lerp(cur.dist, nxt.dist, Math.min(1, Math.max(0, f))); // meters
    // G accel ≈ d(speed)/dt in mph/s, normalize to ±0.5g visual
    const dtS = 2;
    const back = findIndex(data.points, Math.max(0, playbackMs - dtS * 1000));
    const sBack = data.points[back].speed;
    const accelMphPerSec = (speed - sBack) / dtS;
    const g = accelMphPerSec * 0.0447; // mph/s -> g
    const realTime = new Date(data.startedAt.getTime() + playbackMs);
    return { speed, distMi: dist / 1609.34, g, realTime, idx: i };
  }, [data, playbackMs]);

  // Speed chart data (downsampled)
  const chartData = useMemo(() => {
    if (!data) return [];
    const N = 120;
    const step = Math.max(1, Math.floor(data.points.length / N));
    const out: { tSec: number; speed: number }[] = [];
    for (let i = 0; i < data.points.length; i += step) {
      out.push({ tSec: Math.round(data.points[i].t / 1000), speed: Math.round(data.points[i].speed) });
    }
    return out;
  }, [data]);

  const ESC = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.code === "Space") { e.preventDefault(); setPlaying((p) => !p); }
  }, [onClose]);
  useEffect(() => {
    window.addEventListener("keydown", ESC);
    return () => window.removeEventListener("keydown", ESC);
  }, [ESC]);

  return createPortal(
    <div className="fixed inset-0 z-[2000] bg-[#050505] animate-in fade-in duration-200 flex flex-col">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-black/60 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${GOLD}, #b8941f)` }}>
            <Play size={16} className="text-black ml-0.5" fill="currentColor" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.25em] font-medium" style={{ color: GOLD }}>Replay de viagem</p>
            <h2 className="text-sm font-medium text-white truncate">{vehicleName}</h2>
          </div>
        </div>

        {data && (
          <div className="hidden md:flex items-center gap-5 lg:gap-7 text-xs text-white/70 flex-wrap justify-center">
            <Stat icon={<Route size={11} />} label="Distância" value={`${data.totalDistanceMi.toFixed(1).replace(".", ",")} mi`} />
            <Stat icon={<Clock size={11} />} label="Duração" value={fmtClock(data.durationMs)} />
            <Stat icon={<Gauge size={11} />} label="Vel. média" value={`${Math.round(data.avgSpeedMph)} mph`} />
            <Stat icon={<TrendingUp size={11} />} label="Vel. máx" value={`${Math.round(data.maxSpeedMph)} mph`} />
            {data.startOdometerMi != null && data.endOdometerMi != null && (
              <Stat icon={<Activity size={11} />} label="Odômetro" value={`${Math.round(data.startOdometerMi)} → ${Math.round(data.endOdometerMi)} mi`} />
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={downloadMp4}
            disabled={recording || !data}
            className="text-[10px] uppercase tracking-wider font-semibold px-3 py-1.5 rounded-full border transition-colors flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              borderColor: recording ? GOLD : "rgba(212,175,55,0.5)",
              color: recording ? "#0a0a0a" : GOLD,
              background: recording
                ? `linear-gradient(90deg, ${GOLD} ${Math.round(recProgress * 100)}%, rgba(212,175,55,0.15) ${Math.round(recProgress * 100)}%)`
                : "rgba(212,175,55,0.08)",
            }}
            title={recording ? "Renderizando vídeo…" : "Gerar vídeo MP4 da viagem (renderizado em background)"}
          >
            {recording ? (
              <>
                <Loader2 size={11} className="animate-spin" />
                Renderizando {Math.round(recProgress * 100)}%
              </>
            ) : (
              <>
                <Download size={11} /> Baixar MP4
              </>
            )}
          </button>
          <button
            onClick={fitWhole}
            className="text-[10px] uppercase tracking-wider font-semibold px-3 py-1.5 rounded-full border border-white/15 text-white/80 hover:bg-white/5 transition-colors flex items-center gap-1.5"
            title="Ver rota inteira"
          >
            <Maximize2 size={11} /> Ver rota inteira
          </button>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center text-white"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Map */}
        <div className="relative flex-1 min-h-0">
          <div ref={mapHostRef} className="absolute inset-0" />

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
              <div className="flex items-center gap-3 text-white/80 text-sm bg-black/70 px-5 py-3 rounded-full border border-white/10">
                <Loader2 size={16} className="animate-spin" /> Preparando viagem…
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10">
              <div className="max-w-sm text-center px-6 py-6 rounded-xl bg-[#0a0a0a] border border-red-500/30">
                <AlertTriangle size={22} className="mx-auto text-red-500 mb-2" />
                <p className="text-sm font-semibold text-white">Não foi possível abrir a viagem</p>
                <p className="text-xs text-white/60 mt-1">{error}</p>
                <button onClick={onClose} className="mt-4 text-xs font-medium uppercase tracking-wider px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white">
                  Fechar
                </button>
              </div>
            </div>
          )}

          {/* Instrument panel. top-left over map */}
          {data && hud && (
            <div className="absolute top-3 left-3 z-10 w-[230px] rounded-2xl bg-black/80 backdrop-blur-md border border-white/10 p-3 shadow-2xl"
                 style={{ borderColor: "rgba(212,175,55,0.25)" }}>
              <Speedometer
                mph={data.level === 2 ? hud.speed : data.avgSpeedMph}
                max={Math.max(80, data.maxSpeedMph)}
                maxMarker={data.level === 1 ? data.maxSpeedMph : undefined}
                caption={data.level === 1 ? "média" : "mph"}
              />
              {data.level === 2 && <Gmeter g={hud.g} />}
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <MiniStat label="Percorrido" value={`${hud.distMi.toFixed(1).replace(".", ",")} mi`} />
                <MiniStat label="Decorrido" value={fmtClock(playbackMs)} />
              </div>
              {data.startOdometerMi != null && data.endOdometerMi != null && (
                <div className="mt-2 rounded-md bg-white/[0.04] border border-white/5 px-2 py-1.5">
                  <p className="text-[8px] uppercase tracking-wider text-white/40 font-semibold">Odômetro</p>
                  <p className="text-xs font-medium text-white tabular-nums">
                    {Math.round(
                      data.startOdometerMi + (data.endOdometerMi - data.startOdometerMi) * (playbackMs / data.durationMs)
                    ).toLocaleString("pt-BR")} mi
                  </p>
                </div>
              )}
              <div className="mt-2 text-[10px] text-white/60 flex items-center gap-1.5">
                <Clock size={10} style={{ color: GOLD }} />
                <span className="tabular-nums">{fmtTimeOfDay(hud.realTime, data.timeZone)}</span>
              </div>
              {data.startAddress && playbackMs < 5000 && (
                <p className="mt-2 text-[10px] text-white/50 leading-snug flex items-start gap-1">
                  <MapPin size={10} style={{ color: GOLD }} className="mt-0.5 shrink-0" />
                  <span className="block truncate min-w-0">{data.startAddress}</span>
                </p>
              )}
              {data.endAddress && playbackMs > data.durationMs - 5000 && (
                <p className="mt-2 text-[10px] text-white/50 leading-snug flex items-start gap-1">
                  <MapPin size={10} style={{ color: GOLD }} className="mt-0.5 shrink-0" />
                  <span className="block truncate min-w-0">{data.endAddress}</span>
                </p>
              )}
            </div>
          )}


          {/* Speed bands legend. bottom-left */}
          <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-black/75 backdrop-blur-sm border border-white/10 px-3 py-2">
            <p className="text-[9px] uppercase tracking-wider text-white/60 font-semibold mb-1.5">Velocidade no trajeto</p>
            {[
              { l: "até 35", c: "#f59e0b" },{ l: "3545", c: "#22c55e" },
              { l: "4550", c: "#3b82f6" },{ l: "5065", c: "#ec4899" },{ l: "acima de 65", c: "#ef4444" },
            ].map((b) => (
              <div key={b.l} className="flex items-center gap-2 text-[10px] text-white/80">
                <span className="w-4 h-1 rounded-full" style={{ backgroundColor: b.c }} />
                <span className="tabular-nums">{b.l} mph</span>
              </div>
            ))}
          </div>

          {/* Cinematic intro overlay */}
          {data && intro && !loading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 backdrop-blur-[2px] animate-in fade-in duration-300 pointer-events-none">
              <div className="text-center px-8 animate-in fade-in zoom-in-95 duration-500">
                <p className="text-[10px] uppercase tracking-[0.4em] font-medium mb-3" style={{ color: GOLD }}>
                  Preparando replay
                </p>
                <h3 className="text-2xl sm:text-3xl font-medium text-white leading-tight">
                  {vehicleName}
                </h3>
                {data.startAddress && (
                  <p className="mt-3 text-xs text-white/70 max-w-md mx-auto">
                    Saindo de <span className="text-white font-semibold">{data.startAddress.split(",")[0]}</span>
                    {data.endAddress && (
                      <>
                        <span className="mx-2 text-white/30">→</span>
                        <span className="text-white font-semibold">{data.endAddress.split(",")[0]}</span>
                      </>
                    )}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-center gap-5 text-[10px] uppercase tracking-wider text-white/50">
                  <span><span className="tabular-nums text-white font-medium">{data.totalDistanceMi.toFixed(1).replace(".", ",")}</span> mi</span>
                  <span className="w-1 h-1 rounded-full bg-white/30" />
                  <span><span className="tabular-nums text-white font-medium">{fmtClock(data.durationMs)}</span></span>
                  <span className="w-1 h-1 rounded-full bg-white/30" />
                  <span>pico <span className="tabular-nums text-white font-medium">{Math.round(data.maxSpeedMph)}</span> mph</span>
                </div>
              </div>
            </div>
          )}

          {/* Closing summary card */}
          {data && showSummary && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
              <div className="relative w-[min(92vw,440px)] rounded-2xl border p-6 animate-in fade-in zoom-in-95 duration-400 shadow-2xl"
                   style={{ borderColor: `${GOLD}55`, background: "linear-gradient(180deg, #0a0a0a 0%, #050505 100%)" }}>
                <button
                  onClick={() => setShowSummary(false)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/70"
                  aria-label="Fechar resumo"
                >
                  <X size={14} />
                </button>

                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center"
                       style={{ background: `linear-gradient(135deg, ${GOLD}, #b8941f)` }}>
                    <Trophy size={16} className="text-black" />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.3em] font-medium" style={{ color: GOLD }}>Viagem concluída</p>
                    <h4 className="text-base font-medium text-white leading-tight">{vehicleName}</h4>
                  </div>
                </div>

                {(data.startAddress || data.endAddress) && (
                  <div className="rounded-xl border border-white/10 p-3 mb-4 text-[11px] space-y-1.5">
                    {data.startAddress && (
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                        <span className="text-white/80 leading-snug">{data.startAddress}</span>
                      </div>
                    )}
                    {data.endAddress && (
                      <div className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                        <span className="text-white/80 leading-snug">{data.endAddress}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <BigStat label="Distância" value={data.totalDistanceMi.toFixed(1).replace(".", ",")} unit="mi" highlight />
                  <BigStat label="Tempo" value={fmtClock(data.durationMs)} unit="" />
                  <BigStat label="Pico" value={`${Math.round(data.maxSpeedMph)}`} unit="mph" />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <MiniStat label="Vel. média" value={`${Math.round(data.avgSpeedMph)} mph`} />
                  <MiniStat label="Tempo parado" value={fmtMins(data.totalIdleSeconds)} />
                  <MiniStat label="Freadas bruscas" value={`${data.hardBrakes}`} />
                  <MiniStat label="Acelerações bruscas" value={`${data.hardAccels}`} />
                  {data.fuelConsumedGal != null && data.fuelConsumedGal > 0 && (
                    <MiniStat label="Combustível" value={`${data.fuelConsumedGal.toFixed(2).replace(".", ",")} gal`} />
                  )}
                  {data.avgMpg != null && data.avgMpg > 0 && (
                    <MiniStat label="Consumo médio" value={`${data.avgMpg.toFixed(1).replace(".", ",")} mpg`} />
                  )}
                  {data.startOdometerMi != null && data.endOdometerMi != null && (
                    <div className="col-span-2 rounded-md bg-white/[0.04] border border-white/5 px-2 py-1.5">
                      <p className="text-[8px] uppercase tracking-wider text-white/40 font-semibold">Odômetro</p>
                      <p className="text-xs font-medium text-white tabular-nums">
                        {Math.round(data.startOdometerMi).toLocaleString("pt-BR")} → {Math.round(data.endOdometerMi).toLocaleString("pt-BR")} mi
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex items-center gap-2">
                  <button
                    onClick={() => {
                      playbackRef.current = 0;
                      setPlaybackMs(0);
                      setShowSummary(false);
                      setPlaying(true);
                    }}
                    className="flex-1 text-[11px] font-medium uppercase tracking-wider px-4 py-2.5 rounded-full text-black hover:scale-[1.02] transition-transform flex items-center justify-center gap-1.5"
                    style={{ background: GOLD }}
                  >
                    <RotateCcw size={12} /> Assistir de novo
                  </button>
                  <button
                    onClick={onClose}
                    className="text-[11px] font-medium uppercase tracking-wider px-4 py-2.5 rounded-full border border-white/15 text-white/80 hover:bg-white/5"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right panel. narration timeline */}
        {data && (
          <div className="lg:w-[280px] lg:border-l border-t lg:border-t-0 border-white/5 bg-black/70 backdrop-blur-md flex flex-col max-h-[40vh] lg:max-h-none">
            <div className="px-4 py-3 border-b border-white/5">
              <p className="text-[10px] uppercase tracking-[0.2em] font-medium" style={{ color: GOLD }}>Linha do tempo</p>
              <p className="text-[11px] text-white/50 mt-0.5">Clique para pular ao momento</p>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 scrollbar-thin">
              {data.events.map((ev, i) => {
                const cfg = EVENT_CFG[ev.kind];
                const active = playbackMs >= ev.t - 1500;
                const current = playbackMs >= ev.t - 1500 && playbackMs <= ev.t + 4000;
                const Icon = cfg.icon;
                const evTime = new Date(data.startedAt.getTime() + ev.t);
                return (
                  <button
                    key={i}
                    onClick={() => seekTo(ev.t)}
                    className={`w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-lg transition-all ${
                      current
                        ? "bg-[#D4AF37]/10 border border-[#D4AF37]/40"
                        : active
                          ? "bg-white/[0.04] border border-transparent hover:bg-white/[0.07]"
                          : "opacity-50 hover:opacity-100 hover:bg-white/[0.04] border border-transparent"
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                         style={{ background: `${cfg.color}22`, border: `1px solid ${cfg.color}66` }}>
                      <Icon size={11} style={{ color: cfg.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold text-white leading-tight">{ev.label}</p>
                      <p className="text-[10px] text-white/50 tabular-nums mt-0.5">
                        {evTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: data.timeZone })}
                        <span className="mx-1.5 text-white/30">•</span>
                        {fmtClock(ev.t)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom. chart + player controls */}
      {data && (
        <div className="border-t border-white/5 bg-black/80 backdrop-blur-md">
          {/* Chart */}
          <div className="h-24 px-4 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 4, right: 6, left: 0, bottom: 2 }}
                onClick={(e: any) => {
                  if (e?.activeLabel != null) seekTo(Number(e.activeLabel) * 1000);
                }}
              >
                <XAxis dataKey="tSec" hide />
                <YAxis hide domain={[0, "dataMax + 5"]} />
                <Tooltip
                  contentStyle={{ background: "#0a0a0a", border: `1px solid ${GOLD}55`, fontSize: 11, color: "#fff" }}
                  labelFormatter={(v) => fmtClock(Number(v) * 1000)}
                  formatter={(v: any) => [`${v} mph`, "Velocidade"]}
                />
                <ReferenceLine
                  x={Math.round(playbackMs / 1000)}
                  stroke={GOLD}
                  strokeWidth={2}
                  isFront
                />
                <Line type="monotone" dataKey="speed" stroke={GOLD} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 sm:gap-3 px-4 pb-3 pt-1">
            <button
              onClick={() => seekTo(playbackRef.current - 10_000)}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center text-white/80"
              aria-label="Voltar 10s"
              title="Voltar 10s"
            >
              <SkipBack size={14} />
            </button>
            <button
              onClick={() => {
                playbackRef.current = 0;
                setPlaybackMs(0);
                setShowSummary(false);
                setPlaying(true);
              }}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center text-white/80"
              aria-label="Recomeçar"
              title="Recomeçar"
            >
              <RotateCcw size={14} />
            </button>
            <button
              onClick={() => {
                if (playbackRef.current >= data.durationMs - 50) {
                  playbackRef.current = 0;
                  setPlaybackMs(0);
                  setShowSummary(false);
                }
                setPlaying((p) => !p);
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center text-black shadow-lg hover:scale-105 transition-transform"
              style={{ background: GOLD }}
              aria-label={playing ? "Pausar" : "Reproduzir"}
            >
              {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5" />}
            </button>
            <button
              onClick={() => seekTo(playbackRef.current + 10_000)}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 transition-colors flex items-center justify-center text-white/80"
              aria-label="Avançar 10s"
              title="Avançar 10s"
            >
              <SkipForward size={14} />
            </button>

            <div className="flex items-center gap-0.5 bg-white/5 rounded-full p-0.5">
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`text-[10px] font-medium uppercase tracking-wider px-2 py-1 rounded-full transition-colors ${
                    speed === s ? "bg-[#D4AF37] text-black" : "text-white/70 hover:text-white"
                  }`}
                  title={s === 18 ? "Velocidade padrão" : s < 18 ? "Mais lento" : "Mais rápido"}
                >
                  {s}×
                </button>
              ))}
            </div>

            {/* Scrubber */}
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <span className="text-[10px] font-semibold text-white/70 tabular-nums w-12 text-right">
                {fmtClock(playbackMs)}
              </span>
              <input
                type="range"
                min={0}
                max={data.durationMs}
                value={playbackMs}
                step={50}
                onChange={(e) => seekTo(Number(e.target.value))}
                className="flex-1 accent-[#D4AF37] h-1 cursor-pointer"
                style={{
                  background: `linear-gradient(to right, ${GOLD} 0%, ${GOLD} ${(playbackMs / data.durationMs) * 100}%, rgba(255,255,255,0.1) ${(playbackMs / data.durationMs) * 100}%, rgba(255,255,255,0.1) 100%)`,
                  borderRadius: 4,
                  WebkitAppearance: "none",
                  appearance: "none",
                }}
              />
              <span className="text-[10px] font-semibold text-white/50 tabular-nums w-12">
                {fmtClock(data.durationMs)}
              </span>
            </div>

            <label className="hidden sm:flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-white/70 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={followCam}
                onChange={(e) => setFollowCam(e.target.checked)}
                className="accent-[#D4AF37]"
              />
              Seguir carro
            </label>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-white/40">{icon}</span>
      <span className="text-[9px] uppercase tracking-wider text-white/40 font-semibold">{label}</span>
      <span className="text-xs font-medium text-white tabular-nums">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/[0.04] border border-white/5 px-2 py-1.5">
      <p className="text-[8px] uppercase tracking-wider text-white/40 font-semibold">{label}</p>
      <p className="text-xs font-medium text-white tabular-nums">{value}</p>
    </div>
  );
}

function BigStat({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-3 text-center ${highlight ? "border-[#D4AF37]/40 bg-[#D4AF37]/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
      <p className="text-[8px] uppercase tracking-wider text-white/50 font-semibold">{label}</p>
      <p className={`text-lg font-medium tabular-nums leading-tight mt-1 ${highlight ? "text-[#D4AF37]" : "text-white"}`}>
        {value}
        {unit && <span className="text-[9px] font-normal text-white/50 ml-1 uppercase">{unit}</span>}
      </p>
    </div>
  );
}

function Speedometer({ mph, max, maxMarker, caption }: { mph: number; max: number; maxMarker?: number; caption?: string }) {
  const mphClamped = Math.max(0, Math.min(max, mph));
  const angle = -90 + (mphClamped / max) * 180;
  const r = 60;
  const cx = 75, cy = 80;
  const ticks = Array.from({ length: 9 }, (_, i) => -90 + i * 22.5);
  // Tick angle for maxMarker
  const markerAngle = maxMarker != null ? -90 + (Math.max(0, Math.min(max, maxMarker)) / max) * 180 : null;
  return (
    <div className="relative">
      <svg viewBox="0 0 150 95" className="w-full">
        <defs>
          <linearGradient id="gaugeArc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="40%" stopColor="#3b82f6" />
            <stop offset="70%" stopColor="#ec4899" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" strokeLinecap="round" />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="url(#gaugeArc)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(mphClamped / max) * Math.PI * r} ${Math.PI * r}`}
        />
        {ticks.map((a, i) => {
          const rad = (a * Math.PI) / 180;
          const x1 = cx + Math.cos(rad) * (r - 2);
          const y1 = cy + Math.sin(rad) * (r - 2);
          const x2 = cx + Math.cos(rad) * (r - 9);
          const y2 = cy + Math.sin(rad) * (r - 9);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.3)" strokeWidth="1" />;
        })}
        {/* Max-speed marker for level 1 */}
        {markerAngle != null && (() => {
          const rad = (markerAngle * Math.PI) / 180;
          const x1 = cx + Math.cos(rad) * (r + 2);
          const y1 = cy + Math.sin(rad) * (r + 2);
          const x2 = cx + Math.cos(rad) * (r - 12);
          const y2 = cy + Math.sin(rad) * (r - 12);
          return (
            <g>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
              <circle cx={cx + Math.cos(rad) * (r + 5)} cy={cy + Math.sin(rad) * (r + 5)} r="2.5" fill="#ef4444" />
            </g>
          );
        })()}
        <g transform={`rotate(${angle} ${cx} ${cy})`}>
          <line x1={cx} y1={cy} x2={cx} y2={cy - (r - 4)} stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="4" fill={GOLD} />
        </g>
      </svg>
      <div className="absolute inset-x-0 bottom-1 text-center px-1">
        <p className="text-2xl font-medium text-white tabular-nums leading-none">{Math.round(mph)}</p>
        <p className="text-[9px] uppercase tracking-wider text-white/50 font-semibold mt-0.5 whitespace-nowrap truncate">{caption ?? "mph"}</p>
        {maxMarker != null && (
          <p className="text-[8px] uppercase tracking-wider text-red-400/80 font-semibold mt-0.5 whitespace-nowrap">
            pico <span className="tabular-nums">{Math.round(maxMarker)}</span>
          </p>
        )}
      </div>
    </div>
  );
}


function Gmeter({ g }: { g: number }) {
  // g range ~ -0.6 .. +0.6
  const gClamped = Math.max(-0.6, Math.min(0.6, g));
  const pct = (gClamped + 0.6) / 1.2; // 0..1
  const color = Math.abs(g) > 0.35 ? "#ef4444" : Math.abs(g) > 0.2 ? "#f97316" : "#22c55e";
  return (
    <div className="mt-2">
      <div className="flex items-center justify-between text-[9px] uppercase tracking-wider text-white/40 font-semibold mb-1">
        <span>Freio</span>
        <span>G</span>
        <span>Acel</span>
      </div>
      <div className="relative h-2 rounded-full bg-white/[0.06] overflow-hidden">
        {/* center mark */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/20" />
        {/* needle bar */}
        <div
          className="absolute top-0 bottom-0 transition-[left,width] duration-150"
          style={{
            background: color,
            left: g >= 0 ? "50%" : `${pct * 100}%`,
            width: `${Math.abs(gClamped) / 1.2 * 100}%`,
            borderRadius: 2,
          }}
        />
      </div>
      <p className="text-[10px] text-white/60 tabular-nums text-center mt-1">{g.toFixed(2)}g</p>
    </div>
  );
}
