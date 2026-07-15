import { useEffect, useState, useRef } from "react";
import { parseDateOnly } from "@/lib/dateOnly";
import { InspectionSkeleton } from "@/components/skeletons/MinorPageSkeletons";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  Camera, Check, ChevronLeft, Fuel, Gauge, ClipboardCheck,
  PenTool, Save, Loader2, X, Trash2, AlertTriangle, CheckCircle2,
  Download, GitCompare, Info, Eye, Calendar, Clock, MapPin as MapPinIcon
} from "lucide-react";
import { generateInspectionPDF } from "@/utils/inspectionPdf";
import { WebcamCaptureDialog } from "@/components/admin/WebcamCaptureDialog";
import refFrente from "@/assets/inspection/frente.jpg";
import refTraseira from "@/assets/inspection/traseira.jpg";
import refLatEsq from "@/assets/inspection/lateral-esquerda.jpg";
import refLatDir from "@/assets/inspection/lateral-direita.jpg";
import refPainel from "@/assets/inspection/painel.jpg";
import refBancoD from "@/assets/inspection/banco-dianteiro.jpg";
import refBancoT from "@/assets/inspection/banco-traseiro.jpg";
import refPortaMalas from "@/assets/inspection/porta-malas.jpg";
import refRodaDE from "@/assets/inspection/roda-de.jpg";
import refRodaDD from "@/assets/inspection/roda-dd.jpg";
import refRodaTE from "@/assets/inspection/roda-te.jpg";
import refRodaTD from "@/assets/inspection/roda-td.jpg";
import { SignedImage } from "@/components/admin/SignedImage";
import { PhotoLightbox } from "@/components/admin/PhotoLightbox";
import { ShareInspectionButton } from "@/components/admin/ShareInspectionButton";
import { ShareWhatsAppInspectionButton } from "@/components/admin/ShareWhatsAppInspectionButton";
import { registerLocalInspectionPreview, compressInspectionImage } from "@/lib/inspectionStorage";
import CarDamageMap from "@/components/inspection/CarDamageMap";
import { PhotoSourceSheet } from "@/components/admin/PhotoSourceSheet";
import { stampInspectionPhoto } from "@/lib/inspectionStamp";
import { normalizeDamageText } from "@/lib/damageTextNormalizer";
import { AddressAutocompleteInput } from "@/components/admin/AddressAutocompleteInput";
import { MapPin } from "lucide-react";

const PHOTO_REFERENCES: Record<string, string> = {
  "Frente": refFrente,
  "Traseira": refTraseira,
  "Lateral Esquerda": refLatEsq,
  "Lateral Direita": refLatDir,
  "Painel": refPainel,
  "Banco Dianteiro": refBancoD,
  "Banco Traseiro": refBancoT,
  "Porta-Malas": refPortaMalas,
  "Roda Dianteira Esquerda": refRodaDE,
  "Roda Dianteira Direita": refRodaDD,
  "Roda Traseira Esquerda": refRodaTE,
  "Roda Traseira Direita": refRodaTD,
  "Estepe": refPortaMalas,
};

/** Normaliza nomes de posição antigos (abreviados) para os novos nomes completos */
function normalizePhotoPosition(position: string): string {
  const map: Record<string, string> = {
    "Roda Dianteira Esq.": "Roda Dianteira Esquerda",
    "Roda Dianteira Dir.": "Roda Dianteira Direita",
    "Roda Traseira Esq.": "Roda Traseira Esquerda",
    "Roda Traseira Dir.": "Roda Traseira Direita",
    "Lateral Esq.": "Lateral Esquerda",
    "Lateral Dir.": "Lateral Direita",
  };
  return map[position] ?? position;
}

type DamageItem = {
  id: string;
  position: string;
  description: string;
  severity: "light" | "medium" | "heavy";
  photo_url?: string;
};

type ExteriorPhoto = {
  id: string;
  position: string;
  url: string;
};

type PhotoUploadStatus = "uploading" | "done" | "failed";

type AccessoryCheck = Record<string, boolean>;

// SVG mini illustrations for each photo position
const PhotoIllustration = ({ position }: { position: string }) => {
  const s = 48;
  const stroke = "hsl(var(--primary))";
  const fill = "hsl(var(--primary) / 0.08)";
  const bodyStroke = "hsl(var(--muted-foreground))";

  // Simplified car body for reuse
  const carBody = (highlight: React.ReactNode) => (
    <svg viewBox="0 0 48 48" width={s} height={s}>
      {/* Car body outline */}
      <path d="M12 32 L12 24 L16 16 L32 16 L36 24 L36 32 Z" fill={fill} stroke={bodyStroke} strokeWidth="1.2"/>
      {/* Windshield */}
      <path d="M17 16 L19 20 L29 20 L31 16" fill="none" stroke={bodyStroke} strokeWidth="0.8" opacity="0.6"/>
      {/* Wheels */}
      <circle cx="17" cy="32" r="3" fill="hsl(var(--foreground) / 0.15)" stroke={bodyStroke} strokeWidth="1"/>
      <circle cx="31" cy="32" r="3" fill="hsl(var(--foreground) / 0.15)" stroke={bodyStroke} strokeWidth="1"/>
      {highlight}
    </svg>
  );

  switch (position) {
    case "Frente":
      return (
        <svg viewBox="0 0 48 48" width={s} height={s}>
          <rect x="10" y="16" width="28" height="20" rx="4" fill={fill} stroke={bodyStroke} strokeWidth="1.2"/>
          <circle cx="16" cy="22" r="3" fill="hsl(var(--primary) / 0.2)" stroke={stroke} strokeWidth="1.2"/>
          <circle cx="32" cy="22" r="3" fill="hsl(var(--primary) / 0.2)" stroke={stroke} strokeWidth="1.2"/>
          <rect x="18" y="28" width="12" height="4" rx="1" fill="hsl(var(--muted))" stroke={bodyStroke} strokeWidth="0.8"/>
          <path d="M14 14 L34 14" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
          <path d="M8 20 L10 20 M38 20 L40 20" stroke={stroke} strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      );
    case "Traseira":
      return (
        <svg viewBox="0 0 48 48" width={s} height={s}>
          <rect x="10" y="16" width="28" height="20" rx="4" fill={fill} stroke={bodyStroke} strokeWidth="1.2"/>
          <rect x="13" cy="18" y="18" width="6" height="4" rx="1" fill="hsl(var(--destructive) / 0.2)" stroke="hsl(var(--destructive) / 0.5)" strokeWidth="1"/>
          <rect x="29" y="18" width="6" height="4" rx="1" fill="hsl(var(--destructive) / 0.2)" stroke="hsl(var(--destructive) / 0.5)" strokeWidth="1"/>
          <rect x="18" y="28" width="12" height="4" rx="1" fill="hsl(var(--muted))" stroke={bodyStroke} strokeWidth="0.8"/>
          <path d="M16 36 L32 36" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
        </svg>
      );
    case "Lateral Esquerda":
      return carBody(
        <path d="M10 18 L10 34" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" opacity="0.8"/>
      );
    case "Lateral Direita":
      return carBody(
        <path d="M38 18 L38 34" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" opacity="0.8"/>
      );
    case "Painel":
      return (
        <svg viewBox="0 0 48 48" width={s} height={s}>
          <rect x="6" y="14" width="36" height="22" rx="3" fill={fill} stroke={bodyStroke} strokeWidth="1.2"/>
          <circle cx="16" cy="25" r="5" fill="none" stroke={stroke} strokeWidth="1.2"/>
          <path d="M16 20 L16 25 L19 23" fill="none" stroke={stroke} strokeWidth="0.8"/>
          <rect x="25" y="20" width="12" height="8" rx="1.5" fill="hsl(var(--primary) / 0.12)" stroke={stroke} strokeWidth="0.8"/>
          <circle cx="24" cy="36" r="4" fill="none" stroke={bodyStroke} strokeWidth="1" opacity="0.5"/>
        </svg>
      );
    case "Banco Dianteiro":
      return (
        <svg viewBox="0 0 48 48" width={s} height={s}>
          <rect x="12" y="10" width="10" height="28" rx="3" fill={fill} stroke={bodyStroke} strokeWidth="1.2"/>
          <rect x="26" y="10" width="10" height="28" rx="3" fill={fill} stroke={bodyStroke} strokeWidth="1.2"/>
          <path d="M12 22 L22 22 M26 22 L36 22" stroke={stroke} strokeWidth="0.8" opacity="0.5"/>
        </svg>
      );
    case "Banco Traseiro":
      return (
        <svg viewBox="0 0 48 48" width={s} height={s}>
          <rect x="8" y="12" width="32" height="24" rx="4" fill={fill} stroke={bodyStroke} strokeWidth="1.2"/>
          <path d="M8 24 L40 24" stroke={stroke} strokeWidth="0.8" opacity="0.5"/>
          <path d="M20 12 L20 36 M28 12 L28 36" stroke={bodyStroke} strokeWidth="0.6" opacity="0.3"/>
        </svg>
      );
    case "Porta-Malas":
      return (
        <svg viewBox="0 0 48 48" width={s} height={s}>
          <rect x="10" y="14" width="28" height="22" rx="3" fill={fill} stroke={bodyStroke} strokeWidth="1.2"/>
          <path d="M10 20 L38 20" stroke={bodyStroke} strokeWidth="0.8" opacity="0.4"/>
          <circle cx="24" cy="28" r="4" fill="none" stroke={stroke} strokeWidth="1" strokeDasharray="2 2"/>
          <path d="M22 28 L26 28 M24 26 L24 30" stroke={stroke} strokeWidth="0.8"/>
        </svg>
      );
    case "Roda Dianteira Esquerda":
    case "Roda Dianteira Direita":
    case "Roda Traseira Esquerda":
    case "Roda Traseira Direita":
      const isLeft = position.includes("Esq");
      const isFront = position.includes("Dianteira");
      return (
        <svg viewBox="0 0 48 48" width={s} height={s}>
          {/* Car outline faded */}
          <path d="M12 32 L12 24 L16 16 L32 16 L36 24 L36 32 Z" fill="hsl(var(--muted) / 0.15)" stroke={bodyStroke} strokeWidth="0.6" opacity="0.4"/>
          {/* Highlighted wheel */}
          <circle
            cx={isLeft ? 17 : 31}
            cy={isFront ? 24 : 32}
            r="6"
            fill="hsl(var(--primary) / 0.15)"
            stroke={stroke}
            strokeWidth="1.5"
          />
          <circle
            cx={isLeft ? 17 : 31}
            cy={isFront ? 24 : 32}
            r="2"
            fill="none"
            stroke={stroke}
            strokeWidth="0.8"
          />
        </svg>
      );
    case "Estepe":
      return (
        <svg viewBox="0 0 48 48" width={s} height={s}>
          {/* Trunk / undercarriage outline */}
          <rect x="10" y="14" width="28" height="22" rx="3" fill="hsl(var(--muted) / 0.15)" stroke={bodyStroke} strokeWidth="0.6" opacity="0.4"/>
          <path d="M10 20 L38 20" stroke={bodyStroke} strokeWidth="0.8" opacity="0.3"/>
          {/* Highlighted spare tire */}
          <circle cx="24" cy="28" r="8" fill="hsl(var(--primary) / 0.15)" stroke={stroke} strokeWidth="1.4"/>
          <circle cx="24" cy="28" r="3" fill="none" stroke={stroke} strokeWidth="0.8"/>
          <path d="M16 28 L32 28 M24 20 L24 36" stroke={stroke} strokeWidth="0.6" opacity="0.5"/>
        </svg>
      );
    case "Chaves + Ticket":
      return (
        <svg viewBox="0 0 48 48" width={s} height={s}>
          {/* Ticket */}
          <rect x="22" y="12" width="20" height="26" rx="2" fill={fill} stroke={bodyStroke} strokeWidth="1.2"/>
          <path d="M25 18 L39 18 M25 22 L37 22 M25 26 L35 26" stroke={bodyStroke} strokeWidth="0.8" opacity="0.5"/>
          <rect x="25" y="30" width="10" height="4" rx="0.5" fill="hsl(var(--primary) / 0.2)" stroke={stroke} strokeWidth="0.8"/>
          {/* Key */}
          <circle cx="12" cy="20" r="5" fill="none" stroke={stroke} strokeWidth="1.4"/>
          <circle cx="12" cy="20" r="1.6" fill={stroke}/>
          <path d="M16.5 20 L22 20 L22 23 L20 23 M22 20 L24 20" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" fill="none"/>
        </svg>
      );
    default:
      return carBody(null);
  }
};

