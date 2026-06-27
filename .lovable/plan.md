# Plano: Zeus Intelligence — Painel IA de outro nível

Objetivo: transformar o atual "AI Painel" num cockpit de inteligência de frota que vai muito além de ROI/ocupação. Quero entregar insights que normalmente só consultorias de revenue management e data science entregam — tudo calculado em cima dos dados reais (bookings, vehicles, financial_transactions, vehicle_telemetry, vehicle_expenses, customers, trip_events, vehicle_incidents).

---

## 1. Arquitetura

- Página: `src/pages/admin/AiPainel.tsx` (refatorada em módulos)
- Diretório novo: `src/lib/intelligence/`
  - `dataLoader.ts` — busca paralela (bookings, vehicles, expenses, telemetry, trips, incidents, customers, transactions, price_overrides, seasons)
  - `metrics/` — um arquivo por família de métrica (puro, testável)
  - `forecast.ts` — projeções (regressão linear simples + sazonalidade)
  - `scoring.ts` — normalização z-score e ranking
- Edge Function opcional `intelligence-summary` chamando Lovable AI (`google/gemini-3-flash-preview`) para gerar o **briefing executivo em linguagem natural** a partir do JSON de métricas (cacheado 1h).
- Estado: React Query com `staleTime: 10min`. Tema cósmico mantido.

---

## 2. Insights novos (os "uau")

Agrupados em 6 cockpits dentro do painel:

### A. Revenue Intelligence
1. **RevPAC** (Revenue per Available Car-day) — métrica de hotelaria aplicada à frota: receita / (carros × dias do período). Comparável entre frotas de tamanhos diferentes.
2. **ADR efetivo vs. tabela** — diária média realizada vs. `daily_price_usd` (mostra quanto desconto silencioso a frota está dando).
3. **Price Elasticity Score por veículo** — correlação entre variações de preço (overrides/seasons) e taxa de conversão de reservas. Identifica carros sub/superprecificados.
4. **Revenue Leakage** — soma de: gaps entre reservas <2 dias, no-shows, cancelamentos tardios, devoluções antecipadas não cobradas. Quantifica dinheiro deixado na mesa.
5. **Pacing vs. mês anterior** — receita acumulada até o dia X do mês vs. mesmo dia do mês passado e do ano passado.

### B. Demand & Booking Intelligence
6. **Booking Lead Time médio** por veículo/categoria — quanto antes os clientes reservam (sinal de demanda quente).
7. **Day-of-week heatmap** de pickup/return — revela dias subutilizados → sugestão de promo.
8. **Funil de conversão** pending → confirmed → in_progress → completed, com tempo médio em cada estágio.
9. **Janela de oportunidade** — carros com >3 dias livres entre duas reservas confirmadas → sugere campanha de last-minute com desconto calculado para break-even.
10. **Search-to-book ratio** (se disponível via `activity_logs`).

### C. Customer Intelligence
11. **CLV (Customer Lifetime Value)** — receita histórica + projeção (frequência × ticket médio × margem).
12. **RFM Segmentation** (Recency, Frequency, Monetary) — 4 segmentos: Champions, Loyal, At Risk, Hibernating.
13. **Churn Risk Score** — clientes high-value sem reserva nos últimos N dias relativo ao seu intervalo médio.
14. **NPS implícito** — proxy: % completed sem incidentes + repeat rate.
15. **Cohort Retention** — % de clientes do mês X que voltaram em X+1, X+2…

### D. Operational Intelligence
16. **Turnaround Time** entre check-out e próximo check-in (gargalo operacional).
17. **Inspection Quality Score** — fotos por inspeção, tempo médio, % com avarias registradas.
18. **Incident Density** por veículo/categoria/cliente — heatmap de risco.
19. **Maintenance Predictive Score** — combina `vehicle_telemetry` (km, diagnostics) + `vehicle_expenses` históricos → prevê próxima manutenção e custo.
20. **Driver Behavior Score** (via `trip_events`) — eventos de hard brake/accel por viagem → identifica clientes de risco.

