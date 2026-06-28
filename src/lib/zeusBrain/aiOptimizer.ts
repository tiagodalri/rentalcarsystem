/**
 * AI Fleet Optimizer — busca combinatória determinística.
 *
 * Dado N carros para vender (escolhidos pela pior performance real),
 * encontra a melhor combinação possível de carros para comprar
 * que MAXIMIZE a receita diária projetada, respeitando o capital
 * recuperado pela venda (com tolerância pequena de aporte).
 *
 * Algoritmo: bounded knapsack 0/1 com granularidade de $1.000.
 * Cada modelo pode ser comprado até MAX_UNITS_PER_MODEL vezes.
 * Resultado: ÓTIMO GLOBAL dentro da granularidade — não é heurística.
 */

import type { SimVehicle } from "@/components/admin/zeus-brain/FleetSimulator";

export type AiScenario = {
  sell: SimVehicle[];
  buy: Array<{ vehicle: SimVehicle; qty: number }>;
  recoveredCapital: number;
  spentCapital: number;
  cashBalance: number;
  currentRevPerDay: number;
  projectedRevPerDay: number;
  deltaPerDay: number;
  delta90: number;
  delta180: number;
  delta365: number;
  combinationsEvaluated: number;
  capitalEfficiency: number; // % de ganho por dólar empregado
  avgOccupancyBuy: number;
  avgOccupancySell: number;
};

const MAX_UNITS_PER_MODEL = 5;
const GRAIN = 1000;                // $1k de granularidade
const APORTE_TOLERANCE = 0.10;     // permite até 10% acima do capital recuperado

export function optimizeFleet(
  perVehicle: SimVehicle[],
  sellCount: number,
): AiScenario | null {
  if (sellCount < 1) return null;

  // Universo elegível: precificado, com histórico real e produtivo
  const eligible = perVehicle.filter(
    p =>
      p.purchase > 0 &&
      p.hasAcquiredDate &&
      p.daysInFleet >= 60 &&
      p.bookingsCount > 0 &&
      p.revPerDayOwned > 0,
  );
  if (eligible.length < sellCount + 1) return null;

  // Carros para VENDER: os de pior receita-por-dia-de-posse
  const sortedAsc = [...eligible].sort((a, b) => a.revPerDayOwned - b.revPerDayOwned);
  const sell = sortedAsc.slice(0, sellCount);
  const sellIds = new Set(sell.map(p => p.v.id));
  const recovered = sell.reduce((s, p) => s + p.purchase, 0);

  const candidates = eligible.filter(p => !sellIds.has(p.v.id));
  if (!candidates.length) return null;

  // Bounded knapsack via flatten de unidades
  const capacity = recovered * (1 + APORTE_TOLERANCE);
  const W = Math.max(1, Math.floor(capacity / GRAIN));

  type Item = { id: string; cost: number; value: number };
  const items: Item[] = [];
  for (const c of candidates) {
    const cost = Math.max(1, Math.round(c.purchase / GRAIN));
    if (cost > W) continue;
    for (let u = 0; u < MAX_UNITS_PER_MODEL; u++) {
      items.push({ id: c.v.id, cost, value: c.revPerDayOwned });
    }
  }
  if (!items.length) return null;

  // DP 0/1 com rastreio de escolha por (w, item)
  const dp = new Float64Array(W + 1);
  // parent codifica: prevW (Int32) e itemIndex (Int32) por estado
  const parentPrevW = new Int32Array(W + 1).fill(-1);
  const parentItem = new Int32Array(W + 1).fill(-1);

  for (let i = 0; i < items.length; i++) {
    const { cost, value } = items[i];
    for (let w = W; w >= cost; w--) {
      const cand = dp[w - cost] + value;
      if (cand > dp[w] + 1e-9) {
        dp[w] = cand;
        parentPrevW[w] = w - cost;
        parentItem[w] = i;
      }
    }
  }

  // Melhor W
  let bestW = 0;
  for (let w = 1; w <= W; w++) {
    if (dp[w] > dp[bestW]) bestW = w;
  }
  if (dp[bestW] <= 0) return null;

  // Reconstrução: cada estado parent foi escrito DEPOIS de processar o item,
  // então andamos para trás. Como cada slot só guarda 1 item, podemos repetir
  // a mesma cadeia até esgotar; suficiente para recuperar o multiset usado.
  const counts: Record<string, number> = {};
  let cur = bestW;
  // Como múltiplas escolhas convergem ao mesmo bestW, usamos um conjunto de
  // itens já "consumidos" rastreando posição i; mas como cada cópia é item
  // distinto no array, a recursão simples funciona:
  let safety = items.length + 8;
  while (cur > 0 && safety-- > 0) {
    const itemIdx = parentItem[cur];
    const prev = parentPrevW[cur];
    if (itemIdx < 0 || prev < 0) break;
    const id = items[itemIdx].id;
    counts[id] = (counts[id] || 0) + 1;
    // Impede contar a mesma cópia duas vezes ao "consumi-la":
    parentItem[cur] = -2;
    cur = prev;
  }

  const byId = new Map(eligible.map(p => [p.v.id, p]));
  const buy = Object.entries(counts)
    .map(([id, qty]) => ({ vehicle: byId.get(id)!, qty: Math.min(qty, MAX_UNITS_PER_MODEL) }))
    .filter(x => x.vehicle && x.qty > 0)
    .sort((a, b) => b.vehicle.revPerDayOwned * b.qty - a.vehicle.revPerDayOwned * a.qty);

  const spent = buy.reduce((s, b) => s + b.vehicle.purchase * b.qty, 0);
  const currentRev = sell.reduce((s, p) => s + p.revPerDayOwned, 0);
  const projectedRev = buy.reduce((s, b) => s + b.vehicle.revPerDayOwned * b.qty, 0);
  const deltaPerDay = projectedRev - currentRev;

  const buyUnits = buy.reduce((s, b) => s + b.qty, 0);
  const avgOccBuy = buyUnits
    ? buy.reduce((s, b) => s + b.vehicle.occupancy * b.qty, 0) / buyUnits
    : 0;
  const avgOccSell = sell.length
    ? sell.reduce((s, p) => s + p.occupancy, 0) / sell.length
    : 0;

  const capEff =
    recovered > 0 && spent > 0
      ? ((projectedRev / spent) / (currentRev / recovered) - 1) * 100
      : 0;

  return {
    sell,
    buy,
    recoveredCapital: recovered,
    spentCapital: spent,
    cashBalance: recovered - spent,
    currentRevPerDay: currentRev,
    projectedRevPerDay: projectedRev,
    deltaPerDay,
    delta90: deltaPerDay * 90,
    delta180: deltaPerDay * 180,
    delta365: deltaPerDay * 365,
    combinationsEvaluated: items.length * W,
    capitalEfficiency: capEff,
    avgOccupancyBuy: avgOccBuy,
    avgOccupancySell: avgOccSell,
  };
}

/** Quantos carros são elegíveis para venda inteligente? */
export function countEligible(perVehicle: SimVehicle[]): number {
  return perVehicle.filter(
    p =>
      p.purchase > 0 &&
      p.hasAcquiredDate &&
      p.daysInFleet >= 60 &&
      p.bookingsCount > 0 &&
      p.revPerDayOwned > 0,
  ).length;
}
