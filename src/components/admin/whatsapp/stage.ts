import type { FunnelStage } from "@/hooks/useWhatsAppConversations";

/**
 * Stage/tag badges — aligned with admin design system:
 * uppercase, tracking-wider, bg-X/15, text-X, border border-X/30, rounded, text-[9-10px] font-semibold.
 * Matches badge styles in AdminCustomers.tsx (Turo pill) and AdminDashboard.tsx status badges.
 */

export const STAGE_BADGE_BASE =
  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider border";

export const STAGES: { value: FunnelStage; label: string; cls: string; dot: string }[] = [
  { value: "novo_lead",          label: "Novo lead",          cls: "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30",       dot: "bg-blue-500" },
  { value: "atendimento",        label: "Em atendimento",     cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",   dot: "bg-amber-500" },
  { value: "proposta_enviada",   label: "Proposta enviada",   cls: "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30", dot: "bg-purple-500" },
  { value: "negociacao",         label: "Negociação",         cls: "bg-primary/15 text-primary border-primary/30",                              dot: "bg-primary" },
  { value: "reserva_confirmada", label: "Reserva confirmada", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30", dot: "bg-emerald-500" },
  { value: "perdido",            label: "Perdido",            cls: "bg-muted text-muted-foreground border-border",                              dot: "bg-muted-foreground/50" },
];

export function stageInfo(value: string | null | undefined) {
  return STAGES.find((s) => s.value === value) ?? STAGES[0];
}

/**
 * Deterministic tag class from a small palette aligned with the admin tokens.
 * Returns a full className string — replaces the previous inline-style rainbow generator.
 */
const TAG_PALETTE = [
  "bg-primary/15 text-primary border-primary/30",
  "bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
  "bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30",
  "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
  "bg-muted text-muted-foreground border-border",
];

export function tagClass(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) | 0;
  return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length];
}
