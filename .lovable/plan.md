
# Importação E-Pass + Atribuição de Pedágios

Replica a arquitetura do módulo Turo (upload → parse → preview → confirmar) para arquivos do portal E-Pass, e usa o campo `vehicles.e_pass_transponder` + as datas das reservas para atrelar cada pedágio ao carro, à reserva ativa naquele momento e ao cliente correspondente.

## 1. Modelo de dados (Lovable Cloud)

Três tabelas novas em `public`:

**`epass_imports`** — uma linha por arquivo importado
- `filename`, `period_label` (ex: "5_2026"), `account_number`
- `total_rows`, `matched_rows`, `unmatched_vehicle_rows`, `unmatched_booking_rows`
- `total_amount` (soma do período)
- `imported_by` (uuid), `created_at`

**`epass_tolls`** — uma linha por pedágio do CSV
- `import_id` → `epass_imports`
- `transponder_number` (text, indexado)
- `vehicle_id` (uuid, nullable — resolvido por transponder)
- `booking_id` (uuid, nullable — resolvido por janela da reserva)
- `customer_id` (uuid, nullable — espelhado da reserva)
- `toll_datetime` (timestamptz, montado de Date + Time, TZ America/New_York)
- `posting_date` (date)
- `location` (text), `amount` (numeric), `toll_type` (text)
- `status` enum: `matched` | `no_vehicle` | `no_booking` | `ignored`
- `charged_to_customer` boolean default false (marca cobrança feita)
- `dedupe_hash` (text, unique) = hash(transponder + datetime + location + amount) → evita duplicar em reimport

**`epass_account_activity`** — linhas da seção "Account Activity" (descontos/pagamentos), só pra auditoria/total. Campos: `import_id`, `account_number`, `date`, `description`, `location`, `amount`.

RLS: leitura/escrita só para `admin`, `finance`, `operations`. Grants padrão + service_role.

## 2. Parser do arquivo E-Pass

Novo `src/lib/epass/csvParser.ts`:
- Lê o CSV bruto, identifica as duas seções por cabeçalho ("Account Activity" e "Vehicle Activity")
- Normaliza datas no formato `1-May-26` + hora `16:18:44` → `Date` em America/New_York
- Retorna `{ accountActivity[], vehicleActivity[] }`

PDF: na v1 **aceitamos só CSV** (o PDF tem o mesmo conteúdo mas em formato visual; parse de PDF é frágil). Mostro mensagem clara no dropzone: "Exporte o relatório como CSV no portal E-Pass". Pode entrar como v2 se quiser.

## 3. Motor de atribuição

`src/lib/epass/assignEngine.ts`:
1. Para cada linha de Vehicle Activity:
   - Acha `vehicle_id` por `e_pass_transponder = transponder_number` (compara como string, trim)
   - Se não achou → `status='no_vehicle'`
   - Senão, busca reservas desse veículo onde `toll_datetime` ∈ `[pickup_at, return_at]` (intervalo `[)`) — montando os datetimes de pickup/return com `pickup_date+pickup_time` e `return_date+return_time` em America/New_York
   - Match → grava `booking_id` + `customer_id`, `status='matched'`
   - Sem reserva ativa → `status='no_booking'` (provavelmente uso interno / movimentação)
2. Calcula `dedupe_hash` e descarta o que já existe em `epass_tolls`.

## 4. UI — Página `/admin/epass-import`

Espelha `AdminTuroImport`:
- **Dropzone** (`EpassDropzone`) — aceita só `.csv`, múltiplos
- **Preview** (`EpassPreview`) com 4 abas:
  - **Resumo**: total $, nº pedágios, % atribuídos, conta E-Pass
  - **Atribuídos** (tabela: data/hora, carro, placa, reserva, cliente, local, valor)
  - **Sem reserva** (carro identificado, mas fora de qualquer reserva — provável uso interno)
  - **Sem veículo** (transponder não cadastrado em nenhum carro → CTA "Vincular transponder" abre o veículo)
- **Confirmar importação** grava tudo nas tabelas.

Acesso no menu: novo item "E-Pass" dentro de **Configurações → Gestão** (próximo a Turo) e/ou em **Operações**.

## 5. Cobrança ao cliente

Na página de detalhes da reserva (`AdminBookingDetail`):
- Nova seção **Pedágios E-Pass** lista `epass_tolls` da reserva, com total
- Botão **"Adicionar à fatura"** cria uma `payment_request` (ou linha de addon) com o total não cobrado e marca `charged_to_customer=true`
- Estado visual claro: "Pendente cobrança" / "Cobrado"

Sem alteração automática de `total_price` — fica explícito por ação do operador.

## 6. Pendências automáticas

Em `AdminPendencias`: nova categoria **"Transponder E-Pass não cadastrado"** listando veículos sem `e_pass_transponder` mas que aparecem em algum CSV importado (referência cruzada via `epass_tolls.status='no_vehicle'`).

## Arquivos a criar/alterar

Criar:
- `supabase/migrations/<ts>_epass.sql` (3 tabelas + RLS + grants + índices)
- `src/lib/epass/csvParser.ts`
- `src/lib/epass/assignEngine.ts`
- `src/lib/epass/applyImport.ts`
- `src/components/admin/epass/EpassDropzone.tsx`
- `src/components/admin/epass/EpassPreview.tsx`
- `src/components/admin/epass/EpassTollsTable.tsx`
- `src/pages/admin/AdminEpassImport.tsx`
- `src/components/admin/booking/BookingEpassTolls.tsx`

Alterar:
- `src/App.tsx` (rota `/admin/epass-import`)
- `src/components/admin/AdminSidebar.tsx` (item de menu)
- `src/pages/admin/AdminBookingDetail.tsx` (seção pedágios)
- `src/pages/admin/AdminPendencias.tsx` (categoria nova)

## Pontos a confirmar antes de codar

1. **PDF**: ok aceitar **só CSV** na v1? (parse de PDF E-Pass dá inconsistência e o portal já exporta CSV)
2. **Cobrança**: criar como **`payment_request` separado** (recomendado) ou somar no `total_price` da reserva?
3. **Fuso horário**: confirmo que os horários do CSV são **America/New_York** (Orlando) — ok?
4. **Pedágios "sem reserva"**: ficam só registrados (uso interno/manutenção) ou também listar como pendência?
