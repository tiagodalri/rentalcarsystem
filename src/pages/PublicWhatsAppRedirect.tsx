import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

type State = "loading" | "not-found" | "redirecting";

export default function PublicWhatsAppRedirect() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let cancelled = false;
    if (!slug) {
      setState("not-found");
      return;
    }

    (async () => {
      const { data, error } = await supabase
        .from("whatsapp_links")
        .select("id, target_phone, prefilled_message")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setState("not-found");
        return;
      }

      const url = buildWhatsAppUrl(data.target_phone, data.prefilled_message ?? undefined);
      if (!url) {
        setState("not-found");
        return;
      }

      setState("redirecting");

      // Fire-and-forget click log with short timeout race.
      const clickInsert = supabase.from("whatsapp_link_clicks").insert({
        link_id: data.id,
        user_agent: (typeof navigator !== "undefined" ? navigator.userAgent : "").slice(0, 500),
        referrer: (typeof document !== "undefined" ? document.referrer : "").slice(0, 500),
      });

      await Promise.race([
        clickInsert,
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);

      if (!cancelled) {
        window.location.replace(url);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state === "not-found") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-xl font-semibold text-foreground">Link não encontrado</h1>
          <p className="text-sm text-muted-foreground">
            Este link não existe ou foi desativado. Verifique o endereço com quem enviou.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Redirecionando para o WhatsApp...
      </div>
    </div>
  );
}
