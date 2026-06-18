
# Plano: Migração 100% Câmbio Real + Melhorias do Fluxo de Reserva

## Objetivo
1. **Remover totalmente o Stripe** do sistema (frontend, backend, edge functions, banco, secrets, config) sem quebrar nenhum fluxo ativo.
2. Implementar melhorias nos blocos **1 (webhooks/holds)**, **2 (pós-venda)**, **3 (checkout)** e **6 (operações/observabilidade)**.
3. Descartados conforme pedido: pontos **4** (disponibilidade/preço batch), **5** (contrato/inspeção) e **7** (conversão).

---

## PARTE A — Remoção total do Stripe

### A1. Mapa do que existe hoje (auditoria antes de tocar)
Antes de remover qualquer linha, vou rodar um `rg "stripe"` no projeto inteiro e gerar uma lista exaustiva. Pontos já conhecidos:

**Edge functions**
- `supabase/functions/create-checkout/index.ts` — cria sessão Stripe Checkout (legado).
- (verificar) `stripe-webhook`, `verify-payment`, qualquer outra função que importe `stripe`.

**Frontend**
- `src/pages/Checkout.tsx` — pode ter tab/branch Stripe; hoje fluxo ativo é Pix/Boleto/Cartão via Câmbio Real.
- `src/pages/BookingConfirmed.tsx` — provavelmente lê `session_id` da URL.
- Qualquer `supabase.functions.invoke("create-checkout")` no app.

**Banco**
- Coluna `bookings.stripe_session_id` (gravada por `create-checkout`).
- Possíveis colunas em `payment_requests` ou índices.

**Secrets**
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (se existirem) → remover via `delete_secret`.

**Config**
- `supabase/config.toml` — checar se há entrada para função Stripe.
- Tipos gerados (`src/integrations/supabase/types.ts`) — atualizam sozinhos após migration.

### A2. Ordem segura de remoção (sem quebrar nada)

```text
1. Auditoria (rg) + lista fechada de arquivos/refs
2. Frontend: remover toda chamada/branch Stripe — substituir
   por caminho Câmbio Real já existente (Pix/Boleto/Cartão)
3. Build local — garantir zero referência pendente
4. Deletar edge functions Stripe (delete_edge_functions)
5. Migration: DROP COLUMN bookings.stripe_session_id
   (com IF EXISTS, em transação)
6. delete_secret STRIPE_* (se existirem)
7. Limpar config.toml se houver entrada Stripe
8. Smoke test: criar reserva Pix + Cartão em sandbox
```

Cada passo é independente e reversível até o passo 5. Faço commits separados implícitos.

### A3. O que NÃO removo
- Histórico de `bookings` antigas que tenham `stripe_session_id` populado — só dropo a coluna depois de confirmar com você. Alternativa mais segura: **manter a coluna** (read-only) e só remover o código que escreve nela. Recomendo essa via.

---

## PARTE B — Melhorias do fluxo (escopo aprovado)

### B1. Webhooks e holds de pagamento (bloco 1)

**Problema hoje:** se o cliente abandona o checkout Câmbio Real, a `bookings` fica em `pending_payment` com `hold_expires_at = now + 30min`. Nada limpa isso depois. Sem reconciliação periódica, podemos depender 100% do webhook chegar — e webhook pode falhar silenciosamente.

**O que vou fazer:**

1. **Cron de reconciliação a cada 5 min** — nova edge function `cambioreal-reconcile-cron`:
   - Busca todo `payment_request` com status `AGUARDANDO_CLIENTE` criado há > 5 min.
   - Chama `GET /service/v1/checkout/get/{token}` no Câmbio Real.
   - Aplica a mesma lógica do webhook (confirma, cancela, ou mantém).
   - Idempotente: nunca rebaixa status mais avançado.
   - Agendada via `pg_cron` (já temos infra do `pickup-reminder-cron`).

2. **Cron de expiração de hold a cada 1 min** — `cambioreal-expire-holds-cron`:
   - Marca como `cancelled` qualquer `bookings` com `status='pending_payment'` e `hold_expires_at < now()`.
   - Libera o carro para outras buscas.
   - Loga em `email_logs`/tabela de auditoria.

