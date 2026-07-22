import { Handshake, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BrandLogo from "@/components/BrandLogo";
import { supabase } from "@/integrations/supabase/client";

export default function PartnerHeader({ email }: { email?: string | null }) {
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/parceiro/login", { replace: true });
  };
  return (
    <header className="sticky top-0 z-30 border-b border-border/40 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3">
      <button
        onClick={() => navigate("/parceiro")}
        className="flex items-center gap-3 min-w-0 group"
      >
        <BrandLogo className="h-7 shrink-0" />
        <span className="hidden sm:inline-flex text-[10px] uppercase tracking-[0.24em] text-muted-foreground items-center gap-1.5 group-hover:text-foreground transition-colors">
          <Handshake size={12} className="text-primary" /> Portal Parceiro
        </span>
      </button>
      <div className="flex items-center gap-2">
        {email && (
          <span className="hidden md:inline text-xs text-muted-foreground truncate max-w-[220px]">{email}</span>
        )}
        <button
          onClick={signOut}
          className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/40"
        >
          <LogOut size={13} /> Sair
        </button>
      </div>
    </header>
  );
}
