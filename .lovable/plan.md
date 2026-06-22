## Importador Turo — Admin (com merge inteligente)

Nova rota `/admin/turo-import` (link no menu admin, seção Reservas) com fluxo em 3 passos.

---

### Passo 1 — Upload
- Dropzone aceita `.csv` (drag & drop + click), múltiplos arquivos concatenáveis
- Parse client-side com PapaParse
- Detecta colunas Turo: `Reservation ID`, `Status`, `Guest`, `Vehicle`, `Trip start`, `Trip end`, `Total earnings`, `Pickup location`, `Return location`
- Validação Zod — CSV malformado é rejeitado com erro claro

---

### Passo 2 — Análise / Diff visual (núcleo da inteligência)

Para cada linha do CSV o sistema classifica comparando com `bookings.addons->>turo_reservation_id`:

**🟢 NOVA** — não existe no banco
- Checkbox marcado por padrão
- Será inserida do zero

**🟡 ENRIQUECER** — existe no banco, mas o CSV traz dados novos/mais recentes
- Detecta campo a campo o que mudou:
  - `status` mudou (ex: confirmed → completed, ou in_progress → completed)
  - `total_price` estava nulo/zero e CSV trouxe valor
  - `return_date`/`pickup_date` divergem (Turo é fonte da verdade)
  - `customer_name` vazio no banco
- Mostra **diff lado a lado** (Sistema → CSV) com checkbox por campo
- Checkbox marcado só para campos onde o banco está vazio OU o status avançou no ciclo de vida (pending→confirmed→in_progress→completed)
- **NUNCA sobrescreve dado preenchido manualmente sem o user marcar explicitamente**

**🔵 IDÊNTICA** — existe e está sincronizada → cinza, sem ação, colapsada por padrão

**🔴 CANCELADA no CSV** — desmarcada por padrão; se marcar, apenas atualiza status (não cria nova)

**⚠️ SEM VEÍCULO MAPEADO** — mostra nome do CSV + dropdown para escolher veículo do sistema (ou pular linha)

KPIs no topo: Total CSV / Novas / Para enriquecer / Idênticas / Canceladas / Inválidas

Filtros: chips por status + busca por nome/ID Turo.

---

### Passo 3 — Confirmação e execução
- Botão "Aplicar X mudanças" com breakdown (Y novas + Z enriquecidas + W atualizações de status)
- Modal de confirmação final
- Execução transacional:
  - **Inserts** das novas (com `addons.turo_reservation_id`, `payment_status='paid'` quando completed/in_progress → dispara `create_financial_from_booking`)
  - **Updates seletivos** das enriquecidas — apenas campos marcados pelo user, via `UPDATE ... SET campo = ... WHERE id = ...` (preserva tudo o resto)
  - Cada update registra no `audit_logs` automaticamente (trigger já existe)
- Toast com resumo + redirect para listagem

---

### Regras de segurança do merge (críticas)

1. **Match exclusivo por `turo_reservation_id`** (não por nome+data, evita falsos positivos)
2. **Nunca sobrescreve sem consentimento**: cada campo enriquecido precisa do checkbox marcado pelo user
3. **Auto-marca apenas** quando:
   - Campo de destino está `NULL` ou vazio
   - Status avança naturalmente (nunca regride completed → confirmed)
4. **Soft fields protegidos** (nunca auto-marca, sempre opt-in manual): `notes`, `customer_phone`, `customer_email`, `extras`, valores financeiros já lançados
5. **Financial transactions** não são duplicados — o trigger `create_financial_from_booking` já tem guarda `WHERE source='booking_auto' AND is_cancelled=false`
6. **Reservas marcadas como deletadas** (`deleted_at IS NOT NULL`) são tratadas como "não existe" → permite reinserção limpa

---

### Mapeamento de veículos (persistente)
- Nova tabela `turo_vehicle_mapping`: `{ turo_vehicle_name TEXT PK, vehicle_id UUID FK → vehicles, created_by, created_at }`
- Pré-popula com os 10 mapeamentos já validados na sync anterior
- Quando user mapeia novo no passo 2, salva no banco — próximas importações reconhecem automaticamente

---

### Arquivos
- `src/pages/admin/AdminTuroImport.tsx` — página principal (state machine 3 steps)
- `src/components/admin/turo/TuroDropzone.tsx`
- `src/components/admin/turo/TuroDiffTable.tsx` — tabela com expand para diff campo-a-campo
- `src/components/admin/turo/TuroFieldDiff.tsx` — linha "Sistema → CSV" com checkbox
- `src/components/admin/turo/TuroVehicleMapper.tsx`
- `src/lib/turo/csvParser.ts` — parse + normalização + Zod
- `src/lib/turo/diffEngine.ts` — lógica de classificação/diff (pura, testável)
- `src/lib/turo/applyChanges.ts` — executa inserts/updates
- Rota em `App.tsx` + item no menu admin (ícone `Upload`, seção Reservas)
- Migration: `turo_vehicle_mapping` com GRANTs + RLS (admin/operations)

### Acesso
- Restrito a roles `admin` e `operations`

### Fora de escopo
- Investigar cron Bouncie parado
- Histórico de importações (pode vir depois)
- Edição inline de dados além do diff CSV

Posso começar?