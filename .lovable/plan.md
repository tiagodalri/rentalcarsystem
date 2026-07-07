## Objetivo

Deixar a demo com números que **um dono de frota real acreditaria** — margens críveis, "dias parado" reais, KPI do mês consistente com o gráfico, distribuição deliberadamente desigual (heróis vs. carroços) e rótulo neutro no seletor de origem. Todos os derivados (margem, payback, RevPAC, diária média, ocupação, MTD, gráfico mensal, simulador) precisam **reconciliar** entre si.

Fonte de verdade após o ajuste: os mesmos `bookings + vehicle_expenses + vehicles` já em produção. Nenhuma métrica passa a ser hardcoded — só recalibramos os dados brutos e corrigimos 2 bugs de cálculo (dias parado + janela do mês corrente) + 1 rótulo.

---

## Diagnóstico rápido (o que o banco mostra hoje)

- **Investimento:** ~$614k · **Receita lifetime (não cancelada):** ~$619k · **Despesas totais registradas:** ~$526k, mas concentradas em manutenção/peças/seguro/combustível. Faltam categorias que qualquer frotista real tem no P&L: **depreciação, parcela de financiamento, pedágios, sinistros**. Sem elas, em janelas curtas (ex: mês corrente com pouca despesa lançada) a margem estoura para >90%.
- Todas as `last_pickup` do banco estão em ago/set 2026 (futuro). Julho 2026 aparece com ~$32k no gráfico porque o cálculo do mês corrente pega o mês inteiro (inclui pickups de 08–31/jul), enquanto o KPI MTD só vai até 07/07 → **exatamente o bug do item 3**.
- Não existe cálculo de "dias desde a última reserva" no código. A frase "Parado há 691 dias" está usando `daysInFleet` (dias na frota desde `acquired_date`) em `AiPainel.tsx` — semântica errada.
- `src/lib/aiStudio/bookingSource.ts` define `zeus: "Zeus particular"` → precisa virar rótulo neutro white-label.

---

## Estratégia de reconciliação (regra de ouro)

Nada de números "cosméticos". Só mexemos em:
1. **Dados brutos** (`vehicles`, `vehicle_expenses`, seed pontual em `bookings`).
2. **2 bugs de cálculo** (dias parado + janela do mês corrente).
3. **1 rótulo de UI** (source label).

Como `AiPainel` / `FrotaInteligente` / `FleetSimulator` derivam tudo de `computePerVehicle(vehicles, bookings, expenses)`, se os brutos mudarem de forma coerente, **margem, ROI, payback, RevPAC, ADR, ocupação, simulador e briefing recalculam sozinhos e batem entre si**. Nenhum KPI é ajustado à mão.

---

## Parte 1 — Mudanças de DADOS (migrations/seeds)

Todas as seeds serão **idempotentes** (marcadores em `notes` e prefixos em `booking_number`), para reexecutar sem duplicar.

### 1.1 Semear despesas realistas até a margem cair para 25–40%

Alvo: margem consolidada em janela 6m em **~30% (banda 25–40%)**. Com receita 6m ≈ $210k, precisamos que despesas 6m fiquem em **~$140–160k**, mas **bem distribuídas** por veículo e categoria.

Seed `seed_realistic_expenses` (marcador `notes` = `'[demo-seed-v2]'`, começa apagando o próprio seed anterior). Para cada veículo ativo, distribui ao longo dos últimos 12 meses:

| Categoria (enum atual) | Frequência | Valor típico (USD) | Rótulo em `notes` |
|---|---|---|---|
| `insurance` | mensal | 180–320 | "Prêmio mensal" |
| `maintenance` | 60–90 dias | 120–450 | "Revisão / óleo / freios" |
| `parts` | 90–150 dias | 200–1.400 | "Pneus / bateria / suspensão" |
| `documentation` | anual + eventual | 380–780 | "Licenciamento" |
| `fuel` | semanal | 40–120 | mantém volume atual |
| `cleaning` | quinzenal | 25–60 | "Detalhamento" |
| `other` (depreciação) | mensal | 1,2% de `purchase_price` / 12 | "Depreciação contábil" |
| `other` (financiamento) | mensal, só em ~40% da frota | 380–620 | "Parcela financiamento" |
| `other` (pedágios) | quinzenal | 8–35 | "E-Pass simulado" |
| `maintenance` (colisão) | 0–2 eventos/ano nos carroços | 900–3.200 | "Reparo colisão" |

