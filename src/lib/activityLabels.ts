// Friendly Portuguese labels for activity logs (no technical jargon).

const ROUTE_LABELS: Array<[RegExp, string]> = [
  [/^\/admin\/dashboard$/, "Painel inicial"],
  [/^\/admin\/bookings\/[^/]+$/, "Detalhes da reserva"],
  [/^\/admin\/bookings$/, "Reservas"],
  [/^\/admin\/calendar$/, "Calendário da frota"],
  [/^\/admin\/ops-today$/, "Operação do dia"],
  [/^\/admin\/vehicles\/[^/]+$/, "Detalhes do veículo"],
  [/^\/admin\/vehicles$/, "Frota"],
  [/^\/admin\/customers\/[^/]+$/, "Detalhes do cliente"],
  [/^\/admin\/customers$/, "Clientes"],
  [/^\/admin\/finance$/, "Financeiro"],
  [/^\/admin\/team$/, "Equipe"],
  [/^\/admin\/contracts\/template$/, "Modelo de contrato"],
  [/^\/admin\/contracts$/, "Contratos"],
  [/^\/admin\/turo-import$/, "Importação Turo"],
  [/^\/admin\/tutoriais$/, "Tutoriais"],
  [/^\/admin\/logs$/, "Painel de logs"],
  [/^\/admin\/pendencias$/, "Pendências da frota"],
  [/^\/admin\/settings$/, "Configurações"],
  [/^\/admin\/stamp-preview$/, "Pré-visualização de carimbo"],
  [/^\/admin\/ai-studio\/simulador/, "AI Studio .  Simulador"],
  [/^\/admin\/ai-studio/, "AI Studio"],
  [/^\/admin\/inspection/, "Inspeção de veículo"],
  [/^\/admin\/report\/fleet-pnl/, "Relatório de lucros da frota"],
  [/^\/admin$/, "Área administrativa"],
  [/^\/cadastro/, "Cadastro de cliente"],
  [/^\/login/, "Login"],
  [/^\/minha-area/, "Área do cliente"],
  [/^\/booking/, "Reservar veículo"],
  [/^\/frota/, "Frota pública"],
  [/^\/inspecao\//, "Inspeção pública"],
  [/^\/$/, "Página inicial"],
];

export function friendlyRoute(path: string | null | undefined): string {
  if (!path) return "Local desconhecido";
  const clean = path.split("?")[0];
  for (const [re, label] of ROUTE_LABELS) if (re.test(clean)) return label;
  return clean;
}

export function friendlyEventType(type: string): string {
  switch (type) {
    case "pageview": return "Acessou página";
    case "auth.login": return "Entrou no sistema";
    case "auth.logout": return "Saiu do sistema";
    case "auth.password_recovery": return "Pediu recuperação de senha";
    case "click": return "Clicou";
    case "form.submit": return "Enviou formulário";
    case "search": return "Pesquisou";
    default:
      if (type.startsWith("click.")) return "Clicou";
      return type;
  }
}

export function friendlyAction(action: string): string {
  switch (action) {
    case "insert": return "Criou";
    case "update": return "Editou";
    case "delete": return "Excluiu";
    case "soft_delete": return "Arquivou";
    case "restore": return "Restaurou";
    default: return action;
  }
}

export function friendlyTable(name: string): string {
  const map: Record<string, string> = {
    bookings: "Reserva",
    vehicles: "Veículo",
    customers: "Cliente",
    vehicle_inspections: "Inspeção",
    vehicle_incidents: "Incidente",
    vehicle_expenses: "Despesa do veículo",
    vehicle_documents: "Documento do veículo",
    financial_transactions: "Lançamento financeiro",
    financial_accounts: "Conta financeira",
    financial_categories: "Categoria financeira",
    team_members: "Membro da equipe",
    user_roles: "Permissão de usuário",
    customer_notes: "Anotação do cliente",
    customer_tags: "Etiqueta de cliente",
    contract_templates: "Modelo de contrato",
    payment_requests: "Cobrança",
    public_inspection_links: "Link público de inspeção",
    vehicle_price_overrides: "Preço personalizado",
    vehicle_price_seasons: "Temporada de preço",
    vehicle_pricing_rules: "Regra de preço",
  };
  return map[name] || name;
}

export function describeDevice(d: { device?: string | null; browser?: string | null; os?: string | null }) {
  const dev = d.device === "mobile" ? "Celular" : d.device === "tablet" ? "Tablet" : d.device === "desktop" ? "Computador" : "Aparelho";
  const parts = [dev, d.os, d.browser].filter(Boolean);
  return parts.join(" • ");
}

export function describeNavigation(l: {
  event_type: string;
  event_name?: string | null;
  path?: string | null;
  metadata?: any;
}): { title: string; subtitle: string } {
  const where = friendlyRoute(l.path);
  if (l.event_type === "pageview") {
    const prev = l.metadata?.previous ? friendlyRoute(l.metadata.previous) : null;
    return {
      title: `Abriu "${where}"`,
      subtitle: prev && prev !== where ? `Vindo de "${prev}"` : "Entrada direta",
    };
  }
  if (l.event_type === "auth.login") return { title: "Entrou no sistema", subtitle: `Em "${where}"` };
  if (l.event_type === "auth.logout") return { title: "Saiu do sistema", subtitle: `De "${where}"` };
  if (l.event_type === "click" || l.event_type.startsWith("click.")) {
    const label = l.metadata?.label || l.event_name || "elemento";
    return { title: `Clicou em "${label}"`, subtitle: `Em "${where}"` };
  }
  if (l.event_type === "form.submit") {
    const label = l.metadata?.label || l.event_name || "formulário";
    return { title: `Enviou "${label}"`, subtitle: `Em "${where}"` };
  }
  return { title: l.event_name || friendlyEventType(l.event_type), subtitle: `Em "${where}"` };
}

export function fmtDuration(ms?: number | null): string | null {
  if (!ms || ms < 0) return null;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}min${rs ? ` ${rs}s` : ""}`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h${rm ? ` ${rm}min` : ""}`;
}
