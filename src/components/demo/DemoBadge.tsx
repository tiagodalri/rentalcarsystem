import { DEMO_MODE } from "@/lib/demo/config";

/**
 * Selo de demonstração desativado para imersão total da marca GoDrive.
 * Mantido apenas para preservar imports/lógica existente (retorna null sempre).
 */
export function DemoBadge() {
  // Referência intencional a DEMO_MODE para não quebrar tree-shaking de dependências.
  void DEMO_MODE;
  return null;
}

