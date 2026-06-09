## Objetivo

Transformar o registro de reserva em uma **jornada guiada por etapas**, com a opção da IA pré-preencher tudo antes do wizard começar. Ao final, uma tela de revisão editável confirma e cria a reserva — já marcada como aprovada, porém com selos visíveis de **contrato pendente** e **pagamento pendente**, que dão baixa automaticamente quando concluídos.

---

## Fluxo proposto (UX)

### Caminho IA
1. **Tela de captura** (atual painel "Extrair dados com IA", isolada — sem formulário embaixo)
   - Anexar print/PDF, colar texto, gravar áudio
   - Botão único: **"Interpretar com IA"**
   - Loading com feedback ("Lendo documento...", "Identificando cliente...", "Cruzando com a frota...")
2. Após sucesso → entra no **Wizard** com campos pré-preenchidos e badge "Sugerido pela IA" em cada campo tocado pela IA

### Caminho Manual
- Pula direto ao **Wizard** com tudo vazio

### Wizard (7 etapas + revisão)
Header sticky com stepper horizontal (1/7, barra de progresso dourada), botões **Voltar / Avançar** no rodapé, atalho `Enter` para avançar:

| # | Etapa | Conteúdo |
|---|-------|----------|
| 1 | **Cliente** | Buscar existente ou criar novo (reaproveita CustomerCombobox). IA pode pré-selecionar via match por nome/email/telefone; se não achar, abre "Criar novo" pré-preenchido |
| 2 | **Veículo** | Grid visual da frota com cards (foto, nome, diária). IA marca o sugerido com selo "Sugerido". Filtro por categoria |
| 3 | **Retirada** | Data + hora + local (com AddressAutocomplete) |
| 4 | **Devolução** | Data + hora + local. Mostra duração calculada em destaque |
| 5 | **Caução & Franquia** | Valor caução, valor franquia, prazo para devolução do caução (dias) |
| 6 | **Opcionais** | Plano (Essencial/Conforto/Premium), motorista adicional, idade do motorista, addons |
| 7 | **Pagamento** | Valor total (auto-calculado, editável), forma de pagamento (Pix/Cartão/Dinheiro/Stripe/Outro), status inicial do pagamento (Pendente / Pago) |
| ✓ | **Revisão** | Página única com todos os blocos em modo leitura, cada bloco com botão "Editar" que volta à etapa. Botão final: **Confirmar e criar reserva** |

### Pós-criação
A reserva é criada com `status = 'confirmed'` e dois sub-status visíveis no card/detalhe:
- **Contrato:** Pendente → Enviado → Assinado (já integrado via Clicksign)
- **Pagamento:** Pendente → Pago

Quando os dois ficam OK, o badge geral muda para "Aprovada — completa". Caso contrário, mostra chips: "Contrato pendente" e/ou "Pagamento pendente".

---

## Detalhes técnicos

### Banco de dados (migration)
Adicionar à tabela `bookings`:
- `payment_status text not null default 'pending'` (valores: `pending`, `paid`, `refunded`, `partial`)
- `payment_method text` (`pix`, `card`, `cash`, `stripe`, `other`)
- `paid_at timestamptz`

`contract_status` já existe — manter. Sem mudanças de RLS.

### Arquivos a criar
- `src/components/admin/booking-wizard/BookingWizard.tsx` — orquestrador (state global do form + stepper)
- `src/components/admin/booking-wizard/WizardStepper.tsx` — barra de progresso
- `src/components/admin/booking-wizard/WizardFooter.tsx` — botões Voltar/Avançar
- `src/components/admin/booking-wizard/steps/StepCustomer.tsx`
- `src/components/admin/booking-wizard/steps/StepVehicle.tsx`
- `src/components/admin/booking-wizard/steps/StepPickup.tsx`
- `src/components/admin/booking-wizard/steps/StepReturn.tsx`
- `src/components/admin/booking-wizard/steps/StepDepositFranchise.tsx`
- `src/components/admin/booking-wizard/steps/StepExtras.tsx`
- `src/components/admin/booking-wizard/steps/StepPayment.tsx`
- `src/components/admin/booking-wizard/steps/StepReview.tsx`
- `src/components/admin/booking-wizard/AiCapturePanel.tsx` — tela inicial de captura (caminho IA)
- `src/components/admin/booking-wizard/types.ts` — `WizardFormState`, `AiSuggestedFields`

### Arquivos a editar
- `src/pages/admin/AdminBookingNew.tsx` — após escolher modo, renderiza `<BookingWizard mode="ai|manual" />` em vez do `NewBookingDialog`
- `src/components/admin/NewBookingDialog.tsx` — **mantido como está**, ainda usado em outros pontos (`AdminBookings`, agenda etc.). Não quebra nada.
- Lugares que mostram status da reserva (`AdminBookingDetail`, `BookingCard`, listagem) — adicionar chips de contrato/pagamento pendentes
- `src/data/bookingTypes.ts` — adicionar `payment_status`, `payment_method`

### Estado do wizard
Um único `useState<WizardFormState>` no `BookingWizard` é repassado por props às etapas (`value` + `onChange`). Cada etapa valida só seus campos antes de liberar "Avançar". `aiSuggestedKeys: Set<string>` controla quais campos mostram o selo dourado "IA".

### Persistência intermediária
Usar `useFormDraft` (já existe no projeto) com chave `booking-wizard-draft` para não perder dados em refresh.

### Aproveitamento
- Lógica de criação final (insert na `bookings`) reaproveita o handler de submit do `NewBookingDialog` extraído para `src/lib/createBooking.ts`
- `extract-booking` edge function: sem mudanças
- `VoiceRecorder`, `OcrReviewPanel`, `CustomerCombobox`, `AddressAutocomplete`, `BookingDateField`: reaproveitados

---

## O que NÃO está no escopo desta entrega
- Mudar o fluxo do cliente público (`/booking`)
- Refatorar `EditBookingDialog`
- Mudar a integração Clicksign (já existe e dispara baixa automática)

---

## Como testar depois de pronto
1. Ir em **Reservas → Nova reserva → Utilizar Auxiliar de IA**
2. Colar um texto de WhatsApp e clicar "Interpretar"
3. Confirmar que o wizard abre na etapa 1 com cliente sugerido
4. Passar pelas 7 etapas, conferir validações e selos "IA"
5. Na revisão, editar um campo, confirmar e criar
6. Conferir que a reserva aparece na listagem com chips "Contrato pendente" + "Pagamento pendente"
7. Marcar pagamento como pago → chip some
8. Assinar contrato no Clicksign → chip some → badge vira "Aprovada — completa"

---

## Riscos
- Wizard longo pode cansar — mitigado pelo pré-preenchimento da IA e `useFormDraft`
- `NewBookingDialog` continua sendo usado em outros pontos; manter compatibilidade
- Migration adiciona colunas com default seguro, sem quebrar dados existentes

Quer que eu siga com esse plano ou ajusto alguma etapa antes (ordem, agrupamento, campos extras)?