const PHOTO_POSITIONS: { name: string; guide: string; optional?: boolean }[] = [
  { name: "Frente", guide: "Foto centralizada da frente do veículo, mostrando faróis, grade e placa inteiros. Distância: ~2 metros." },
  { name: "Lateral Esquerda", guide: "Foto lateral completa do lado do motorista. Posicione-se no meio do carro. Distância: ~3 metros." },
  { name: "Roda Dianteira Esquerda", guide: "Foto focada na roda dianteira esquerda: pneu, calota/roda e suspensão visível." },
  { name: "Roda Traseira Esquerda", guide: "Foto focada na roda traseira esquerda: pneu, calota/roda e suspensão visível." },
  { name: "Lateral Direita", guide: "Foto lateral completa do lado do passageiro. Posicione-se no meio do carro. Distância: ~3 metros." },
  { name: "Roda Dianteira Direita", guide: "Foto focada na roda dianteira direita: pneu, calota/roda e suspensão visível." },
  { name: "Roda Traseira Direita", guide: "Foto focada na roda traseira direita: pneu, calota/roda e suspensão visível." },
  { name: "Traseira", guide: "Foto centralizada da traseira, mostrando lanternas, placa e para-choque inteiros. Distância: ~2 metros." },
  { name: "Porta-Malas", guide: "Foto do porta-malas aberto, mostrando espaço, tapete e estepe (se visível)." },
  { name: "Banco Dianteiro", guide: "Foto dos bancos dianteiros mostrando estado do estofamento. Tire da porta traseira aberta." },
  { name: "Banco Traseiro", guide: "Foto dos bancos traseiros e assoalho. Tire com a porta traseira aberta." },
  { name: "Banco Traseiro (3ª Fileira)", guide: "Apenas para veículos de 7 lugares. Foto da terceira fileira de bancos (últimos 2 lugares) mostrando estado do estofamento e assoalho.", optional: true },
  { name: "Chaves + Ticket", guide: "Foto da chave do veículo posicionada junto ao ticket do parking. Enquadre ambos lado a lado em superfície limpa para que o número do ticket fique legível." },
  { name: "Estepe", guide: "Somente se o veículo possuir estepe visível ou acessível. Registre o estado do pneu reserva, independente de onde esteja (porta-malas, porta traseira, sob o veículo, etc.)", optional: true },
];

const PhotoUploadBadge = ({ status }: { status?: PhotoUploadStatus }) => {
  if (!status || status === "done") return null;

  return (
    <span
      className={`absolute top-1 right-1 z-10 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium shadow-sm backdrop-blur-md ${
        status === "failed"
          ? "border-destructive/35 bg-destructive/90 text-destructive-foreground"
          : "border-border/50 bg-background/85 text-foreground"
      }`}
    >
      {status === "failed" ? (
        <AlertTriangle size={10} />
      ) : (
        <Loader2 size={10} className="animate-spin" />
      )}
      {status === "failed" ? "Falhou" : "Enviando"}
    </span>
  );
};


const FUEL_LEVELS = [
  { value: "empty", label: "Vazio", pct: 0 },
  { value: "1/8", label: "1/8", pct: 12.5 },
  { value: "1/4", label: "1/4", pct: 25 },
  { value: "3/8", label: "3/8", pct: 37.5 },
  { value: "1/2", label: "1/2", pct: 50 },
  { value: "5/8", label: "5/8", pct: 62.5 },
  { value: "3/4", label: "3/4", pct: 75 },
  { value: "7/8", label: "7/8", pct: 87.5 },
  { value: "full", label: "Cheio", pct: 100 },
];

const DEFAULT_ACCESSORIES: Record<string, string> = {
  jack: "Macaco",
  antenna: "Antena",
  first_aid: "Kit Primeiros Socorros",
  spare_tire: "Estepe",
  triangle: "Triângulo",
  floor_mats: "Tapetes",
  fire_extinguisher: "Extintor",
};

// Mapa de avarias agora vive em src/components/inspection/CarDamageMap.tsx


