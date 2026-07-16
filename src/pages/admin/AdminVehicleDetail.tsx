import { useEffect, useState, useMemo, useCallback } from "react";
import { parseDateOnly } from "@/lib/dateOnly";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChevronLeft, Loader2, Car, DollarSign, Gauge, Calendar,
  Users, AlertTriangle, CheckCircle2, Clock,
  BarChart3, MapPin, FileText, Settings, Pencil, X,
  Hash, Palette, StickyNote, CalendarDays,
  Plus, Wrench, Shield, CircleAlert, TrendingDown, TrendingUp,
  Trash2, Activity, Heart, AlertCircle, Ban, ImageIcon, Upload, Star, ArrowLeft, ArrowRight, ArrowUpToLine, Maximize2, ChevronRight, Camera, Paperclip, ExternalLink, Briefcase
} from "lucide-react";
import { getCoverImage } from "@/data/vehicleImages";
import { coverImageMap } from "@/data/fleetAssets";
import { useLanguage } from "@/i18n/LanguageContext";
import { EmptyState } from "@/components/admin/EmptyState";
import { Receipt, ShieldCheck, ChevronDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { VehicleEpassTolls } from "@/components/admin/vehicle/VehicleEpassTolls";
import VehicleAgenda from "@/components/admin/VehicleAgenda";
import PricingPanel from "@/components/admin/pricing/PricingPanel";
import { VehicleDetailSkeleton } from "@/components/skeletons/DetailSkeletons";
import { SignedImage } from "@/components/admin/SignedImage";
import { getSignedInspectionUrl } from "@/lib/inspectionStorage";
import { useConfirm } from "@/components/mobile/ConfirmSheet";

// ─── Types ────────────────────────────────────────────────────────────
type Vehicle = {
  id: string; name: string; category: string; daily_price_usd: number;
  image_url: string | null; passengers: number; bags: number;
  transmission: string; fuel: string; year: number | null; status: string;
  features: string[] | null; purchase_price: number | null;
  initial_odometer: number | null; current_odometer: number | null;
  acquired_date: string | null; license_plate: string | null;
  vin: string | null; color: string | null; notes: string | null;
  bouncie_imei: string | null;
  e_pass_transponder: string | null;
  bouncie_vin: string | null;
  created_at: string; engine_type: string | null; engine_size: string | null;
  doors: number | null; insurance_policy: string | null;
  insurance_expiry: string | null; registration_expiry: string | null;
  last_service_date: string | null; next_service_km: number | null;
  tire_condition: string | null; brake_condition: string | null;
  battery_condition: string | null; body_condition: string | null;
  photos: string[] | null;
  listed_on_turo?: boolean | null;
};

type Expense = {
  id: string; vehicle_id: string; type: string; amount: number;
  expense_date: string; description: string | null; supplier: string | null;
  is_recurring: boolean | null; receipt_url: string | null; created_at: string;
};

type Incident = {
  id: string; vehicle_id: string; booking_id: string | null;
  type: string; severity: string; status: string; title: string;
  description: string | null; incident_date: string;
  estimated_cost: number | null; actual_cost: number | null;
  resolution_notes: string | null; resolved_at: string | null;
  created_at: string;
};

type BookingWithInspections = {
  id: string; customer_name: string; customer_email: string | null;
  pickup_date: string; return_date: string; pickup_location: string | null;
  return_location: string | null; pickup_time: string | null; return_time: string | null;
  total_price: number | null;
  status: string; created_at: string; checkin?: any; checkout?: any;
};

// ─── Config Maps ──────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30" },
  confirmed: { label: "Confirmada", color: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  active: { label: "Ativa", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
  in_progress: { label: "Em andamento", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  completed: { label: "Concluída", color: "bg-muted text-muted-foreground border-border" },
  cancelled: { label: "Cancelada", color: "bg-destructive/10 text-destructive border-destructive/30" },
};

const vehicleStatusConfig: Record<string, { label: string; color: string }> = {
  available: { label: "Disponível", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  rented: { label: "Alugado", color: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  maintenance: { label: "Manutenção", color: "bg-yellow-500/15 text-yellow-600 border-yellow-500/30" },
  unavailable: { label: "Indisponível", color: "bg-destructive/15 text-destructive border-destructive/30" },
};

const expenseTypeLabels: Record<string, { label: string; icon: any }> = {
  maintenance: { label: "Manutenção", icon: Wrench },
  insurance: { label: "Seguro", icon: Shield },
  fine: { label: "Multa", icon: AlertCircle },
  fuel: { label: "Combustível", icon: Car },
  documentation: { label: "Documentação", icon: FileText },
  parts: { label: "Peças", icon: Settings },
  cleaning: { label: "Limpeza", icon: Activity },
  other: { label: "Outros", icon: DollarSign },
};

const incidentTypeLabels: Record<string, string> = {
  accident: "Acidente", breakdown: "Quebra", theft: "Furto/Roubo",
  vandalism: "Vandalismo", recall: "Recall", other: "Outros",
};

const severityLabels: Record<string, { label: string; color: string }> = {
  low: { label: "Baixa", color: "bg-blue-500/10 text-blue-500" },
  medium: { label: "Média", color: "bg-yellow-500/10 text-yellow-600" },
  high: { label: "Alta", color: "bg-orange-500/10 text-orange-600" },
  critical: { label: "Crítica", color: "bg-destructive/10 text-destructive" },
};

const incidentStatusLabels: Record<string, { label: string; color: string }> = {
  open: { label: "Aberta", color: "bg-red-500/10 text-red-500" },
  in_progress: { label: "Em andamento", color: "bg-amber-500/10 text-amber-600" },
  resolved: { label: "Resolvida", color: "bg-emerald-500/10 text-emerald-600" },
  closed: { label: "Fechada", color: "bg-muted text-muted-foreground" },
};

const conditionLabels: Record<string, { label: string; color: string }> = {
  excellent: { label: "Excelente", color: "text-emerald-500" },
  good: { label: "Bom", color: "text-blue-500" },
  fair: { label: "Regular", color: "text-yellow-600" },
  poor: { label: "Ruim", color: "text-orange-500" },
  critical: { label: "Crítico", color: "text-destructive" },
};

// ─── Component ────────────────────────────────────────────────────────
export default function AdminVehicleDetail() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useLanguage();
  const confirm = useConfirm();
  const [loading, setLoading] = useState(true);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(searchParams.get("tab") ?? "agenda");
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [bookings, setBookings] = useState<BookingWithInspections[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [editingDetails, setEditingDetails] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Vehicle>>({});
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [expenseForm, setExpenseForm] = useState<{ type: string; amount: number; expense_date: string; description: string; supplier: string; is_recurring: boolean; receipt_url: string }>({ type: "maintenance", amount: 0, expense_date: new Date().toISOString().split("T")[0], description: "", supplier: "", is_recurring: false, receipt_url: "" });
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [incidentForm, setIncidentForm] = useState({ type: "breakdown", severity: "low", title: "", description: "", incident_date: new Date().toISOString().split("T")[0], estimated_cost: 0 });

  useEffect(() => { loadData(); }, [vehicleId]);

  const handleTabChange = (v: string) => {
    setActiveTab(v);
    const next = new URLSearchParams(searchParams);
    next.set("tab", v);
    setSearchParams(next, { replace: true });
  };

  const loadData = async () => {
    if (!vehicleId) return;
    setLoading(true);
    const [vRes, bRes, iRes, eRes, incRes] = await Promise.all([
      supabase.from("vehicles").select("*").eq("id", vehicleId).single(),
      supabase.from("bookings").select("*").eq("vehicle_id", vehicleId).order("pickup_date", { ascending: false }),
      supabase.from("vehicle_inspections").select("*").order("created_at", { ascending: false }),
      supabase.from("vehicle_expenses").select("*").eq("vehicle_id", vehicleId).order("expense_date", { ascending: false }),
      supabase.from("vehicle_incidents").select("*").eq("vehicle_id", vehicleId).neq("linked_to_vehicle", false).order("incident_date", { ascending: false }),
    ]);
    if (vRes.data) { setVehicle(vRes.data as Vehicle); setEditForm(vRes.data as Vehicle); }
    const allInspections = iRes.data || [];
    setBookings((bRes.data || []).map((b: any) => ({
      ...b,
      checkin: allInspections.find((i: any) => i.booking_id === b.id && i.type === "checkin"),
      checkout: allInspections.find((i: any) => i.booking_id === b.id && i.type === "checkout"),
    })));
    setExpenses((eRes.data || []) as Expense[]);
    setIncidents((incRes.data || []) as Incident[]);
    setLoading(false);
  };

  const saveDetails = async () => {
    if (!vehicle) return;
    const { error } = await supabase.from("vehicles").update({
      purchase_price: editForm.purchase_price || 0,
      initial_odometer: editForm.initial_odometer || 0,
      current_odometer: editForm.current_odometer || 0,
      acquired_date: editForm.acquired_date || null,
      license_plate: editForm.license_plate || null,
      vin: editForm.vin || null,
      color: editForm.color || null,
      bouncie_imei: editForm.bouncie_imei ? String(editForm.bouncie_imei).trim() || null : null,
      e_pass_transponder: editForm.e_pass_transponder ? String(editForm.e_pass_transponder).trim() || null : null,
      
      notes: editForm.notes || null,
      engine_type: editForm.engine_type || null,
      engine_size: editForm.engine_size || null,
      doors: editForm.doors || 4,
      insurance_policy: editForm.insurance_policy || null,
      insurance_expiry: editForm.insurance_expiry || null,
      registration_expiry: editForm.registration_expiry || null,
      last_service_date: editForm.last_service_date || null,
      next_service_km: editForm.next_service_km || null,
      tire_condition: editForm.tire_condition || "good",
      brake_condition: editForm.brake_condition || "good",
      battery_condition: editForm.battery_condition || "good",
      body_condition: editForm.body_condition || "good",
      listed_on_turo: !!editForm.listed_on_turo,
    }).eq("id", vehicle.id);
    if (error) { toast({ title: "Erro ao salvar", variant: "destructive" }); }
    else { toast({ title: "Dados atualizados!" }); setEditingDetails(false); loadData(); }
  };

  const uploadReceipt = async (file: File | null | undefined) => {
    if (!file || !vehicleId) return;
    setUploadingReceipt(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `expenses/${vehicleId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("inspections").upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      // Store path; render-time helpers (SignedImage / getSignedInspectionUrl) resolve to signed URL.
      setExpenseForm(prev => ({ ...prev, receipt_url: path }));
      toast({ title: "Comprovante anexado" });
    } catch (e: any) {
      toast({ title: "Erro ao enviar comprovante", description: e.message, variant: "destructive" });
    } finally {
      setUploadingReceipt(false);
    }
  };

  const addExpense = async () => {
    if (!vehicleId) return;
    const { error } = await supabase.from("vehicle_expenses").insert({
      vehicle_id: vehicleId, ...expenseForm,
    } as any);
    if (error) { toast({ title: "Erro ao adicionar gasto", variant: "destructive" }); }
    else {
      toast({ title: "Gasto registrado!" });
      setShowExpenseForm(false);
      setExpenseForm({ type: "maintenance", amount: 0, expense_date: new Date().toISOString().split("T")[0], description: "", supplier: "", is_recurring: false, receipt_url: "" });
      loadData();
    }
  };

  const deleteExpense = async (id: string) => {
    const ok = await confirm({ title: "Excluir este gasto?", confirmLabel: "Excluir", variant: "destructive" });
    if (!ok) return;
    await supabase.from("vehicle_expenses").delete().eq("id", id);
    toast({ title: "Gasto excluído" }); loadData();
  };

  const addIncident = async () => {
    if (!vehicleId || !incidentForm.title) { toast({ title: "Título obrigatório", variant: "destructive" }); return; }
    const { error } = await supabase.from("vehicle_incidents").insert({
      vehicle_id: vehicleId, ...incidentForm, status: "open",
    } as any);
    if (error) { toast({ title: "Erro ao abrir ocorrência", variant: "destructive" }); }
    else {
      toast({ title: "Ocorrência aberta!" });
      setShowIncidentForm(false);
      setIncidentForm({ type: "breakdown", severity: "low", title: "", description: "", incident_date: new Date().toISOString().split("T")[0], estimated_cost: 0 });
      loadData();
    }
  };

  const updateIncidentStatus = async (id: string, status: string) => {
    const update: any = { status };
    if (status === "resolved" || status === "closed") update.resolved_at = new Date().toISOString();
    await supabase.from("vehicle_incidents").update(update).eq("id", id);
    toast({ title: "Status atualizado" }); loadData();
  };

  const deleteIncident = async (id: string) => {
    const ok = await confirm({ title: "Excluir esta ocorrência?", confirmLabel: "Excluir", variant: "destructive" });
    if (!ok) return;
    await supabase.from("vehicle_incidents").delete().eq("id", id);
    toast({ title: "Ocorrência excluída" }); loadData();
  };

  const uploadPhotos = async (files: FileList | null) => {
    if (!files || !vehicle) return;
    setUploadingPhotos(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${vehicle.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("vehicle-photos").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (error) { toast({ title: "Erro no upload", description: error.message, variant: "destructive" }); continue; }
      const { data } = supabase.storage.from("vehicle-photos").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    if (urls.length === 0) { setUploadingPhotos(false); return; }
    const next = [...((vehicle.photos as string[]) || []), ...urls];
    const updates: any = { photos: next };
    if (!vehicle.image_url) updates.image_url = urls[0];
    const { error } = await supabase.from("vehicles").update(updates).eq("id", vehicle.id);
    setUploadingPhotos(false);
    if (error) { toast({ title: "Erro ao salvar", variant: "destructive" }); return; }
    setVehicle({ ...vehicle, photos: next, image_url: vehicle.image_url || urls[0] });
    toast({ title: `${urls.length} foto(s) adicionada(s)` });
  };

  const removePhoto = async (url: string) => {
    if (!vehicle) return;
    const ok = await confirm({ title: "Remover esta foto?", confirmLabel: "Remover", variant: "destructive" });
    if (!ok) return;
    const next = ((vehicle.photos as string[]) || []).filter(p => p !== url);
    const newCover = vehicle.image_url === url ? (next[0] || null) : vehicle.image_url;
    const updates: any = { photos: next, image_url: newCover };
    const { error } = await supabase.from("vehicles").update(updates).eq("id", vehicle.id);
    const marker = "/vehicle-photos/";
    const idx = url.indexOf(marker);
    if (idx >= 0) {
      const path = url.substring(idx + marker.length);
      supabase.storage.from("vehicle-photos").remove([path]);
    }
    if (error) { toast({ title: "Erro ao remover", variant: "destructive" }); return; }
    setVehicle({ ...vehicle, photos: next, image_url: newCover });
    toast({ title: "Foto removida" });
  };

  const setAsCover = async (url: string) => {
    if (!vehicle) return;
    const { error } = await supabase.from("vehicles").update({ image_url: url }).eq("id", vehicle.id);
    if (error) { toast({ title: "Erro", variant: "destructive" }); return; }
    setVehicle({ ...vehicle, image_url: url });
    toast({ title: "Capa atualizada" });
  };

  const reorderPhotos = async (fromIdx: number, toIdx: number) => {
    if (!vehicle) return;
    const arr = [...((vehicle.photos as string[]) || [])];
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= arr.length || toIdx >= arr.length || fromIdx === toIdx) return;
    const [moved] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, moved);
    setVehicle({ ...vehicle, photos: arr });
    const { error } = await supabase.from("vehicles").update({ photos: arr }).eq("id", vehicle.id);
    if (error) toast({ title: "Erro ao reordenar", variant: "destructive" });
  };



  if (loading) return <VehicleDetailSkeleton />;
  if (!vehicle) return <p className="text-muted-foreground">Veículo não encontrado.</p>;

  // ─── Computed ────────────────
  const totalRevenue = bookings.reduce((s, b) => s + (b.total_price || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalIncidentCost = incidents.reduce((s, i) => s + (i.actual_cost || i.estimated_cost || 0), 0);
  const totalCost = (vehicle.purchase_price || 0) + totalExpenses + totalIncidentCost;
  const netProfit = totalRevenue - totalExpenses - totalIncidentCost;
  const completedBookings = bookings.filter(b => b.status === "completed");
  const totalDays = bookings.reduce((s, b) => {
    const d = Math.ceil((parseDateOnly(b.return_date).getTime() - parseDateOnly(b.pickup_date).getTime()) / 86400000);
    return s + Math.max(d, 1);
  }, 0);
  const daysSinceAcquired = vehicle.acquired_date ? Math.ceil((Date.now() - new Date(vehicle.acquired_date).getTime()) / 86400000) : null;
  const utilizationRate = daysSinceAcquired && daysSinceAcquired > 0 ? Math.min(((totalDays / daysSinceAcquired) * 100), 100).toFixed(1) : null;

  const inspectionsWithOdometer = bookings
    .filter(b => b.checkin?.odometer_reading || b.checkout?.odometer_reading)
    .sort((a, b) => parseDateOnly(a.pickup_date).getTime() - parseDateOnly(b.pickup_date).getTime());
  const lastOdometer = inspectionsWithOdometer.length > 0
    ? inspectionsWithOdometer[inspectionsWithOdometer.length - 1]?.checkout?.odometer_reading || inspectionsWithOdometer[inspectionsWithOdometer.length - 1]?.checkin?.odometer_reading
    : vehicle.current_odometer;
  const kmTotal = lastOdometer && vehicle.initial_odometer ? lastOdometer - vehicle.initial_odometer : null;

  const totalDamages = bookings.reduce((s, b) => s + ((b.checkout?.damages as any[])?.length || 0), 0);
  const openIncidents = incidents.filter(i => i.status === "open" || i.status === "in_progress").length;

  const vs = vehicleStatusConfig[vehicle.status] || vehicleStatusConfig.unavailable;

  // Health score (0-100)
  const conditionScore = (c: string | null) => ({ excellent: 100, good: 80, fair: 50, poor: 25, critical: 0 }[c || "good"] ?? 80);
  const healthScore = Math.round(
    (conditionScore(vehicle.tire_condition) + conditionScore(vehicle.brake_condition) +
     conditionScore(vehicle.battery_condition) + conditionScore(vehicle.body_condition)) / 4
  );
  const healthColor = healthScore >= 80 ? "text-emerald-500" : healthScore >= 50 ? "text-yellow-600" : "text-destructive";

  // Timeline
  const timelineEvents: { date: string; icon: any; title: string; desc: string; color: string }[] = [];
  if (vehicle.acquired_date) {
    timelineEvents.push({ date: vehicle.acquired_date, icon: Car, title: "Veículo adquirido",
      desc: `Entrou na frota com ${vehicle.initial_odometer?.toLocaleString("pt-BR") || 0} mi${vehicle.purchase_price ? ` • $${vehicle.purchase_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}`,
      color: "text-primary" });
  }
  bookings.sort((a, b) => parseDateOnly(a.pickup_date).getTime() - parseDateOnly(b.pickup_date).getTime()).forEach(b => {
    const sc = statusConfig[b.status] || statusConfig.pending;
    timelineEvents.push({ date: b.pickup_date, icon: Calendar, title: `Locação. ${b.customer_name}`,
      desc: `${parseDateOnly(b.pickup_date).toLocaleDateString("pt-BR")} → ${parseDateOnly(b.return_date).toLocaleDateString("pt-BR")}${b.total_price ? ` • $${b.total_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""} • ${sc.label}`,
      color: b.status === "completed" ? "text-emerald-500" : b.status === "active" || b.status === "in_progress" ? "text-blue-500" : "text-muted-foreground" });
  });
  expenses.forEach(e => {
    const et = expenseTypeLabels[e.type] || expenseTypeLabels.other;
    timelineEvents.push({ date: e.expense_date, icon: et.icon, title: `${et.label}. $${e.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      desc: e.description || e.supplier || "", color: "text-orange-500" });
  });
  incidents.forEach(i => {
    timelineEvents.push({ date: i.incident_date, icon: AlertTriangle, title: i.title,
      desc: `${incidentTypeLabels[i.type] || i.type} • ${severityLabels[i.severity]?.label || i.severity}`,
      color: i.severity === "critical" || i.severity === "high" ? "text-destructive" : "text-yellow-600" });
  });
  // Ordena cronologicamente e descarta eventos anteriores à aquisição (incoerentes)
  timelineEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  if (vehicle.acquired_date) {
    const acqTs = new Date(vehicle.acquired_date).getTime();
    const acqIdx = timelineEvents.findIndex((ev) => ev.title === "Veículo adquirido");
    const filtered = timelineEvents.filter((ev, i) => i === acqIdx || new Date(ev.date).getTime() >= acqTs);
    timelineEvents.length = 0;
    timelineEvents.push(...filtered);
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/fleet")} aria-label="Voltar para frota" className="mt-1"><ChevronLeft size={20} /></Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="admin-h1 text-2xl">{vehicle.name}</h1>
            <Badge variant="outline" className={vs.color}>{vs.label}</Badge>
            {openIncidents > 0 && (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 flex items-center gap-1">
                <AlertTriangle size={11} /> {openIncidents} ocorrência(s) aberta(s)
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {vehicle.category} • {vehicle.year} • {vehicle.transmission === "Automatic" ? "Automático" : "Manual"} • {vehicle.fuel}
            {vehicle.color && ` • ${vehicle.color}`} {vehicle.license_plate && ` • ${vehicle.license_plate}`}
          </p>
        </div>
      </div>

      {/* KPI Cards. Primary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: DollarSign, label: "Receita Total", value: `$${totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, sub: `${bookings.length} locações`, color: "text-emerald-500" },
          { icon: TrendingDown, label: "Custo Total", value: `$${totalCost.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, sub: `Compra + gastos + ocorrências`, color: "text-orange-500" },
          { icon: netProfit >= 0 ? TrendingUp : TrendingDown, label: "Lucro Líquido", value: `$${netProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, sub: vehicle.purchase_price ? `ROI: ${((netProfit / vehicle.purchase_price) * 100).toFixed(1)}%` : "", color: netProfit >= 0 ? "text-emerald-500" : "text-destructive" },
          { icon: Heart, label: "Saúde do Veículo", value: `${healthScore}/100`, sub: healthScore >= 80 ? "Excelente estado" : healthScore >= 50 ? "Atenção necessária" : "Estado crítico", color: healthColor },
        ].map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={i} className="border-border/40">
              <CardContent className="p-4 h-full min-h-[128px] flex flex-col items-center justify-center text-center gap-2">
                <div className="flex items-center justify-center gap-2">
                  <Icon size={14} className={s.color} />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{s.label}</span>
                </div>
                <p className="text-base sm:text-lg font-medium text-foreground leading-tight tabular-nums">{s.value}</p>
                <p className="text-[11px] text-muted-foreground truncate max-w-full">{s.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* KPI Cards. Secondary (collapsible no mobile) */}
      <details className="group sm:open:!block" open={typeof window !== "undefined" && window.innerWidth >= 640}>
        <summary className="sm:hidden flex items-center justify-between gap-2 cursor-pointer list-none px-4 h-10 rounded-lg border border-border/40 bg-card/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/30 transition-colors">
          <span className="flex items-center gap-2"><BarChart3 size={13} className="text-primary" /> Métricas operacionais</span>
          <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3 sm:mt-0">
          {[
            { icon: Gauge, label: "Odômetro Entrada", value: vehicle.initial_odometer ? `${vehicle.initial_odometer.toLocaleString("pt-BR")} mi` : "" },
            { icon: Gauge, label: "Odômetro Atual", value: lastOdometer ? `${lastOdometer.toLocaleString("pt-BR")} mi` : "" },
            { icon: Car, label: "Milhas Rodadas", value: kmTotal ? `${kmTotal.toLocaleString("pt-BR")} mi` : "" },
            { icon: Calendar, label: "Na Frota", value: daysSinceAcquired ? `${daysSinceAcquired} dias` : "" },
            { icon: BarChart3, label: "Ocupação", value: utilizationRate ? `${utilizationRate}%` : "" },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <Card key={i} className="border-border/40">
                <CardContent className="p-3 h-full min-h-[88px] flex flex-col items-center justify-center text-center gap-1.5">
                  <div className="flex items-center justify-center gap-1.5">
                    <Icon size={12} className="text-primary" />
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">{s.label}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground tabular-nums">{s.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </details>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="-mx-4 sm:mx-0 overflow-x-auto scrollbar-none">
          <TabsList className="bg-muted/50 inline-flex sm:flex sm:flex-wrap h-auto gap-1 p-1 min-w-max sm:min-w-0 mx-4 sm:mx-0">
            <TabsTrigger value="agenda" className="whitespace-nowrap">Agenda</TabsTrigger>
            <TabsTrigger value="photos" className="whitespace-nowrap">Fotos</TabsTrigger>
            <TabsTrigger value="health" className="whitespace-nowrap">Saúde</TabsTrigger>
            <TabsTrigger value="expenses" className="whitespace-nowrap">Gastos</TabsTrigger>
            <TabsTrigger value="incidents" className="whitespace-nowrap">Ocorrências</TabsTrigger>
            <TabsTrigger value="tolls" className="whitespace-nowrap">Pedágios</TabsTrigger>
            
            <TabsTrigger value="history" className="whitespace-nowrap">Locações</TabsTrigger>
            <TabsTrigger value="pricing" className="whitespace-nowrap">Precificação</TabsTrigger>
            <TabsTrigger value="details" className="whitespace-nowrap">Ficha Técnica</TabsTrigger>
          </TabsList>
        </div>

        {/* ── Agenda Tab ── */}
        <TabsContent value="agenda" className="mt-4">
          <VehicleAgenda bookings={bookings} />
        </TabsContent>

        {/* ── Photos Tab ── */}
        <TabsContent value="photos" className="mt-4 space-y-4">
          {(() => {
            const photos = (vehicle.photos as string[]) || [];
            const cover = vehicle.image_url || photos[0] || "";

            const handleDrop = (e: React.DragEvent) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files?.length) uploadPhotos(e.dataTransfer.files);
            };

            return (
              <>
                {/* HERO: Capa + Upload zone lado a lado */}
                <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                  {/* Capa */}
                  <Card className="hidden sm:block border-border/40 lg:col-span-3 overflow-hidden">
                    <CardContent className="p-0">
                      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-2 border-b border-border/40">
                        <div className="flex items-center gap-2">
                          <Star size={14} className="text-primary" />
                          <h3 className="font-medium text-foreground text-sm">Capa atual</h3>
                        </div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Exibida no site e cards</span>
                      </div>
                      {cover ? (
                        <button
                          onClick={() => {
                            const i = photos.findIndex(p => p === cover);
                            setLightboxIdx(i >= 0 ? i : 0);
                          }}
                          className="relative w-full aspect-video bg-black group block"
                        >
                          <img src={cover} alt={vehicle.name} className="w-full h-full object-contain" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                            <div className="bg-background/90 text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5">
                              <Maximize2 size={12} /> Ampliar
                            </div>
                          </div>
                        </button>
                      ) : (
                        <div className="aspect-video flex flex-col items-center justify-center gap-2 text-muted-foreground bg-muted/20">
                          <ImageIcon size={36} className="opacity-40" />
                          <p className="text-sm font-medium">Nenhuma capa definida</p>
                          <p className="text-xs opacity-70">Envie fotos e marque uma como capa</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Upload zone */}
                  <Card className="border-border/40 lg:col-span-2">
                    <CardContent className="p-5 h-full flex flex-col">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-foreground text-sm flex items-center gap-2">
                          <Upload size={14} className="text-primary" /> Enviar fotos
                        </h3>
                        <span className="text-[10px] text-muted-foreground">{photos.length} {photos.length === 1 ? "foto" : "fotos"}</span>
                      </div>
                      <label
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        className={`flex-1 min-h-[180px] flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors px-4 py-6 text-center ${
                          uploadingPhotos ? "border-primary/60 bg-primary/5 cursor-wait" :
                          dragOver ? "border-primary bg-primary/10 cursor-pointer" : "border-border/60 bg-muted/20 hover:bg-muted/30 hover:border-primary/60 cursor-pointer"
                        }`}
                      >
                        {uploadingPhotos ? (
                          <>
                            <Loader2 size={28} className="text-primary animate-spin" />
                            <p className="text-sm font-semibold text-foreground">Enviando fotos…</p>
                            <p className="text-[11px] text-muted-foreground">Aguarde, não feche a página</p>
                          </>
                        ) : (
                          <>
                            <Upload size={28} className={dragOver ? "text-primary" : "text-muted-foreground"} />
                            <p className="text-sm font-semibold text-foreground">Arraste fotos aqui</p>
                            <p className="text-[11px] text-muted-foreground">ou clique para selecionar do dispositivo</p>
                            <p className="text-[10px] text-muted-foreground mt-1">JPG, PNG ou WEBP. múltiplos arquivos</p>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          disabled={uploadingPhotos}
                          className="hidden"
                          onChange={(e) => { uploadPhotos(e.target.files); e.target.value = ""; }}
                        />
                      </label>
                    </CardContent>
                  </Card>
                </div>


                {/* GALERIA */}
                <Card className="border-border/40">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                      <div>
                        <h3 className="font-medium text-foreground text-sm flex items-center gap-2">
                          <ImageIcon size={14} className="text-primary" /> Galeria completa
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Arraste as fotos para reordenar. Clique numa foto para ampliar.
                        </p>
                      </div>
                    </div>

                    {photos.length === 0 ? (
                      <EmptyState
                        icon={ImageIcon}
                        title="Nenhuma foto enviada"
                        description="Use a área de upload acima para enviar fotos do veículo."
                        compact
                      />
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                        {photos.map((url, idx) => {
                          const isCover = vehicle.image_url === url;
                          const isDragging = draggedIdx === idx;
                          const isDropTarget = dragOverIdx === idx && draggedIdx !== null && draggedIdx !== idx;
                          return (
                            <div
                              key={url}
                              draggable
                              onDragStart={(e) => {
                                setDraggedIdx(idx);
                                e.dataTransfer.effectAllowed = "move";
                                try { e.dataTransfer.setData("text/plain", String(idx)); } catch {}
                              }}
                              onDragOver={(e) => {
                                if (draggedIdx === null) return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                if (dragOverIdx !== idx) setDragOverIdx(idx);
                              }}
                              onDragLeave={() => { if (dragOverIdx === idx) setDragOverIdx(null); }}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (draggedIdx !== null && draggedIdx !== idx) reorderPhotos(draggedIdx, idx);
                                setDraggedIdx(null);
                                setDragOverIdx(null);
                              }}
                              onDragEnd={() => { setDraggedIdx(null); setDragOverIdx(null); }}
                              className={`group relative rounded-xl overflow-hidden border bg-card shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${
                                isDragging ? "opacity-40 border-primary" :
                                isDropTarget ? "border-primary ring-2 ring-primary/40 scale-[1.02]" :
                                "border-border/40 hover:border-primary/40"
                              }`}
                            >
                              <button
                                onClick={() => setLightboxIdx(idx)}
                                className="relative block w-full aspect-square bg-muted/30 overflow-hidden"
                              >
                                <img
                                  src={url}
                                  alt={`Foto ${idx + 1}`}
                                  draggable={false}
                                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105 pointer-events-none"
                                  loading="lazy"
                                  decoding="async"
                                />
                                <div className="absolute top-2 left-2 flex flex-col gap-1">
                                  <span className="bg-background/95 text-foreground text-[10px] font-medium px-1.5 py-0.5 rounded-md shadow-sm">
                                    #{idx + 1}
                                  </span>
                                  {isCover && (
                                    <span className="bg-primary text-primary-foreground text-[9px] font-medium px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-sm">
                                      <Star size={9} fill="currentColor" /> CAPA
                                    </span>
                                  )}
                                </div>
                                <div className="absolute bottom-2 right-2 w-7 h-7 rounded-md bg-background/90 text-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                                  <Maximize2 size={12} />
                                </div>
                              </button>

                              <div className="flex items-center justify-end gap-0.5 px-2 py-1.5 border-t border-border/40 bg-card">
                                {!isCover && (
                                  <button
                                    onClick={() => setAsCover(url)}
                                    className="w-7 h-7 rounded-md hover:bg-primary/10 text-primary flex items-center justify-center transition-colors"
                                    title="Definir como capa"
                                  >
                                    <Star size={13} />
                                  </button>
                                )}
                                <button
                                  onClick={() => removePhoto(url)}
                                  className="w-7 h-7 rounded-md hover:bg-destructive/10 text-destructive flex items-center justify-center transition-colors"
                                  title="Remover foto"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* LIGHTBOX */}
                {lightboxIdx !== null && photos[lightboxIdx] && (
                  <div
                    className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 sm:p-8"
                    onClick={() => setLightboxIdx(null)}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); setLightboxIdx(null); }}
                      className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                      aria-label="Fechar"
                    >
                      <X size={20} />
                    </button>
                    {lightboxIdx > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }}
                        className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                        aria-label="Anterior"
                      >
                        <ChevronLeft size={22} />
                      </button>
                    )}
                    {lightboxIdx < photos.length - 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); }}
                        className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                        aria-label="Próxima"
                      >
                        <ChevronRight size={22} />
                      </button>
                    )}
                    <img
                      src={photos[lightboxIdx]}
                      alt={`Foto ${lightboxIdx + 1}`}
                      className="max-w-full max-h-full object-contain select-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/10 text-white text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur">
                      {lightboxIdx + 1} / {photos.length}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </TabsContent>


        {/* ── Health Tab ── */}
        <TabsContent value="health" className="mt-4 space-y-4">
          <Card className="border-border/40">
            <CardContent className="p-6">
              <h3 className="font-medium text-foreground flex items-center gap-2 mb-4">
                <Heart size={16} className={healthColor} /> Condição Geral. {healthScore}/100
              </h3>
              <div className="w-full h-3 rounded-full bg-muted overflow-hidden mb-6">
                <div className={`h-full rounded-full transition-all duration-700 ${healthScore >= 80 ? "bg-emerald-500" : healthScore >= 50 ? "bg-yellow-500" : "bg-destructive"}`}
                  style={{ width: `${healthScore}%` }} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Pneus", key: "tire_condition" },
                  { label: "Freios", key: "brake_condition" },
                  { label: "Bateria", key: "battery_condition" },
                  { label: "Carroceria", key: "body_condition" },
                ].map(item => {
                  const val = (vehicle as any)[item.key] || "good";
                  const cl = conditionLabels[val] || conditionLabels.good;
                  return (
                    <div key={item.key} className="text-center p-4 rounded-lg border border-border/30 bg-card/50">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">{item.label}</p>
                      <p className={`text-sm font-medium ${cl.color}`}>{cl.label}</p>
                      <div className="mt-2 w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${conditionScore(val) >= 80 ? "bg-emerald-500" : conditionScore(val) >= 50 ? "bg-yellow-500" : "bg-destructive"}`}
                          style={{ width: `${conditionScore(val)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Maintenance info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="border-border/40">
              <CardContent className="p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Última Revisão</p>
                <p className="font-medium text-foreground">{vehicle.last_service_date ? new Date(vehicle.last_service_date).toLocaleDateString("pt-BR") : ""}</p>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardContent className="p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Próxima Revisão (mi)</p>
                <p className="font-medium text-foreground">{vehicle.next_service_km ? `${vehicle.next_service_km.toLocaleString("pt-BR")} mi` : ""}</p>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardContent className="p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Avarias em Locações</p>
                <p className="font-medium text-foreground">{totalDamages} registradas</p>
              </CardContent>
            </Card>
          </div>

          {/* Quick stats */}
          <Card className="border-border/40">
            <CardContent className="p-6">
              <h3 className="font-medium text-foreground mb-4">Resumo de Gastos por Categoria</h3>
              {expenses.length === 0 ? <EmptyState icon={Receipt} title="Nenhum gasto registrado" description="Registre manutenções, combustível e outros custos operacionais deste veículo." compact /> : (
                <div className="space-y-2">
                  {Object.entries(expenses.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + e.amount; return acc; }, {} as Record<string, number>))
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, total]) => {
                      const et = expenseTypeLabels[type] || expenseTypeLabels.other;
                      const Icon = et.icon;
                      const pct = totalExpenses > 0 ? (total / totalExpenses * 100) : 0;
                      return (
                        <div key={type} className="flex items-center gap-3">
                          <Icon size={14} className="text-muted-foreground shrink-0" />
                          <span className="text-xs text-foreground w-24">{et.label}</span>
                          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full bg-primary/60" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-medium text-foreground tabular-nums w-24 text-right">${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Expenses Tab ── */}
        <TabsContent value="expenses" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">Gastos do Veículo</h3>
            <Button size="sm" onClick={() => setShowExpenseForm(true)} className="gold-gradient text-primary-foreground">
              <Plus size={14} className="mr-1" /> Novo Gasto
            </Button>
          </div>

          {/* Expense Form Modal */}
          {showExpenseForm && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowExpenseForm(false)}>
              <div className="bg-card rounded-xl border border-border/50 shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-foreground">Registrar Gasto</h3>
                  <button onClick={() => setShowExpenseForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Tipo</label>
                    <select value={expenseForm.type} onChange={e => setExpenseForm({ ...expenseForm, type: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground">
                      {Object.entries(expenseTypeLabels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Valor (USD)</label>
                    <input type="number" inputMode="decimal" placeholder="0,00" value={expenseForm.amount || ""} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value === "" ? 0 : Number(e.target.value) })} className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground tabular-nums" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Data</label>
                    <input type="date" value={expenseForm.expense_date} onChange={e => setExpenseForm({ ...expenseForm, expense_date: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Descrição</label>
                    <input value={expenseForm.description} onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Fornecedor</label>
                    <input value={expenseForm.supplier} onChange={e => setExpenseForm({ ...expenseForm, supplier: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Comprovante / Nota</label>
                    {expenseForm.receipt_url ? (
                      <div className="relative rounded-lg border border-border/60 bg-muted/30 p-2 flex items-center gap-2">
                        {/\.(jpg|jpeg|png|webp|gif)$/i.test(expenseForm.receipt_url) ? (
                          <SignedImage value={expenseForm.receipt_url} alt="Comprovante" className="w-14 h-14 object-cover rounded-md border border-border/40" />
                        ) : (
                          <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center text-primary"><Paperclip size={18} /></div>
                        )}
                        <button
                          type="button"
                          onClick={async () => {
                            const u = await getSignedInspectionUrl(expenseForm.receipt_url);
                            if (u) window.open(u, "_blank", "noopener,noreferrer");
                          }}
                          className="flex-1 min-w-0 text-left text-xs font-medium text-foreground truncate hover:text-primary flex items-center gap-1"
                        >
                          Ver anexo <ExternalLink size={11} />
                        </button>
                        <button type="button" onClick={() => setExpenseForm({ ...expenseForm, receipt_url: "" })} className="w-7 h-7 rounded-md hover:bg-destructive/10 text-destructive flex items-center justify-center transition-colors" title="Remover">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <label className={`flex items-center justify-center gap-2 h-10 rounded-lg border border-border/60 bg-background text-sm text-foreground cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors ${uploadingReceipt ? "opacity-50 pointer-events-none" : ""}`}>
                          <Paperclip size={14} /> Anexar
                          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => uploadReceipt(e.target.files?.[0])} />
                        </label>
                        <label className={`flex items-center justify-center gap-2 h-10 rounded-lg border border-border/60 bg-background text-sm text-foreground cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors ${uploadingReceipt ? "opacity-50 pointer-events-none" : ""}`}>
                          <Camera size={14} /> Câmera
                          <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => uploadReceipt(e.target.files?.[0])} />
                        </label>
                      </div>
                    )}
                    {uploadingReceipt && <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> Enviando…</p>}
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input type="checkbox" checked={expenseForm.is_recurring} onChange={e => setExpenseForm({ ...expenseForm, is_recurring: e.target.checked })} className="rounded" />
                    Gasto recorrente
                  </label>
                  <Button onClick={addExpense} className="w-full gold-gradient text-primary-foreground">Registrar</Button>
                </div>
              </div>
            </div>
          )}

          {expenses.length === 0 ? (
            <Card className="border-border/40"><CardContent className="p-0"><EmptyState icon={Receipt} title="Nenhum gasto registrado" description="Registre manutenções, combustível e outros custos operacionais deste veículo." compact /></CardContent></Card>
          ) : (
            <div className="space-y-2">
              {expenses.map(e => {
                const et = expenseTypeLabels[e.type] || expenseTypeLabels.other;
                const Icon = et.icon;
                return (
                  <Card key={e.id} className="border-border/40">
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Icon size={16} className="text-primary" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm">{et.label}</span>
                          {e.is_recurring && <Badge variant="outline" className="text-[9px]">Recorrente</Badge>}
                          {e.receipt_url && (
                            <button
                              type="button"
                              onClick={async () => {
                                const u = await getSignedInspectionUrl(e.receipt_url);
                                if (u) window.open(u, "_blank", "noopener,noreferrer");
                              }}
                              className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
                              title="Ver comprovante"
                            >
                              <Paperclip size={10} /> Nota
                            </button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{e.description || e.supplier || ""}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-foreground">${e.amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(e.expense_date).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <button onClick={() => deleteExpense(e.id)} className="text-muted-foreground/30 hover:text-destructive transition-colors"><Trash2 size={14} /></button>
                    </CardContent>
                  </Card>
                );
              })}
              <div className="pt-2 border-t border-border/30 flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">Total de Gastos</span>
                <span className="text-lg font-medium text-foreground">${totalExpenses.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Incidents Tab ── */}
        <TabsContent value="incidents" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-foreground">Ocorrências</h3>
            <Button size="sm" onClick={() => setShowIncidentForm(true)} className="bg-destructive/90 text-destructive-foreground hover:bg-destructive">
              <Plus size={14} className="mr-1" /> Nova Ocorrência
            </Button>
          </div>

          {/* Incident Form Modal */}
          {showIncidentForm && (
            <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowIncidentForm(false)}>
              <div className="bg-card rounded-xl border border-border/50 shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-foreground">Abrir Ocorrência</h3>
                  <button onClick={() => setShowIncidentForm(false)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Título</label>
                    <input value={incidentForm.title} onChange={e => setIncidentForm({ ...incidentForm, title: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground" placeholder="Ex: Pneu furado na I-4" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Tipo</label>
                      <select value={incidentForm.type} onChange={e => setIncidentForm({ ...incidentForm, type: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground">
                        {Object.entries(incidentTypeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Severidade</label>
                      <select value={incidentForm.severity} onChange={e => setIncidentForm({ ...incidentForm, severity: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground">
                        {Object.entries(severityLabels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Data</label>
                    <input type="date" value={incidentForm.incident_date} onChange={e => setIncidentForm({ ...incidentForm, incident_date: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Descrição</label>
                    <textarea value={incidentForm.description} onChange={e => setIncidentForm({ ...incidentForm, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm text-foreground resize-none" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Custo Estimado (USD)</label>
                    <input type="number" inputMode="decimal" placeholder="0,00" value={incidentForm.estimated_cost || ""} onChange={e => setIncidentForm({ ...incidentForm, estimated_cost: e.target.value === "" ? 0 : Number(e.target.value) })} className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground tabular-nums" />
                  </div>
                  <Button onClick={addIncident} className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90">Abrir Ocorrência</Button>
                </div>
              </div>
            </div>
          )}

          {incidents.length === 0 ? (
            <Card className="border-border/40"><CardContent className="p-0"><EmptyState icon={ShieldCheck} title="Nenhuma ocorrência registrada" description="Ocorrências como avarias, multas e sinistros serão listadas aqui." compact /></CardContent></Card>
          ) : (
            <div className="space-y-2">
              {incidents.map(inc => {
                const sev = severityLabels[inc.severity] || severityLabels.low;
                const st = incidentStatusLabels[inc.status] || incidentStatusLabels.open;
                return (
                  <Card key={inc.id} className="border-border/40">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${sev.color}`}>
                          <AlertTriangle size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground text-sm">{inc.title}</span>
                            <Badge variant="outline" className={`text-[9px] ${sev.color}`}>{sev.label}</Badge>
                            <Badge variant="outline" className={`text-[9px] ${st.color}`}>{st.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{incidentTypeLabels[inc.type]} • {new Date(inc.incident_date).toLocaleDateString("pt-BR")}</p>
                          {inc.description && <p className="text-xs text-muted-foreground mt-1">{inc.description}</p>}
                          {inc.resolution_notes && <p className="text-xs text-emerald-600 mt-1">✓ {inc.resolution_notes}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          {(inc.estimated_cost || 0) > 0 && <p className="font-medium text-foreground text-sm">${(inc.actual_cost || inc.estimated_cost || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/20">
                        <select value={inc.status} onChange={e => updateIncidentStatus(inc.id, e.target.value)}
                          className={`text-[10px] font-semibold rounded-md px-2 py-1 border cursor-pointer ${st.color}`}>
                          {Object.entries(incidentStatusLabels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                        <div className="flex-1" />
                        <button onClick={() => deleteIncident(inc.id)} className="text-muted-foreground/30 hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>




        {/* ── Tolls Tab ── */}
        <TabsContent value="tolls" className="mt-4">
          <VehicleEpassTolls vehicleId={vehicleId!} />
        </TabsContent>

        {/* ── History Tab ── */}
        <TabsContent value="history" className="mt-4">
          {bookings.length === 0 ? (
            <Card className="border-border/40"><CardContent className="p-0"><EmptyState icon={Car} title="Nenhuma locação registrada" description="O histórico de locações deste veículo será exibido aqui." compact /></CardContent></Card>
          ) : (
            <div className="space-y-3">
              {bookings.map(b => {
                const days = Math.ceil((parseDateOnly(b.return_date).getTime() - parseDateOnly(b.pickup_date).getTime()) / 86400000);
                const sc = statusConfig[b.status] || statusConfig.pending;
                const kmDriven = b.checkin?.odometer_reading && b.checkout?.odometer_reading ? b.checkout.odometer_reading - b.checkin.odometer_reading : null;
                return (
                  <Card key={b.id} className="border-border/40 hover:border-primary/20 transition-colors cursor-pointer" onClick={() => navigate(`/admin/bookings/${b.id}`)}>
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-foreground">{b.customer_name}</span>
                            <Badge variant="outline" className={`text-[10px] ${sc.color}`}>{sc.label}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Calendar size={11} />{parseDateOnly(b.pickup_date).toLocaleDateString("pt-BR")} → {parseDateOnly(b.return_date).toLocaleDateString("pt-BR")}</span>
                            <span>{days} dia(s)</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-center">
                            <p className="text-[10px] text-muted-foreground">Valor</p>
                            <p className="font-medium text-foreground">${b.total_price?.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) || ""}</p>
                          </div>
                          {kmDriven !== null && <div className="text-center"><p className="text-[10px] text-muted-foreground">Milhas</p><p className="font-medium text-foreground">{kmDriven.toLocaleString("pt-BR")}</p></div>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Precificação ── */}
        <TabsContent value="pricing" className="mt-4">
          {vehicle && (
            <PricingPanel
              vehicleId={vehicle.id}
              basePrice={Number((vehicle as any).daily_price_usd) || 0}
              onBasePriceSaved={(next) =>
                setVehicle({ ...(vehicle as any), daily_price_usd: next } as any)
              }
            />
          )}
        </TabsContent>

        {/* ── Details / Ficha Técnica ── */}
        <TabsContent value="details" className="mt-4">
          <Card className="border-border/40">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-medium text-foreground flex items-center gap-2"><Settings size={16} className="text-primary" /> Ficha Completa do Veículo</h3>
                {!editingDetails ? (
                  <Button variant="outline" size="sm" onClick={() => { setEditForm(vehicle); setEditingDetails(true); }}><Pencil size={12} className="mr-1" /> Editar</Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setEditingDetails(false)}><X size={12} className="mr-1" /> Cancelar</Button>
                    <Button size="sm" onClick={saveDetails} className="gold-gradient text-primary-foreground">Salvar</Button>
                  </div>
                )}
              </div>

              {/* Identification */}
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 mt-2">Identificação</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {renderField("Placa", "license_plate", "text")}
                {renderField("Chassi (VIN)", "vin", "text")}
                {renderField("Cor", "color", "text")}
                {renderField("IMEI Bouncie", "bouncie_imei", "text")}
                {renderField("E-Pass Transponder", "e_pass_transponder", "text")}
              </div>
              <p className="text-[11px] text-muted-foreground -mt-4 mb-6">IMEI Bouncie: rastreador (Users & Devices no portal). E-Pass: tag de pedágio para controle de cobranças.</p>

              {/* Comercial */}
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Comercial</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {renderField("Diária (USD)", "daily_price_usd", "number", v => v != null ? `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 0 })}` : "")}
                {renderField("Caução padrão (USD)", "default_deposit_amount", "number", v => v != null ? `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 0 })}` : "")}
                {renderField("Franquia padrão (USD)", "default_franchise_amount", "number", v => v != null ? `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 0 })}` : "")}
              </div>
              <div className="mb-6">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Listado na Turo</p>
                {editingDetails ? (
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none h-10 px-3 rounded-lg border border-border/60 bg-background">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={!!editForm.listed_on_turo}
                      onChange={e => setEditForm({ ...editForm, listed_on_turo: e.target.checked })}
                    />
                    <span className="text-sm font-medium text-foreground">
                      {editForm.listed_on_turo ? "Listado na Turo" : "Não listado na Turo"}
                    </span>
                  </label>
                ) : (
                  <Badge variant="outline" className={vehicle.listed_on_turo
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                    : "bg-muted text-muted-foreground border-border"}>
                    {vehicle.listed_on_turo ? "Listado na Turo" : "Não listado na Turo"}
                  </Badge>
                )}
              </div>

              {/* Financial */}
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Financeiro</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {renderField("Valor de Compra (USD)", "purchase_price", "number", v => v ? `$${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "")}
                {renderField("Data de Aquisição", "acquired_date", "date", v => v ? new Date(v).toLocaleDateString("pt-BR") : "")}
                {renderField("Apólice de Seguro", "insurance_policy", "text")}
              </div>

              {/* Odometer */}
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Odômetro</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {renderField("Odômetro Aquisição (mi)", "initial_odometer", "number", v => v ? `${Number(v).toLocaleString("pt-BR")} mi` : "")}
                {renderField("Odômetro Atual (mi)", "current_odometer", "number", v => v ? `${Number(v).toLocaleString("pt-BR")} mi` : "")}
                {renderField("Próxima Revisão (mi)", "next_service_km", "number", v => v ? `${Number(v).toLocaleString("pt-BR")} mi` : "")}
              </div>

              {/* Technical */}
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Mecânica</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {renderField("Motor", "engine_type", "text")}
                {renderField("Cilindrada", "engine_size", "text")}
                {renderField("Portas", "doors", "number")}
                {renderField("Última Revisão", "last_service_date", "date", v => v ? new Date(v).toLocaleDateString("pt-BR") : "")}
              </div>

              {/* Documents */}
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Documentação</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {renderField("Vencimento Seguro", "insurance_expiry", "date", v => v ? new Date(v).toLocaleDateString("pt-BR") : "")}
                {renderField("Vencimento Registro", "registration_expiry", "date", v => v ? new Date(v).toLocaleDateString("pt-BR") : "")}
              </div>

              {/* Condition */}
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Condição dos Componentes</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                {renderConditionField("Pneus", "tire_condition")}
                {renderConditionField("Freios", "brake_condition")}
                {renderConditionField("Bateria", "battery_condition")}
                {renderConditionField("Carroceria", "body_condition")}
              </div>

              {/* Notes */}
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Observações</h4>
              {editingDetails ? (
                <textarea value={editForm.notes ?? ""} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border/60 bg-background text-sm text-foreground resize-none" />
              ) : (
                <p className="text-sm text-foreground">{vehicle.notes || ""}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );

  function renderField(label: string, key: string, type: string, format?: (v: any) => string) {
    return (
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
        {editingDetails ? (
          <input type={type} value={(editForm as any)[key] ?? ""}
            onChange={e => setEditForm({ ...editForm, [key]: type === "number" ? Number(e.target.value) : e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
        ) : (
          <p className="text-sm font-medium text-foreground">{format ? format((vehicle as any)[key]) : ((vehicle as any)[key] || "")}</p>
        )}
      </div>
    );
  }

  function renderConditionField(label: string, key: string) {
    const val = (vehicle as any)[key] || "good";
    const cl = conditionLabels[val] || conditionLabels.good;
    return (
      <div className="space-y-1">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</label>
        {editingDetails ? (
          <select value={(editForm as any)[key] || "good"}
            onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}
            className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground">
            {Object.entries(conditionLabels).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        ) : (
          <p className={`text-sm font-medium ${cl.color}`}>{cl.label}</p>
        )}
      </div>
    );
  }
}
