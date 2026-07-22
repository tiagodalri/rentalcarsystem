import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { pt } from "date-fns/locale";
import { Loader2, LogOut, Handshake, Search, CalendarIcon, MapPin, Users, Briefcase, Settings2, Fuel, Building2, ArrowLeft } from "lucide-react";
import CommissionCallout from "@/components/parceiro/CommissionCallout";
import { supabase } from "@/integrations/supabase/client";
import BrandLogo from "@/components/BrandLogo";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getCoverImage } from "@/data/vehicleImages";

type SearchResult = {
  id: string;
  name: string;
  category: string;
  daily_price_usd: number;
  image_url: string | null;
  photos: any;
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
  const arr = Array.isArray(v.photos) ? v.photos : [];
  const first = arr.find((p: any) => typeof p === "string" && p)
    || (typeof arr[0]?.url === "string" ? arr[0].url : null);
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

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/parceiro/login", { replace: true });
  };

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
    } catch (e: any) {
      toast({ title: "Erro na busca", description: e?.message || "Tente novamente.", variant: "destructive" });
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const days = pickupDate && returnDate
    ? Math.max(1, Math.ceil((returnDate.getTime() - pickupDate.getTime()) / 86400000))
    : 1;

  // commission label handled by CommissionCallout component

  if (authorizing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo className="h-7 shrink-0" />
          <span className="hidden sm:inline text-xs uppercase tracking-[0.22em] text-muted-foreground items-center gap-1.5">
            <Handshake size={13} className="text-primary inline mr-1" /> Parceiro
          </span>
        </div>
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <LogOut size={14} /> Sair
        </button>
      </header>

      <main className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
        <div>
          <button
            onClick={() => navigate("/parceiro")}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground mb-3"
          >
            <ArrowLeft size={14} /> Voltar ao painel
          </button>
          <h1 className="text-2xl sm:text-3xl font-semibold">Buscar frota disponível</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Consulte a disponibilidade em todas as locadoras parceiras da rede.
          </p>
        </div>

        {/* Search form */}
        <div className="rounded-2xl border border-border/40 bg-card p-4 sm:p-6">
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

        {/* Results */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {!loading && results !== null && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {results.length === 0
                ? "Nenhum veículo disponível para o período informado."
                : `${results.length} ${results.length === 1 ? "veículo disponível" : "veículos disponíveis"} · ${days} ${days === 1 ? "diária" : "diárias"}`}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((v) => {
                const totalRental = v.daily_price_usd * days;
                return (
                  <div key={v.id} className="rounded-2xl border border-border/40 bg-card overflow-hidden flex flex-col">
                    <div className="aspect-[16/10] bg-muted/40 overflow-hidden">
                      <img src={pickPhoto(v)} alt={v.name} loading="lazy" className="w-full h-full object-cover" />
                    </div>
                    <div className="p-4 space-y-3 flex-1 flex flex-col">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{v.category}</p>
                        <h3 className="text-base font-semibold text-foreground truncate">{v.name}</h3>
                      </div>

                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><Users size={12} />{v.passengers}</span>
                        <span className="inline-flex items-center gap-1"><Briefcase size={12} />{v.bags}</span>
                        <span className="inline-flex items-center gap-1"><Settings2 size={12} />{v.transmission}</span>
                        <span className="inline-flex items-center gap-1"><Fuel size={12} />{v.fuel}</span>
                      </div>

                      <div className="rounded-lg border border-border/40 bg-background/50 p-3 space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 text-foreground">
                          <Building2 size={12} className="text-primary" />
                          <span className="font-medium">Locadora:</span>
                          <span className="text-muted-foreground truncate">{v.locadora_name}</span>
                        </div>
                      </div>

                      <CommissionCallout
                        commissionType={v.commission_type}
                        commissionValue={v.commission_value}
                        bookingTotal={totalRental}
                        size="sm"
                      />

                      <div className="flex items-end justify-between pt-2 mt-auto border-t border-border/30">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total ({days}d)</p>
                          <p className="text-lg font-semibold text-primary tabular-nums">US$ {Math.round(totalRental)}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate("/parceiro/reserva", {
                            state: {
                              vehicle: v,
                              pickup_date: format(pickupDate!, "yyyy-MM-dd"),
                              return_date: format(returnDate!, "yyyy-MM-dd"),
                            },
                          })}
                        >
                          Solicitar reserva
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
