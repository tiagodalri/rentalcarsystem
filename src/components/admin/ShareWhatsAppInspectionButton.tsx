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
  bookingNumber?: string | null;
  turoReservationCode?: string | null;
  customerName: string;
  vehicleLabel: string;
  plate?: string | null;
  pickupDate?: string | null;
  returnDate?: string | null;
  pickupLocation?: string | null;
  returnLocation?: string | null;
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
    `*GODRIVE — ${title}*`,
    ``,
    `*Código GoDrive:* ${args.bookingNumber || "—"}`,
    `*Código Turo:* ${args.turoReservationCode || "—"}`,
    `*Cliente:* ${args.customerName}`,
    `*Veículo:* ${args.vehicleLabel}${args.plate ? ` (${args.plate})` : ""}`,
    `*Retirada:* ${fmtDate(args.pickupDate)}`,
    `*Local de retirada:* ${args.pickupLocation || "—"}`,
    `*Devolução:* ${fmtDate(args.returnDate)}`,
    `*Local de devolução:* ${args.returnLocation || "—"}`,
    ``,
    `*Odômetro:* ${args.odometer != null ? `${args.odometer.toLocaleString("pt-BR")} mi` : "—"}`,
    `*Combustível:* ${args.fuel || "—"}`,
    `*Avarias registradas:* ${args.damagesCount}`,
    `*Fotos:* ${args.photosCount}`,
    ``,
    `*Local da inspeção:* ${args.address || "—"}`,
    `*Agente:* ${args.agent || "—"}`,
    `*Concluída em:* ${fmtDate(args.completedAt)}`,
    ``,
    `_Mensagem gerada automaticamente pelo sistema GoDrive._`,
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

    // IMPORTANTE: abrir a janela do WhatsApp SINCRONAMENTE dentro do clique.
    // Se abrirmos depois de qualquer `await`, o navegador bloqueia o popup e
    // os downloads rodam sozinhos sem o WhatsApp abrir.
    let waWindow: Window | null = null;
    const isDesktopLike =
      typeof window !== "undefined" &&
      !/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isDesktopLike) {
      waWindow = window.open("about:blank", "_blank", "noopener,noreferrer");
    }

    try {
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
        bookingNumber: (booking as any).booking_number ?? null,
        turoReservationCode: (booking as any).turo_reservation_code ?? null,
        customerName,
        vehicleLabel,
        plate: vehicle?.license_plate ?? null,
        pickupDate: (booking as any).pickup_date,
        returnDate: (booking as any).return_date,
        pickupLocation: (booking as any).pickup_location ?? null,
        returnLocation: (booking as any).return_location ?? null,
        odometer: inspection.odometer_reading ?? null,
        fuel: inspection.fuel_level ?? null,
        address:
          (inspection as any).location_address ||
          (type === "checkin" ? (booking as any).pickup_location : (booking as any).return_location) ||
          null,
        agent: inspection.agent_name ?? null,
        damagesCount: Array.isArray(inspection.damages) ? inspection.damages.length : 0,
        photosCount: photos.length,
        completedAt: inspection.completed_at ?? null,
      });

      const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

      // 1) MOBILE — fluxo em 2 etapas, sempre com gesto explícito do usuário.
      //    Auto-redirect após navigator.share é bloqueado por muitos browsers
      //    (perde o gesto) e trava o usuário na página do wa.me. Por isso:
      //    a) copiamos a mensagem no clipboard
      //    b) abrimos wa.me com o texto AGORA (mesmo gesto do clique)
      //    c) baixamos fotos em paralelo — ficam salvas na galeria pro user anexar
      if (!isDesktopLike) {
        // Copia mensagem ANTES de qualquer await (garante permissão do gesto).
        await navigator.clipboard.writeText(message).catch(() => undefined);

        // Abre WhatsApp com a mensagem pronta — usa o gesto original do clique.
        // location.href funciona melhor que window.open no iOS para deep links.
        window.location.href = waUrl;

        toast({
          title: "WhatsApp aberto com a mensagem",
          description: `Baixando ${photos.length} foto(s) — anexe pela galeria do WhatsApp.`,
        });

        // Baixa as fotos em background (não bloqueia a abertura do WhatsApp).
        // Em mobile, o navegador salva os arquivos na pasta Downloads/Fotos.
        (async () => {
          const signed = await Promise.all(
            photos.map(async (p, idx) => {
              const url = await getSignedInspectionUrl(p.url || "");
              if (!url) return null;
              const safePos = (p.position || `foto-${idx + 1}`).toString().replace(/[^a-zA-Z0-9_-]/g, "_");
              return urlToFile(url, `inspecao-${type}-${idx + 1}-${safePos}.jpg`);
            }),
          );
          for (const f of signed) {
            if (!f) continue;
            const u = URL.createObjectURL(f);
            const a = document.createElement("a");
            a.href = u;
            a.download = f.name;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(u), 2000);
          }
        })().catch(() => undefined);

        return;
      }

      // 2) Desktop: redireciona a janela já aberta para o WhatsApp Web.
      await navigator.clipboard.writeText(message).catch(() => undefined);
      if (waWindow && !waWindow.closed) {
        waWindow.location.href = waUrl;
      } else {
        // popup bloqueado — última tentativa
        window.open(waUrl, "_blank", "noopener,noreferrer");
      }

      // 3) Em paralelo, baixa as fotos para o usuário anexar manualmente no WhatsApp Web.
      toast({ title: "Baixando fotos…", description: `${photos.length} imagem(ns) — anexe no WhatsApp Web.` });
      const files: File[] = [];
      const signed = await Promise.all(
        photos.map(async (p, idx) => {
          const url = await getSignedInspectionUrl(p.url || "");
          if (!url) return null;
          const safePos = (p.position || `foto-${idx + 1}`).toString().replace(/[^a-zA-Z0-9_-]/g, "_");
          return urlToFile(url, `inspecao-${type}-${idx + 1}-${safePos}.jpg`);
        }),
      );
      for (const f of signed) if (f) files.push(f);

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
        title: "WhatsApp aberto",
        description: `Mensagem pronta. ${files.length} foto(s) baixada(s) — arraste para a conversa.`,
      });
    } catch (e: any) {
      // se já abrimos a janela em branco e deu erro, fecha pra não deixar lixo
      if (waWindow && !waWindow.closed) waWindow.close();
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
