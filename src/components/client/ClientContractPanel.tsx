import { useState, type ReactNode } from "react";
import { FileSignature, CheckCircle2, Clock, AlertTriangle, Loader2, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  bookingId: string;
  contractStatus: string | null;
  signedAt: string | null;
  signedPdfPath: string | null;
};

const ClientContractPanel = ({ bookingId, contractStatus, signedAt, signedPdfPath }: Props) => {
  const [loading, setLoading] = useState(false);

  const status = (contractStatus || "not_sent") as
    | "not_sent" | "generating" | "sent" | "partially_signed" | "signed" | "cancelled" | "failed";

  const fetchSignUrl = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-contract-sign-url", {
        body: { booking_id: bookingId },
      });
      if (error) throw new Error(error.message);
      const url = (data as any)?.sign_url;
      if (!url) throw new Error("Link de assinatura indisponível.");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível abrir o contrato.");
    } finally {
      setLoading(false);
    }
  };

  const downloadSigned = async () => {
    if (!signedPdfPath) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.storage
        .from("signed-contracts")
        .createSignedUrl(signedPdfPath, 60 * 10);
      if (error || !data?.signedUrl) throw new Error(error?.message || "Falha ao gerar link.");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao baixar contrato.");
    } finally {
      setLoading(false);
    }
  };

  let header: { icon: typeof Clock; label: string; tone: string };
  let body: ReactNode;

  switch (status) {
    case "signed":
      header = { icon: CheckCircle2, label: "Contrato assinado", tone: "text-emerald-600" };
      body = (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            Assinado em {signedAt ? new Date(signedAt).toLocaleDateString("pt-BR") : "—"}.
          </p>
          {signedPdfPath ? (
            <button
              onClick={downloadSigned}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 gold-gradient text-primary-foreground px-4 py-3 rounded-lg text-sm font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              Baixar contrato assinado
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">PDF assinado será disponibilizado em instantes.</p>
          )}
        </>
      );
      break;
    case "sent":
    case "partially_signed":
      header = { icon: Clock, label: "Aguardando sua assinatura", tone: "text-amber-600" };
      body = (
        <>
          <p className="text-xs text-muted-foreground mb-3">
            O contrato foi gerado e pré-assinado pela GoDrive. Falta apenas a sua assinatura para concluir.
          </p>
          <button
            onClick={fetchSignUrl}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 gold-gradient text-primary-foreground px-4 py-3 rounded-lg text-sm font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
            Assinar contrato
          </button>
        </>
      );
      break;
    case "generating":
      header = { icon: Loader2, label: "Gerando contrato", tone: "text-blue-600" };
      body = (
        <p className="text-xs text-muted-foreground">
          Estamos preparando seu contrato. Isso costuma levar menos de um minuto.
        </p>
      );
      break;
    case "failed":
      header = { icon: AlertTriangle, label: "Falha ao gerar contrato", tone: "text-red-600" };
      body = (
        <p className="text-xs text-muted-foreground">
          Algo deu errado. Fale com a GoDrive pelo WhatsApp e geraremos novamente.
        </p>
      );
      break;
    case "cancelled":
      header = { icon: AlertTriangle, label: "Contrato cancelado", tone: "text-muted-foreground" };
      body = <p className="text-xs text-muted-foreground">Este contrato foi cancelado.</p>;
      break;
    default:
      header = { icon: Clock, label: "Aguardando confirmação do pagamento", tone: "text-muted-foreground" };
      body = (
        <p className="text-xs text-muted-foreground">
          Assim que o pagamento for confirmado, o contrato é gerado, pré-assinado pela GoDrive e enviado para sua assinatura.
        </p>
      );
  }

  const Icon = header.icon;

  return (
    <div className="rounded-xl border border-border/50 bg-card/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileSignature size={16} className="text-muted-foreground" />
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Contrato de locação</p>
      </div>
      <div className={`flex items-center gap-2 text-sm font-medium ${header.tone}`}>
        <Icon size={14} className={status === "generating" ? "animate-spin" : ""} />
        {header.label}
      </div>
      {body}
    </div>
  );
};

export default ClientContractPanel;