3. **Dashboard de webhook health** (admin) — descrito em B4.

### B2. Pós-venda (bloco 2)

**Problema hoje:** template `payment-receipt` existe mas ninguém dispara. Sem retenção, sem avaliação pública, devolução de caução manual sem trilha.

**O que vou fazer:**

1. **Disparo automático de recibo** — no `cambioreal-webhook`, após `SOLICITACAO_PAGO`, invoco `send-email` com template `payment-receipt` (idempotente via `email_logs`, já temos).

2. **Avaliação pública pós-devolução** — nova rota `/avaliacao/:bookingNumber?token=...`:
   - Token assinado (HMAC com `JWT_SECRET`) gerado quando reserva vira `completed`.
   - Email "Como foi sua experiência?" 24h após devolução (cron novo `post-rental-survey-cron`).
   - Form salva em `booking.rating` (1-5) + `booking.rating_comment`.
   - Admin vê coluna nova em `AdminBookings`.

3. **Reembolso de caução com trilha** — em `AdminBookingDetail`, botão "Registrar devolução de caução" que cria registro em nova tabela `deposit_refunds` (booking_id, amount, method, refunded_at, refunded_by, notes) e dispara email confirmando. *Reembolso continua manual financeiramente*, só formalizamos a trilha.

4. **Cron de retenção** — `retention-emails-cron` diário:
   - +30 dias: email "Que tal um novo passeio?" com desconto sutil.
   - +90 dias: lembrete sazonal.
   - +180 dias: reativação.
   - Templates novos em `send-email/templates/`.
   - Opt-out via `customers.marketing_opt_out` (boolean novo).

### B3. Checkout sem fricção (bloco 3)

**Problema hoje:** cotação BRL expira em 15 min; CPF é exigido antes mesmo de escolher cartão internacional; não dá pra salvar e voltar depois.

**O que vou fazer:**

1. **Cotação BRL com refresh transparente** — em `Checkout.tsx`:
   - Mantém 15 min de validade da cotação Câmbio Real (limite deles).
   - Adiciona contador visível "Cotação válida por X:XX" + botão "Atualizar cotação" que rebusca sem perder os dados do formulário.
   - Se o usuário envia depois de expirado, refaço a cotação automaticamente e mostro modal "O dólar mudou de R$ X,XX para R$ Y,YY — confirma?".

2. **CPF condicional** — só obrigatório para Pix/Boleto. Para Cartão internacional, vira opcional (mantemos campo "Passaporte ou CPF").

3. **Salvar e continuar depois** — novo botão "Salvar reserva e continuar depois":
   - Cria `bookings` em status `draft` (novo valor de enum) com `hold_expires_at = now + 24h`.
   - Envia email com link `/checkout/retomar/:bookingNumber?token=...`.
   - Cron de expiração de draft (24h) reusa o cron de holds.

### B4. Operações e observabilidade (bloco 6)

**Problema hoje:** sem visibilidade quando webhook do Câmbio Real falha ou quando email não vai.

**O que vou fazer:**

1. **Tabela `webhook_events`** — log estruturado de todo webhook recebido (origem, payload, status HTTP retornado, processed_at, error).
   - Populada em `cambioreal-webhook` e `clicksign-webhook`.

2. **Dashboard `/admin/observabilidade`**:
   - Cards: webhooks últimas 24h (ok/erro), emails últimas 24h (sent/failed), holds expirados hoje, reconciliações que mudaram status.
   - Tabela com últimos 50 webhooks e botão "Reprocessar" para os que falharam.
   - Lê `webhook_events` + `email_logs`.

3. **Alertas de falha em `email_logs`** — cron horário `email-failure-alert-cron`:
   - Se > 3 falhas na última hora, envia email para `admin@zeusrentalcar.com`.

---

## Detalhes técnicos (para a parte técnica)