**Nota sobre enum:** o `expense_type` atual não tem `depreciation`/`financing`/`toll`. Duas opções:
- **(A) — recomendada:** usar `other` + `notes` descritivo. Zero migration de schema, zero risco em UI que já lista categorias por enum.
- **(B):** `ALTER TYPE expense_type ADD VALUE 'depreciation','financing','toll'` e adaptar labels. Só se quisermos essas categorias aparecendo separadas no relatório de despesas.

### 1.2 Rebalancear a frota (heróis vs. carroços)

Escolha determinística por nome do veículo:

- **4–5 campeões** (Highlander, Frontier, Ranger, Colorado, Pilot): despesas em faixa saudável; `daily_price_usd` +5% para reforçar narrativa premium.
- **4–5 carroços** (Kia Sportage #2, Camry, K5, Rogue, Tucson): 
  - Injetar 2–3 eventos de manutenção pesada ($1.500–$3.200) nos últimos 6 meses.
  - Cancelar (`status='cancelled'`) ~30% das reservas futuras deles nos próximos 60 dias → puxa ocupação para <20%.
  - Ajustar reservas passadas recentes para produzir `daysSinceLastBooking` de 25–45 dias.
- **Meio da tabela:** intocado.

Resultado alvo no ranking: carroços com ROI −5% a +8% e ocupação <20%; campeões com ROI 40%+ e ocupação 65%+.

### 1.3 Seed de reservas passadas recentes (base do "dias sem receber")

Hoje toda `last_pickup` é futura. Para o novo cálculo funcionar, cada veículo precisa ter ao menos uma reserva `completed` com `return_date` entre `today−45` e `today−3`.

Seed `seed_recent_completed_bookings` (prefixo `booking_number` = `ZRC-D2-`):
- Cada veículo sem `completed` recente ganha 1–3 reservas curtas (2–5 dias), preço proporcional a `daily_price_usd`.
- Distribuição garantindo **5–15 dias sem receber para campeões** e **25–45 dias para carroços**.
- Cliente ficção reutilizando `customers` existentes. `stripe_session_id=NULL` e `turo_reservation_code=NULL` → contam como "Frota própria", reconciliando tanto na visão "Todas" quanto filtrada.

### 1.4 Normalizar `acquired_date`

Alguns veículos têm `acquired_date` NULL ou muito antigo → distorce payback, RevPAC e é o que alimentaria "691 dias". Setar `acquired_date` entre **90 e 900 dias atrás** (mais recente para carros novos, mais antigo para os com mais histórico).

### 1.5 Nada é mexido no futuro do pipeline

Reservas futuras de ago/set continuam no banco. A leitura do "mês corrente" no gráfico será corrigida via **código** (item 2.2), não deletando dados — o pipeline futuro é informação legítima que aparece em outros KPIs (Receita 30/60 dias).

---

## Parte 2 — Mudanças de CÓDIGO (cirúrgicas)

### 2.1 Novo campo `daysSinceLastBooking` em `computePerVehicle`

**Arquivo:** `src/lib/aiStudio/perVehicle.ts`

Aditivo (não quebra ninguém):

```ts
const pastBookings = vb.filter(b => parseDateOnly(b.return_date).getTime() <= todayMs);
const lastReturnMs = pastBookings.length
  ? Math.max(...pastBookings.map(b => parseDateOnly(b.return_date).getTime()))
  : null;
const daysSinceLastBooking = lastReturnMs
  ? Math.max(0, Math.round((todayMs - lastReturnMs) / dayMs))
  : null;
```

**Arquivo:** `src/pages/admin/AiPainel.tsx`
- Linha 545 e linha 561: trocar `${p.daysInFleet}` → `${p.daysSinceLastBooking ?? '—'}` (no contexto "parado há X dias").
- Onde `daysInFleet` significa literalmente "tempo na frota" (payback, RevPAC, "tempo médio na frota"), mantém.

Com a seed 1.3, o teto natural fica em ~45 dias. Impossível voltar a aparecer "691 dias".

### 2.2 Corrigir janela do mês corrente no gráfico

**Arquivo:** `src/pages/admin/AiPainel.tsx` — `monthlyTrend` (linha 313).

- Para o **último bucket** (mês corrente), trocar `end = endOfMonth(anchor)` por `end = today`.
- Adicionar flag `isCurrent: true` no objeto.
- Na renderização (linha ~1124), sublinhar a barra do mês corrente com hachura/opacidade + label "até hoje" → visualmente óbvio que é MTD.
- Opcional (recomendo): barra "sombra" projetando o fechamento linear (`mtd / diaDoMes * diasDoMes`) em outline, para não perder a leitura de "mês vai fechar em ~X".

Resultado: barra Jul = KPI MTD (mesmo número, mesma regra). Reconciliação garantida.

### 2.3 Rótulo neutro no seletor de origem

**Arquivo:** `src/lib/aiStudio/bookingSource.ts` linha 47.

```ts
export const SOURCE_LABEL: Record<BookingSource, string> = {
  all: "Todas as reservas",
  zeus: "Frota própria",   // era "Zeus particular"
  turo: "Turo",
};
```

Chave interna `"zeus"` intocada — zero risco em queries/persistência. `grep` confirmou que é o único ponto que renderiza esse texto.

### 2.4 O que NÃO muda

Margem, payback, ROI, RevPAC, ADR, ocupação, simulador, briefing narrado — todos derivam automaticamente dos dados novos. Zero KPI hardcoded, zero fórmula reescrita.

---

## Arquivos tocados

**Migrations / seeds (Lovable Cloud, aprovação separada):**
- `seed_realistic_expenses` — despesas realistas por veículo (idempotente via marcador em `notes`).
- `seed_recent_completed_bookings` — reservas passadas recentes (idempotente via prefixo `ZRC-D2-`).
- `adjust_acquired_dates` — normaliza `vehicles.acquired_date`.
- `rebalance_champions_and_duds` — ajusta `daily_price_usd`, cancela subset de reservas futuras dos carroços, injeta manutenções pesadas.

**Código:**
- `src/lib/aiStudio/perVehicle.ts` — adiciona `daysSinceLastBooking`.
- `src/pages/admin/AiPainel.tsx` — usa novo campo (2 pontos) + `monthlyTrend` com `end=today` no bucket corrente + marcação visual da barra MTD.
- `src/lib/aiStudio/bookingSource.ts` — muda `SOURCE_LABEL.zeus`.

**Não muda:** `useFinanceOverview`, `fleetMetrics`, `AiHub`, `FrotaInteligente`, `AdminSidebar`, rotas, schema (a menos que escolhamos opção B em 1.1).

---

## Como garanto a coerência

1. **Uma única fonte** (`computePerVehicle`) alimenta cards, tabs e simulador. Rebalanceando os brutos, tudo recalcula em harmonia.
2. **MTD e barra de julho** passam a usar exatamente a mesma janela (`start=1º do mês, end=today`) → mesmo número, sempre.
3. **Payback / ROI / RevPAC** dependem de `purchase_price`, `revenue` e `expenses`. Como `expenses` sobe proporcional ao investimento (regra "% de `purchase_price`" para depreciação), o payback fica em faixa realista (18–36 meses) sem ajuste manual.
4. **Ocupação, ADR, RevPAC** dependem de dias reservados vs. dias na frota — normalizados por 1.2, 1.3 e 1.4.
5. **Script de conferência** (SQL, não commitado): antes de dar por pronto, listar por veículo `revenue / expenses / margin / roi / occupancy / daysSinceLastBooking`. Qualquer linha absurda → ajustar semente e reexecutar (seeds idempotentes).

---

## Riscos

- **Enum `expense_type`:** ficando em (A) evitamos migration de schema. Se quiser (B), pedagio/depreciação/financiamento viram categorias separadas no relatório — mais bonito, mais trabalho.
- **Filtro de origem:** as reservas seed 1.3 são criadas como "Frota própria" (sem `stripe_session_id` nem `turo_reservation_code`) para não distorcer a visão "Turo".
- **Texto do rótulo white-label:** proponho "Frota própria". Alternativas: "Reservas diretas", "Direto", "Particular". Se preferir outro, avise antes.
- **Reprodutibilidade:** todas as seeds usam marcadores (`notes` com `[demo-seed-v2]`, `booking_number` prefixo `ZRC-D2-`) e são idempotentes.
- **Data mock vs. hoje real:** o app usa `new Date()` (hoje real). Seeds ancoram tudo em `CURRENT_DATE` do banco → segue coerente ao longo do tempo, sem "envelhecer" a demo.

Aguardando aprovação. Duas perguntas antes de construir:
1. Opção **(A)** — usar `other` + `notes` — está bom, ou prefere **(B)** com enum novo?
2. Texto do rótulo `zeus` → "Frota própria" está OK?
