import { useEffect, useState, useRef } from "react";
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
  Download, GitCompare, Info, Eye
} from "lucide-react";
import { generateInspectionPDF } from "@/utils/inspectionPdf";

type DamageItem = {
  id: string;
  position: string;
  description: string;
  severity: "light" | "medium" | "heavy";
  photoUrl?: string;
};

type ExteriorPhoto = {
  id: string;
  position: string;
  url: string;
};

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
    case "Roda Dianteira Esq.":
    case "Roda Dianteira Dir.":
    case "Roda Traseira Esq.":
    case "Roda Traseira Dir.":
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
    default:
      return carBody(null);
  }
};

const PHOTO_POSITIONS: { name: string; guide: string }[] = [
  { name: "Frente", guide: "Foto centralizada da frente do veículo, mostrando faróis, grade e placa inteiros. Distância: ~2 metros." },
  { name: "Traseira", guide: "Foto centralizada da traseira, mostrando lanternas, placa e para-choque inteiros. Distância: ~2 metros." },
  { name: "Lateral Esquerda", guide: "Foto lateral completa do lado do motorista. Posicione-se no meio do carro. Distância: ~3 metros." },
  { name: "Lateral Direita", guide: "Foto lateral completa do lado do passageiro. Posicione-se no meio do carro. Distância: ~3 metros." },
  { name: "Painel", guide: "Foto do painel/dashboard de frente, mostrando volante, tela e instrumentos. Tire do banco do passageiro." },
  { name: "Banco Dianteiro", guide: "Foto dos bancos dianteiros mostrando estado do estofamento. Tire da porta traseira aberta." },
  { name: "Banco Traseiro", guide: "Foto dos bancos traseiros e assoalho. Tire com a porta traseira aberta." },
  { name: "Porta-Malas", guide: "Foto do porta-malas aberto, mostrando espaço, tapete e estepe (se visível)." },
  { name: "Roda Dianteira Esq.", guide: "Foto focada na roda dianteira esquerda: pneu, calota/roda e suspensão visível." },
  { name: "Roda Dianteira Dir.", guide: "Foto focada na roda dianteira direita: pneu, calota/roda e suspensão visível." },
  { name: "Roda Traseira Esq.", guide: "Foto focada na roda traseira esquerda: pneu, calota/roda e suspensão visível." },
  { name: "Roda Traseira Dir.", guide: "Foto focada na roda traseira direita: pneu, calota/roda e suspensão visível." },
];

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
  spare_tire: "Estepe",
  jack: "Macaco",
  triangle: "Triângulo",
  fire_extinguisher: "Extintor",
  first_aid: "Kit Primeiros Socorros",
  manual: "Manual do Veículo",
  floor_mats: "Tapetes",
  antenna: "Antena",
  hubcaps: "Calotas",
  wiper_blades: "Palhetas",
  charger_cable: "Cabo Carregador",
  sunshade: "Protetor Solar",
};

const CAR_ZONES = [
  { id: "hood", label: "Capô", x: 50, y: 6 },
  { id: "front-bumper", label: "Para-choque Diant.", x: 50, y: 14 },
  { id: "windshield", label: "Para-brisa", x: 50, y: 24 },
  { id: "front-left-fender", label: "Para-lama Diant. Esq.", x: 12, y: 18 },
  { id: "front-right-fender", label: "Para-lama Diant. Dir.", x: 88, y: 18 },
  { id: "front-left-door", label: "Porta Diant. Esq.", x: 10, y: 36 },
  { id: "front-right-door", label: "Porta Diant. Dir.", x: 90, y: 36 },
  { id: "rear-left-door", label: "Porta Tras. Esq.", x: 10, y: 56 },
  { id: "rear-right-door", label: "Porta Tras. Dir.", x: 90, y: 56 },
  { id: "roof", label: "Teto", x: 50, y: 44 },
  { id: "left-mirror", label: "Retrovisor Esq.", x: 18, y: 28 },
  { id: "right-mirror", label: "Retrovisor Dir.", x: 82, y: 28 },
  { id: "rear-left-fender", label: "Para-lama Tras. Esq.", x: 12, y: 72 },
  { id: "rear-right-fender", label: "Para-lama Tras. Dir.", x: 88, y: 72 },
  { id: "trunk", label: "Porta-Malas", x: 50, y: 82 },
  { id: "rear-bumper", label: "Para-choque Tras.", x: 50, y: 92 },
  { id: "rear-window", label: "Vidro Traseiro", x: 50, y: 72 },
];

