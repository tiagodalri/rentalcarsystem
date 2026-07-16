import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronRight, FileWarning, Loader2, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { KpiCard } from "@/components/admin/KpiCard";
import { AdminKpiGrid } from "@/components/admin/layout/AdminPage";

type Vehicle = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  license_plate: string | null;
  vin: string | null;
  e_pass_transponder: string | null;
  bouncie_imei: string | null;
  purchase_price: number | null;
  acquired_date: string | null;
  color: string | null;
  current_odometer: number | null;
  initial_odometer: number | null;
  insurance_policy: string | null;
  insurance_expiry: string | null;
  registration_expiry: string | null;
  image_url: string | null;
  status: string;
};

type FieldDef = {
  key: keyof Vehicle;
  label: string;
  test?: (v: Vehicle) => boolean;
};

const FIELDS: FieldDef[] = [
  { key: "license_plate", label: "Placa" },
  { key: "vin", label: "VIN" },
  { key: "e_pass_transponder", label: "E-Pass Transponder" },
  { key: "bouncie_imei", label: "IMEI Bouncie" },
  { key: "purchase_price", label: "Valor pago", test: (v) => !v.purchase_price || v.purchase_price <= 0 },
  { key: "acquired_date", label: "Data de compra" },
  { key: "color", label: "Cor" },
  { key: "image_url", label: "Foto principal" },
  { key: "initial_odometer", label: "Odômetro inicial", test: (v) => v.initial_odometer == null },
];

function isMissing(v: Vehicle, f: FieldDef) {
  if (f.test) return f.test(v);
  const val = v[f.key];
  return val == null || (typeof val === "string" && val.trim() === "");
}

export default function AdminPendencias() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select(
          "id,name,brand,model,year,license_plate,vin,e_pass_transponder,bouncie_imei,purchase_price,acquired_date,color,current_odometer,initial_odometer,insurance_policy,insurance_expiry,registration_expiry,image_url,status"
        )
        .is("deleted_at", null)
        .neq("status", "sold")
        .order("name");
      if (!error && data) setVehicles(data as Vehicle[]);
      setLoading(false);
    })();
  }, []);

  const byField = useMemo(() => {
    const map = new Map<string, { field: FieldDef; vehicles: Vehicle[] }>();
    for (const f of FIELDS) {
      const missing = vehicles.filter((v) => isMissing(v, f));
      if (missing.length) map.set(f.label, { field: f, vehicles: missing });
    }
    return Array.from(map.values()).sort((a, b) => b.vehicles.length - a.vehicles.length);
  }, [vehicles]);

  const byVehicle = useMemo(() => {
    return vehicles
      .map((v) => ({ v, missing: FIELDS.filter((f) => isMissing(v, f)) }))
      .filter((x) => x.missing.length > 0)
      .sort((a, b) => b.missing.length - a.missing.length);
  }, [vehicles]);

  const totalPendencias = byField.reduce((acc, g) => acc + g.vehicles.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="admin-h1 text-2xl flex items-center gap-2">
          <FileWarning className="h-5 w-5 text-primary" />
          Pendências
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Informações que faltam ser preenchidas no cadastro da frota.
        </p>
      </div>

      <AdminKpiGrid cols={3}>
        <KpiCard label="Total de pendências" value={totalPendencias} />
        <KpiCard label="Veículos com pendências" value={byVehicle.length} />
        <KpiCard label="Veículos completos" value={vehicles.length - byVehicle.length} />
      </AdminKpiGrid>


      {byField.length === 0 ? (
        <Card className="bg-card/50 border-border/40">
          <CardContent className="p-0">
            <EmptyState icon={CheckCircle2} title="Frota 100% atualizada" description="Nenhum campo crítico está faltando nos veículos cadastrados." />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="bg-card/50 border-border/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                Por tipo de informação
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {byField.map(({ field, vehicles: vs }) => (
                <details key={field.label} className="group rounded-lg border border-border/40 bg-card/40">
                  <summary className="flex items-center justify-between p-3 cursor-pointer list-none">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant="secondary" className="tabular-nums shrink-0">{vs.length}</Badge>
                      <span className="text-sm font-medium truncate">Faltando: {field.label}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="border-t border-border/30 divide-y divide-border/30">
                    {vs.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => navigate(`/admin/vehicles/${v.id}`)}
                        className="w-full flex items-center justify-between p-3 hover:bg-card/70 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {v.image_url ? (
                            <img src={v.image_url} alt="" className="h-9 w-12 rounded object-cover shrink-0" />
                          ) : (
                            <div className="h-9 w-12 rounded bg-muted shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{v.name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {[v.brand, v.model, v.year].filter(Boolean).join(" • ") || ""}
                              {v.license_plate ? ` • ${v.license_plate}` : ""}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-border/40">
            <CardHeader>
              <CardTitle className="text-base">Por veículo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {byVehicle.map(({ v, missing }) => (
                <button
                  key={v.id}
                  onClick={() => navigate(`/admin/vehicles/${v.id}`)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg border border-border/40 bg-card/40 hover:bg-card/70 transition-colors text-left"
                >
                  {v.image_url ? (
                    <img src={v.image_url} alt="" className="h-12 w-16 rounded object-cover shrink-0" />
                  ) : (
                    <div className="h-12 w-16 rounded bg-muted shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium">{v.name}</p>
                      <Badge variant="outline" className="tabular-nums">{missing.length} pendência{missing.length > 1 ? "s" : ""}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {[v.brand, v.model, v.year].filter(Boolean).join(" • ") || ""}
                      {v.license_plate ? ` • ${v.license_plate}` : ""}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {missing.map((f) => (
                        <Badge key={f.label} variant="secondary" className="text-[10px] font-normal">
                          {f.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-1" />
                </button>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
