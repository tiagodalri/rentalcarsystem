import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, UsersRound, Shield, X, Phone, Mail, ChevronRight } from "lucide-react";
import { formatPersonName } from "@/lib/formatName";
import { PullToRefresh } from "@/components/mobile/PullToRefresh";
import { LoadingRows } from "@/components/skeletons/LoadingRows";
import { TeamMemberProfileSheet, type TeamMember as ProfileMember } from "@/components/admin/TeamMemberProfileSheet";

/* ============================================================
   EQUIPE. Mobile-first
   Lista contato-style com função, status e ações rápidas.
   ============================================================ */

type Member = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  role: string;
  is_active: boolean;
};

const initials = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
const onlyDigits = (s: string | null) => (s || "").replace(/\D/g, "");

export default function MobileTeam() {
  const [items, setItems] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fullMember, setFullMember] = useState<ProfileMember | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("team_members")
      .select("id, full_name, email, phone, position, role, is_active")
      .order("full_name");
    setItems((data as Member[]) || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const openProfile = async (id: string) => {
    setSelectedId(id);
    setProfileOpen(true);
    const { data } = await supabase.from("team_members").select("*").eq("id", id).maybeSingle();
    if (data) setFullMember(data as unknown as ProfileMember);
  };

  const filtered = useMemo(() => items.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${m.full_name} ${m.position || ""} ${m.role}`.toLowerCase().includes(q);
  }), [items, search]);

  return (
    <PullToRefresh onRefresh={load}>
      <div className="pb-24">
        <div className="px-4 pt-1">
          <p className="text-xs text-muted-foreground">{filtered.length} membros</p>


          <div className="mt-3 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar membro"
              className="w-full h-11 pl-10 pr-10 rounded-xl bg-card border border-border/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 space-y-2 px-4">
          {loading ? (
            <LoadingRows count={5} rowHeight={64} />
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Nenhum membro.</div>
          ) : filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => openProfile(m.id)}
              className={`w-full text-left p-3.5 rounded-xl bg-card border border-border/50 active:scale-[0.99] transition-transform ${!m.is_active ? "opacity-50" : ""}`}
            >
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                  {initials(m.full_name) || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{formatPersonName(m.full_name)}</div>
                      <div className="text-xs text-muted-foreground truncate">{m.position || ""}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {m.role === "admin" && (
                        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          <Shield size={10} /> Admin
                        </span>
                      )}
                      <ChevronRight size={14} className="text-muted-foreground/60" />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {m.phone && (
                      <a href={`tel:${onlyDigits(m.phone)}`} className="h-8 px-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 inline-flex items-center gap-1.5 text-xs font-medium">
                        <Phone size={12} /> Ligar
                      </a>
                    )}
                    {m.email && (
                      <a href={`mailto:${m.email}`} className="h-8 px-2.5 rounded-lg bg-muted text-foreground inline-flex items-center gap-1.5 text-xs font-medium">
                        <Mail size={12} /> Email
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <TeamMemberProfileSheet
        open={profileOpen}
        onOpenChange={(v) => { setProfileOpen(v); if (!v) { setSelectedId(null); setFullMember(null); } }}
        member={fullMember}
        onChanged={load}
      />
    </PullToRefresh>
  );
}
