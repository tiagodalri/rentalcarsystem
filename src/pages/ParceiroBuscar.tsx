import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Loader2, Search, CalendarIcon, MapPin, Users, Briefcase, Settings2, Fuel, Building2, ArrowLeft, SearchX, Sparkles } from "lucide-react";
import CommissionCallout from "@/components/parceiro/CommissionCallout";
import VehicleCardSkeleton from "@/components/parceiro/VehicleCardSkeleton";
import PartnerHeader from "@/components/parceiro/PartnerHeader";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getCoverImage } from "@/data/vehicleImages";
import { fmtUSDCompact } from "@/lib/partnerFormat";

type SearchResult = {
  id: string;
  name: string;
  category: string;
  daily_price_usd: number;
  image_url: string | null;
  photos: unknown;
  passengers: number;
  bags: number;
  transmission: string;
  fuel: string;
  year: number | null;
  locadora_id: string;
  locadora_name: string;
  commission_type: "percent" | "fixed" | null;
  commission_value: number | null;
};

const CATEGORIES = ["Minivan", "Pickup", "Sedan", "SUV", "SUV Compacto", "SUV Premium", "SUV Full Size", "Esportivo", "Super Esportivo"];

function pickPhoto(v: SearchResult): string {
  const arr = Array.isArray(v.photos) ? (v.photos as unknown[]) : [];
  const first = arr.find((p) => typeof p === "string" && p) as string | undefined
    || (typeof (arr[0] as { url?: string })?.url === "string" ? (arr[0] as { url: string }).url : undefined);
  return (typeof v.image_url === "string" && v.image_url) ? v.image_url : (first || getCoverImage(v.name));
}

