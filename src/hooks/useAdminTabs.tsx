import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export const MAX_TABS = 10;

export type AdminTab = {
  id: string;
  path: string;
};

type Ctx = {
  tabs: AdminTab[];
  activeId: string | null;
  openTab: (path: string) => void;          // abre nova aba (ou ativa existente do mesmo path se já existir)
  duplicateTab: (path: string) => void;     // sempre cria nova aba, mesmo se path já existir
  closeTab: (id: string) => void;
  activateTab: (id: string) => void;
  canAddMore: boolean;
};

const AdminTabsContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "zeus.admin.tabs.v1";

const newId = () => `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

type Persisted = { tabs: AdminTab[]; activeId: string | null };

function loadInitial(currentPath: string): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Persisted;
      if (parsed?.tabs?.length) {
        // Garante que a aba ativa reflita a rota atual quando aplicável
        const matchActive = parsed.tabs.find((t) => t.path === currentPath);
        return {
          tabs: parsed.tabs.slice(0, MAX_TABS),
          activeId: matchActive?.id ?? parsed.activeId ?? parsed.tabs[0].id,
        };
      }
    }
  } catch {
    /* noop */
  }
  const id = newId();
  return { tabs: [{ id, path: currentPath }], activeId: id };
}

export function AdminTabsProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const initialPath = location.pathname + location.search;

  const [{ tabs, activeId }, setState] = useState<Persisted>(() => loadInitial(initialPath));
  const ignoreNextLocationSync = useRef(false);

  // Persistência
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabs, activeId }));
    } catch {
      /* noop */
    }
  }, [tabs, activeId]);

  // Sincroniza mudança de rota -> atualiza o path da aba ativa
  useEffect(() => {
    if (ignoreNextLocationSync.current) {
      ignoreNextLocationSync.current = false;
      return;
    }
    const full = location.pathname + location.search;
    setState((prev) => {
      if (!prev.activeId) return prev;
      const idx = prev.tabs.findIndex((t) => t.id === prev.activeId);
      if (idx === -1) return prev;
      if (prev.tabs[idx].path === full) return prev;
      const next = [...prev.tabs];
      next[idx] = { ...next[idx], path: full };
      return { ...prev, tabs: next };
    });
  }, [location.pathname, location.search]);

  const activateTab = useCallback(
    (id: string) => {
      setState((prev) => {
        const tab = prev.tabs.find((t) => t.id === id);
        if (!tab) return prev;
        ignoreNextLocationSync.current = true;
        navigate(tab.path);
        return { ...prev, activeId: id };
      });
    },
    [navigate],
  );

  const openTab = useCallback(
    (path: string) => {
      setState((prev) => {
        // Se já existir aba com o mesmo path, apenas ativa
        const existing = prev.tabs.find((t) => t.path === path);
        if (existing) {
          ignoreNextLocationSync.current = true;
          navigate(existing.path);
          return { ...prev, activeId: existing.id };
        }
        if (prev.tabs.length >= MAX_TABS) {
          return prev; // limite atingido
        }
        const id = newId();
        ignoreNextLocationSync.current = true;
        navigate(path);
        return { tabs: [...prev.tabs, { id, path }], activeId: id };
      });
    },
    [navigate],
  );

  const duplicateTab = useCallback(
    (path: string) => {
      setState((prev) => {
        if (prev.tabs.length >= MAX_TABS) return prev;
        const id = newId();
        ignoreNextLocationSync.current = true;
        navigate(path);
        return { tabs: [...prev.tabs, { id, path }], activeId: id };
      });
    },
    [navigate],
  );

  const closeTab = useCallback(
    (id: string) => {
      setState((prev) => {
        if (prev.tabs.length <= 1) return prev; // sempre mantém pelo menos 1
        const idx = prev.tabs.findIndex((t) => t.id === id);
        if (idx === -1) return prev;
        const nextTabs = prev.tabs.filter((t) => t.id !== id);
        let nextActive = prev.activeId;
        if (prev.activeId === id) {
          const fallback = nextTabs[Math.min(idx, nextTabs.length - 1)];
          nextActive = fallback.id;
          ignoreNextLocationSync.current = true;
          navigate(fallback.path);
        }
        return { tabs: nextTabs, activeId: nextActive };
      });
    },
    [navigate],
  );

  const value = useMemo<Ctx>(
    () => ({
      tabs,
      activeId,
      openTab,
      duplicateTab,
      closeTab,
      activateTab,
      canAddMore: tabs.length < MAX_TABS,
    }),
    [tabs, activeId, openTab, duplicateTab, closeTab, activateTab],
  );

  return <AdminTabsContext.Provider value={value}>{children}</AdminTabsContext.Provider>;
}

export function useAdminTabs() {
  const ctx = useContext(AdminTabsContext);
  if (!ctx) throw new Error("useAdminTabs deve ser usado dentro de AdminTabsProvider");
  return ctx;
}

// Resolve um título amigável a partir do path
const TITLE_MAP: Array<{ test: (p: string) => boolean; title: string }> = [
  { test: (p) => p === "/admin" || p === "/admin/", title: "Painel" },
  { test: (p) => p.startsWith("/admin/ops-today"), title: "Operação Hoje" },
  { test: (p) => p.startsWith("/admin/live"), title: "Live" },
  { test: (p) => p.startsWith("/admin/ai-studio/simulador"), title: "AI Studio" },
  { test: (p) => p.startsWith("/admin/frota-inteligente"), title: "Frota Inteligente" },
  { test: (p) => p.startsWith("/admin/bookings/new"), title: "Nova Reserva" },
  { test: (p) => /^\/admin\/bookings\/[^/]+/.test(p), title: "Reserva" },
  { test: (p) => p.startsWith("/admin/bookings"), title: "Reservas" },
  { test: (p) => p.startsWith("/admin/calendar"), title: "Agenda" },
  { test: (p) => p.startsWith("/admin/fleet/new"), title: "Novo Veículo" },
  { test: (p) => /^\/admin\/fleet\/[^/]+\/history/.test(p), title: "Histórico do Veículo" },
  { test: (p) => /^\/admin\/fleet\/[^/]+/.test(p), title: "Veículo" },
  { test: (p) => p.startsWith("/admin/fleet"), title: "Frota" },
  { test: (p) => p.startsWith("/admin/vehicle-history"), title: "Histórico do Veículo" },
  { test: (p) => p.startsWith("/admin/customers/birthdays"), title: "Aniversariantes" },
  { test: (p) => /^\/admin\/customers\/[^/]+/.test(p), title: "Cliente" },
  { test: (p) => p.startsWith("/admin/customers"), title: "Clientes" },
  { test: (p) => p.startsWith("/admin/finance"), title: "Financeiro" },
  { test: (p) => p.startsWith("/admin/team"), title: "Equipe" },
  { test: (p) => p.startsWith("/admin/report/fleet-pnl"), title: "Lucro da Frota" },
  { test: (p) => p.startsWith("/admin/report"), title: "Relatório" },
  { test: (p) => p.startsWith("/admin/dashboard"), title: "Dashboard" },
  { test: (p) => p.startsWith("/admin/settings"), title: "Configurações" },
  { test: (p) => p.startsWith("/admin/inspection/compare"), title: "Comparar Inspeção" },
  { test: (p) => p.startsWith("/admin/inspection/report"), title: "Laudo de Inspeção" },
  { test: (p) => p.startsWith("/admin/inspection"), title: "Inspeção" },
  { test: (p) => p.startsWith("/admin/contracts/template"), title: "Modelo de Contrato" },
  { test: (p) => p.startsWith("/admin/contracts"), title: "Contratos" },
  { test: (p) => p.startsWith("/admin/turo-import"), title: "Importar Turo" },
  { test: (p) => p.startsWith("/admin/epass-import"), title: "Importar E-Pass" },
  { test: (p) => p.startsWith("/admin/tolls"), title: "Pedágios" },
  { test: (p) => p.startsWith("/admin/costs"), title: "Custos" },
  { test: (p) => p.startsWith("/admin/tutoriais"), title: "Tutoriais" },
  { test: (p) => p.startsWith("/admin/logs"), title: "Logs" },
  { test: (p) => p.startsWith("/admin/pendencias"), title: "Pendências" },
  { test: (p) => p.startsWith("/admin/stamp-preview"), title: "Prévia de Selo" },
];

// Palavras que devem manter capitalização especial no fallback
const SPECIAL_CASE: Record<string, string> = {
  admin: "Admin",
  ai: "AI",
  pnl: "P&L",
  turo: "Turo",
  epass: "E-Pass",
  ops: "Operação",
  live: "Live",
  id: "ID",
  new: "Novo",
};

function prettifySlug(slug: string): string {
  return slug
    .split("-")
    .map((w) => SPECIAL_CASE[w.toLowerCase()] ?? (w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ");
}

export function getTabTitle(path: string): string {
  const cleanPath = path.split("?")[0];
  const match = TITLE_MAP.find((m) => m.test(cleanPath));
  if (match) return match.title;
  const last = cleanPath.split("/").filter(Boolean).pop() ?? "Admin";
  return prettifySlug(last);
}