export default function AdminInspection() {
  const { bookingId } = useParams();
  const [searchParams] = useSearchParams();
  const rawType = searchParams.get("type");
  const type: "checkin" | "checkout" = rawType === "checkout" ? "checkout" : "checkin";
  const navigate = useNavigate();

  const [booking, setBooking] = useState<any>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingInspection, setExistingInspection] = useState<any>(null);
  const [step, setStep] = useState(0);

  // Form state
  const [odometer, setOdometer] = useState("");
  const [fuelLevel, setFuelLevel] = useState("full");
  const [photos, setPhotos] = useState<ExteriorPhoto[]>([]);
  const [damages, setDamages] = useState<DamageItem[]>([]);
  const [accessories, setAccessories] = useState<AccessoryCheck>(
    Object.keys(DEFAULT_ACCESSORIES).reduce((acc, k) => ({ ...acc, [k]: true }), {})
  );
  const [notes, setNotes] = useState("");
  const [agentName, setAgentName] = useState("");
  const [customerSignature, setCustomerSignature] = useState("");
  const [agentSignature, setAgentSignature] = useState("");
  const [odometerPhoto, setOdometerPhoto] = useState("");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<null | { odometer_miles: number | null; fuel_level: string | null; confidence: string }>(null);
  const [fuelPhoto, setFuelPhoto] = useState("");
  // Local da inspeção (carimbado em todas as fotos)
  const [inspectionAddress, setInspectionAddress] = useState<string>(() => {
    try { return localStorage.getItem("zeus_inspection_last_address") || ""; } catch { return ""; }
  });

  // Guide panel
  const [activeGuide, setActiveGuide] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ value: string; label: string } | null>(null);

  // Signature canvas refs
  const customerCanvasRef = useRef<HTMLCanvasElement>(null);
  const agentCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingCustomer, setIsDrawingCustomer] = useState(false);
  const [isDrawingAgent, setIsDrawingAgent] = useState(false);

  // Camera (capture) + Gallery (attach existing) refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileInputGalRef = useRef<HTMLInputElement>(null);
  const [capturePosition, setCapturePosition] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [photoUploadStatus, setPhotoUploadStatus] = useState<Record<string, PhotoUploadStatus>>({});

  // Damage photo
  const damageFileRef = useRef<HTMLInputElement>(null);
  const damageFileGalRef = useRef<HTMLInputElement>(null);
  const [damagePhotoTarget, setDamagePhotoTarget] = useState<string>("");

  // Odometer/fuel photo refs
  const odometerPhotoRef = useRef<HTMLInputElement>(null);
  const odometerPhotoGalRef = useRef<HTMLInputElement>(null);
  const fuelPhotoRef = useRef<HTMLInputElement>(null);
  const fuelPhotoGalRef = useRef<HTMLInputElement>(null);

  // Source picker (Camera vs Gallery)
  const [sourcePicker, setSourcePicker] = useState<
    | null
    | { kind: "exterior"; position: string }
    | { kind: "damage"; damageId: string }
    | { kind: "odometer" }
    | { kind: "fuel" }
  >(null);

  // Webcam dialog (desktop only — mobile uses native camera via input capture)
  const isTouchDevice = typeof window !== "undefined"
    && window.matchMedia?.("(pointer: coarse)").matches;
  const [webcamTarget, setWebcamTarget] = useState<
    | null
    | { kind: "exterior"; position: string }
    | { kind: "damage"; damageId: string }
    | { kind: "odometer" }
    | { kind: "fuel" }
  >(null);
  const webcamTitle =
    webcamTarget?.kind === "exterior" ? `Foto: ${webcamTarget.position}`
    : webcamTarget?.kind === "damage" ? "Foto da avaria"
    : webcamTarget?.kind === "odometer" ? "Foto do odômetro"
    : webcamTarget?.kind === "fuel" ? "Foto do tanque"
    : "Capturar foto";

  const handleWebcamFile = async (file: File) => {
    if (!webcamTarget) return;
    if (webcamTarget.kind === "exterior") {
      const url = uploadPhoto(file, webcamTarget.position.replace(/\s/g, "_"));
      if (url) {
        setPhotos((prev) => {
          const filtered = prev.filter((p) => p.position !== webcamTarget.position);
          return [...filtered, { id: crypto.randomUUID(), position: webcamTarget.position, url }];
        });
      }
    } else if (webcamTarget.kind === "damage") {
      const url = uploadPhoto(file, `damage-${webcamTarget.damageId.substring(0, 8)}`);
      if (url) {
        setDamages((prev) =>
          prev.map((d) => (d.id === webcamTarget.damageId ? { ...d, photo_url: url } : d))
        );
      }
    } else if (webcamTarget.kind === "odometer") {
      const url = uploadPhoto(file, "odometro");
      if (url) { setOdometerPhoto(url); setFuelPhoto(url); }
      void runDashboardOcr(file);
    } else if (webcamTarget.kind === "fuel") {
      const url = uploadPhoto(file, "tanque_combustivel");
      if (url) setFuelPhoto(url);
    }
    setWebcamTarget(null);
  };

  const draftKey = bookingId ? `zeus_inspection_draft:${bookingId}:${type}` : "";
  const draftRestoredRef = useRef(false);
  const draftHydratedRef = useRef(false);

  useEffect(() => {
    draftRestoredRef.current = false;
    draftHydratedRef.current = false;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, type]);

  // Restore local draft (after server hydration) so a tab switch / reload
  // brings the user back to the same step with the same photos.
  useEffect(() => {
    if (loading || !draftKey || draftRestoredRef.current) return;
    draftRestoredRef.current = true;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) { draftHydratedRef.current = true; return; }
      const d = JSON.parse(raw);
      // Never override a finalized inspection.
      if (existingInspection?.completed_at) {
        localStorage.removeItem(draftKey);
        draftHydratedRef.current = true;
        return;
      }
      if (typeof d.step === "number") setStep(d.step);
      if (typeof d.odometer === "string") setOdometer(d.odometer);
      if (typeof d.fuelLevel === "string") setFuelLevel(d.fuelLevel);
      if (Array.isArray(d.photos)) setPhotos(d.photos.map((p: any) => ({ ...p, position: normalizePhotoPosition(p.position) })));
      if (Array.isArray(d.damages)) setDamages(d.damages);
      if (d.accessories && typeof d.accessories === "object") setAccessories(d.accessories);
      if (typeof d.notes === "string") setNotes(d.notes);
      if (typeof d.agentName === "string") setAgentName(d.agentName);
      if (typeof d.customerSignature === "string") setCustomerSignature(d.customerSignature);
      if (typeof d.agentSignature === "string") setAgentSignature(d.agentSignature);
      if (typeof d.odometerPhoto === "string") setOdometerPhoto(d.odometerPhoto);
      if (typeof d.fuelPhoto === "string") setFuelPhoto(d.fuelPhoto);
      if (typeof d.inspectionAddress === "string" && d.inspectionAddress) setInspectionAddress(d.inspectionAddress);
    } catch (e) {
      console.warn("[inspection] failed to restore draft", e);
    } finally {
      draftHydratedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, draftKey]);

  // Persist draft on every relevant change (only after hydration to avoid
  // wiping the saved draft with empty initial values).
  useEffect(() => {
    if (!draftKey || !draftHydratedRef.current) return;
    if (existingInspection?.completed_at) return;
    try {
      const payload = {
        step, odometer, fuelLevel, photos, damages, accessories,
        notes, agentName, customerSignature, agentSignature,
        odometerPhoto, fuelPhoto, inspectionAddress,
        savedAt: Date.now(),
      };
      localStorage.setItem(draftKey, JSON.stringify(payload));
    } catch (e) {
      // QuotaExceeded etc — silently ignore.
    }
  }, [
    draftKey, step, odometer, fuelLevel, photos, damages, accessories,
    notes, agentName, customerSignature, agentSignature,
    odometerPhoto, fuelPhoto, inspectionAddress, existingInspection?.completed_at,
  ]);

  // Also flush a save when the tab is hidden (iOS may freeze the page).
  useEffect(() => {
    const flush = () => {
      if (!draftKey || !draftHydratedRef.current) return;
      if (existingInspection?.completed_at) return;
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          step, odometer, fuelLevel, photos, damages, accessories,
          notes, agentName, customerSignature, agentSignature,
          odometerPhoto, fuelPhoto, inspectionAddress, savedAt: Date.now(),
        }));
      } catch {}
    };
    window.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [
    draftKey, step, odometer, fuelLevel, photos, damages, accessories,
    notes, agentName, customerSignature, agentSignature,
    odometerPhoto, fuelPhoto, inspectionAddress, existingInspection?.completed_at,
  ]);

  // Lembra o último endereço usado entre inspeções (preenchido por padrão).
  useEffect(() => {
    if (!inspectionAddress) return;
    try { localStorage.setItem("zeus_inspection_last_address", inspectionAddress); } catch {}
  }, [inspectionAddress]);



  const loadData = async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const [bookingRes, inspectionRes] = await Promise.all([
        supabase.from("bookings").select("*").eq("id", bookingId).single(),
        supabase.from("vehicle_inspections").select("*").eq("booking_id", bookingId).eq("type", type).maybeSingle(),
      ]);

      if (bookingRes.error) {
        toast({ title: "Erro ao carregar reserva", description: bookingRes.error.message, variant: "destructive" });
      } else if (bookingRes.data) {
        setBooking(bookingRes.data);
        if (bookingRes.data.vehicle_id) {
          // Senior staff can read the full row; drivers/mechanics use the safe RPC.
          const { data: vehFull } = await supabase.from("vehicles").select("*").eq("id", bookingRes.data.vehicle_id).maybeSingle();
          if (vehFull) {
            setVehicle(vehFull);
          } else {
            const { data: vehBasic } = await supabase.rpc("get_vehicle_basic", { p_vehicle_id: bookingRes.data.vehicle_id });
            setVehicle((vehBasic && vehBasic[0]) || null);
          }
        }
      }

      if (inspectionRes.data) {
        setExistingInspection(inspectionRes.data);
        setOdometer(inspectionRes.data.odometer_reading?.toString() || "");
        setFuelLevel(inspectionRes.data.fuel_level || "full");
        setPhotos(((inspectionRes.data.exterior_photos as any[]) || []).map((p: any) => ({ ...p, position: normalizePhotoPosition(p.position) })));
        setDamages((inspectionRes.data.damages as any[]) || []);
        setAccessories(inspectionRes.data.accessories_check as AccessoryCheck || {});
        setNotes(inspectionRes.data.notes || "");
        setAgentName(inspectionRes.data.agent_name || "");
        setCustomerSignature(inspectionRes.data.customer_signature || "");
        setAgentSignature(inspectionRes.data.agent_signature || "");
        const extPhotos = (inspectionRes.data.exterior_photos as any[]) || [];
        setOdometerPhoto(extPhotos.find((p: any) => p.position === "__odometer")?.url || "");
        setFuelPhoto(extPhotos.find((p: any) => p.position === "__fuel")?.url || "");
      }
    } catch (e: any) {
      toast({ title: "Erro ao carregar inspeção", description: e?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Counter-based "uploading" state so multiple concurrent background uploads
  // are tracked correctly without flicker.
  const pendingUploadsRef = useRef(0);
  const pendingUploadPromisesRef = useRef<Promise<void>[]>([]);
  const bumpUploading = (delta: number) => {
    pendingUploadsRef.current = Math.max(0, pendingUploadsRef.current + delta);
    setUploading(pendingUploadsRef.current > 0);
  };

  // Optimistic upload: compresses the photo, registers an instant blob preview,
  // returns the storage path immediately, and uploads in the background.
  // The thumbnail appears in the UI right away — no waiting for the round-trip.
  const getImageExtension = (file: File) => {
    const byType: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/heic": "heic",
      "image/heif": "heif",
    };
    if (byType[file.type]) return byType[file.type];
    return file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  };

  const uploadPhoto = (file: File, tag: string): string | null => {
    if (!bookingId) return null;
    const safeTag = tag.replace(/[^a-zA-Z0-9_-]/g, "_");
    const path = `${bookingId}/${type}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safeTag}.jpg`;

    // Register the original file immediately. This makes the thumbnail appear
    // on the next paint; stamping, compression and upload happen after the UI updates.
    registerLocalInspectionPreview(path, file);
    setPhotoUploadStatus((prev) => ({ ...prev, [path]: "uploading" }));
    bumpUploading(+1);

    // Captura o endereço no momento da foto — não muda se o usuário editar depois.
    const stampAddress = inspectionAddress;
    const stampDate = new Date();

    const task = new Promise<void>((resolve) => {
      window.setTimeout(() => {
        void (async () => {
          try {
            // 1) Carimba a foto com data/hora + endereço (igual app Timestamp Camera).
            const stamped = await stampInspectionPhoto(file, {
              address: stampAddress,
              date: stampDate,
            });
            // Atualiza o preview local com a versão carimbada para o usuário ver
            // o overlay imediatamente (sem esperar o upload).
            if (stamped !== file) registerLocalInspectionPreview(path, stamped);

            // 2) Sempre comprimir antes do upload — JPEGs carimbados saiam com 4-7 MB,
            //    o que estourava o tempo de upload em 4G/5G no mobile e produzia "Falhou".
            //    A compressão respeita a orientação EXIF e mantém o enquadramento já
            //    rasterizado pelo stamp. maxDim 1920 + q 0.82 = qualidade visual idêntica
            //    com 5-8x menos bytes.
            const stampedFile = stamped instanceof File
              ? stamped
              : new File([stamped], file.name, { type: "image/jpeg" });
            const toUpload: Blob = await compressInspectionImage(stampedFile, 1920, 0.82);
            const { error } = await supabase.storage
              .from("inspections")
              .upload(path, toUpload, {
                contentType: toUpload.type || "image/jpeg",
                cacheControl: "3600",
                upsert: false,
              });

            if (error) {
              setPhotoUploadStatus((prev) => ({ ...prev, [path]: "failed" }));
              toast({ title: "Erro ao enviar foto", description: error.message, variant: "destructive" });
              return;
            }
            setPhotoUploadStatus((prev) => ({ ...prev, [path]: "done" }));
          } finally {
            bumpUploading(-1);
            resolve();
          }
        })();
      }, 0);
    });
    pendingUploadPromisesRef.current.push(task);
    void task.finally(() => {
      pendingUploadPromisesRef.current = pendingUploadPromisesRef.current.filter((p) => p !== task);
    });

    return path;
  };



  // -- Photo capture (exterior) — opens source picker
  const capturePhoto = (position: string) => {
    setCapturePosition(position);
    setSourcePicker({ kind: "exterior", position });
  };

  const handleFileCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !capturePosition) return;
    const selectedPosition = capturePosition;
    // For gallery multi-select we keep the position label on the first file and
    // append the others as additional photos for the same position.
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const url = uploadPhoto(file, selectedPosition.replace(/\s/g, "_"));
      if (url) {
        setPhotos((prev) => {
          // Single capture replaces the same position; multi-select appends.
          if (files.length === 1) {
            const filtered = prev.filter((p) => p.position !== selectedPosition);
            return [...filtered, { id: crypto.randomUUID(), position: selectedPosition, url }];
          }
          return [...prev, { id: crypto.randomUUID(), position: selectedPosition, url }];
        });
      }
    }
    setCapturePosition("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (fileInputGalRef.current) fileInputGalRef.current.value = "";
  };

  // Odometer photo
  const captureOdometerPhoto = () => {
    setSourcePicker({ kind: "odometer" });
  };

  const runDashboardOcr = async (file: File) => {
    try {
      setOcrLoading(true);
      setOcrResult(null);
      // Compress + base64 (cap ~1.2MP to keep payload small)
      const compressed = await compressInspectionImage(file, 1400, 0.82).catch(() => file);
      const buf = await compressed.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
      }
      const b64 = btoa(binary);
      const { data, error } = await supabase.functions.invoke("ocr-dashboard", {
        body: { imageBase64: b64, mimeType: compressed.type || "image/jpeg" },
      });
      if (error) throw error;
      const result = (data as any)?.data;
      if (!result) throw new Error("Sem resultado");
      setOcrResult(result);
      // Auto-fill only when the fields are still empty (user can always edit)
      if (result.odometer_miles != null && !odometer.trim()) {
        setOdometer(String(result.odometer_miles));
      }
      if (result.fuel_level) {
        setFuelLevel(result.fuel_level);
      }
      toast({
        title: "Painel analisado",
        description: `Odômetro: ${result.odometer_miles ?? "—"} mi · Tanque: ${result.fuel_level ?? "—"}. Revise antes de avançar.`,
      });
    } catch (err: any) {
      console.error("ocr-dashboard error", err);
      toast({
        title: "Não consegui ler o painel",
        description: "Preencha o odômetro e o combustível manualmente.",
        variant: "destructive",
      });
    } finally {
      setOcrLoading(false);
    }
  };

  const handleOdometerPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = uploadPhoto(file, "odometro");
    if (url) { setOdometerPhoto(url); setFuelPhoto(url); }
    void runDashboardOcr(file);

    if (odometerPhotoRef.current) odometerPhotoRef.current.value = "";
    if (odometerPhotoGalRef.current) odometerPhotoGalRef.current.value = "";
  };

  // Fuel photo
  const captureFuelPhoto = () => {
    setSourcePicker({ kind: "fuel" });
  };

  const handleFuelPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = uploadPhoto(file, "tanque_combustivel");
    if (url) setFuelPhoto(url);
    if (fuelPhotoRef.current) fuelPhotoRef.current.value = "";
    if (fuelPhotoGalRef.current) fuelPhotoGalRef.current.value = "";
  };

  // -- Damage photo
  const captureDamagePhoto = (damageId: string) => {
    setDamagePhotoTarget(damageId);
    setSourcePicker({ kind: "damage", damageId });
  };

  const handleDamageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !damagePhotoTarget) return;
    const url = uploadPhoto(file, `damage-${damagePhotoTarget.substring(0, 8)}`);
    if (url) {
      setDamages((prev) =>
        prev.map((d) => (d.id === damagePhotoTarget ? { ...d, photo_url: url } : d))
      );
    }
    setDamagePhotoTarget("");
    if (damageFileRef.current) damageFileRef.current.value = "";
    if (damageFileGalRef.current) damageFileGalRef.current.value = "";
  };

  // Resolve picker action: trigger the right hidden input based on choice.
  const handlePickerCamera = () => {
    if (!sourcePicker) return;
    // Desktop (no touch): prefer the in-page webcam dialog.
    if (!isTouchDevice) {
      setWebcamTarget(sourcePicker);
      return;
    }
    if (sourcePicker.kind === "exterior") fileInputRef.current?.click();
    else if (sourcePicker.kind === "damage") damageFileRef.current?.click();
    else if (sourcePicker.kind === "odometer") odometerPhotoRef.current?.click();
    else if (sourcePicker.kind === "fuel") fuelPhotoRef.current?.click();
  };

  const handlePickerGallery = () => {
    if (!sourcePicker) return;
    if (sourcePicker.kind === "exterior") fileInputGalRef.current?.click();
    else if (sourcePicker.kind === "damage") damageFileGalRef.current?.click();
    else if (sourcePicker.kind === "odometer") odometerPhotoGalRef.current?.click();
    else if (sourcePicker.kind === "fuel") fuelPhotoGalRef.current?.click();
  };

  // -- Damages
  const addDamage = (position: string) => {
    setDamages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), position, description: "", severity: "light" },
    ]);
  };

  const updateDamage = (id: string, field: keyof DamageItem, value: string) => {
    setDamages((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  };

  const removeDamage = (id: string) => {
    setDamages((prev) => prev.filter((d) => d.id !== id));
  };

  // -- Signature drawing
  const startDrawing = (canvas: HTMLCanvasElement, setDrawing: (v: boolean) => void) => {
    setDrawing(true);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    canvas: HTMLCanvasElement,
    isDrawing: boolean
  ) => {
    if (!isDrawing) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;
    if ("touches" in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "hsl(var(--foreground))";
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const stopDrawing = (
    canvas: HTMLCanvasElement,
    setDrawing: (v: boolean) => void,
    setSignature: (v: string) => void
  ) => {
    setDrawing(false);
    setSignature(canvas.toDataURL());
  };

  const clearCanvas = (canvas: HTMLCanvasElement, setSignature: (v: string) => void) => {
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignature("");
  };

  // -- Save
  const handleSave = async (finalize = false) => {
    setSaving(true);

    // Before finalizing, wait for any in-flight background uploads so the
    // saved record never references a storage path that hasn't landed yet.
    if (finalize && pendingUploadPromisesRef.current.length > 0) {
      toast({ title: "Aguardando envio das fotos...", description: "Finalizando em instantes." });
      await Promise.allSettled(pendingUploadPromisesRef.current);
    }

    // Hard-block finalize if any photo upload ultimately failed — avoids
    // shipping a "completed" inspection with broken image links.
    if (finalize) {
      const failedPaths = Object.entries(photoUploadStatus)
        .filter(([, s]) => s === "failed")
        .map(([p]) => p);
      if (failedPaths.length > 0) {
        toast({
          title: "Algumas fotos não foram enviadas",
          description: "Toque em 'Refazer' nas fotos com erro e tente finalizar novamente.",
          variant: "destructive",
        });
        setSaving(false);
        return;
      }
    }

    // Merge odometer/fuel photos into exterior_photos
    const allPhotos = [
      ...photos.filter((p) => !p.position.startsWith("__")),
      ...(odometerPhoto ? [{ id: "odometer-photo", position: "__odometer", url: odometerPhoto }] : []),
      ...(fuelPhoto ? [{ id: "fuel-photo", position: "__fuel", url: fuelPhoto }] : []),
    ];


    const payload = {
      booking_id: bookingId!,
      type,
      odometer_reading: odometer ? parseInt(odometer) : null,
      fuel_level: fuelLevel,
      exterior_photos: allPhotos,
      damages,
      accessories_check: accessories,
      notes,
      location_address: inspectionAddress || null,
      customer_signature: customerSignature,
      agent_signature: agentSignature,
      agent_name: agentName,
      // Preserve a previously-recorded completion timestamp on draft saves so an
      // accidental "Salvar Rascunho" never un-finalizes an inspection.
      completed_at: finalize
        ? new Date().toISOString()
        : (existingInspection?.completed_at ?? null),
    };

    let error;
    let savedRow: any = null;
    if (existingInspection) {
      const res = await supabase
        .from("vehicle_inspections")
        .update(payload)
        .eq("id", existingInspection.id)
        .select()
        .maybeSingle();
      error = res.error;
      savedRow = res.data;
    } else {
      const res = await supabase
        .from("vehicle_inspections")
        .insert(payload)
        .select()
        .maybeSingle();
      error = res.error;
      savedRow = res.data;
    }

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Re-sync local state so subsequent saves update the same row instead of inserting a duplicate.
    if (savedRow) setExistingInspection(savedRow);

    // On finalize: also transition the parent booking status so downstream
    // ranking (in_progress > confirmed) and reporting stay accurate.
    if (finalize && bookingId) {
      const nextStatus = type === "checkin" ? "in_progress" : "completed";
      const updatePayload: Record<string, any> = { status: nextStatus };

      // Regra Turo: pagamento é pós check-out. Ao finalizar a inspeção de
      // devolução, marcamos a reserva como paga automaticamente.
      if (type === "checkout") {
        const { data: bk } = await supabase
          .from("bookings")
          .select("turo_reservation_code, addons, payment_status")
          .eq("id", bookingId)
          .maybeSingle();
        const isTuro = !!(bk?.turo_reservation_code || (bk?.addons as any)?.turo_reservation_id);
        if (isTuro && bk?.payment_status !== "paid") {
          updatePayload.payment_status = "paid";
          updatePayload.paid_at = new Date().toISOString();
        }
      }

      const { error: bErr } = await supabase
        .from("bookings")
        .update(updatePayload)
        .eq("id", bookingId);
      if (bErr) {
        console.error("[inspection] failed to update booking status", bErr);
      }
    }

    if (finalize && draftKey) {
      try { localStorage.removeItem(draftKey); } catch {}
    }

    // Dispara e-mail Sua Marca com o laudo da inspeção (não bloqueia)
    if (finalize && booking) {
      try {
        const { sendZeusEmail } = await import("@/lib/emails/sendZeusEmail");
        const tpl = type === "checkin" ? "inspection-checkin" : "inspection-checkout";
        const photosCount = (allPhotos?.length || 0) + (damages?.filter((d: any) => d?.photoUrl).length || 0);
        const completedAt = new Date().toLocaleString("pt-BR");

        // Public share link (no login required) for the email CTA
        let reportUrl = `${window.location.origin}/`;
        try {
          const { data: linkRes } = await supabase.functions.invoke("create-public-inspection-link", {
            body: { booking_id: bookingId, type, expires_hours: 24 * 30 },
          });
          if ((linkRes as any)?.token) {
            reportUrl = `${window.location.origin}/share/inspection/${(linkRes as any).token}`;
          }
        } catch (e) { console.warn("[zeus-email] public link failed", e); }


        // Para o checkout, busca odômetro do check-in para calcular milhas rodadas
        let odometerStart: number | null = null;
        if (type === "checkout") {
          try {
            const { data: prevInsp } = await supabase
              .from("vehicle_inspections")
              .select("odometer_reading")
              .eq("booking_id", bookingId)
              .eq("type", "checkin")
              .maybeSingle();
            odometerStart = (prevInsp as any)?.odometer_reading ?? null;
          } catch {}
        }

        const odoEnd = odometer ? parseInt(odometer) : null;
        const miles =
          odometerStart != null && odoEnd != null && odoEnd >= odometerStart
            ? `${(odoEnd - odometerStart).toLocaleString("pt-BR")} mi`
            : "—";

        sendZeusEmail({
          templateName: tpl,
          idempotencyKey: `${tpl}:${bookingId}:${Date.now()}`,
          templateData: {
            bookingNumber: (booking as any).booking_number || "—",
            customerName: (booking as any).customer_name || "—",
            vehicleName: (vehicle as any)?.name || "—",
            vehiclePlate: (vehicle as any)?.license_plate || (vehicle as any)?.plate || "—",
            odometer: odoEnd != null ? `${odoEnd.toLocaleString("pt-BR")} mi` : "—",
            odometerStart: odometerStart != null ? `${odometerStart.toLocaleString("pt-BR")} mi` : "—",
            odometerEnd: odoEnd != null ? `${odoEnd.toLocaleString("pt-BR")} mi` : "—",
            milesDriven: miles,
            fuelLevel: fuelLevel || "—",
            damagesCount: damages?.length ?? 0,
            photosCount,
            paymentStatus: type === "checkout" ? "Pago" : ((booking as any).payment_status || "—"),
            inspectorName: "Equipe Sua Marca",
            completedAt,
            reportUrl,
            inspectionBookingId: bookingId,
            inspectionType: type,
          },
        });
      } catch (e) { console.error("[zeus-email] inspection dispatch failed", e); }
    }

    toast({ title: finalize ? "Inspeção finalizada com sucesso!" : "Rascunho salvo!" });
    setSaving(false);
    if (finalize) navigate("/admin/bookings");
  };

  const steps = [
    { icon: Gauge, label: "Odômetro & Combustível" },
    { icon: Camera, label: "Fotos do Veículo" },
    { icon: AlertTriangle, label: "Avarias" },
    { icon: ClipboardCheck, label: "Acessórios" },
    { icon: PenTool, label: "Assinaturas" },
  ];

  if (loading) {
    return <InspectionSkeleton />;
  }

  if (!booking) {
    return <p className="text-muted-foreground">Reserva não encontrada.</p>;
  }

  const isCompleted = !!existingInspection?.completed_at;
  const failedUploadCount = Object.values(photoUploadStatus).filter((status) => status === "failed").length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Camera-capture inputs — capture="environment" opens rear camera on mobile.
          NOTE: iOS Safari (and standalone PWA) ignore programmatic .click() on
          inputs with display:none. Use sr-only so the input stays in the layout
          tree and the click reliably opens the camera. */}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleFileCapture} />
      <input ref={damageFileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleDamageFile} />
      <input ref={odometerPhotoRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleOdometerPhoto} />
      <input ref={fuelPhotoRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleFuelPhoto} />

      {/* Gallery inputs — no capture attribute → opens file/photo picker (existing photos). */}
      <input ref={fileInputGalRef} type="file" accept="image/*" multiple className="sr-only" onChange={handleFileCapture} />
      <input ref={damageFileGalRef} type="file" accept="image/*" className="sr-only" onChange={handleDamageFile} />
      <input ref={odometerPhotoGalRef} type="file" accept="image/*" className="sr-only" onChange={handleOdometerPhoto} />
      <input ref={fuelPhotoGalRef} type="file" accept="image/*" className="sr-only" onChange={handleFuelPhoto} />

      {/* Source picker: Camera vs. Gallery */}
      <PhotoSourceSheet
        open={!!sourcePicker}
        onClose={() => setSourcePicker(null)}
        onPickCamera={handlePickerCamera}
        onPickGallery={handlePickerGallery}
        title={
          sourcePicker?.kind === "exterior" ? `Foto: ${sourcePicker.position}` :
          sourcePicker?.kind === "damage" ? "Foto da avaria" :
          sourcePicker?.kind === "odometer" ? "Foto do odômetro" :
          sourcePicker?.kind === "fuel" ? "Foto do tanque" : "Adicionar foto"
        }
        allowMultiple={sourcePicker?.kind === "exterior"}
      />


      {/* Webcam dialog — only used on desktop/notebook (no touch). Mobile uses native camera via input capture. */}
      <WebcamCaptureDialog
        open={!!webcamTarget}
        onClose={() => setWebcamTarget(null)}
        onCapture={handleWebcamFile}
        title={webcamTitle}
        stampAddress={inspectionAddress}
      />

      {lightbox && (
        <PhotoLightbox
          items={photos.map((p) => ({ url: p.url, label: p.position }))}
          index={Math.max(0, photos.findIndex((p) => p.url === lightbox.value))}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/bookings")} aria-label="Voltar para reservas">
          <ChevronLeft size={20} />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="admin-h1 text-2xl">
              {type === "checkin" ? "Entrega do Veículo" : "Devolução do Veículo"}
            </h1>
            {isCompleted && (
              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                <CheckCircle2 size={12} className="mr-1" /> Finalizada
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {booking.customer_name} • {vehicle?.name || "Veículo não vinculado"} •{" "}
            {parseDateOnly(booking.pickup_date).toLocaleDateString("pt-BR")} → {parseDateOnly(booking.return_date).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex gap-2">
          {isCompleted && bookingId && (
            <>
              <ShareWhatsAppInspectionButton bookingId={bookingId} type={type} />
              <ShareInspectionButton bookingId={bookingId} type={type} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateInspectionPDF({ type, booking, vehicle, inspection: existingInspection })}
              >
                <Download size={14} className="mr-1" /> PDF
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/admin/inspection/compare/${bookingId}`)}
          >
            <GitCompare size={14} className="mr-1" /> Comparar
          </Button>
        </div>
      </div>

      {/* Booking info card — visível pra equipe na hora da inspeção */}
      <Card className="admin-card border-primary/20">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Retirada</div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={14} className="text-primary shrink-0" />
              <span className="font-medium">{parseDateOnly(booking.pickup_date).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</span>
              {booking.pickup_time && (
                <>
                  <Clock size={14} className="text-primary shrink-0 ml-1" />
                  <span className="font-medium tabular-nums">{booking.pickup_time}</span>
                </>
              )}
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPinIcon size={14} className="text-primary shrink-0 mt-0.5" />
              <span className="break-words">{booking.pickup_location || "Local não informado"}</span>
            </div>
          </div>
          <div className="space-y-2 sm:border-l sm:border-border/60 sm:pl-4">
            <div className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">Devolução</div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={14} className="text-primary shrink-0" />
              <span className="font-medium">{parseDateOnly(booking.return_date).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })}</span>
              {booking.return_time && (
                <>
                  <Clock size={14} className="text-primary shrink-0 ml-1" />
                  <span className="font-medium tabular-nums">{booking.return_time}</span>
                </>
              )}
            </div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPinIcon size={14} className="text-primary shrink-0 mt-0.5" />
              <span className="break-words">{booking.return_location || "Local não informado"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step indicator */}

      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`inline-flex items-center justify-center gap-2 px-4 min-h-[44px] leading-none rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                step === i
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon size={14} className="shrink-0" />
              <span className="leading-none">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* Step 0: Odometer & Fuel */}
      {step === 0 && (
        <div className="space-y-4">
          {/* 1) Inspection location — own card, comes first */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-2">
                <MapPin size={18} className="text-primary shrink-0" />
                <span className="text-sm sm:text-base font-semibold text-foreground">Local da Inspeção</span>
              </div>
              <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight -mt-1">
                Carimbado automaticamente em todas as fotos (data, hora e endereço).
              </p>
              <AddressAutocompleteInput
                value={inspectionAddress}
                onChange={setInspectionAddress}
                placeholder="Digite o endereço da inspeção..."
                disabled={isCompleted}
              />
            </CardContent>
          </Card>

          {/* 2) Odometer & Fuel — photo first (OCR), then editable fields */}
          <Card className="border-border/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Gauge size={20} className="text-primary" /> Odômetro & Combustível
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step A — Dashboard photo (drives auto-fill via OCR) */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Camera size={12} /> 1. Foto do Painel Aceso
                  </label>
                  {ocrLoading && (
                    <span className="flex items-center gap-1 text-[11px] text-primary">
                      <Loader2 size={12} className="animate-spin" /> Analisando com IA…
                    </span>
                  )}
                  {!ocrLoading && ocrResult && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={12} /> Leitura automática
                    </span>
                  )}
                </div>
                {odometerPhoto ? (
                  <div className="relative group">
                    <SignedImage value={odometerPhoto} alt="Painel do veículo" className="w-full h-auto max-h-[360px] object-contain rounded-lg border border-border/40 bg-muted/20" />
                    {!isCompleted && (
                      <div className="absolute inset-x-0 bottom-0 p-2 flex items-center justify-end gap-2 bg-gradient-to-t from-black/60 to-transparent rounded-b-lg">
                        <Button size="sm" variant="secondary" onClick={captureOdometerPhoto} className="h-8 text-xs">
                          <Camera size={12} /> Refazer
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => { setOdometerPhoto(""); setFuelPhoto(""); setOcrResult(null); }} className="h-8 text-xs">
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => !isCompleted && captureOdometerPhoto()}
                    disabled={isCompleted}
                    className="min-h-[200px] rounded-lg border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors p-4 text-center"
                  >
                    <Camera size={28} />
                    <span className="text-sm font-medium">Tirar foto do painel aceso</span>
                    <span className="text-[11px] text-muted-foreground/70">
                      A IA vai ler o odômetro e o nível de combustível automaticamente
                    </span>
                  </button>
                )}
              </div>

              {/* Step B — Auto-filled, editable fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-foreground">2. Leitura do Odômetro (mi)</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={odometer}
                    onChange={(e) => setOdometer(e.target.value)}
                    placeholder={ocrLoading ? "Lendo painel…" : "Ex: 45230"}
                    className="tabular-nums h-12 text-base"
                    disabled={isCompleted}
                  />
                  {ocrResult?.odometer_miles != null && (
                    <span className="text-[11px] text-muted-foreground">
                      Sugerido pela IA: <span className="tabular-nums font-medium text-foreground">{ocrResult.odometer_miles}</span> mi · edite se preciso.
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">3. Nível de Combustível</label>
                    <span className="text-sm font-semibold text-primary tabular-nums">
                      {FUEL_LEVELS.find((f) => f.value === fuelLevel)?.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Fuel size={18} className="text-muted-foreground shrink-0" />
                    <div className="flex-1 h-3 bg-muted/60 rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${FUEL_LEVELS.find((f) => f.value === fuelLevel)?.pct || 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="-mx-1 px-1 overflow-x-auto" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                    <div className="flex gap-1.5 min-w-min pb-1">
                      {FUEL_LEVELS.map((f) => {
                        const active = fuelLevel === f.value;
                        return (
                          <button
                            key={f.value}
                            onClick={() => !isCompleted && setFuelLevel(f.value)}
                            disabled={isCompleted}
                            className={`shrink-0 min-w-[46px] h-9 px-2.5 rounded-full text-xs font-semibold border transition-all tabular-nums ${
                              active
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-background border-border/50 text-muted-foreground active:scale-95"
                            }`}
                          >
                            {f.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {uploading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" /> Foto já disponível. Enviando em segundo plano...
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}


      {/* Step 1: Exterior Photos */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Photo grid */}
          <div className="lg:col-span-2">
            <Card className="border-border/40">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Camera size={20} className="text-primary" /> Fotos do Veículo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PHOTO_POSITIONS.map((pos) => {
                    const photo = photos.find((p) => p.position === pos.name);
                    return (
                      <div key={pos.name} className="relative group">
                        {photo ? (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => setLightbox({ value: photo.url, label: pos.name })}
                            onKeyDown={(e) => { if (e.key === "Enter") setLightbox({ value: photo.url, label: pos.name }); }}
                            className="relative aspect-[4/3] rounded-lg overflow-hidden border border-border/40 cursor-zoom-in"
                          >
                            <SignedImage value={photo.url} alt={pos.name} className="w-full h-full object-contain bg-muted/20" />
                            <PhotoUploadBadge status={photoUploadStatus[photo.url]} />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              {!isCompleted && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={(e) => { e.stopPropagation(); capturePhoto(pos.name); }}
                                    className="h-7 text-xs"
                                  >
                                    <Camera size={12} /> Refazer
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={(e) => { e.stopPropagation(); setPhotos((prev) => prev.filter((p) => p.position !== pos.name)); }}
                                    className="h-7 text-xs"
                                  >
                                    <Trash2 size={12} />
                                  </Button>
                                </>
                              )}
                            </div>
                            <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap">
                              {pos.name}
                            </span>
                            <CheckCircle2 size={16} className="absolute top-1 right-1 text-emerald-400" />
                          </div>
                        ) : (
                          <button
                            onClick={() => { !isCompleted && capturePhoto(pos.name); setActiveGuide(pos.name); }}
                            disabled={isCompleted}
                            className={`aspect-[4/3] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors w-full ${
                              pos.optional ? "border-border/40 bg-muted/20" : "border-border/60"
                            }`}
                          >
                            <PhotoIllustration position={pos.name} />
                            <Camera size={18} />
                            <span className="text-[10px] font-medium leading-tight text-center px-1 whitespace-nowrap">{pos.name}</span>
                            {pos.optional && (
                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 border border-border/40 rounded px-1.5 py-0.5">
                                Se houver
                              </span>
                            )}
                          </button>
                        )}

                        {/* Guide tooltip on hover */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setActiveGuide(activeGuide === pos.name ? null : pos.name); }}
                          className="absolute top-1 left-1 w-5 h-5 rounded-full bg-background/80 border border-border/50 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors z-10"
                          title="Ver instrução"
                        >
                          <Info size={10} />
                        </button>
                      </div>
                    );
                  })}
                </div>
                {uploading && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                    <Loader2 size={14} className="animate-spin" /> Fotos já aparecem na grade. Envio em segundo plano...
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-4">
                  {photos.filter((p) => !p.position.startsWith("__")).length}/{PHOTO_POSITIONS.filter((p) => !p.optional).length} fotos obrigatórias capturadas <span className="text-muted-foreground/60">· estepe opcional</span>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Guide panel */}
          <div className="lg:col-span-1">
            <Card className="border-border/40 sticky top-20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye size={16} className="text-primary" /> Guia de Fotografia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {activeGuide ? (
                  <>
                    <div className="rounded-lg overflow-hidden border border-border/40 bg-muted/30">
                      <div className="relative aspect-[3/2] bg-muted">
                        {PHOTO_REFERENCES[activeGuide] ? (
                          <img
                            src={PHOTO_REFERENCES[activeGuide]}
                            alt={`Exemplo: ${activeGuide}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <PhotoIllustration position={activeGuide} />
                          </div>
                        )}
                        <div className="absolute top-2 left-2 bg-background/90 backdrop-blur px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-medium text-muted-foreground border border-border/40">
                          Exemplo
                        </div>
                      </div>
                      <div className="p-3 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <PhotoIllustration position={activeGuide} />
                          <h4 className="font-semibold text-foreground text-sm">{activeGuide}</h4>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {PHOTO_POSITIONS.find((p) => p.name === activeGuide)?.guide}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Dicas gerais</p>
                      <ul className="text-xs text-muted-foreground space-y-1.5">
                        <li className="flex items-start gap-1.5"><Check size={12} className="text-emerald-500 mt-0.5 shrink-0" /> Boa iluminação (evite sombras fortes)</li>
                        <li className="flex items-start gap-1.5"><Check size={12} className="text-emerald-500 mt-0.5 shrink-0" /> Foto nítida, sem tremidas</li>
                        <li className="flex items-start gap-1.5"><Check size={12} className="text-emerald-500 mt-0.5 shrink-0" /> Enquadre toda a área indicada</li>
                        <li className="flex items-start gap-1.5"><Check size={12} className="text-emerald-500 mt-0.5 shrink-0" /> Mantenha o celular na horizontal</li>
                      </ul>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 space-y-2">
                    <Info size={24} className="mx-auto text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">
                      Clique no <Info size={10} className="inline" /> de qualquer foto para ver as instruções de como tirar a foto corretamente.
                    </p>
                  </div>
                )}

                {/* Quick overview of all positions */}
                <div className="border-t border-border/30 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Sequência recomendada</p>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {photos.filter((p) => !p.position.startsWith("__")).length}/{PHOTO_POSITIONS.filter((p) => !p.optional).length}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {PHOTO_POSITIONS.map((pos, i) => {
                      const done = photos.some((p) => p.position === pos.name);
                      const isActive = activeGuide === pos.name;
                      return (
                        <button
                          key={pos.name}
                          onClick={() => setActiveGuide(pos.name)}
                          className={`w-full flex items-center gap-2.5 p-1.5 pr-2 rounded-md text-[11px] text-left transition-all border ${
                            isActive
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "border-transparent hover:bg-muted/50 hover:border-border/40"
                          }`}
                        >
                          <span className="w-4 text-center text-[10px] font-medium tabular-nums shrink-0">
                            {done ? <CheckCircle2 size={13} className="text-emerald-500" /> : <span className="text-muted-foreground">{i + 1}</span>}
                          </span>
                          <div className="relative w-20 h-16 sm:w-24 sm:h-[72px] rounded-md overflow-hidden bg-muted shrink-0 border border-border/30 flex items-center justify-center">
                            {PHOTO_REFERENCES[pos.name] ? (
                              <img
                                src={PHOTO_REFERENCES[pos.name]}
                                alt=""
                                className={`w-full h-full object-cover transition ${done ? "opacity-60" : ""}`}
                                loading="lazy"
                              />
                            ) : (
                              <div className={done ? "opacity-50" : ""}>
                                <PhotoIllustration position={pos.name} />
                              </div>
                            )}
                          </div>
                          <span className={`flex-1 truncate ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                            {pos.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Step 2: Damages */}
      {step === 2 && (
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle size={20} className="text-primary" /> Mapa de Avarias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Mapa interativo de avarias (vista superior + lateral) */}
            <CarDamageMap
              damageCountByLabel={damages.reduce<Record<string, number>>((acc, d) => {
                acc[d.position] = (acc[d.position] || 0) + 1;
                return acc;
              }, {})}
              onAddDamage={(label) => !isCompleted && addDamage(label)}
              disabled={isCompleted}
              vehicle={vehicle}
            />

            {/* Damage list */}
            {damages.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border/40">
                  <div className="flex items-center gap-2.5">
                    <div className="w-[3px] h-5 bg-primary rounded-full" />
                    <h3 className="admin-section-title text-sm">Avarias Registradas</h3>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-primary/8 border border-primary/25 text-[10px] font-medium tracking-wider uppercase text-primary tabular-nums">
                    {String(damages.length).padStart(2, "0")} {damages.length === 1 ? "Registro" : "Registros"}
                  </span>
                </div>

                <div className="space-y-3">
                  {damages.map((d, idx) => {
                    const severityMeta =
                      d.severity === "heavy"
                        ? { label: "Grave", dot: "bg-rose-500", ring: "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400" }
                        : d.severity === "medium"
                        ? { label: "Moderada", dot: "bg-amber-500", ring: "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400" }
                        : { label: "Leve", dot: "bg-emerald-500", ring: "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400" };
                    const charCount = (d.description || "").length;

                    return (
                      <div
                        key={d.id}
                        className="group relative rounded-xl border border-border/50 bg-card hover:border-primary/30 hover:shadow-[0_4px_20px_-8px_hsl(var(--primary)/0.25)] transition-all duration-200"
                      >
                        {/* Side accent */}
                        <div className="absolute left-0 top-3 bottom-3 w-[2px] bg-gradient-to-b from-primary/60 via-primary/30 to-transparent rounded-full" />

                        <div className="flex flex-col sm:flex-row gap-4 p-4 pl-5">
                          {/* Photo column */}
                          <div className="flex sm:flex-col items-start gap-2 shrink-0">
                            {d.photo_url ? (
                              <div className="relative group/photo">
                                <SignedImage
                                  value={d.photo_url}
                                  alt={`Avaria ${idx + 1}`}
                                  className="w-24 h-24 object-contain rounded-lg border border-border/60 bg-muted/20 shadow-sm"
                                />
                                <PhotoUploadBadge status={photoUploadStatus[d.photo_url]} />
                                {!isCompleted && (
                                  <button
                                    type="button"
                                    onClick={() => captureDamagePhoto(d.id)}
                                    className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/85 backdrop-blur-sm opacity-0 group-hover/photo:opacity-100 transition-opacity"
                                    aria-label="Trocar foto"
                                  >
                                    <span className="flex items-center gap-1.5 text-[10px] font-medium tracking-wider uppercase text-foreground">
                                      <Camera size={12} /> Trocar
                                    </span>
                                  </button>
                                )}
                                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center tabular-nums shadow-sm">
                                  {idx + 1}
                                </span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => captureDamagePhoto(d.id)}
                                disabled={isCompleted}
                                className="relative w-24 h-24 rounded-lg border-2 border-dashed border-border/60 bg-muted/20 hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="Adicionar foto da avaria"
                              >
                                <Camera size={20} className="text-muted-foreground group-hover:text-primary transition-colors" />
                                <span className="text-[10px] font-medium tracking-wider uppercase text-muted-foreground">
                                  Adicionar foto
                                </span>
                                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-muted text-muted-foreground border border-border text-[10px] font-semibold flex items-center justify-center tabular-nums">
                                  {idx + 1}
                                </span>
                              </button>
                            )}
                          </div>

                          {/* Content column */}
                          <div className="flex-1 min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary/8 border border-primary/25 text-[11px] font-medium text-foreground">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                {d.position}
                              </span>

                              <div className={`inline-flex items-center gap-1.5 px-1 py-0.5 rounded-md border ${severityMeta.ring}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${severityMeta.dot} ml-1.5`} />
                                <select
                                  value={d.severity}
                                  onChange={(e) => updateDamage(d.id, "severity", e.target.value)}
                                  disabled={isCompleted}
                                  className="bg-transparent text-[11px] font-medium pr-1 py-0.5 focus:outline-none cursor-pointer appearance-none disabled:cursor-not-allowed"
                                  aria-label="Gravidade da avaria"
                                >
                                  <option value="light">Leve</option>
                                  <option value="medium">Moderada</option>
                                  <option value="heavy">Grave</option>
                                </select>
                              </div>

                              {!isCompleted && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removeDamage(d.id)}
                                  className="h-7 px-2 ml-auto text-muted-foreground hover:text-destructive hover:bg-destructive/8 gap-1.5 text-[11px]"
                                  aria-label="Remover avaria"
                                >
                                  <Trash2 size={12} /> Remover
                                </Button>
                              )}
                            </div>

                            <div className="relative">
                              <Textarea
                                placeholder="Descreva a avaria — localização exata, tamanho aproximado, profundidade, observações relevantes..."
                                value={d.description}
                                onChange={(e) => updateDamage(d.id, "description", e.target.value)}
                                onBlur={(e) => {
                                  const normalized = normalizeDamageText(e.target.value);
                                  if (normalized !== e.target.value) updateDamage(d.id, "description", normalized);
                                }}
                                disabled={isCompleted}
                                maxLength={280}
                                rows={2}
                                className="text-xs resize-none bg-background/60 border-border/60 focus-visible:border-primary/50 focus-visible:ring-primary/15 pr-14 leading-relaxed"
                              />
                              <span className="absolute bottom-1.5 right-2 text-[9px] tracking-wider tabular-nums text-muted-foreground/70">
                                {charCount}/280
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {damages.length === 0 && (
              <div className="text-center py-8 rounded-xl border border-dashed border-border/50 bg-muted/10">
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 size={22} className="text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-foreground">Nenhuma avaria registrada</p>
                <p className="text-[11px] text-muted-foreground mt-1 tracking-wide">
                  Clique nas peças do modelo 3D para registrar
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Accessories */}
      {step === 3 && (
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardCheck size={20} className="text-primary" /> Checklist de Acessórios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(DEFAULT_ACCESSORIES).map(([key, label]) => (
                <label
                  key={key}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                    accessories[key]
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-destructive/30 bg-destructive/5"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={accessories[key] ?? true}
                    onChange={(e) => !isCompleted && setAccessories((prev) => ({ ...prev, [key]: e.target.checked }))}
                    disabled={isCompleted}
                    className="rounded"
                  />
                  <span className="text-sm text-foreground">{label}</span>
                  {accessories[key] ? (
                    <Check size={14} className="ml-auto text-emerald-500" />
                  ) : (
                    <X size={14} className="ml-auto text-destructive" />
                  )}
                </label>
              ))}
            </div>

            <div className="mt-6">
              <label className="text-sm font-medium text-foreground mb-2 block">Observações Gerais</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações adicionais sobre o estado do veículo..."
                rows={4}
                disabled={isCompleted}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Signatures */}
      {step === 4 && (
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PenTool size={20} className="text-primary" /> Assinaturas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Nome do Agente</label>
              <Input
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Nome completo do agente"
                className="max-w-sm"
                disabled={isCompleted}
              />
            </div>

            {/* Agent signature */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">Assinatura do Agente</label>
                {!isCompleted && agentSignature && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => clearCanvas(agentCanvasRef.current!, setAgentSignature)}
                    className="h-7 text-xs"
                  >
                    Limpar
                  </Button>
                )}
              </div>
              {isCompleted && agentSignature ? (
                <img src={agentSignature} alt="Assinatura agente" className="h-24 border rounded-lg bg-white" />
              ) : (
                <canvas
                  ref={agentCanvasRef}
                  role="img"
                  aria-label="Área de assinatura do agente — desenhe sua assinatura com o dedo ou mouse"
                  width={400}
                  height={150}
                  className="border-2 border-dashed border-border/60 rounded-lg bg-white cursor-crosshair touch-none w-full max-w-md"
                  onMouseDown={(e) => startDrawing(e.currentTarget, setIsDrawingAgent)}
                  onMouseMove={(e) => draw(e, e.currentTarget, isDrawingAgent)}
                  onMouseUp={() => stopDrawing(agentCanvasRef.current!, setIsDrawingAgent, setAgentSignature)}
                  onMouseLeave={() => isDrawingAgent && stopDrawing(agentCanvasRef.current!, setIsDrawingAgent, setAgentSignature)}
                  onTouchStart={(e) => { e.preventDefault(); startDrawing(e.currentTarget, setIsDrawingAgent); }}
                  onTouchMove={(e) => { e.preventDefault(); draw(e, e.currentTarget, isDrawingAgent); }}
                  onTouchEnd={() => stopDrawing(agentCanvasRef.current!, setIsDrawingAgent, setAgentSignature)}
                />
              )}
            </div>

            {/* Customer signature */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-foreground">Assinatura do Cliente</label>
                {!isCompleted && customerSignature && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => clearCanvas(customerCanvasRef.current!, setCustomerSignature)}
                    className="h-7 text-xs"
                  >
                    Limpar
                  </Button>
                )}
              </div>
              {isCompleted && customerSignature ? (
                <img src={customerSignature} alt="Assinatura cliente" className="h-24 border rounded-lg bg-white" />
              ) : (
                <canvas
                  ref={customerCanvasRef}
                  role="img"
                  aria-label="Área de assinatura do cliente — desenhe a assinatura com o dedo ou mouse"
                  width={400}
                  height={150}
                  className="border-2 border-dashed border-border/60 rounded-lg bg-white cursor-crosshair touch-none w-full max-w-md"
                  onMouseDown={(e) => startDrawing(e.currentTarget, setIsDrawingCustomer)}
                  onMouseMove={(e) => draw(e, e.currentTarget, isDrawingCustomer)}
                  onMouseUp={() => stopDrawing(customerCanvasRef.current!, setIsDrawingCustomer, setCustomerSignature)}
                  onMouseLeave={() => isDrawingCustomer && stopDrawing(customerCanvasRef.current!, setIsDrawingCustomer, setCustomerSignature)}
                  onTouchStart={(e) => { e.preventDefault(); startDrawing(e.currentTarget, setIsDrawingCustomer); }}
                  onTouchMove={(e) => { e.preventDefault(); draw(e, e.currentTarget, isDrawingCustomer); }}
                  onTouchEnd={() => stopDrawing(customerCanvasRef.current!, setIsDrawingCustomer, setCustomerSignature)}
                />
              )}
            </div>

            <div className="bg-muted/30 rounded-lg p-4 border border-border/30">
              <p className="text-xs text-muted-foreground">
                Ao assinar, ambas as partes declaram estar de acordo com o estado do veículo documentado nesta inspeção,
                incluindo fotos, avarias e acessórios listados acima.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom actions */}
      <div className="flex items-center justify-between gap-3 pb-8">
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Anterior
            </Button>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          {(() => {
            const missing: string[] = [];
            if (!agentName) missing.push("nome do agente");
            if (!agentSignature) missing.push("assinatura do agente");
            if (!customerSignature) missing.push("assinatura do cliente");
            const isLast = step === steps.length - 1;
            return (!isCompleted && isLast && missing.length > 0) ? (
              <p className="text-[11px] text-muted-foreground">Preencha: {missing.join(", ")}.</p>
            ) : null;
          })()}
          {failedUploadCount > 0 ? (
            <p className="text-[11px] text-destructive">{failedUploadCount} foto(s) falharam no envio. Refazer antes de finalizar.</p>
          ) : null}
          <div className="flex gap-2">
            {!isCompleted && (
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving || failedUploadCount > 0}>
                {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Save size={14} className="mr-1" />}
                Salvar Rascunho
              </Button>
            )}
            {step < steps.length - 1 ? (
              <Button onClick={() => setStep(step + 1)}>
                Próximo
              </Button>
            ) : (
              !isCompleted && (
                <Button
                  onClick={() => handleSave(true)}
                  disabled={saving || uploading || failedUploadCount > 0 || !customerSignature || !agentSignature || !agentName}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <CheckCircle2 size={14} className="mr-1" />}
                  Finalizar Inspeção
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