// Realistic top-down car SVG
const CarDiagramSVG = () => (
  <svg viewBox="0 0 300 500" className="absolute inset-0 w-full h-full" style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.06))" }}>
    {/* Body outline */}
    <path
      d="M150 15 C100 15 72 30 65 55 L58 90 C52 110 48 130 48 155 L45 200 L45 300 L48 345 C48 370 52 390 58 410 L65 445 C72 470 100 485 150 485 C200 485 228 470 235 445 L242 410 C248 390 252 370 252 345 L255 300 L255 200 L252 155 C252 130 248 110 242 90 L235 55 C228 30 200 15 150 15Z"
      fill="hsl(var(--muted) / 0.3)"
      stroke="hsl(var(--border))"
      strokeWidth="2.5"
    />
    {/* Hood lines */}
    <path d="M90 55 L210 55" fill="none" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.5" />
    <path d="M85 75 L215 75" fill="none" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.5" />
    {/* Windshield */}
    <path
      d="M82 100 L218 100 L205 145 L95 145Z"
      fill="hsl(var(--primary) / 0.05)"
      stroke="hsl(var(--primary) / 0.3)"
      strokeWidth="1.5"
    />
    {/* Roof */}
    <rect x="88" y="155" width="124" height="120" rx="8" fill="none" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.4" />
    {/* Rear window */}
    <path
      d="M95 355 L205 355 L218 400 L82 400Z"
      fill="hsl(var(--primary) / 0.05)"
      stroke="hsl(var(--primary) / 0.3)"
      strokeWidth="1.5"
    />
    {/* Trunk lines */}
    <path d="M85 425 L215 425" fill="none" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.5" />
    {/* Front headlights */}
    <ellipse cx="80" cy="42" rx="18" ry="10" fill="hsl(var(--primary) / 0.1)" stroke="hsl(var(--primary) / 0.3)" strokeWidth="1" />
    <ellipse cx="220" cy="42" rx="18" ry="10" fill="hsl(var(--primary) / 0.1)" stroke="hsl(var(--primary) / 0.3)" strokeWidth="1" />
    {/* Rear taillights */}
    <ellipse cx="80" cy="458" rx="18" ry="10" fill="hsl(var(--destructive) / 0.1)" stroke="hsl(var(--destructive) / 0.3)" strokeWidth="1" />
    <ellipse cx="220" cy="458" rx="18" ry="10" fill="hsl(var(--destructive) / 0.1)" stroke="hsl(var(--destructive) / 0.3)" strokeWidth="1" />
    {/* Wheels */}
    <rect x="30" y="95" width="28" height="55" rx="6" fill="hsl(var(--foreground) / 0.08)" stroke="hsl(var(--foreground) / 0.2)" strokeWidth="1.5" />
    <rect x="242" y="95" width="28" height="55" rx="6" fill="hsl(var(--foreground) / 0.08)" stroke="hsl(var(--foreground) / 0.2)" strokeWidth="1.5" />
    <rect x="30" y="345" width="28" height="55" rx="6" fill="hsl(var(--foreground) / 0.08)" stroke="hsl(var(--foreground) / 0.2)" strokeWidth="1.5" />
    <rect x="242" y="345" width="28" height="55" rx="6" fill="hsl(var(--foreground) / 0.08)" stroke="hsl(var(--foreground) / 0.2)" strokeWidth="1.5" />
    {/* Side mirrors */}
    <ellipse cx="40" cy="130" rx="10" ry="7" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1" />
    <ellipse cx="260" cy="130" rx="10" ry="7" fill="hsl(var(--muted))" stroke="hsl(var(--border))" strokeWidth="1" />
    {/* Door handles */}
    <rect x="60" y="185" width="12" height="4" rx="2" fill="hsl(var(--foreground) / 0.15)" />
    <rect x="228" y="185" width="12" height="4" rx="2" fill="hsl(var(--foreground) / 0.15)" />
    <rect x="60" y="275" width="12" height="4" rx="2" fill="hsl(var(--foreground) / 0.15)" />
    <rect x="228" y="275" width="12" height="4" rx="2" fill="hsl(var(--foreground) / 0.15)" />
    {/* Door lines */}
    <path d="M65 160 L65 310" fill="none" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.3" />
    <path d="M235 160 L235 310" fill="none" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.3" />
    <path d="M65 235 L80 235" fill="none" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.3" />
    <path d="M235 235 L220 235" fill="none" stroke="hsl(var(--border))" strokeWidth="1" opacity="0.3" />
    {/* Center label */}
    <text x="150" y="220" textAnchor="middle" fontSize="11" fill="hsl(var(--muted-foreground))" opacity="0.4" fontWeight="bold">VISTA SUPERIOR</text>
  </svg>
);

