import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

type Scope = "locadora_default" | "vehicle_category" | "vehicle" | "partner_override";
type CommissionType = "percent" | "fixed";

interface CommissionRule {
  id: string;
  locadora_id: string;
  scope: Scope;
  vehicle_id: string | null;
  vehicle_category: string | null;
  partner_id: string | null;
  commission_type: CommissionType;
  commission_value: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
}

interface Locadora {
  id: string;
  name: string;
}

interface VehicleLite {
  id: string;
  name: string | null;
  brand: string | null;
  model: string | null;
  category: string | null;
  license_plate: string | null;
  locadora_id: string | null;
}

const SCOPE_LABEL: Record<Scope, string> = {
  locadora_default: "Padrão da locadora",
  vehicle_category: "Categoria",
  vehicle: "Veículo",
  partner_override: "Parceiro",
};

export default function AdminCommissions() {
  const { user, hasAny } = useAdminAuth();
  const isPlatform = hasAny(["platform_admin"]);

  const [locadoras, setLocadoras] = useState<Locadora[]>([]);
  const [selectedLocadora, setSelectedLocadora] = useState<string | null>(null);

  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [vehicles, setVehicles] = useState<VehicleLite[]>([]);
  const [loading, setLoading] = useState(false);

  // form
  const [scope, setScope] = useState<Scope>("locadora_default");
  const [vehicleId, setVehicleId] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [ctype, setCtype] = useState<CommissionType>("percent");
  const [cvalue, setCvalue] = useState<string>("");
  const [validFrom, setValidFrom] = useState<string>("");
  const [validUntil, setValidUntil] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Initial locadora resolution
  useEffect(() => {
    (async () => {
      if (isPlatform) {
        const { data } = await supabase.from("locadoras").select("id,name").order("name");
        setLocadoras(data || []);
        if (data && data.length && !selectedLocadora) setSelectedLocadora(data[0].id);
      } else if (user) {
        const { data } = await supabase
          .from("user_roles")
          .select("locadora_id")
          .eq("user_id", user.id)
          .not("locadora_id", "is", null)
          .limit(1)
          .maybeSingle();
        if (data?.locadora_id) setSelectedLocadora(data.locadora_id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlatform, user?.id]);

  const load = async () => {
    if (!selectedLocadora) return;
    setLoading(true);
    const [rulesRes, vehiclesRes] = await Promise.all([
      supabase
        .from("commission_rules")
        .select("*")
        .eq("locadora_id", selectedLocadora)
        .order("created_at", { ascending: false }),
      supabase
        .from("vehicles")
        .select("id,name,brand,model,category,license_plate,locadora_id")
        .eq("locadora_id", selectedLocadora)
        .is("deleted_at", null)
        .order("name", { ascending: true }),
    ]);
    if (rulesRes.error) toast.error("Erro ao carregar regras: " + rulesRes.error.message);
    setRules((rulesRes.data as CommissionRule[]) || []);
    setVehicles((vehiclesRes.data as VehicleLite[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocadora]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    vehicles.forEach((v) => v.category && set.add(v.category));
    return Array.from(set).sort();
  }, [vehicles]);

  const resetForm = () => {
    setScope("locadora_default");
    setVehicleId("");
    setCategory("");
    setCtype("percent");
    setCvalue("");
    setValidFrom("");
    setValidUntil("");
  };

  const submit = async () => {
    if (!selectedLocadora) return;
    const num = parseFloat(cvalue);
    if (isNaN(num) || num < 0) {
      toast.error("Valor da comissão inválido");
      return;
    }
    if (scope === "vehicle" && !vehicleId) {
      toast.error("Selecione um veículo");
      return;
    }
    if (scope === "vehicle_category" && !category) {
      toast.error("Selecione uma categoria");
      return;
    }

    setSaving(true);
    const payload: any = {
      locadora_id: selectedLocadora,
      scope,
      commission_type: ctype,
      commission_value: num,
      valid_from: validFrom ? new Date(validFrom).toISOString() : null,
      valid_until: validUntil ? new Date(validUntil).toISOString() : null,
      vehicle_id: scope === "vehicle" ? vehicleId : null,
      vehicle_category: scope === "vehicle_category" ? category : null,
      partner_id: null,
      created_by: user?.id ?? null,
      is_active: true,
    };

    const { error } = await supabase.from("commission_rules").insert(payload);
    setSaving(false);
    if (error) {
      toast.error("Erro ao criar regra: " + error.message);
      return;
    }
    toast.success("Regra de comissão criada");
    resetForm();
    load();
  };

  const toggleActive = async (rule: CommissionRule) => {
    const { error } = await supabase
      .from("commission_rules")
      .update({ is_active: !rule.is_active })
      .eq("id", rule.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (rule: CommissionRule) => {
    if (!confirm("Excluir esta regra?")) return;
    const { error } = await supabase.from("commission_rules").delete().eq("id", rule.id);
    if (error) return toast.error(error.message);
    toast.success("Regra excluída");
    load();
  };

  const vehicleLabel = (id: string | null) => {
    if (!id) return "—";
    const v = vehicles.find((x) => x.id === id);
    if (!v) return id.slice(0, 8);
    return `${v.brand ?? ""} ${v.model ?? v.name ?? ""} ${v.license_plate ? "· " + v.license_plate : ""}`.trim();
  };

  const formatValue = (r: CommissionRule) =>
    r.commission_type === "percent"
      ? `${r.commission_value}%`
      : `US$ ${r.commission_value.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  const formatRange = (r: CommissionRule) => {
    const f = r.valid_from ? new Date(r.valid_from).toLocaleDateString("pt-BR") : "—";
    const u = r.valid_until ? new Date(r.valid_until).toLocaleDateString("pt-BR") : "—";
    if (!r.valid_from && !r.valid_until) return "Sem limite";
    return `${f} → ${u}`;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="admin-h1 text-2xl">Comissões</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Regras de comissão por escopo (padrão, categoria, veículo ou parceiro). A regra mais específica e vigente prevalece.
        </p>
      </div>

      {isPlatform && (
        <Card className="bg-card/50 border-border/40">
          <CardContent className="pt-6">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Locadora</Label>
            <Select value={selectedLocadora ?? ""} onValueChange={setSelectedLocadora}>
              <SelectTrigger className="mt-2 max-w-md">
                <SelectValue placeholder="Selecione a locadora" />
              </SelectTrigger>
              <SelectContent>
                {locadoras.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <Card className="bg-card/50 border-border/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus size={16} className="text-primary" />
            Nova regra
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Escopo</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as Scope)}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="locadora_default">Padrão da locadora</SelectItem>
                  <SelectItem value="vehicle_category">Por categoria de veículo</SelectItem>
                  <SelectItem value="vehicle">Por veículo específico</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Parceiro fica disponível após o cadastro de parceiros (Fase 3).
              </p>
            </div>

            {scope === "vehicle_category" && (
              <div>
                <Label>Categoria</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="Escolha uma categoria" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scope === "vehicle" && (
              <div>
                <Label>Veículo</Label>
                <Select value={vehicleId} onValueChange={setVehicleId}>
                  <SelectTrigger className="mt-2"><SelectValue placeholder="Escolha um veículo" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {`${v.brand ?? ""} ${v.model ?? v.name ?? ""}${v.license_plate ? " · " + v.license_plate : ""}`.trim()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Tipo</Label>
              <Select value={ctype} onValueChange={(v) => setCtype(v as CommissionType)}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor fixo (US$)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Valor</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={cvalue}
                onChange={(e) => setCvalue(e.target.value)}
                placeholder={ctype === "percent" ? "Ex.: 15" : "Ex.: 50.00"}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Vigência — início</Label>
              <Input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="mt-2"
              />
            </div>

            <div>
              <Label>Vigência — fim</Label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={resetForm} disabled={saving}>Limpar</Button>
            <Button onClick={submit} disabled={saving || !selectedLocadora}>
              {saving ? "Salvando..." : "Criar regra"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card className="bg-card/50 border-border/40">
        <CardHeader>
          <CardTitle className="text-base">Regras existentes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma regra cadastrada ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Escopo</TableHead>
                    <TableHead>Alvo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="tabular-nums">Valor</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead>Ativa</TableHead>
                    <TableHead className="w-8"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge variant="outline">{SCOPE_LABEL[r.scope]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.scope === "vehicle" && vehicleLabel(r.vehicle_id)}
                        {r.scope === "vehicle_category" && (r.vehicle_category ?? "—")}
                        {r.scope === "locadora_default" && "—"}
                        {r.scope === "partner_override" && (r.partner_id?.slice(0, 8) ?? "—")}
                      </TableCell>
                      <TableCell className="text-sm">{r.commission_type === "percent" ? "%" : "US$"}</TableCell>
                      <TableCell className="tabular-nums">{formatValue(r)}</TableCell>
                      <TableCell className="text-sm">{formatRange(r)}</TableCell>
                      <TableCell>
                        <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => remove(r)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
