# Fluxo de assinatura de contrato — plano

## Diagnóstico do que já existe

Boa parte da infra já está pronta neste projeto, então não vamos recriar nada — só fechar o ciclo.

**Já implementado hoje:**
- Integração **Clicksign v3** em `supabase/functions/send-contract/index.ts` (gera PDF com pdf-lib, cria envelope, sobe documento, adiciona signers Zeus + cliente, ativa envelope).
- Webhook `supabase/functions/clicksign-webhook/index.ts` com validação HMAC, mapeia eventos para `contract_status`: `partially_signed`, `signed`, `cancelled`.
- Tabela `bookings` já tem: `contract_status` (default `not_sent`), `clicksign_envelope_id`, `clicksign_document_key`, `contract_sent_at`, `contract_signed_at`, `contract_signed_pdf_url`, `contract_error`.
- Secrets já configurados: `CLICKSIGN_API_TOKEN`, `CLICKSIGN_WEBHOOK_SECRET`.
- Webhook de pagamento `cambioreal-webhook` já marca a reserva como `confirmed` + `payment_status=paid`.
- Botão manual "Enviar contrato" no admin (`AdminBookingDetail.tsx`).

## O que está faltando (escopo deste trabalho)

1. **Disparo automático pós-pagamento** — hoje o envio é manual pelo admin.
2. **Auto-assinatura da Zeus (locadora)** — hoje a Zeus também recebe e-mail e precisa clicar para assinar. Precisa ser automática.
3. **CTA de assinatura no painel do cliente** + status visível.
4. **Painel admin de contratos** consolidado (hoje só aparece dentro de cada reserva).
5. **Download do PDF assinado** quando concluído (puxar do Clicksign e guardar em Storage).

## Mudanças

### 1. Banco — migration
- Bucket privado `signed-contracts` já existe; só garantir policies para `authenticated` leem só os próprios e admins leem tudo.
- Sem novas tabelas. Acrescentar índice em `bookings(contract_status)` para o painel admin.

### 2. Edge functions
**`supabase/functions/cambioreal-webhook/index.ts`** (editar)
- Após marcar booking como `confirmed`/`paid`, disparar `supabase.functions.invoke("send-contract", { booking_id })` (fire-and-forget, dentro do bloco background já existente). Idempotente: só envia se `contract_status in ('not_sent','failed')`.

**`supabase/functions/send-contract/index.ts`** (editar)
- Após criar o envelope e antes do `status=running`, chamar Clicksign para **auto-assinar como Zeus** usando token de API (endpoint `POST /api/v3/envelopes/{id}/signers/{signerZeusId}/sign` com o token da conta dona — fluxo "assinatura automática por API key" da Clicksign). Se a Clicksign exigir requirement `provide_evidence=api`, ajustar o requirement do signer Zeus para `auth: "api"` em vez de `email`.
- Resultado: só o cliente recebe o e-mail de assinatura.

**`supabase/functions/clicksign-webhook/index.ts`** (editar)
- No evento `auto_close`/`close`, baixar o PDF final via `GET /api/v3/envelopes/{id}/documents` (campo `download_url`), salvar em `storage/signed-contracts/{booking_id}.pdf` e gravar `contract_signed_pdf_url` (signed URL de longa duração ou path para gerar sob demanda).

### 3. Frontend

**`src/pages/BookingDetailClient.tsx`** (editar — painel do cliente)
- Bloco "Contrato": mostra status (`Aguardando envio`, `Aguardando sua assinatura`, `Assinado em ...`).
- Quando `contract_status='sent'` ou `'partially_signed'` e o cliente ainda não assinou: botão **"Assinar contrato"** que busca a URL de assinatura do signer cliente (nova função leve `get-contract-sign-url` que consulta `/api/v3/envelopes/{id}/signers/{customerSignerId}` e retorna `sign_url`).
- Quando `signed`: botão **"Baixar contrato assinado"**.

**`src/pages/admin/AdminBookings.tsx`** (editar) ou nova aba `AdminContracts.tsx`
- Decisão: adicionar **nova rota `/admin/contratos`** com lista filtrável por status (`Pendente`, `Aguardando cliente`, `Parcialmente assinado`, `Assinado`, `Cancelado`, `Falhou`), com link para a reserva e ações: reenviar, cancelar envelope, baixar PDF.
- Adicionar item no menu admin (`AdminSidebar` + `AdminBottomNav`).

**`src/pages/admin/AdminBookingDetail.tsx`** (manter)
- Botão atual vira "Reenviar contrato" quando já foi enviado uma vez.

### 4. Nova edge function: `get-contract-sign-url`
- Recebe `booking_id`, valida sessão do cliente (dono da reserva) ou admin, consulta Clicksign e retorna `sign_url` do signer cliente. Evita expor o token Clicksign no front.

## Arquivos a criar/alterar

**Criar**
- `supabase/migrations/<timestamp>_contracts_index_and_storage.sql`
- `supabase/functions/get-contract-sign-url/index.ts`
- `src/pages/admin/AdminContracts.tsx`
- `src/hooks/useContractStatus.ts` (helper compartilhado)

**Editar**
- `supabase/functions/cambioreal-webhook/index.ts` — disparo automático
- `supabase/functions/send-contract/index.ts` — auto-sign Zeus via API
- `supabase/functions/clicksign-webhook/index.ts` — baixar PDF assinado
- `supabase/config.toml` — registrar `get-contract-sign-url` (verify_jwt true)
- `src/pages/BookingDetailClient.tsx` — bloco contrato + CTA
- `src/components/admin/AdminSidebar.tsx` + `AdminBottomNav.tsx` — item "Contratos"
- `src/App.tsx` — rota nova

## Pontos abertos para você confirmar

1. **Provedor**: mantenho **Clicksign** (já 100% integrado). OK?
2. **Auto-assinatura da Zeus**: a Clicksign aceita auto-assinatura via API quando o requirement do signer é `auth: "api"`. Vou ajustar essa parte. Se a sua conta Clicksign não permitir esse modo (depende do plano), o fallback é manter a Zeus assinando por e-mail — me avisa o plano da conta se souber.
3. **PDF final**: salvar em Storage privado `signed-contracts` e servir via signed URL de 7 dias quando o cliente/admin pedir. OK?
4. **Disparo**: só pelo `cambioreal-webhook` (forma atual de pagamento) — confirmo que não tem outro caminho de pagamento ativo?

Aprova que eu já implemento?
