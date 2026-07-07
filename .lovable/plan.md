## Etapa B — Finalização

Duas frentes independentes, ambas verificáveis por SQL. Nada de UI muda além do texto de descrição do modal de apresentação.

---

### FOCO 1 — Recalibrar margem para ~25–40% (por veículo, proporcional)

**Diagnóstico.** A margem do KPI é calculada em `computePerVehicle` (`src/lib/aiStudio/perVehicle.ts`) somando `revenue = Σ bookings.total_price` e `exp = Σ vehicle_expenses.amount` **do veículo inteiro** (sem filtrar por janela). O seed anterior calibrou despesas contra uma receita ~4× menor que a real, por isso a margem hoje fica em ~66–85%. Correção: recalibrar as despesas por veículo em função da **própria receita histórica do veículo** e do `purchase_price`, no mesmo escopo que o app usa.

**O que muda em DADOS (nova migration, idempotente com marcador `[demo-seed-v3]`):**

1. `DELETE FROM vehicle_expenses WHERE notes LIKE '%[demo-seed-v%]%'` (limpa v1/v2/v3 — reexecutável).
2. Para cada veículo (`v`), calcular em SQL:
   - `rev_v = Σ bookings.total_price` (mesmos filtros do app: `deleted_at IS NULL`).
   - `days_owned_v` = `today − acquired_date` (mínimo 90).
   - `purchase_v = purchase_price`.
3. Meta por veículo: **exp_v = rev_v × target_ratio(v)** — onde `target_ratio` depende do "tier" do veículo (definido pela ocupação e ROI atuais, ver Foco 2). Faixas:
   - Campeão (top ~25% ROI): `0.55–0.65` → margem 35–45%.
   - Meio (~50%): `0.68–0.75` → margem 25–32%.
   - Caroço (bottom ~25%): `0.95–1.10` → margem 0% a −10% (alguns negativos).
   - Resultado agregado alvo: **margem consolidada 28–35%**.
4. Distribuir `exp_v` entre as categorias existentes (proporcional, nunca fixo), com `notes = '[demo-seed-v3] <categoria>'`:
   - `depreciation` (via `other` + notes): 18% de `purchase_v` ao ano, prorrateado por `days_owned_v/365`.
   - `financing` (via `other` + notes): aplicado em ~40% da frota, 6% de `purchase_v` ao ano, prorrateado.
   - `insurance`: 3.5% de `purchase_v` ao ano, prorrateado.
   - `maintenance`: 4% de `rev_v` (meio) / 8% (caroço) / 2.5% (campeão).
   - `parts` + `collision` (para caroços): eventos extras usando `other`+notes.
   - `cleaning`: $12 × dias_reservados_historico.
   - `tolls` (via `other`+notes): $6 × dias_reservados_historico.
   - **Ajuste fino residual:** após somar, calcular `delta = exp_v_alvo − exp_v_semeado` e lançar 1 linha em `other`/`[demo-seed-v3] ajuste` com o delta (positivo ou negativo → nesse caso reduzir depreciação).
5. **Datas** das despesas espalhadas entre `acquired_date` e `today` (linha por mês para depreciação/financiamento/seguro; linhas esparsas para manutenção/limpeza/pedágio) — mantém coerência com o gráfico mensal.

**O que muda em CÓDIGO:** nada. `computePerVehicle` já lê tudo por veículo, então recalibrar dados propaga automaticamente para KPI, ranking, payback, ROI, "receita/carro-dia", ocupação (não muda), MTD e simulador.

**Verificação (script SQL final):**

```sql
-- Reproduz a fórmula do app por veículo
WITH pv AS (
  SELECT v.id, v.brand, v.model,
    (SELECT COALESCE(SUM(total_price),0) FROM bookings b WHERE b.vehicle_id=v.id AND b.deleted_at IS NULL) rev,
    (SELECT COALESCE(SUM(amount),0)     FROM vehicle_expenses e WHERE e.vehicle_id=v.id) exp
  FROM vehicles v WHERE v.deleted_at IS NULL
)
SELECT
  SUM(rev)                                      AS revenue_total,
  SUM(exp)                                      AS expense_total,
  ROUND(100.0*(SUM(rev)-SUM(exp))/NULLIF(SUM(rev),0), 1) AS margem_consolidada_pct,
  COUNT(*) FILTER (WHERE rev>0 AND (rev-exp)/rev < 0)     AS carros_margem_negativa,
  COUNT(*) FILTER (WHERE rev>0 AND (rev-exp)/rev BETWEEN 0.35 AND 0.5) AS carros_campeoes
FROM pv;
```

Alvo: `margem_consolidada_pct BETWEEN 25 AND 40`, `carros_margem_negativa BETWEEN 3 AND 6`, `carros_campeoes >= 4`. Se sair fora, ajustar constantes de `target_ratio` na migration e reexecutar (é idempotente pelo marcador).

---

### FOCO 2 — Modo Apresentação com mix garantido por tier

