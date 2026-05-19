import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, Pencil, Trash2, Car, Users as UsersIcon, Briefcase, X, History, Eye, EyeOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/admin/EmptyState";
import { CardGridSkeleton } from "@/components/skeletons/CardGridSkeleton";
import { getCoverImage } from "@/data/vehicleImages";
import { storageThumb } from "@/lib/storageThumb";

type Vehicle = {
  id: string;
  name: string;
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

const emptyVehicle = {
  name: "", license_plate: "", category: "Economy", daily_price_usd: 0, image_url: "",
  passengers: 5, bags: 2, transmission: "Automatic", fuel: "Gasoline",
  year: new Date().getFullYear(), status: "available", features: [] as string[],
  color: "", purchase_price: 0, initial_odometer: 0, current_odometer: 0,
  acquired_date: null as string | null,
};

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

  const filtered = vehicles.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.category.toLowerCase().includes(search.toLowerCase())
  );

  const save = async () => {
    if (!editing?.name) return toast({ title: "Nome obrigatório", variant: "destructive" });
    const plate = (editing.license_plate || "").trim();
    if (plate.length < 3) return toast({ title: "Placa obrigatória", description: "Informe ao menos 3 caracteres.", variant: "destructive" });

    const payload = {
      name: editing.name,
      license_plate: plate.toUpperCase(),
      category: editing.category || "Economy",
      daily_price_usd: editing.daily_price_usd || 0,
      image_url: editing.image_url || null,
      passengers: editing.passengers || 5,
      bags: editing.bags || 2,
      transmission: editing.transmission || "Automatic",
      fuel: editing.fuel || "Gasoline",
      year: editing.year || null,
      status: editing.status || "available",
      features: editing.features || [],
      color: editing.color || null,
      purchase_price: editing.purchase_price ?? 0,
      initial_odometer: editing.initial_odometer ?? 0,
      current_odometer: editing.current_odometer ?? 0,
      acquired_date: editing.acquired_date || null,
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

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setEditing(null)}>
          <div className="bg-card rounded-xl border border-border/50 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-foreground">{isNew ? "Novo Veículo" : "Editar Veículo"}</h2>
              <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              {[
                { label: "Nome", key: "name", type: "text" },
                { label: "Placa", key: "license_plate", type: "text" },
                { label: "Categoria", key: "category", type: "text" },
                { label: "Diária (USD)", key: "daily_price_usd", type: "number" },
                { label: "Passageiros", key: "passengers", type: "number" },
                { label: "Malas", key: "bags", type: "number" },
                { label: "Ano", key: "year", type: "number" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">{field.label}</label>
                  <input
                    type={field.type}
                    value={(editing as any)[field.key] ?? ""}
                    onChange={(e) => setEditing({ ...editing, [field.key]: field.type === "number" ? Number(e.target.value) : e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Transmissão</label>
                  <select
                    value={editing.transmission || "Automatic"}
                    onChange={(e) => setEditing({ ...editing, transmission: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground"
                  >
                    <option value="Automatic">Automático</option>
                    <option value="Manual">Manual</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Combustível</label>
                  <select
                    value={editing.fuel || "Gasoline"}
                    onChange={(e) => setEditing({ ...editing, fuel: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground"
                  >
                    <option value="Gasoline">Gasolina</option>
                    <option value="Diesel">Diesel</option>
                    <option value="Electric">Elétrico</option>
                    <option value="Hybrid">Híbrido</option>
                  </select>
                </div>
              </div>

              {/* Financeiro & Aquisição */}
              <div className="pt-2">
                <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">Financeiro & Aquisição</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Cor</label>
                    <input
                      type="text"
                      value={editing.color ?? ""}
                      onChange={(e) => setEditing({ ...editing, color: e.target.value })}
                      placeholder="Ex: Preto"
                      className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Valor de Compra (USD)</label>
                    <input
                      type="number"
                      value={editing.purchase_price ?? 0}
                      onChange={(e) => setEditing({ ...editing, purchase_price: Number(e.target.value) })}
                      className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Data de Aquisição</label>
                    <input
                      type="date"
                      value={editing.acquired_date ?? ""}
                      onChange={(e) => setEditing({ ...editing, acquired_date: e.target.value || null })}
                      className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Odômetro Inicial (mi)</label>
                    <input
                      type="number"
                      value={editing.initial_odometer ?? 0}
                      onChange={(e) => setEditing({ ...editing, initial_odometer: Number(e.target.value) })}
                      className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Odômetro Atual (mi)</label>
                    <input
                      type="number"
                      value={editing.current_odometer ?? 0}
                      onChange={(e) => setEditing({ ...editing, current_odometer: Number(e.target.value) })}
                      className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">Status</label>
                <select
                  value={editing.status || "available"}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                  className="w-full h-9 px-3 rounded-lg border border-border/60 bg-background text-sm text-foreground"
                >
                  <option value="available">Disponível</option>
                  <option value="rented">Alugado</option>
                  <option value="maintenance">Manutenção</option>
                  <option value="unavailable">Indisponível</option>
                </select>
              </div>

              <button
                onClick={save}
                disabled={saving}
                className="w-full h-10 gold-gradient text-primary-foreground rounded-lg text-sm font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Salvando..." : isNew ? "Adicionar" : "Salvar"}
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
              <div className="h-40 bg-muted/30 overflow-hidden">
                <img
                  src={storageThumb(v.image_url || (v.photos && v.photos[0]) || "", 640, 360) || getCoverImage(v.name)}
                  alt={v.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  decoding="async"
                  width={640}
                  height={360}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = getCoverImage(v.name); }}
                />
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
