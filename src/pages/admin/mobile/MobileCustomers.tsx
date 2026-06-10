import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, Phone, MessageCircle, X } from "lucide-react";
import { formatPersonName } from "@/lib/formatName";
import { PullToRefresh } from "@/components/mobile/PullToRefresh";
import { CustomersSubNav } from "@/components/admin/CustomersSubNav";

/* ============================================================
   CLIENTES — Mobile-first
   Lista estilo agenda do iPhone: avatares com inicial,
   agrupado por letra, swipe→ligar/whatsapp.
   ============================================================ */

type Customer = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
};

const initials = (name: string) =>
  name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

const onlyDigits = (s: string | null) => (s || "").replace(/\D/g, "");

export default function MobileCustomers() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("customers")
      .select("id, full_name, email, phone")
      .is("deleted_at", null)
      .order("full_name");
    setItems((data as Customer[]) || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((c) =>
      !q || `${c.full_name} ${c.email || ""} ${c.phone || ""}`.toLowerCase().includes(q),
    );
  }, [items, search]);

  const grouped = useMemo(() => {
    const g: Record<string, Customer[]> = {};
    filtered.forEach((c) => {
      const letter = (c.full_name?.[0] || "#").toUpperCase();
      const key = /[A-Z]/.test(letter) ? letter : "#";
      (g[key] ||= []).push(c);
    });
    return Object.entries(g).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <PullToRefresh onRefresh={load}>
      <div className="pb-28">
        <div className="px-3 pt-2">
          <CustomersSubNav />
        </div>
        <div className="px-4">
          <h1 className="admin-h1 text-2xl">Clientes</h1>
          <p className="text-xs text-muted-foreground mt-1">{filtered.length} cadastrados</p>

          <div className="mt-3 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente"
              className="w-full h-11 pl-10 pr-10 rounded-xl bg-card border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : grouped.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">Nenhum cliente.</div>
          ) : grouped.map(([letter, list]) => (
            <div key={letter} className="mb-2">
              <div className="px-4 py-1.5 text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground bg-muted/40 sticky top-0 backdrop-blur z-10">
                {letter}
              </div>
              {list.map((c) => (
                <div key={c.id} className="flex items-center px-4 py-3 border-b border-border/30 bg-card">
                  <button
                    onClick={() => navigate(`/admin/customers/${c.id}`)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                      {initials(c.full_name) || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{formatPersonName(c.full_name)}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.phone || c.email || "—"}</div>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {c.phone && (
                      <>
                        <a href={`tel:${onlyDigits(c.phone)}`} className="h-9 w-9 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center active:bg-emerald-500/20">
                          <Phone size={15} />
                        </a>
                        <a href={`https://wa.me/${onlyDigits(c.phone)}`} target="_blank" rel="noreferrer" className="h-9 w-9 rounded-full bg-[#25D366]/15 text-[#1ea152] flex items-center justify-center active:bg-[#25D366]/25">
                          <MessageCircle size={15} />
                        </a>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <button
          onClick={() => navigate("/admin/customers?new=1")}
          className="fixed right-4 bottom-24 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-2xl flex items-center justify-center z-30 active:scale-95 transition-transform"
          aria-label="Novo cliente"
          style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        >
          <Plus size={22} />
        </button>
      </div>
    </PullToRefresh>
  );
}
