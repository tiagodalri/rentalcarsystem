import type { FunnelStage } from "@/hooks/useWhatsAppConversations";

export const STAGES: { value: FunnelStage; label: string; cls: string; dot: string }[] = [
  { value: "novo_lead",          label: "Novo lead",          cls: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300",       dot: "bg-blue-500" },
  { value: "atendimento",        label: "Em atendimento",     cls: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300",   dot: "bg-amber-500" },
  { value: "proposta_enviada",   label: "Proposta enviada",   cls: "bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-300", dot: "bg-purple-500" },
  { value: "negociacao",         label: "Negociação",         cls: "bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-300", dot: "bg-orange-500" },
  { value: "reserva_confirmada", label: "Reserva confirmada", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300", dot: "bg-emerald-500" },
  { value: "perdido",            label: "Perdido",            cls: "bg-muted text-muted-foreground border-border",                                dot: "bg-muted-foreground/50" },
];

export function stageInfo(value: string | null | undefined) {
  return STAGES.find((s) => s.value === value) ?? STAGES[0];
}

// Deterministic tag color
export function tagStyle(tag: string): React.CSSProperties {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return {
    background: `hsl(${hue} 70% 92%)`,
    color: `hsl(${hue} 55% 30%)`,
    borderColor: `hsl(${hue} 60% 75%)`,
  };
}