**Diagnóstico.** A RPC atual `demo_start_presentation` faz seed 1-por-categoria + preenchimento com viés leve a `daily_price` — não olha performance real. Resultado: qualquer N pode vir "só campeões", "só meio", etc. A narrativa Pareto (~70–80% da receita em ~20–30% do capital) só aparece por acaso.

**O que muda em DADOS:** nada estrutural (a tabela `demo_presentation_state` já existe).

**O que muda em CÓDIGO (nova migration substituindo a RPC):**

1. Nova versão de `public.demo_start_presentation(p_count integer)` que classifica cada veículo em **tier** com base nas mesmas métricas do app (calculadas em SQL puro, sem depender do TS):
   ```sql
   WITH pv AS ( ... rev, exp, purchase, days_booked_hist, days_owned ... ),
   scored AS (
     SELECT id, category,
       (CASE WHEN purchase>0 THEN (rev-exp)/purchase*100 ELSE 0 END) AS roi,
       (days_booked_hist::numeric / GREATEST(days_owned,1)) * 100      AS occ,
       rev
     FROM pv
   ),
   ranked AS (
     SELECT *,
       NTILE(4) OVER (ORDER BY roi + occ*0.6 DESC) AS q  -- 1=top, 4=bottom
     FROM scored
   )
   ```
2. **Cotas por tier** para qualquer N (arredondamento determinístico):
   - `n_champ  = GREATEST(1, ROUND(N * 0.20))`  → topo (`q=1`, filtro extra: `roi >= mediana + 15pp` OU `occ >= 55`).
   - `n_caroc  = GREATEST(1, ROUND(N * 0.20))`  → fundo (`q=4`, filtro: `occ < 22` **e** `roi < 5`).
   - `n_meio   = N − n_champ − n_caroc`         → `q IN (2,3)`.
   - Fallback: se algum bucket não tiver candidatos suficientes (frota pequena), redistribui a cota faltante para o meio; garante-se sempre **≥1 campeão e ≥1 caroço** quando `N ≥ 3`.
3. **Determinismo:** ordenação por `(score DESC, id)` — mesma entrada, mesma seleção. Nada de `random()` primário; um `hashtext(id)` só desempata se houver empate exato.
4. **Diversidade de categoria só como desempate** dentro de cada bucket (evita 5 SUVs no meio), mas nunca sacrifica o tier.
5. Restante da RPC (soft-delete de vehicles/bookings/telemetry/financial_transactions e snapshot) permanece igual.
6. `PresentationModeButton.tsx`: atualizar apenas o texto de `DialogDescription` para explicar o mix ("sempre inclui campeões, meio e alguns carros fracos para a narrativa Pareto"). Nenhuma outra mudança de UI/estado.

**Verificação (SQL, rodar após `SELECT demo_start_presentation(N)` para N ∈ {5,7,10,15,20}):**

```sql
WITH pv AS ( /* mesma CTE do app: rev, exp, purchase, occ, roi por veículo NÃO deletado */ )
SELECT
  COUNT(*)                                              AS n_exibidos,
  COUNT(*) FILTER (WHERE occ < 22 AND roi < 5)          AS n_carocos,
  COUNT(*) FILTER (WHERE occ >= 55 OR  roi >= 40)       AS n_campeoes,
  ROUND(100.0 * SUM(rev) FILTER (WHERE roi >= 40) / NULLIF(SUM(rev),0), 1) AS pct_receita_top;
```

Alvo, para todo N ≥ 5: `n_carocos >= 1`, `n_campeoes >= 1`, `pct_receita_top BETWEEN 60 AND 85` (janela Pareto).

---

### Arquivos tocados

- **Nova migration** `supabase/migrations/<ts>_demo_seed_v3_expense_calibration.sql` — Foco 1.
- **Nova migration** `supabase/migrations/<ts>_demo_presentation_tiered_selection.sql` — Foco 2 (`CREATE OR REPLACE` da RPC).
- `src/components/admin/PresentationModeButton.tsx` — só o texto da `DialogDescription`.
- Nenhuma alteração em `perVehicle.ts`, `AiPainel.tsx`, `FrotaInteligente.tsx`.

### Riscos

- **Margem fora do alvo após primeira execução.** Mitigação: linha "ajuste" residual garante convergência matemática por veículo; script de conferência roda ao final e a migration é idempotente.
- **Frota pequena após apresentação (N=5)** pode não ter 1 caroço "puro" nas condições `occ<22 & roi<5`. Mitigação: filtro caroço afrouxa para `q=4` puro quando o filtro estrito não retorna suficiente.
- **`hidden_bookings/telemetry/txns`** já são cobertos pela RPC atual; a nova versão só troca a lógica de escolha de `v_chosen`, mantendo o restante do fluxo intacto.

### Roteiro de execução (depois da aprovação)

1. Aplicar migration Foco 1 → rodar SQL de verificação → se fora da faixa, ajustar `target_ratio` e reaplicar.
2. Aplicar migration Foco 2 → rodar `demo_start_presentation` para N ∈ {5,7,10,15,20} → conferir mix → `demo_stop_presentation` ao final.
3. Reportar tabela com: margem consolidada, nº campeões, nº caroços, maior `daysSinceLastBooking`, e mix Pareto para cada N.