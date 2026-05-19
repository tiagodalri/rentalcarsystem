import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, Pencil, Trash2, Car, Users as UsersIcon, Briefcase, X, History, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/admin/EmptyState";
import { CardGridSkeleton } from "@/components/skeletons/CardGridSkeleton";
import { getCoverImage, hasCoverImage } from "@/data/vehicleImages";
import { storageThumb } from "@/lib/storageThumb";
import { useFormDraft, clearFormDraft } from "@/hooks/useFormDraft";

const FLEET_DRAFT_KEY = "new-vehicle";

type Vehicle = {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  version: string | null;
  manufacture_year: number | null;
  model_year: number | null;
  vin: string | null;
  renavam: string | null;
  license_plate: string | null;
  category: string;
  daily_price_usd: number;
  image_url: string | null;
  passengers: number;
  bags: number;
  transmission: string;
  fuel: string;
  year: number | null;
  status: string;
  features: string[] | null;
  published: boolean;
  color: string | null;
  purchase_price: number | null;
  initial_odometer: number | null;
  current_odometer: number | null;
  acquired_date: string | null;
  photos: string[] | null;
};

const currentYear = new Date().getFullYear();

const emptyVehicle = {
  name: "",
  brand: "", model: "", version: "",
  manufacture_year: null as number | null, model_year: null as number | null,
  vin: "", renavam: "",
  license_plate: "", category: "Economy", daily_price_usd: null as number | null, image_url: "",
  passengers: 5, bags: 2, transmission: "Automatic", fuel: "Gasoline",
  year: null as number | null, status: "available", features: [] as string[],
  color: "", purchase_price: null as number | null,
  initial_odometer: null as number | null, current_odometer: null as number | null,
  acquired_date: null as string | null,
};

const CATEGORIES = ["Economy", "Compact", "Midsize", "Fullsize", "SUV", "Premium SUV", "Luxury", "Sports", "Minivan", "Pickup", "Convertible"];