export default function AdminInspection() {
  const { bookingId } = useParams();
  const [searchParams] = useSearchParams();
  const type = searchParams.get("type") as "checkin" | "checkout";
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
  const [fuelPhoto, setFuelPhoto] = useState("");

  // Guide panel
  const [activeGuide, setActiveGuide] = useState<string | null>(null);

  // Signature canvas refs
  const customerCanvasRef = useRef<HTMLCanvasElement>(null);
  const agentCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawingCustomer, setIsDrawingCustomer] = useState(false);
  const [isDrawingAgent, setIsDrawingAgent] = useState(false);

  // Camera
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [capturePosition, setCapturePosition] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  // Damage photo
  const damageFileRef = useRef<HTMLInputElement>(null);
  const [damagePhotoTarget, setDamagePhotoTarget] = useState<string>("");

  // Odometer/fuel photo refs
  const odometerPhotoRef = useRef<HTMLInputElement>(null);
  const fuelPhotoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, [bookingId]);

  const loadData = async () => {
    if (!bookingId) return;
    setLoading(true);

    const [bookingRes, inspectionRes] = await Promise.all([
      supabase.from("bookings").select("*").eq("id", bookingId).single(),
      supabase.from("vehicle_inspections").select("*").eq("booking_id", bookingId).eq("type", type).maybeSingle(),
    ]);

    if (bookingRes.data) {
      setBooking(bookingRes.data);
      if (bookingRes.data.vehicle_id) {
        const { data: veh } = await supabase.from("vehicles").select("*").eq("id", bookingRes.data.vehicle_id).single();
        setVehicle(veh);
      }
    }

    if (inspectionRes.data) {
      setExistingInspection(inspectionRes.data);
      setOdometer(inspectionRes.data.odometer_reading?.toString() || "");
      setFuelLevel(inspectionRes.data.fuel_level || "full");
      setPhotos((inspectionRes.data.exterior_photos as any[]) || []);
      setDamages((inspectionRes.data.damages as any[]) || []);
      setAccessories(inspectionRes.data.accessories_check as AccessoryCheck || {});
      setNotes(inspectionRes.data.notes || "");
      setAgentName(inspectionRes.data.agent_name || "");
      setCustomerSignature(inspectionRes.data.customer_signature || "");
      setAgentSignature(inspectionRes.data.agent_signature || "");
      // Load extra photos from exterior_photos array
      const extPhotos = (inspectionRes.data.exterior_photos as any[]) || [];
      setOdometerPhoto(extPhotos.find((p: any) => p.position === "__odometer")?.url || "");
      setFuelPhoto(extPhotos.find((p: any) => p.position === "__fuel")?.url || "");
    }

    setLoading(false);
  };

  // Generic upload helper
  const uploadPhoto = async (file: File, tag: string): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `${bookingId}/${type}/${Date.now()}-${tag}.${ext}`;
    const { error } = await supabase.storage.from("inspections").upload(path, file);
    if (error) {
      toast({ title: "Erro ao enviar foto", description: error.message, variant: "destructive" });
      return null;
    }
    const { data: urlData } = supabase.storage.from("inspections").getPublicUrl(path);
    return urlData.publicUrl;
  };

  // -- Photo capture
  const capturePhoto = (position: string) => {
    setCapturePosition(position);
    fileInputRef.current?.click();
  };

  const handleFileCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !capturePosition) return;
    setUploading(true);
    const url = await uploadPhoto(file, capturePosition.replace(/\s/g, "_"));
    if (url) {
      setPhotos((prev) => {
        const filtered = prev.filter((p) => p.position !== capturePosition);
        return [...filtered, { id: crypto.randomUUID(), position: capturePosition, url }];
      });
    }
    setCapturePosition("");
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Odometer photo
  const handleOdometerPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadPhoto(file, "odometro");
    if (url) setOdometerPhoto(url);
    setUploading(false);
    if (odometerPhotoRef.current) odometerPhotoRef.current.value = "";
  };

  // Fuel photo
  const handleFuelPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadPhoto(file, "tanque_combustivel");
    if (url) setFuelPhoto(url);
    setUploading(false);
    if (fuelPhotoRef.current) fuelPhotoRef.current.value = "";
  };

  // -- Damage photo
  const captureDamagePhoto = (damageId: string) => {
    setDamagePhotoTarget(damageId);
    damageFileRef.current?.click();
  };

  const handleDamageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !damagePhotoTarget) return;
    setUploading(true);
    const url = await uploadPhoto(file, `damage-${damagePhotoTarget.substring(0, 8)}`);
    if (url) {
      setDamages((prev) =>
        prev.map((d) => (d.id === damagePhotoTarget ? { ...d, photoUrl: url } : d))
      );
    }
    setDamagePhotoTarget("");
    setUploading(false);
    if (damageFileRef.current) damageFileRef.current.value = "";
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
      customer_signature: customerSignature,
      agent_signature: agentSignature,
      agent_name: agentName,
      completed_at: finalize ? new Date().toISOString() : null,
    };

    let error;
    if (existingInspection) {
      ({ error } = await supabase.from("vehicle_inspections").update(payload).eq("id", existingInspection.id));
    } else {
      ({ error } = await supabase.from("vehicle_inspections").insert(payload));
    }

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: finalize ? "Inspeção finalizada com sucesso!" : "Rascunho salvo!" });
      if (finalize) navigate("/admin/bookings");
    }
    setSaving(false);
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Hidden file inputs — capture="environment" opens rear camera on mobile */}
      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileCapture} />
      <input ref={damageFileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleDamageFile} />
      <input ref={odometerPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleOdometerPhoto} />
      <input ref={fuelPhotoRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFuelPhoto} />

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/bookings")}>
          <ChevronLeft size={20} />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">
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
            {new Date(booking.pickup_date).toLocaleDateString("pt-BR")} → {new Date(booking.return_date).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex gap-2">
          {isCompleted && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateInspectionPDF({ type, booking, vehicle, inspection: existingInspection })}
            >
              <Download size={14} className="mr-1" /> PDF
            </Button>
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

      {/* Step indicator */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                step === i
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon size={14} />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Step 0: Odometer & Fuel */}
      {step === 0 && (
        <Card className="border-border/40">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Gauge size={20} className="text-primary" /> Odômetro & Combustível
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Odometer column */}
              <div className="flex flex-col gap-4">
                <label className="text-sm font-medium text-foreground">Leitura do Odômetro (mi)</label>
                <Input
                  type="number"
                  inputMode="numeric"
                  value={odometer}
                  onChange={(e) => setOdometer(e.target.value)}
                  placeholder="Ex: 45230"
                  className="tabular-nums"
                  disabled={isCompleted}
                />
                <div className="flex-1 flex flex-col">
                  <label className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Camera size={12} /> Foto do Odômetro
                  </label>
                  {odometerPhoto ? (
                    <div className="relative group flex-1">
                      <img src={odometerPhoto} alt="Odômetro" className="w-full h-full min-h-[180px] object-cover rounded-lg border border-border/40" />
                      {!isCompleted && (
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => odometerPhotoRef.current?.click()} className="h-7 text-xs">
                            <Camera size={12} /> Refazer
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setOdometerPhoto("")} className="h-7 text-xs">
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => !isCompleted && odometerPhotoRef.current?.click()}
                      disabled={isCompleted || uploading}
                      className="flex-1 min-h-[180px] rounded-lg border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      <Camera size={24} />
                      <span className="text-xs font-medium">Tirar foto do odômetro</span>
                      <span className="text-[10px] text-muted-foreground/70">Focalize o painel mostrando a milhagem claramente</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Fuel column */}
              <div className="flex flex-col gap-4">
                <label className="text-sm font-medium text-foreground">Nível de Combustível</label>
                <div className="flex items-center gap-3">
                  <Fuel size={20} className="text-muted-foreground shrink-0" />
                  <div className="flex-1 h-9 bg-muted/50 rounded-full overflow-hidden relative">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${FUEL_LEVELS.find((f) => f.value === fuelLevel)?.pct || 0}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground min-w-[50px] text-right">
                    {FUEL_LEVELS.find((f) => f.value === fuelLevel)?.label}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {FUEL_LEVELS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => !isCompleted && setFuelLevel(f.value)}
                      disabled={isCompleted}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        fuelLevel === f.value
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "border-border/40 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1 flex flex-col">
                  <label className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <Camera size={12} /> Foto do Tanque de Combustível
                  </label>
                  {fuelPhoto ? (
                    <div className="relative group flex-1">
                      <img src={fuelPhoto} alt="Combustível" className="w-full h-full min-h-[180px] object-cover rounded-lg border border-border/40" />
                      {!isCompleted && (
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => fuelPhotoRef.current?.click()} className="h-7 text-xs">
                            <Camera size={12} /> Refazer
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => setFuelPhoto("")} className="h-7 text-xs">
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => !isCompleted && fuelPhotoRef.current?.click()}
                      disabled={isCompleted || uploading}
                      className="flex-1 min-h-[180px] rounded-lg border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      <Camera size={24} />
                      <span className="text-xs font-medium">Tirar foto do indicador de combustível</span>
                      <span className="text-[10px] text-muted-foreground/70">Focalize o painel mostrando o nível do tanque</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {uploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" /> Enviando foto...
              </div>
            )}
          </CardContent>
        </Card>
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
                          <div className="relative aspect-[4/3] rounded-lg overflow-hidden border border-border/40">
                            <img src={photo.url} alt={pos.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              {!isCompleted && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => capturePhoto(pos.name)}
                                    className="h-7 text-xs"
                                  >
                                    <Camera size={12} /> Refazer
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => setPhotos((prev) => prev.filter((p) => p.position !== pos.name))}
                                    className="h-7 text-xs"
                                  >
                                    <Trash2 size={12} />
                                  </Button>
                                </>
                              )}
                            </div>
                            <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
                              {pos.name}
                            </span>
                            <CheckCircle2 size={16} className="absolute top-1 right-1 text-emerald-400" />
                          </div>
                        ) : (
                          <button
                            onClick={() => { !isCompleted && capturePhoto(pos.name); setActiveGuide(pos.name); }}
                            disabled={isCompleted || uploading}
                            className="aspect-[4/3] rounded-lg border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors w-full"
                          >
                            <PhotoIllustration position={pos.name} />
                            <Camera size={18} />
                            <span className="text-[10px] font-medium leading-tight text-center px-1">{pos.name}</span>
                          </button>
                        )}
                        {/* Guide tooltip on hover */}
                        <button
                          onClick={() => setActiveGuide(activeGuide === pos.name ? null : pos.name)}
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
                    <Loader2 size={14} className="animate-spin" /> Enviando foto...
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-4">
                  {photos.filter((p) => !p.position.startsWith("__")).length}/{PHOTO_POSITIONS.length} fotos capturadas
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
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <PhotoIllustration position={activeGuide} />
                        <h4 className="font-semibold text-foreground text-sm">{activeGuide}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {PHOTO_POSITIONS.find((p) => p.name === activeGuide)?.guide}
                      </p>
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
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-2">Sequência recomendada</p>
                  <div className="space-y-1">
                    {PHOTO_POSITIONS.map((pos, i) => {
                      const done = photos.some((p) => p.position === pos.name);
                      return (
                        <button
                          key={pos.name}
                          onClick={() => setActiveGuide(pos.name)}
                          className={`w-full flex items-center gap-2 px-2 py-1 rounded text-[11px] text-left transition-colors ${
                            activeGuide === pos.name ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
                          }`}
                        >
                          <span className="w-4 text-center">{done ? <CheckCircle2 size={12} className="text-emerald-500" /> : <span className="text-muted-foreground">{i + 1}</span>}</span>
                          <span className="w-5 shrink-0"><PhotoIllustration position={pos.name} /></span>
                          <span className={done ? "text-muted-foreground line-through" : "text-foreground"}>{pos.name}</span>
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
            {/* Realistic car diagram */}
            <div className="relative bg-muted/20 rounded-xl p-4 border border-border/30">
              <p className="text-xs text-muted-foreground mb-2 text-center">Clique na zona do veículo para registrar uma avaria</p>
              <div className="relative mx-auto" style={{ width: "300px", height: "500px" }}>
                <CarDiagramSVG />
                {/* Clickable damage zones */}
                {CAR_ZONES.map((zone) => {
                  const zoneDamages = damages.filter((d) => d.position === zone.label);
                  const hasDamage = zoneDamages.length > 0;
                  return (
                    <button
                      key={zone.id}
                      onClick={() => !isCompleted && addDamage(zone.label)}
                      disabled={isCompleted}
                      className={`absolute flex items-center justify-center rounded-full transition-all z-10 ${
                        hasDamage
                          ? "w-8 h-8 -ml-4 -mt-4 bg-destructive/25 text-destructive border-2 border-destructive/60 shadow-lg shadow-destructive/20"
                          : "w-6 h-6 -ml-3 -mt-3 bg-primary/10 text-primary/50 border border-primary/20 hover:bg-primary/25 hover:scale-125 hover:text-primary"
                      }`}
                      style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
                      title={zone.label}
                    >
                      {hasDamage ? (
                        <span className="text-[10px] font-bold">{zoneDamages.length}</span>
                      ) : (
                        <span className="text-[10px]">+</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Zone legend */}
              <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-primary/10 border border-primary/20 inline-block" /> Sem avaria</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-destructive/25 border-2 border-destructive/60 inline-block" /> Com avaria</span>
              </div>
            </div>

            {/* Damage list */}
            {damages.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-foreground">Avarias Registradas ({damages.length})</h3>
                {damages.map((d) => (
                  <div key={d.id} className="flex gap-3 p-3 rounded-lg bg-muted/30 border border-border/30">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{d.position}</Badge>
                        <select
                          value={d.severity}
                          onChange={(e) => updateDamage(d.id, "severity", e.target.value)}
                          disabled={isCompleted}
                          className="text-xs bg-background border border-border/40 rounded px-2 py-1 text-foreground"
                        >
                          <option value="light">Leve</option>
                          <option value="medium">Moderada</option>
                          <option value="heavy">Grave</option>
                        </select>
                      </div>
                      <Input
                        placeholder="Descreva a avaria..."
                        value={d.description}
                        onChange={(e) => updateDamage(d.id, "description", e.target.value)}
                        disabled={isCompleted}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      {d.photoUrl ? (
                        <img src={d.photoUrl} alt="Avaria" className="w-16 h-16 object-cover rounded border" />
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => captureDamagePhoto(d.id)}
                          disabled={isCompleted}
                          className="h-16 w-16 flex-col text-[9px]"
                        >
                          <Camera size={14} />
                          Foto
                        </Button>
                      )}
                      {!isCompleted && (
                        <Button size="sm" variant="ghost" onClick={() => removeDamage(d.id)} className="h-6 text-destructive">
                          <Trash2 size={12} />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {damages.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                <CheckCircle2 size={24} className="mx-auto mb-2 text-emerald-500" />
                Nenhuma avaria registrada
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
        <div className="flex gap-2">
          {!isCompleted && (
            <Button variant="outline" onClick={() => handleSave(false)} disabled={saving}>
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
                disabled={saving || !customerSignature || !agentSignature || !agentName}
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
  );
}
