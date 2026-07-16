import { useEffect, useState } from "react";
import { parseDateOnly } from "@/lib/dateOnly";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, Gauge, Fuel, Camera, AlertTriangle, ClipboardCheck,
  PenTool, ArrowRight, Loader2, CheckCircle2, XCircle, Download
} from "lucide-react";
import { generateInspectionPDF } from "@/utils/inspectionPdf";
import { SignedImage } from "@/components/admin/SignedImage";

const FUEL_LABELS: Record<string, string> = {
  empty: "Vazio", "1/8": "1/8", "1/4": "1/4", "3/8": "3/8",
  "1/2": "1/2", "5/8": "5/8", "3/4": "3/4", "7/8": "7/8", full: "Cheio",
};

const FUEL_PCT: Record<string, number> = {
  empty: 0, "1/8": 12.5, "1/4": 25, "3/8": 37.5,
  "1/2": 50, "5/8": 62.5, "3/4": 75, "7/8": 87.5, full: 100,
};

const ACCESSORIES_LABELS: Record<string, string> = {
  jack: "Macaco", antenna: "Antena", first_aid: "Kit Primeiros Socorros",
  spare_tire: "Estepe", triangle: "Triângulo", floor_mats: "Tapetes",
  fire_extinguisher: "Extintor",
};

const SEVERITY_LABELS: Record<string, string> = {
  light: "Leve", medium: "Moderada", heavy: "Grave",
};

