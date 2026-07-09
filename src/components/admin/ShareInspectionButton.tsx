import { useState } from "react";
import { Share2, Check, Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  bookingId: string;
  type: "checkin" | "checkout";
  size?: "sm" | "default";
  variant?: "outline" | "default" | "secondary" | "ghost";
  className?: string;
  label?: string;
}

export function ShareInspectionButton({ bookingId, type, size = "sm", variant = "outline", className, label }: Props) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-public-inspection-link", {
        body: { booking_id: bookingId, type },
      });
      if (error || !data?.token) throw error || new Error("Falha ao gerar link");
      const url = `${window.location.origin}/share/inspection/${data.token}`;

      // Try native share first (mobile-friendly)
      const shareTitle = type === "checkin" ? "Inspeção de Entrega — Sua Marca" : "Inspeção de Devolução — Sua Marca";
      if (navigator.share) {
        try {
          await navigator.share({ title: shareTitle, url });
          toast({ title: "Link compartilhado", description: "Inspeção enviada com sucesso." });
          return;
        } catch {
          // user cancelled or unsupported — fall back to clipboard
        }
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
      toast({
        title: "Link copiado",
        description: "Cole no WhatsApp, e-mail ou onde preferir.",
      });
    } catch (e: any) {
      toast({
        title: "Não foi possível gerar o link",
        description: e?.message || "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size={size}
      variant={variant}
      onClick={handleShare}
      disabled={loading}
      className={className}
    >
      {loading ? <Loader2 size={14} className="mr-1.5 animate-spin" />
        : copied ? <Check size={14} className="mr-1.5" />
        : <Share2 size={14} className="mr-1.5" />}
      {label ?? (copied ? "Link copiado" : "Compartilhar")}
    </Button>
  );
}