export default function AdminFleet() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Vehicle> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("vehicles").select("*").order("name");
    setVehicles((data || []) as unknown as Vehicle[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Auto-save de rascunho APENAS para novo veículo
  useFormDraft(
    FLEET_DRAFT_KEY,
    (editing || {}) as Record<string, any>,
    (v) => setEditing((prev) => ({ ...(prev || {}), ...v })),
    !!editing && isNew
  );

  const filtered = vehicles.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.category.toLowerCase().includes(search.toLowerCase())
  );

  const save = async () => {
    const brand = (editing?.brand || "").trim();
    const model = (editing?.model || "").trim();
    const version = (editing?.version || "").trim();
    const autoName = [brand, model, version].filter(Boolean).join(" ").trim();
    const name = (editing?.name || "").trim() || autoName;

    if (!brand || !model) return toast({ title: "Marca e Modelo obrigatórios", variant: "destructive" });
    if (!name) return toast({ title: "Nome obrigatório", variant: "destructive" });
    const plate = (editing?.license_plate || "").trim();
    if (plate.length < 3) return toast({ title: "Placa obrigatória", description: "Informe ao menos 3 caracteres.", variant: "destructive" });

    const payload = {
      name,
      brand, model, version: version || null,
      manufacture_year: editing?.manufacture_year ?? null,
      model_year: editing?.model_year ?? null,
      vin: (editing?.vin || "").trim().toUpperCase() || null,
      renavam: (editing?.renavam || "").trim() || null,
      license_plate: plate.toUpperCase(),
      category: editing?.category || "Economy",
      daily_price_usd: editing?.daily_price_usd ?? 0,
      image_url: editing?.image_url || null,
      passengers: editing?.passengers || 5,
      bags: editing?.bags || 2,
      transmission: editing?.transmission || "Automatic",
      fuel: editing?.fuel || "Gasoline",
      year: editing?.model_year || editing?.year || null,
      status: editing?.status || "available",
      features: editing?.features || [],
      color: editing?.color || null,
      purchase_price: editing?.purchase_price ?? 0,
      initial_odometer: editing?.initial_odometer ?? 0,
      current_odometer: editing?.current_odometer ?? 0,
      acquired_date: editing?.acquired_date || null,
    };

    setSaving(true);
    try {
      if (isNew) {
        const { data, error } = await supabase.from("vehicles").insert(payload).select("id").single();
        if (error || !data) {
          toast({ title: "Erro ao criar veículo", description: error?.message, variant: "destructive" });
          return;
        }
        toast({ title: "Carro criado! Agora adicione as fotos da galeria." });
        clearFormDraft(FLEET_DRAFT_KEY);
        navigate(`/admin/fleet/${data.id}?tab=photos`);
        return;
      }
      const { error } = await supabase.from("vehicles").update(payload).eq("id", editing.id!);
      if (error) {
        toast({ title: "Erro ao atualizar veículo", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Veículo atualizado" });
      setEditing(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const deleteVehicle = async (id: string) => {
    if (!confirm("Excluir este veículo?")) return;
    await supabase.from("vehicles").delete().eq("id", id);
    toast({ title: "Veículo excluído" });
    load();
  };

  const togglePublished = async (v: Vehicle) => {
    const next = !v.published;
    await supabase.from("vehicles").update({ published: next }).eq("id", v.id);
    toast({ title: next ? "Publicado no site" : "Removido do site" });
    load();
  };

  const statusColors: Record<string, string> = {
    available: "bg-green-500/10 text-green-500",
    rented: "bg-blue-500/10 text-blue-400",
    maintenance: "bg-yellow-500/10 text-yellow-500",
    unavailable: "bg-destructive/10 text-destructive",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Frota</h1>
          <p className="text-sm text-muted-foreground mt-1">{vehicles.length} veículos cadastrados</p>
        </div>
        <button
          onClick={() => { setEditing({ ...emptyVehicle }); setIsNew(true); }}
          className="gold-gradient text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <Plus size={16} /> Adicionar
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar veículo..."
          className="w-full h-9 pl-9 pr-3 rounded-lg border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Edit Modal — bottom-sheet no mobile, modal centralizado no desktop */}
      {editing && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4"
          onClick={() => setEditing(null)}
        >
          <div
            className="bg-card border border-border/50 shadow-2xl w-full sm:max-w-lg sm:rounded-xl rounded-t-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh]"
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* grab handle (mobile) */}
            <div className="sm:hidden flex justify-center pt-2 pb-1">
              <div className="h-1.5 w-12 rounded-full bg-border" />
            </div>

            {/* Sticky header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/40 sticky top-0 bg-card z-10">
              <h2 className="text-base sm:text-lg font-bold text-foreground">{isNew ? "Novo Veículo" : "Editar Veículo"}</h2>
              <button
                onClick={() => setEditing(null)}
                aria-label="Fechar"
                className="h-11 w-11 -mr-2 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6 overscroll-contain">
              {(() => {
                const inputCls = "w-full h-11 px-3 rounded-lg border border-border/60 bg-background text-[16px] sm:text-[15px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30";
                const labelCls = "text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block";
                const sectionTitleCls = "text-xs font-semibold text-primary uppercase tracking-wider mb-3";
                const setVal = (k: string, v: any) => setEditing({ ...editing, [k]: v });
                const numChange = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
                  const v = e.target.value;
                  setVal(k, v === "" ? null : Number(v));
                };
                return (
                  <>
                    {/* Identificação */}
                    <section>
                      <h3 className={sectionTitleCls}>Identificação</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Marca *</label>
                          <input className={inputCls} value={editing.brand ?? ""} onChange={(e) => setVal("brand", e.target.value)} placeholder="Ex: Toyota" />
                        </div>
                        <div>
                          <label className={labelCls}>Modelo *</label>
                          <input className={inputCls} value={editing.model ?? ""} onChange={(e) => setVal("model", e.target.value)} placeholder="Ex: Corolla" />
                        </div>
                        <div className="sm:col-span-2">
                          <label className={labelCls}>Versão</label>
                          <input className={inputCls} value={editing.version ?? ""} onChange={(e) => setVal("version", e.target.value)} placeholder="Ex: XEi 2.0 Flex" />
                        </div>
                        <div>
                          <label className={labelCls}>Ano Fabricação</label>
                          <input type="number" inputMode="numeric" className={`${inputCls} tabular-nums`} value={editing.manufacture_year ?? ""} onChange={numChange("manufacture_year")} placeholder={String(currentYear)} />
                        </div>
                        <div>
                          <label className={labelCls}>Ano Modelo</label>
                          <input type="number" inputMode="numeric" className={`${inputCls} tabular-nums`} value={editing.model_year ?? ""} onChange={numChange("model_year")} placeholder={String(currentYear)} />
                        </div>
                        <div>
                          <label className={labelCls}>Placa *</label>
                          <input className={`${inputCls} uppercase`} value={editing.license_plate ?? ""} onChange={(e) => setVal("license_plate", e.target.value.toUpperCase())} placeholder="ABC-1D23" />
                        </div>
                        <div>
                          <label className={labelCls}>Cor</label>
                          <input className={inputCls} value={editing.color ?? ""} onChange={(e) => setVal("color", e.target.value)} placeholder="Ex: Preto" />
                        </div>
                        <div>
                          <label className={labelCls}>Chassi (VIN)</label>
                          <input className={`${inputCls} uppercase font-mono text-sm`} maxLength={17} value={editing.vin ?? ""} onChange={(e) => setVal("vin", e.target.value.toUpperCase())} placeholder="17 caracteres" />
                        </div>
                        <div>
                          <label className={labelCls}>Renavam</label>
                          <input className={`${inputCls} tabular-nums`} inputMode="numeric" value={editing.renavam ?? ""} onChange={(e) => setVal("renavam", e.target.value.replace(/\D/g, ""))} placeholder="11 dígitos" />
                        </div>
                      </div>
                    </section>

                    {/* Especificações */}
                    <section>
                      <h3 className={sectionTitleCls}>Especificações</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <label className={labelCls}>Categoria</label>
                          <select className={inputCls} value={editing.category || "Economy"} onChange={(e) => setVal("category", e.target.value)}>
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Passageiros</label>
                          <input type="number" inputMode="numeric" className={`${inputCls} tabular-nums`} value={editing.passengers ?? ""} onChange={numChange("passengers")} placeholder="5" />
                        </div>
                        <div>
                          <label className={labelCls}>Malas</label>
                          <input type="number" inputMode="numeric" className={`${inputCls} tabular-nums`} value={editing.bags ?? ""} onChange={numChange("bags")} placeholder="2" />
                        </div>
                        <div>
                          <label className={labelCls}>Transmissão</label>
                          <select className={inputCls} value={editing.transmission || "Automatic"} onChange={(e) => setVal("transmission", e.target.value)}>
                            <option value="Automatic">Automático</option>
                            <option value="Manual">Manual</option>
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Combustível</label>
                          <select className={inputCls} value={editing.fuel || "Gasoline"} onChange={(e) => setVal("fuel", e.target.value)}>
                            <option value="Gasoline">Gasolina</option>
                            <option value="Diesel">Diesel</option>
                            <option value="Electric">Elétrico</option>
                            <option value="Hybrid">Híbrido</option>
                          </select>
                        </div>
                      </div>
                    </section>

                    {/* Comercial */}
                    <section>
                      <h3 className={sectionTitleCls}>Comercial</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Diária (USD)</label>
                          <input type="number" inputMode="decimal" className={`${inputCls} tabular-nums`} value={editing.daily_price_usd ?? ""} onChange={numChange("daily_price_usd")} placeholder="0,00" />
                        </div>
                        <div>
                          <label className={labelCls}>Status</label>
                          <select className={inputCls} value={editing.status || "available"} onChange={(e) => setVal("status", e.target.value)}>
                            <option value="available">Disponível</option>
                            <option value="rented">Alugado</option>
                            <option value="maintenance">Manutenção</option>
                            <option value="unavailable">Indisponível</option>
                          </select>
                        </div>
                      </div>
                    </section>

                    {/* Financeiro & Aquisição */}
                    <section>
                      <h3 className={sectionTitleCls}>Financeiro & Aquisição</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Valor de Compra (USD)</label>
                          <input type="number" inputMode="decimal" className={`${inputCls} tabular-nums`} value={editing.purchase_price ?? ""} onChange={numChange("purchase_price")} placeholder="0,00" />
                        </div>
                        <div>
                          <label className={labelCls}>Data de Aquisição</label>
                          <input type="date" className={inputCls} value={editing.acquired_date ?? ""} onChange={(e) => setVal("acquired_date", e.target.value || null)} />
                        </div>
                        <div>
                          <label className={labelCls}>Odômetro Inicial (mi)</label>
                          <input type="number" inputMode="numeric" className={`${inputCls} tabular-nums`} value={editing.initial_odometer ?? ""} onChange={numChange("initial_odometer")} placeholder="0" />
                        </div>
                        <div>
                          <label className={labelCls}>Odômetro Atual (mi)</label>
                          <input type="number" inputMode="numeric" className={`${inputCls} tabular-nums`} value={editing.current_odometer ?? ""} onChange={numChange("current_odometer")} placeholder="0" />
                        </div>
                      </div>
                    </section>
                  </>
                );
              })()}
            </div>

            {/* Sticky footer */}
            <div className="px-5 py-3 border-t border-border/40 bg-card flex gap-3 sticky bottom-0">
              <button
                onClick={() => setEditing(null)}
                className="hidden sm:inline-flex h-12 px-4 rounded-lg border border-border/60 text-sm font-semibold text-foreground hover:bg-accent transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 h-12 gold-gradient text-primary-foreground rounded-lg text-sm font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Salvando..." : isNew ? "Adicionar Veículo" : "Salvar Alterações"}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Grid */}
      {loading ? (
        <CardGridSkeleton count={6} variant="fleet" />
      ) : filtered.length === 0 && vehicles.length > 0 ? (
        <EmptyState icon={Search} title="Nenhum veículo encontrado" description="Nenhum veículo corresponde à busca atual." actionLabel="Limpar busca" onAction={() => setSearch("")} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Car} title="Nenhum veículo cadastrado" description="Adicione veículos à frota para começar a gerenciar disponibilidade e locações." actionLabel="Adicionar Veículo" onAction={() => { setEditing({ ...emptyVehicle }); setIsNew(true); }} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((v) => (
            <Card key={v.id} className="bg-card/50 border-border/40 hover:border-primary/20 transition-colors overflow-hidden cursor-pointer" onClick={() => navigate(`/admin/fleet/${v.id}`)}>
              <div className="h-40 bg-muted/30 overflow-hidden flex items-center justify-center">
                {(() => {
                  const raw = v.image_url || (v.photos && v.photos[0]) || "";
                  const dbImg = raw && !raw.includes("placeholder") ? raw : "";
                  const thumb = storageThumb(dbImg, 640, 360);
                  const src = thumb || (hasCoverImage(v.name) ? getCoverImage(v.name) : "");
                  if (!src) {
                    return (
                      <div className="flex flex-col items-center justify-center text-muted-foreground/50 gap-1">
                        <Car size={40} strokeWidth={1.2} />
                        <span className="text-[10px] uppercase tracking-wider">Sem foto</span>
                      </div>
                    );
                  }
                  return (
                    <img
                      src={src}
                      alt={v.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                      width={640}
                      height={360}
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        if (hasCoverImage(v.name) && !img.src.endsWith(getCoverImage(v.name))) {
                          img.src = getCoverImage(v.name);
                        } else if (!img.src.endsWith("/placeholder.svg")) {
                          img.src = "/placeholder.svg";
                        }
                      }}
                    />
                  );
                })()}
              </div>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{v.name}</h3>
                    <p className="text-xs text-muted-foreground">{v.category} · {v.year}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[v.status] || "bg-muted text-muted-foreground"}`}>
                      {v.status === "available" ? "Disponível" : v.status === "rented" ? "Alugado" : v.status === "maintenance" ? "Manutenção" : "Indisponível"}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${v.published ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {v.published ? <><Eye size={10} /> No site</> : <><EyeOff size={10} /> Oculto</>}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><UsersIcon size={12} />{v.passengers}</span>
                  <span className="flex items-center gap-1"><Briefcase size={12} />{v.bags}</span>
                  <span>{v.transmission === "Automatic" ? "Auto" : "Manual"}</span>
                </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border/30">
                    <span className="text-lg font-bold text-primary">${v.daily_price_usd}/dia</span>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePublished(v); }}
                        className={`transition-colors ${v.published ? "text-primary hover:text-primary/70" : "text-muted-foreground hover:text-primary"}`}
                        title={v.published ? "Despublicar do site" : "Publicar no site"}
                      >
                        {v.published ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/admin/vehicle-history/${v.id}`); }}
                        className="text-muted-foreground hover:text-primary transition-colors"
                        title="Histórico de Locações"
                      >
                        <History size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditing(v); setIsNew(false); }}
                        className="text-muted-foreground hover:text-primary transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteVehicle(v.id); }}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