### Migrations necessárias
```sql
-- B1
-- (nenhuma; usa colunas existentes)

-- B2
alter table public.customers add column if not exists marketing_opt_out boolean not null default false;
alter table public.bookings add column if not exists rating_comment text;
create table public.deposit_refunds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  amount numeric(10,2) not null,
  currency text not null default 'USD',
  method text,
  notes text,
  refunded_at timestamptz not null default now(),
  refunded_by uuid references auth.users(id)
);
grant select, insert, update on public.deposit_refunds to authenticated;
grant all on public.deposit_refunds to service_role;
alter table public.deposit_refunds enable row level security;
create policy "staff manage refunds" on public.deposit_refunds
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

-- B3
-- adiciona 'draft' ao enum de status (se for enum) ou nada (se for text)

-- B4
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,           -- 'cambioreal' | 'clicksign'
  payload jsonb not null,
  http_status int,
  processed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);
grant select on public.webhook_events to authenticated;
grant all on public.webhook_events to service_role;
alter table public.webhook_events enable row level security;
create policy "staff read webhooks" on public.webhook_events
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- A2 (último, opcional)
-- alter table public.bookings drop column if exists stripe_session_id;
```

### Edge functions novas
- `cambioreal-reconcile-cron` (cron 5min)
- `cambioreal-expire-holds-cron` (cron 1min)
- `post-rental-survey-cron` (cron diário)
- `retention-emails-cron` (cron diário)
- `email-failure-alert-cron` (cron horário)
- `generate-survey-token` (HTTP, para link público)

### Edge functions removidas
- `create-checkout` (Stripe)
- Qualquer `stripe-*` que aparecer na auditoria

### Secrets
- Remover: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (se existirem)
- Adicionar: nenhum novo (já temos `CAMBIOREAL_*`, `RESEND_API_KEY`, `JWT_SECRET` p/ tokens de survey — se faltar, peço)

### Frontend novo/alterado
- `src/pages/Checkout.tsx` — refresh de cotação, CPF condicional, salvar-e-continuar
- `src/pages/CheckoutResume.tsx` — nova
- `src/pages/PublicSurvey.tsx` — nova
- `src/pages/admin/AdminObservability.tsx` — nova
- `src/pages/admin/AdminBookingDetail.tsx` — botão deposit refund
- `src/pages/admin/AdminBookings.tsx` — coluna rating

---

## Como vamos testar (antes de eu dar por concluído)
1. **Stripe-removal:** `rg -i stripe src supabase` retorna zero matches funcionais.
2. **Reserva Pix sandbox:** cria booking → webhook chega → status `confirmed` → email recibo enviado → contrato disparado.
3. **Hold expiration:** criar booking `pending_payment` com `hold_expires_at` passado → cron marca `cancelled` em ≤ 1 min.
4. **Reconciliação:** simular webhook perdido (deletar `payment_request.status` update) → cron 5min recupera.
5. **Salvar e continuar:** clicar salvar → receber email → abrir link → formulário pré-preenchido.
6. **Observabilidade:** ver entradas em `/admin/observabilidade` após cada teste acima.

---

## Riscos e mitigações
| Risco | Mitigação |
|---|---|
| Quebrar reservas em andamento ao remover Stripe | Manter `stripe_session_id` na tabela (drop opcional depois); remover só código que **escreve** |
| Cron rodando em loop infinito | Idempotência + `WHERE` restrito por timestamp + LIMIT |
| Email de survey virar spam | Opt-out + 1 disparo único por booking |
| Reconciliação confirmar booking já cancelado | Função sempre verifica `status` atual antes de transitar |
| `JWT_SECRET` ausente para tokens de survey | Peço via `add_secret` antes de implementar B2 |

---

## Ordem de execução sugerida
1. **PARTE A** completa (1 sessão) — limpa a casa.
2. **B1** (1 sessão) — base de confiabilidade.
3. **B4** (1 sessão) — visibilidade antes do resto, pra você ver o que acontece.
4. **B2** (1-2 sessões) — pós-venda.
5. **B3** (1 sessão) — checkout polish.

Cada etapa termina com smoke test e você aprova antes da próxima.

---

**Pergunta antes de começar:** posso **manter** a coluna `bookings.stripe_session_id` no banco (mais seguro, zero risco) ou você quer mesmo dropar? E confirma que posso começar pela Parte A agora?
