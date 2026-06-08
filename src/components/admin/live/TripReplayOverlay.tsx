import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  X, Play, Pause, Loader2, Maximize2, MapPin, Flag, AlertTriangle,
  Zap, PauseCircle, Gauge, Clock, Route, TrendingUp, SkipBack, SkipForward,
  RotateCcw, Fuel, Activity, Trophy, Download,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceLine, Tooltip } from "recharts";
import { loadGoogleMaps } from "@/lib/googleMapsLoader";
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
  const SPEED_OPTIONS = [10, 14, 18, 20, 24, 30] as const;
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

  // ===== Render & download a real video file of the replay =====
  // Offscreen canvas + MediaRecorder. Uses MP4 when the browser supports it,
  // otherwise WebM. No screen-share prompt, no tab capture — works everywhere.
  const [recording, setRecording] = useState(false);
  const [recProgress, setRecProgress] = useState(0);
  const recCancelRef = useRef<() => void>(() => {});

  const downloadMp4 = useCallback(async () => {
    if (!data || recording) return;
    if (typeof (window as any).MediaRecorder === "undefined") {
      alert("Seu navegador não suporta gravação de vídeo. Use Chrome, Edge ou Safari atualizado.");
      return;
    }

    // ---- Setup offscreen canvas (1920x1080, ~4K-clean line work) ----
    const W = 1920, H = 1080;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d", { alpha: false })!;
    ctx.imageSmoothingEnabled = true;
    (ctx as any).imageSmoothingQuality = "high";

    // Project lat/lng → pixel using bounds, with padding
    const PAD = 120;
    const { south, west, north, east } = data.bounds;
    const latSpan = Math.max(1e-6, north - south);
    const lngSpan = Math.max(1e-6, east - west);
    const innerW = W - PAD * 2;
    const innerH = H - PAD * 2 - 220; // reserve bottom 220px for HUD
    const sx = innerW / lngSpan;
    const sy = innerH / latSpan;
    const scale = Math.min(sx, sy);
    const offX = (W - lngSpan * scale) / 2;
    const offY = (H - 220 - latSpan * scale) / 2;
    const proj = (lat: number, lng: number) => ({
      x: offX + (lng - west) * scale,
      y: offY + (north - lat) * scale,
    });

    const pts = data.points;
    const screenPts = pts.map((p) => proj(p.lat, p.lng));

    // ---- MIME selection: prefer MP4, fall back to WebM ----
    const candidates = [
      "video/mp4;codecs=avc1.640028",
      "video/mp4;codecs=avc1.42E01F",
      "video/mp4",
      "video/webm;codecs=h264",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    const MR: any = (window as any).MediaRecorder;
    const mime = candidates.find((m) => MR.isTypeSupported?.(m)) || "video/webm";
    const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";

    const stream = (canvas as any).captureStream(60) as MediaStream;
    const rec: MediaRecorder = new MR(stream, {
      mimeType: mime,
      videoBitsPerSecond: 12_000_000, // high quality
    });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

    setRecording(true);
    setRecProgress(0);

    const recordSpeed = speedRef.current;
    const playbackDurMs = data.durationMs / recordSpeed;
    const tailMs = 1500;
    const totalMs = playbackDurMs + tailMs;

    // Pre-compute interpolation
    const findIdx = (tMs: number) => {
      let lo = 0, hi = pts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (pts[mid].t <= tMs) lo = mid + 1; else hi = mid;
      }
      return Math.max(0, lo - 1);
    };

    const drawFrame = (tripMs: number, tailFade: number) => {
      // Background — deep slate gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, "#0a0a0a");
      bg.addColorStop(1, "#141414");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Subtle grid
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // Full route — soft outline
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(screenPts[0].x, screenPts[0].y);
      for (let i = 1; i < screenPts.length; i++) ctx.lineTo(screenPts[i].x, screenPts[i].y);
      ctx.stroke();

      // Traveled portion — gold
      const i = findIdx(tripMs);
      const next = Math.min(pts.length - 1, i + 1);
      const span = Math.max(1, pts[next].t - pts[i].t);
      const f = Math.max(0, Math.min(1, (tripMs - pts[i].t) / span));
      const curX = screenPts[i].x + (screenPts[next].x - screenPts[i].x) * f;
      const curY = screenPts[i].y + (screenPts[next].y - screenPts[i].y) * f;

      ctx.strokeStyle = "#D4AF37";
      ctx.lineWidth = 8;
      ctx.shadowColor = "rgba(212,175,55,0.55)";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(screenPts[0].x, screenPts[0].y);
      for (let k = 1; k <= i; k++) ctx.lineTo(screenPts[k].x, screenPts[k].y);
      ctx.lineTo(curX, curY);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Start marker
      ctx.fillStyle = "#22c55e";
      ctx.beginPath(); ctx.arc(screenPts[0].x, screenPts[0].y, 10, 0, Math.PI * 2); ctx.fill();
      // End marker
      const last = screenPts[screenPts.length - 1];
      ctx.fillStyle = "#ef4444";
      ctx.beginPath(); ctx.arc(last.x, last.y, 10, 0, Math.PI * 2); ctx.fill();

      // Vehicle dot — pulsing
      const pulse = 1 + Math.sin(tripMs / 120) * 0.12;
      ctx.fillStyle = "rgba(212,175,55,0.25)";
      ctx.beginPath(); ctx.arc(curX, curY, 28 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(curX, curY, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#D4AF37";
      ctx.beginPath(); ctx.arc(curX, curY, 7, 0, Math.PI * 2); ctx.fill();

      // ---- HUD bar (bottom 220px) ----
      const hudY = H - 220;
      const hudGrad = ctx.createLinearGradient(0, hudY, 0, H);
      hudGrad.addColorStop(0, "rgba(10,10,10,0)");
      hudGrad.addColorStop(0.35, "rgba(10,10,10,0.92)");
      hudGrad.addColorStop(1, "rgba(10,10,10,0.98)");
      ctx.fillStyle = hudGrad; ctx.fillRect(0, hudY, W, 220);

      // Title
      ctx.fillStyle = "#D4AF37";
      ctx.font = "600 22px Inter, system-ui, sans-serif";
      ctx.textBaseline = "top";
      ctx.fillText("ZEUS RENTAL CAR · TRIP REPLAY", 60, hudY + 28);
      ctx.fillStyle = "#ffffff";
      ctx.font = "700 34px Inter, system-ui, sans-serif";
      ctx.fillText(vehicleName, 60, hudY + 60);

      // Stats row
      const speedNow = pts[i].speed + (pts[next].speed - pts[i].speed) * f;
      const distNow = (pts[i].dist + (pts[next].dist - pts[i].dist) * f) / 1609.34;
      const clock = (() => {
        const s = Math.floor(tripMs / 1000);
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
        return `${h}:${m.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
      })();

      const stats: Array<[string, string]> = [
        ["TEMPO", clock],
        ["VELOCIDADE", `${Math.round(speedNow)} mph`],
        ["DISTÂNCIA", `${distNow.toFixed(1)} mi`],
        ["MÉDIA", `${Math.round(data.avgSpeedMph)} mph`],
        ["PICO", `${Math.round(data.maxSpeedMph)} mph`],
        ["FREADAS", `${data.hardBrakes}`],
      ];
      const colW = (W - 120) / stats.length;
      stats.forEach(([label, value], idx) => {
        const x = 60 + colW * idx;
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.font = "600 13px Inter, system-ui, sans-serif";
        ctx.fillText(label, x, hudY + 120);
        ctx.fillStyle = "#fff";
        ctx.font = "700 30px Inter, system-ui, sans-serif";
        ctx.fillText(value, x, hudY + 142);
      });

      // Progress bar
      const pbY = hudY + 200;
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(60, pbY, W - 120, 6);
      ctx.fillStyle = "#D4AF37";
      ctx.fillRect(60, pbY, (W - 120) * (tripMs / data.durationMs), 6);

      // Speed badge top-right
      ctx.fillStyle = "rgba(212,175,55,0.15)";
      ctx.fillRect(W - 200, 40, 140, 50);
      ctx.fillStyle = "#D4AF37";
      ctx.font = "700 24px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`${recordSpeed}× SPEED`, W - 130, 54);
      ctx.textAlign = "start";

      // Tail fade-out
      if (tailFade > 0) {
        ctx.fillStyle = `rgba(0,0,0,${tailFade})`;
        ctx.fillRect(0, 0, W, H);
      }
    };

    // Draw initial frame so the recorder has data immediately
    drawFrame(0, 0);
    rec.start(250);

    let cancelled = false;
    recCancelRef.current = () => { cancelled = true; };

    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      const tick = () => {
        const elapsed = performance.now() - t0;
        const ratio = Math.min(1, elapsed / totalMs);
        setRecProgress(ratio);
        const tripMs = Math.min(data.durationMs, (elapsed / playbackDurMs) * data.durationMs);
        const tailFade = elapsed > playbackDurMs
          ? Math.min(1, (elapsed - playbackDurMs) / tailMs) * 0.55
          : 0;
        drawFrame(tripMs, tailFade);
        if (cancelled || elapsed >= totalMs) return resolve();
        requestAnimationFrame(tick);
      };
      tick();
    });

    await new Promise<void>((res) => {
      if (rec.state === "inactive") return res();
      rec.onstop = () => res();
      try { rec.stop(); } catch { res(); }
    });
    stream.getTracks().forEach((t) => t.stop());

    if (chunks.length) {
      const blob = new Blob(chunks, { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safe = vehicleName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `replay-${safe}-${stamp}-${recordSpeed}x.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
    setRecording(false);
    setRecProgress(0);
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

  return (
    <div className="fixed inset-0 z-[2000] bg-[#050505] animate-in fade-in duration-200 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 bg-black/60 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${GOLD}, #b8941f)` }}>
            <Play size={16} className="text-black ml-0.5" fill="currentColor" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.25em] font-bold" style={{ color: GOLD }}>Replay de viagem</p>
            <h2 className="text-sm font-bold text-white truncate">{vehicleName}</h2>
          </div>
          {data && (
            <span
              className="hidden sm:inline-flex items-center gap-1.5 ml-2 px-2.5 py-1 rounded-full text-[9px] uppercase tracking-[0.2em] font-bold border"
              style={
                data.level === 2
                  ? { color: GOLD, borderColor: `${GOLD}66`, background: `${GOLD}10` }
                  : { color: "rgba(255,255,255,0.7)", borderColor: "rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.04)" }
              }
              title={
                data.level === 2
                  ? "Telemetria ponto-a-ponto (velocidade, tempo e eventos reais)"
                  : "Apenas agregados da viagem — sem velocidade ponto-a-ponto"
              }
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: data.level === 2 ? GOLD : "rgba(255,255,255,0.5)" }} />
              {data.level === 2 ? "Replay detalhado" : "Replay resumido"}
            </span>
          )}
        </div>


        {data && (
          <div className="hidden md:flex items-center gap-4 lg:gap-5 text-xs text-white/70 flex-wrap justify-center">
            <Stat icon={<Route size={11} />} label="Distância" value={`${data.totalDistanceMi.toFixed(1).replace(".", ",")} mi`} />
            <Stat icon={<Clock size={11} />} label="Duração" value={fmtClock(data.durationMs)} />
            <Stat icon={<Gauge size={11} />} label="Vel. média" value={`${Math.round(data.avgSpeedMph)} mph`} />
            <Stat icon={<TrendingUp size={11} />} label="Vel. máx" value={`${Math.round(data.maxSpeedMph)} mph`} />
            <Stat icon={<AlertTriangle size={11} />} label="Freadas" value={`${data.hardBrakes}`} />
            <Stat icon={<Zap size={11} />} label="Acel." value={`${data.hardAccels}`} />
            {data.totalIdleSeconds > 60 && (
              <Stat icon={<PauseCircle size={11} />} label="Parado" value={fmtMins(data.totalIdleSeconds)} />
            )}
            {data.fuelConsumedGal != null && data.fuelConsumedGal > 0 && (
              <Stat icon={<Fuel size={11} />} label="Combust." value={`${data.fuelConsumedGal.toFixed(2).replace(".", ",")} gal`} />
            )}
            {data.avgMpg != null && data.avgMpg > 0 && (
              <Stat icon={<Activity size={11} />} label="Consumo" value={`${data.avgMpg.toFixed(1).replace(".", ",")} mpg`} />
            )}
            {data.startOdometerMi != null && data.endOdometerMi != null && (
              <Stat icon={<Gauge size={11} />} label="Odômetro" value={`${Math.round(data.startOdometerMi)} → ${Math.round(data.endOdometerMi)} mi`} />
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
            title={recording ? "Renderizando vídeo em alta qualidade…" : "Baixar vídeo da animação (Full HD)"}
          >
            {recording ? (
              <>
                <Loader2 size={11} className="animate-spin" />
                Gravando {Math.round(recProgress * 100)}%
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
                <button onClick={onClose} className="mt-4 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-white">
                  Fechar
                </button>
              </div>
            </div>
          )}

          {/* Instrument panel — top-left over map */}
          {data && hud && (
            <div className="absolute top-3 left-3 z-10 w-[230px] rounded-2xl bg-black/80 backdrop-blur-md border border-white/10 p-3 shadow-2xl"
                 style={{ borderColor: "rgba(212,175,55,0.25)" }}>
              <Speedometer
                mph={data.level === 2 ? hud.speed : data.avgSpeedMph}
                max={Math.max(80, data.maxSpeedMph)}
                maxMarker={data.level === 1 ? data.maxSpeedMph : undefined}
                caption={data.level === 1 ? "vel. média da viagem" : "mph"}
              />
              {data.level === 2 && <Gmeter g={hud.g} />}
              <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                <MiniStat label="Percorrido" value={`${hud.distMi.toFixed(1).replace(".", ",")} mi`} />
                <MiniStat label="Decorrido" value={fmtClock(playbackMs)} />
              </div>
              {data.startOdometerMi != null && data.endOdometerMi != null && (
                <div className="mt-2 rounded-md bg-white/[0.04] border border-white/5 px-2 py-1.5">
                  <p className="text-[8px] uppercase tracking-wider text-white/40 font-semibold">Odômetro</p>
                  <p className="text-xs font-bold text-white tabular-nums">
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
                  <span className="truncate">{data.startAddress}</span>
                </p>
              )}
              {data.endAddress && playbackMs > data.durationMs - 5000 && (
                <p className="mt-2 text-[10px] text-white/50 leading-snug flex items-start gap-1">
                  <MapPin size={10} style={{ color: GOLD }} className="mt-0.5 shrink-0" />
                  <span className="truncate">{data.endAddress}</span>
                </p>
              )}
            </div>
          )}


          {/* Speed bands legend — bottom-left */}
          <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-black/75 backdrop-blur-sm border border-white/10 px-3 py-2">
            <p className="text-[9px] uppercase tracking-wider text-white/60 font-semibold mb-1.5">Velocidade no trajeto</p>
            {[
              { l: "até 35", c: "#f59e0b" },{ l: "35–45", c: "#22c55e" },
              { l: "45–50", c: "#3b82f6" },{ l: "50–65", c: "#ec4899" },{ l: "acima de 65", c: "#ef4444" },
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
                <p className="text-[10px] uppercase tracking-[0.4em] font-bold mb-3" style={{ color: GOLD }}>
                  Preparando replay
                </p>
                <h3 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
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
                  <span><span className="tabular-nums text-white font-bold">{data.totalDistanceMi.toFixed(1).replace(".", ",")}</span> mi</span>
                  <span className="w-1 h-1 rounded-full bg-white/30" />
                  <span><span className="tabular-nums text-white font-bold">{fmtClock(data.durationMs)}</span></span>
                  <span className="w-1 h-1 rounded-full bg-white/30" />
                  <span>pico <span className="tabular-nums text-white font-bold">{Math.round(data.maxSpeedMph)}</span> mph</span>
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
                    <p className="text-[9px] uppercase tracking-[0.3em] font-bold" style={{ color: GOLD }}>Viagem concluída</p>
                    <h4 className="text-base font-bold text-white leading-tight">{vehicleName}</h4>
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
                      <p className="text-xs font-bold text-white tabular-nums">
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
                    className="flex-1 text-[11px] font-bold uppercase tracking-wider px-4 py-2.5 rounded-full text-black hover:scale-[1.02] transition-transform flex items-center justify-center gap-1.5"
                    style={{ background: GOLD }}
                  >
                    <RotateCcw size={12} /> Assistir de novo
                  </button>
                  <button
                    onClick={onClose}
                    className="text-[11px] font-bold uppercase tracking-wider px-4 py-2.5 rounded-full border border-white/15 text-white/80 hover:bg-white/5"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right panel — narration timeline */}
        {data && (
          <div className="lg:w-[280px] lg:border-l border-t lg:border-t-0 border-white/5 bg-black/70 backdrop-blur-md flex flex-col max-h-[40vh] lg:max-h-none">
            <div className="px-4 py-3 border-b border-white/5">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: GOLD }}>Linha do tempo</p>
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

      {/* Bottom — chart + player controls */}
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
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full transition-colors ${
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
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-white/40">{icon}</span>
      <span className="text-[9px] uppercase tracking-wider text-white/40 font-semibold">{label}</span>
      <span className="text-xs font-bold text-white tabular-nums">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white/[0.04] border border-white/5 px-2 py-1.5">
      <p className="text-[8px] uppercase tracking-wider text-white/40 font-semibold">{label}</p>
      <p className="text-xs font-bold text-white tabular-nums">{value}</p>
    </div>
  );
}

function BigStat({ label, value, unit, highlight }: { label: string; value: string; unit: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-3 text-center ${highlight ? "border-[#D4AF37]/40 bg-[#D4AF37]/[0.06]" : "border-white/10 bg-white/[0.03]"}`}>
      <p className="text-[8px] uppercase tracking-wider text-white/50 font-semibold">{label}</p>
      <p className={`text-lg font-bold tabular-nums leading-tight mt-1 ${highlight ? "text-[#D4AF37]" : "text-white"}`}>
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
      <div className="absolute inset-x-0 bottom-0 text-center pb-1">
        <p className="text-2xl font-bold text-white tabular-nums leading-none">{Math.round(mph)}</p>
        <p className="text-[9px] uppercase tracking-wider text-white/50 font-semibold">{caption ?? "mph"}</p>
      </div>
      {maxMarker != null && (
        <p className="text-center text-[8px] uppercase tracking-wider text-red-400/80 font-semibold mt-0.5">
          pico atingido: <span className="tabular-nums">{Math.round(maxMarker)}</span> mph
        </p>
      )}
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
