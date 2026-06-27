import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getSignedInspectionUrl } from "@/lib/inspectionStorage";
import { formatPersonName } from "@/lib/formatName";

interface Props {
  bookingId: string;
  type: "checkin" | "checkout";
  size?: "sm" | "default";
  variant?: "outline" | "default" | "secondary" | "ghost";
  className?: string;
  label?: string;
}

type ExteriorPhoto = { id?: string; position?: string; url?: string };

function buildMessage(args: {
  type: "checkin" | "checkout";
  customerName: string;
  vehicleLabel: string;
  plate?: string | null;
  pickupDate?: string | null;
  returnDate?: string | null;
  odometer?: number | null;
  fuel?: string | null;
  address?: string | null;
  agent?: string | null;
  damagesCount: number;
  photosCount: number;
  completedAt?: string | null;
}): string {
  const title = args.type === "checkin" ? "INSPEÇÃO DE ENTREGA" : "INSPEÇÃO DE DEVOLUÇÃO";
  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  const lines = [
    `*ZEUS RENTAL CAR — ${title}*`,
    ``,
    `*Cliente:* ${args.customerName}`,
    `*Veículo:* ${args.vehicleLabel}${args.plate ? ` (${args.plate})` : ""}`,
    `*Retirada:* ${fmtDate(args.pickupDate)}`,
    `*Devolução:* ${fmtDate(args.returnDate)}`,
    ``,
    `*Odômetro:* ${args.odometer != null ? `${args.odometer.toLocaleString("pt-BR")} mi` : "—"}`,
    `*Combustível:* ${args.fuel || "—"}`,
    `*Avarias registradas:* ${args.damagesCount}`,
    `*Fotos:* ${args.photosCount}`,
    ``,
    `*Local:* ${args.address || "—"}`,
    `*Agente:* ${args.agent || "—"}`,
    `*Concluída em:* ${fmtDate(args.completedAt)}`,
    ``,
    `_Mensagem gerada automaticamente pelo sistema Zeus._`,
  ];
  return lines.join("\n");
}

async function urlToFile(url: string, filename: string): Promise<File | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const type = blob.type || "image/jpeg";
    return new File([blob], filename, { type });
  } catch {
    return null;
  }
}

export function ShareWhatsAppInspectionButton({
  bookingId,
  type,
  size = "sm",
  variant = "default",
  className,
  label,
}: Props) {
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    setLoading(true);
    try {
      // Load booking + vehicle + inspection in one roundtrip.
      const { data: booking, error: bErr } = await supabase
        .from("bookings")
        .select("*, customer:customers(*), vehicle:vehicles(*), inspections:vehicle_inspections(*)")
        .eq("id", bookingId)
        .maybeSingle();
      if (bErr || !booking) throw bErr || new Error("Reserva não encontrada");

      const inspection = (booking as any).inspections?.find((i: any) => i.type === type);
      if (!inspection) throw new Error("Inspeção ainda não realizada.");

      const photos: ExteriorPhoto[] = Array.isArray(inspection.exterior_photos)
        ? (inspection.exterior_photos as ExteriorPhoto[])
        : [];

      const vehicle = (booking as any).vehicle;
      const customerName = formatPersonName(
        (booking as any).customer?.full_name || (booking as any).customer_name || "Cliente",
      );
      const vehicleLabel = vehicle
        ? [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(" ")
        : (booking as any).vehicle_name || "Veículo";

      const message = buildMessage({
        type,
        customerName,
        vehicleLabel,
        plate: vehicle?.license_plate ?? null,
        pickupDate: (booking as any).pickup_date,
        returnDate: (booking as any).return_date,
        odometer: inspection.odometer_reading ?? null,
        fuel: inspection.fuel_level ?? null,
        address: inspection.location_address ?? (booking as any).pickup_location ?? null,
        agent: inspection.agent_name ?? null,
        damagesCount: Array.isArray(inspection.damages) ? inspection.damages.length : 0,
        photosCount: photos.length,
        completedAt: inspection.completed_at ?? null,
      });

      // Resolve photo URLs in parallel.
      toast({ title: "Preparando fotos…", description: `Baixando ${photos.length} imagem(ns) para compartilhar.` });
      const files: File[] = [];
      const signed = await Promise.all(
        photos.map(async (p, idx) => {
          const url = await getSignedInspectionUrl(p.url || "");
          if (!url) return null;
          const safePos = (p.position || `foto-${idx + 1}`).toString().replace(/[^a-zA-Z0-9_-]/g, "_");
          const filename = `inspecao-${type}-${idx + 1}-${safePos}.jpg`;
          return urlToFile(url, filename);
        }),
      );
      for (const f of signed) if (f) files.push(f);

      // Web Share API Level 2: text + multiple files (WhatsApp on iOS/Android supports this).
      const shareData: ShareData = { text: message, title: "Inspeção Zeus" };
      const canShareFiles =
        typeof navigator !== "undefined" &&
        "canShare" in navigator &&
        files.length > 0 &&
        (navigator as any).canShare({ files });

      if (canShareFiles && navigator.share) {
        try {
          await navigator.share({ ...shareData, files } as any);
          toast({ title: "Pronto para enviar", description: "Selecione o WhatsApp na folha de compartilhamento." });
          return;
        } catch (err: any) {
          if (err?.name === "AbortError") return;
          // fall through to fallback
        }
      }

      // Fallback: open WhatsApp with the formatted message and download photos as a zip.
      await navigator.clipboard.writeText(message).catch(() => undefined);
      const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(waUrl, "_blank", "noopener,noreferrer");

      if (files.length > 0) {
        // Trigger sequential downloads so the user has the originals on hand.
        for (const file of files) {
          const u = URL.createObjectURL(file);
          const a = document.createElement("a");
          a.href = u;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(u), 1500);
        }
        toast({
          title: "Mensagem aberta no WhatsApp",
          description: `As ${files.length} foto(s) foram baixadas — anexe-as na conversa.`,
        });
      } else {
        toast({ title: "Mensagem aberta no WhatsApp", description: "Texto copiado também para a área de transferência." });
      }
    } catch (e: any) {
      toast({
        title: "Não foi possível compartilhar",
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
      {loading ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <MessageCircle size={14} className="mr-1.5" />}
      {label ?? "WhatsApp"}
    </Button>
  );
}