export default function AdminInspectionCompare() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<any>(null);
  const [vehicle, setVehicle] = useState<any>(null);
  const [checkin, setCheckin] = useState<any>(null);
  const [checkout, setCheckout] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [bookingId]);

  const loadData = async () => {
    if (!bookingId) return;
    setLoading(true);
    const [bRes, ciRes, coRes] = await Promise.all([
      supabase.from("bookings").select("*").eq("id", bookingId).single(),
      supabase.from("vehicle_inspections").select("*").eq("booking_id", bookingId).eq("type", "checkin").maybeSingle(),
      supabase.from("vehicle_inspections").select("*").eq("booking_id", bookingId).eq("type", "checkout").maybeSingle(),
    ]);
    setBooking(bRes.data);
    setCheckin(ciRes.data);
    setCheckout(coRes.data);

    if (bRes.data?.vehicle_id) {
      const { data: v } = await supabase.from("vehicles").select("*").eq("id", bRes.data.vehicle_id).single();
      setVehicle(v);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const odometerDiff = checkin?.odometer_reading && checkout?.odometer_reading
    ? checkout.odometer_reading - checkin.odometer_reading : null;

  const fuelDiff = checkin?.fuel_level && checkout?.fuel_level
    ? (FUEL_PCT[checkout.fuel_level] ?? 0) - (FUEL_PCT[checkin.fuel_level] ?? 0) : null;

  const checkinDamages = (checkin?.damages as any[]) || [];
  const checkoutDamages = (checkout?.damages as any[]) || [];
  const newDamages = checkoutDamages.filter(
    (d: any) => !checkinDamages.some((ci: any) => ci.position === d.position && ci.description === d.description)
  );

  const checkinAcc = (checkin?.accessories_check as Record<string, boolean>) || {};
  const checkoutAcc = (checkout?.accessories_check as Record<string, boolean>) || {};
  const missingAcc = Object.keys(ACCESSORIES_LABELS).filter(
    (k) => checkinAcc[k] !== false && checkoutAcc[k] === false
  );

  const CompareColumn = ({ label, data, color }: { label: string; data: any; color: string }) => (
    <div className="flex-1 min-w-0">
      <div className={`text-center py-2 rounded-t-lg font-semibold text-sm ${color}`}>
        {label}
      </div>
      {data ? (
        <div className="space-y-3 p-3 border border-t-0 border-border/30 rounded-b-lg">
          <div>
            <span className="text-xs text-muted-foreground">Odômetro</span>
            <p className="text-sm font-medium text-foreground">
              {data.odometer_reading?.toLocaleString("pt-BR") || ""} mi
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Combustível</span>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-3 bg-muted/50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-emerald-500 rounded-full transition-all"
                  style={{ width: `${FUEL_PCT[data.fuel_level] ?? 0}%` }}
                />
              </div>
              <span className="text-xs font-medium text-foreground">
                {FUEL_LABELS[data.fuel_level] || ""}
              </span>
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Avarias</span>
            <p className="text-sm font-medium text-foreground">
              {(data.damages as any[])?.length || 0} registrada(s)
            </p>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">Fotos</span>
            <p className="text-sm font-medium text-foreground">
              {(data.exterior_photos as any[])?.length || 0} capturada(s)
            </p>
          </div>
          {data.completed_at && (
            <p className="text-[10px] text-muted-foreground">
              Finalizada em {new Date(data.completed_at).toLocaleString("pt-BR")}
            </p>
          )}
        </div>
      ) : (
        <div className="p-6 border border-t-0 border-border/30 rounded-b-lg text-center">
          <p className="text-sm text-muted-foreground">Inspeção não realizada</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/bookings")} aria-label="Voltar para reservas">
          <ChevronLeft size={20} />
        </Button>
        <div className="flex-1">
          <h1 className="admin-h1 text-2xl">Comparar Inspeções</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {booking?.customer_name} • {vehicle?.name || ""} •{" "}
            {booking && parseDateOnly(booking.pickup_date).toLocaleDateString("pt-BR")} →{" "}
            {booking && parseDateOnly(booking.return_date).toLocaleDateString("pt-BR")}
          </p>
        </div>
        <div className="flex gap-2">
          {checkin?.completed_at && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateInspectionPDF({ type: "checkin", booking, vehicle, inspection: checkin })}
            >
              <Download size={14} className="mr-1" /> PDF Entrega
            </Button>
          )}
          {checkout?.completed_at && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateInspectionPDF({ type: "checkout", booking, vehicle, inspection: checkout })}
            >
              <Download size={14} className="mr-1" /> PDF Devolução
            </Button>
          )}
        </div>
      </div>

      {/* Side by side summary */}
      <div className="flex gap-4">
        <CompareColumn label="Entrega (Check-in)" data={checkin} color="bg-primary/10 text-primary" />
        <div className="flex items-center"><ArrowRight size={20} className="text-muted-foreground" /></div>
        <CompareColumn label="Devolução (Check-out)" data={checkout} color="bg-secondary text-secondary-foreground" />
      </div>

      {/* Differences */}
      {checkin && checkout && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-foreground">Diferenças Detectadas</h2>

          {/* Mileage difference */}
          <Card className="border-border/40">
            <CardContent className="p-4 flex items-center gap-4">
              <Gauge size={20} className="text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Milhagem percorrida</p>
                <p className="text-xs text-muted-foreground">
                  {checkin.odometer_reading?.toLocaleString("pt-BR") || "?"} → {checkout.odometer_reading?.toLocaleString("pt-BR") || "?"} mi
                </p>
              </div>
              <Badge variant="outline" className="text-lg font-medium">
                {odometerDiff !== null ? `${odometerDiff.toLocaleString("pt-BR")} mi` : ""}
              </Badge>
            </CardContent>
          </Card>

          {/* Fuel difference */}
          <Card className="border-border/40">
            <CardContent className="p-4 flex items-center gap-4">
              <Fuel size={20} className="text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Diferença de combustível</p>
                <p className="text-xs text-muted-foreground">
                  {FUEL_LABELS[checkin.fuel_level] || "?"} → {FUEL_LABELS[checkout.fuel_level] || "?"}
                </p>
              </div>
              <Badge
                variant="outline"
                className={fuelDiff !== null && fuelDiff < 0 ? "text-destructive border-destructive/30" : ""}
              >
                {fuelDiff !== null ? `${fuelDiff > 0 ? "+" : ""}${fuelDiff}%` : ""}
              </Badge>
            </CardContent>
          </Card>

          {/* New damages */}
          <Card className="border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle size={16} className="text-primary" />
                Novas Avarias na Devolução ({newDamages.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {newDamages.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 size={16} /> Nenhuma nova avaria
                </div>
              ) : (
                <div className="space-y-2">
                  {newDamages.map((d: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded bg-destructive/5 border border-destructive/20">
                      <XCircle size={14} className="text-destructive" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{d.position}</p>
                        <p className="text-xs text-muted-foreground">
                          {SEVERITY_LABELS[d.severity] || d.severity}. {d.description || "Sem descrição"}
                        </p>
                      </div>
                      {d.photoUrl && (
                        <SignedImage value={d.photoUrl} alt="" className="w-12 h-12 rounded object-cover ml-auto" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Missing accessories */}
          {missingAcc.length > 0 && (
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClipboardCheck size={16} className="text-primary" />
                  Acessórios Faltando na Devolução ({missingAcc.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {missingAcc.map((k) => (
                    <Badge key={k} variant="destructive" className="text-xs">
                      {ACCESSORIES_LABELS[k]}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Photos comparison */}
          {(checkin.exterior_photos as any[])?.length > 0 && (
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Camera size={16} className="text-primary" /> Comparação Fotográfica
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(checkin.exterior_photos as any[]).map((ciPhoto: any) => {
                    const coPhoto = (checkout.exterior_photos as any[])?.find(
                      (p: any) => p.position === ciPhoto.position
                    );
                    return (
                      <div key={ciPhoto.id} className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">{ciPhoto.position}</p>
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <p className="text-[10px] text-muted-foreground mb-1">Entrega</p>
                            <SignedImage value={ciPhoto.url} alt="" className="w-full aspect-[4/3] object-cover rounded-lg border border-border/40" />
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] text-muted-foreground mb-1">Devolução</p>
                            {coPhoto ? (
                              <SignedImage value={coPhoto.url} alt="" className="w-full aspect-[4/3] object-cover rounded-lg border border-border/40" />
                            ) : (
                              <div className="w-full aspect-[4/3] rounded-lg border-2 border-dashed border-border/40 flex items-center justify-center text-xs text-muted-foreground">
                                Sem foto
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
