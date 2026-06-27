# Painel de LOGS — Monitoramento Imersivo

Acesso restrito ao e-mail `admin@zeusrentalcar.com`. Tudo que acontece no sistema (login, navegação, cliques, ações) será registrado e visualizado num painel interativo.

## 1. O que vai ser registrado

| Categoria | Exemplos capturados |
|---|---|
| **Sessão** | login, logout, falha de login, IP, user-agent, cidade/estado/país (via `ipapi.co`), device (mobile/desktop), navegador |
| **Navegação** | toda mudança de rota com URL, timestamp, tempo gasto na página anterior |
| **Cliques** | botões, links e elementos com `data-track` (texto/label, rota onde ocorreu) |
| **Ações de negócio** | criar/editar/cancelar reserva, iniciar/concluir inspeção, upload de foto, alterar veículo, alterar cliente, exportar dados, importar Turo, compartilhar WhatsApp, gerar link público |
| **Erros** | erros de runtime capturados pelo error boundary |

## 2. Estrutura de dados (Cloud)

Tabela nova `public.activity_logs`:
- `user_id`, `user_email`, `user_name`
- `event_type` (`login`/`logout`/`page_view`/`click`/`action`/`error`)
- `event_name` (ex.: "Cancelar reserva", "Upload foto inspeção")
- `path` (rota), `referrer`, `target_id` (id do recurso afetado, ex.: booking_id)
- `metadata` (jsonb com payload extra: valores antigos/novos, label do botão, etc.)
- `ip`, `city`, `region`, `country`, `device`, `browser`, `os`
- `session_id` (agrupa eventos de uma mesma sessão)
- `duration_ms` (tempo na página anterior)
- `created_at`

RLS: apenas admins leem. Insert permitido a qualquer usuário autenticado (escreve só os próprios eventos).

Mantemos a tabela `audit_logs` existente (mudanças de banco) — o painel agrega as duas fontes.

## 3. Coleta no front

- Hook global `useActivityTracker` montado no `App.tsx`:
  - dispara `page_view` em toda navegação do React Router (com `duration_ms` da página anterior)
  - escuta cliques em `<button>`, `<a>` e qualquer elemento com `[data-track]` (com debounce)
  - escuta `auth.onAuthStateChange` para `login`/`logout`
  - resolve geo via `ipapi.co/json` uma vez por sessão e cacheia em `sessionStorage`
- Helper `logAction(event_name, metadata)` para ações de negócio chamado nos pontos críticos (reservas, inspeções, importação Turo, contratos, etc.)
- Buffer + flush em lote (a cada 5s ou 10 eventos) via `supabase.from('activity_logs').insert([...])` — não bloqueia UI, falhas silenciosas

## 4. Painel `/admin/logs`

Guard: redireciona se `user.email !== 'admin@zeusrentalcar.com'`. Item de menu "LOGS" aparece só pra esse e-mail.

Layout em 3 abas no estilo private-bank (admin-shell):

**Aba "Usuários"** — grid de cards com avatar, nome, e-mail, último acesso (relativo + exato), cidade/país, device, total de eventos hoje/7d/30d, status (online se sessão ativa há <5min). Clique abre o drawer da sessão.

**Aba "Atividade ao vivo"** — feed em tempo real (realtime channel) tipo terminal: timestamp, usuário, evento, rota, IP. Filtros por usuário, tipo de evento, data. Auto-scroll com toggle pausar.

**Aba "Sessões"** — lista de sessões agrupadas (1 linha por session_id) com início/fim, duração, nº de eventos, rota inicial→final, mapa de calor das rotas visitadas. Drawer com timeline vertical imersiva: cada evento como nó (ícone Lucide por tipo, cor do private-bank), com tempo gasto entre eventos, payload expandível.

**KPIs no topo**: usuários ativos agora, sessões hoje, ações críticas (cancelamentos, exclusões), erros 24h.

Exportar CSV de qualquer filtro aplicado.

## 5. Arquivos

**Novos**
- `supabase/migrations/...` — tabela `activity_logs` + policies + GRANTs + índices
- `src/lib/activityLogger.ts` — buffer + flush + geo
- `src/hooks/useActivityTracker.tsx` — montado no App
- `src/pages/admin/AdminLogs.tsx` — painel com 3 abas
- `src/components/admin/logs/UserCard.tsx`
- `src/components/admin/logs/LiveFeed.tsx`
- `src/components/admin/logs/SessionTimeline.tsx`
- `src/components/admin/logs/LogFilters.tsx`

**Editados**
- `src/App.tsx` — montar tracker + rota `/admin/logs`
- `src/components/admin/AdminSidebar.tsx` (ou equivalente) — item "LOGS" condicional
- pontos-chave para `logAction()`: `AdminBookings`, `AdminInspection`, `AdminBookingDetail`, `turo` import, contratos, upload de fotos

## 6. Privacidade / performance

- IP nunca exibido para usuários comuns (admin master only).
- Cliques não capturam valores de inputs sensíveis (senha, CPF, cartão) — bloqueio por seletor.
- Eventos antigos: job de limpeza (>90 dias) via função SQL agendada manualmente quando necessário.
- Índices em `(user_id, created_at desc)` e `(session_id)`.

Posso seguir com essa estrutura?