### E. Financial Intelligence
21. **Margem real por reserva** — receita − (custo diário amortizado + manutenção alocada + combustível + taxas Turo/Stripe).
22. **Break-even date por veículo** — data projetada em que receita acumulada cobrirá `purchase_price`.
23. **Custo oculto por categoria** — manutenção+limpeza+combustível por dia possuído.
24. **Cash conversion cycle** — dias entre despesa do veículo e recebimento médio.
25. **Stripe vs. Turo profitability** — margem comparada por canal.

### F. Strategic / Predictive
26. **Fleet Composition Optimizer** — sugere venda/compra: para cada slot da frota, calcula "se eu trocasse o veículo X (bottom ROI) por outro da categoria Y (top revenue/dia), o ganho projetado em 12m seria $Z". Usa benchmark interno por categoria.
27. **Dynamic Pricing Suggestions** — para próximos 60 dias, sugere preço por dia/veículo baseado em: demanda histórica do dia da semana, sazonalidade, lead time, ocupação atual da categoria. Mostra delta vs. preço configurado.
28. **What-if Simulator** (slider): "se eu subir preço em +X% nos top-10 carros, projeção de receita/ocupação".
29. **Anomaly Detection** — métricas que fugiram >2σ da média móvel (queda súbita de bookings, pico de cancelamento, custo anômalo).
30. **AI Executive Briefing** — texto gerado por Lovable AI sintetizando os top 5 movimentos da semana em linguagem de CEO.

---

## 3. UX / Visual

Mantém estética cósmica, mas reorganiza em:

```text
┌─ Hero: Briefing Executivo IA (texto + 4 KPIs hero: RevPAC, ADR, Margem, Churn Risk)
├─ Tabs: [Receita] [Demanda] [Clientes] [Operação] [Financeiro] [Estratégia]
│   cada tab = grid de cards específicos do cockpit
├─ Alertas inteligentes (anomalias) — banner deslizante
└─ What-if Simulator (drawer lateral)
```

- Sparklines em cada KPI (recharts, já no projeto)
- Heatmaps com `<div grid>` + gradient (sem libs novas)
- Badges de "AI Pick" nos itens recomendados
- Animação sutil de "pulse" nos alertas críticos

---

## 4. Entrega em fases

**Fase 1 (essa rodada):**
- Refator `AiPainel.tsx` em módulos
- DataLoader paralelo com tudo que falta (telemetry, trips, incidents, expenses, overrides)
- Cockpits A (Revenue) + B (Demand) + F parcial (Anomaly + Briefing IA)
- 12 insights novos visíveis

**Fase 2:**
- Cockpits C (Customer RFM/CLV/Cohort) + D (Operational/Predictive Maintenance)
- Edge Function `intelligence-summary` com Lovable AI

**Fase 3:**
- Cockpit E (Financial deep) + Fleet Composition Optimizer + What-if Simulator + Dynamic Pricing Suggestions

---

## 5. Detalhes técnicos

- Tudo client-side em React (cálculos puros) exceto o briefing IA (edge function).
- Sem libs novas além das já presentes (recharts, date-fns, lucide).
- Tipos estritos em `src/lib/intelligence/types.ts`.
- Cada métrica num arquivo isolado → testável e fácil de evoluir.
- Performance: memoização agressiva (`useMemo`), workers só se necessário (>50k registros).

---

## 6. Riscos / pontos a validar

- Volume de dados: se `vehicle_telemetry_history` for muito grande, paginar por período.
- Algumas métricas (Search-to-book) dependem de `activity_logs` ter os eventos certos — verifico antes.
- Driver Behavior depende de `trip_events` ter tipos hard_brake/accel — verifico schema.
- Briefing IA gasta créditos Lovable AI — cacheio por 1h.

---

**Aprova esse plano? Se sim, começo pela Fase 1.** Se quiser priorizar outro cockpit primeiro (ex: começar pelo Fleet Composition Optimizer e Dynamic Pricing porque dão decisão imediata de dinheiro), me diz.