export default function ParceiroBuscar() {
  const navigate = useNavigate();
  const [authorizing, setAuthorizing] = useState(true);

  const [pickupDate, setPickupDate] = useState<Date>();
  const [returnDate, setReturnDate] = useState<Date>();
  const [category, setCategory] = useState<string>("");
  const [openPicker, setOpenPicker] = useState<null | "pickup" | "return">(null);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { navigate("/parceiro/login", { replace: true }); return; }
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .eq("role", "partner")
        .maybeSingle();
      if (!role) { navigate("/parceiro/login", { replace: true }); return; }
      setAuthorizing(false);
    })();
  }, [navigate]);

  const handleSearch = async () => {
    if (!pickupDate || !returnDate) {
      toast({ title: "Datas obrigatórias", description: "Selecione retirada e devolução.", variant: "destructive" });
      return;
    }
    if (returnDate <= pickupDate) {
      toast({ title: "Datas inválidas", description: "A devolução deve ser após a retirada.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResults(null);
    try {
      const { data, error } = await supabase.functions.invoke("partner-search-fleet", {
        body: {
          pickup_date: format(pickupDate, "yyyy-MM-dd"),
          return_date: format(returnDate, "yyyy-MM-dd"),
          category: category || undefined,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Falha na busca");
      setResults(data.results as SearchResult[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Tente novamente.";
      toast({ title: "Erro na busca", description: msg, variant: "destructive" });
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const days = useMemo(() =>
    pickupDate && returnDate
      ? Math.max(1, Math.ceil((returnDate.getTime() - pickupDate.getTime()) / 86400000))
      : 1
  , [pickupDate, returnDate]);

  const sortedResults = useMemo(() => {
    if (!results) return null;
    return [...results].sort((a, b) => a.daily_price_usd - b.daily_price_usd);
  }, [results]);

  if (authorizing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <PartnerHeader />

      <main className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6">
        <div>
          <button
            onClick={() => navigate("/parceiro")}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            <ArrowLeft size={14} /> Voltar ao painel
          </button>
          <h1 className="text-2xl sm:text-3xl font-semibold">Buscar frota disponível</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Consulte a disponibilidade em todas as locadoras parceiras da rede.
          </p>
        </div>

        {/* Search form */}
        <div className="rounded-2xl border border-border/40 bg-card p-4 sm:p-5 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Popover open={openPicker === "pickup"} onOpenChange={(o) => setOpenPicker(o ? "pickup" : null)}>
              <PopoverTrigger asChild>
                <button className={cn(
                  "flex items-center gap-2 px-3 py-3 rounded-xl border border-border/60 bg-background/50 text-left hover:border-primary/40 transition-colors",
                  pickupDate && "border-primary/30",
                )}>
                  <CalendarIcon size={16} className="text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Retirada</p>
                    <p className="text-sm text-foreground truncate">
                      {pickupDate ? format(pickupDate, "dd MMM yyyy", { locale: pt }) : "Selecione"}
                    </p>
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                <Calendar
                  mode="single"
                  selected={pickupDate}
                  onSelect={(d) => { setPickupDate(d); setOpenPicker(null); }}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <Popover open={openPicker === "return"} onOpenChange={(o) => setOpenPicker(o ? "return" : null)}>
              <PopoverTrigger asChild>
                <button className={cn(
                  "flex items-center gap-2 px-3 py-3 rounded-xl border border-border/60 bg-background/50 text-left hover:border-primary/40 transition-colors",
                  returnDate && "border-primary/30",
                )}>
                  <CalendarIcon size={16} className="text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Devolução</p>
                    <p className="text-sm text-foreground truncate">
                      {returnDate ? format(returnDate, "dd MMM yyyy", { locale: pt }) : "Selecione"}
                    </p>
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-popover border-border" align="start">
                <Calendar
                  mode="single"
                  selected={returnDate}
                  onSelect={(d) => { setReturnDate(d); setOpenPicker(null); }}
                  disabled={(date) => date <= (pickupDate || new Date())}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/60 bg-background/50">
              <MapPin size={16} className="text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Categoria</p>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-transparent text-sm text-foreground outline-none"
                >
                  <option value="">Todas</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <Button
              onClick={handleSearch}
              disabled={loading}
              className="gold-gradient text-primary-foreground font-bold uppercase tracking-widest h-auto py-3 rounded-xl hover:opacity-90 text-sm gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              Buscar
            </Button>
          </div>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <VehicleCardSkeleton key={i} />)}
          </div>
        )}

        {/* Empty state */}
        {!loading && sortedResults !== null && sortedResults.length === 0 && (
          <div className="rounded-2xl border border-border/40 bg-card p-10 flex flex-col items-center text-center gap-3 animate-in fade-in duration-300">
            <div className="h-14 w-14 rounded-full bg-muted/50 flex items-center justify-center">
              <SearchX className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Nenhum veículo disponível</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Não encontramos frota livre para essas datas. Tente ajustar o período ou remover o filtro de categoria.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => { setCategory(""); }}
              className="mt-2"
            >
              Limpar filtro de categoria
            </Button>
          </div>
        )}

        {/* Results */}
        {!loading && sortedResults !== null && sortedResults.length > 0 && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground tabular-nums">{sortedResults.length}</span>{" "}
                {sortedResults.length === 1 ? "veículo disponível" : "veículos disponíveis"}
                {" · "}
                <span className="tabular-nums">{days}</span> {days === 1 ? "diária" : "diárias"}
              </p>
              <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-400 font-semibold">
                <Sparkles size={11} /> Comissão calculada em cada card
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sortedResults.map((v) => {
                const totalRental = v.daily_price_usd * days;
                return (
                  <div
                    key={v.id}
                    className="group rounded-2xl border border-border/40 bg-card overflow-hidden flex flex-col hover:border-primary/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="aspect-[16/10] bg-muted/40 overflow-hidden">
                      <img
                        src={pickPhoto(v)}
                        alt={v.name}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-3.5 space-y-2.5 flex-1 flex flex-col">
                      <div className="min-w-0">
                        <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-semibold truncate">{v.category}</p>
                        <h3 className="text-sm font-semibold text-foreground truncate leading-tight">{v.name}</h3>
                      </div>

                      <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Users size={11} />{v.passengers}</span>
                        <span className="inline-flex items-center gap-1"><Briefcase size={11} />{v.bags}</span>
                        <span className="inline-flex items-center gap-1"><Settings2 size={11} />{v.transmission}</span>
                        <span className="inline-flex items-center gap-1"><Fuel size={11} />{v.fuel}</span>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
                        <Building2 size={11} className="text-primary shrink-0" />
                        <span className="truncate">{v.locadora_name}</span>
                      </div>

                      <CommissionCallout
                        commissionType={v.commission_type}
                        commissionValue={v.commission_value}
                        bookingTotal={totalRental}
                        size="sm"
                      />

                      <div className="flex items-end justify-between pt-2 mt-auto border-t border-border/30">
                        <div>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Total {days}d</p>
                          <p className="text-base font-semibold text-primary tabular-nums leading-tight">{fmtUSDCompact(totalRental)}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => navigate("/parceiro/reserva", {
                            state: {
                              vehicle: v,
                              pickup_date: format(pickupDate!, "yyyy-MM-dd"),
                              return_date: format(returnDate!, "yyyy-MM-dd"),
                            },
                          })}
                        >
                          Reservar
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Initial idle state */}
        {!loading && sortedResults === null && (
          <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-10 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Search className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Selecione as datas para começar</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Escolha retirada, devolução e (opcionalmente) uma categoria para ver a frota disponível em toda a rede.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
