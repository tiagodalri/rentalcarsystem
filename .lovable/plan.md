## Objetivo
Criar o usuário **rui@zeusrentalcar.com** com um papel novo — **Operador de Rua (`driver`)** — que enxerga apenas o necessário para entregar/devolver carros e fazer inspeções. **Zero acesso a valores financeiros.**

## O que o Rui poderá ver
- **Operação (Hoje)** — agenda de retiradas e devoluções do dia (já não mostra valores)
- **Reservas** — lista + detalhe da reserva (cliente, carro, horários, locais, telefone, observações) — **sem coluna Valor, sem caução, sem franquia, sem totais**
- **Inspeções pré e pós** — fluxo completo de check-in/check-out com fotos
- **Clientes** — só nome e contato da reserva atual (sem histórico financeiro)

## O que ele NÃO poderá ver
- Painel/Dashboard (tem KPIs financeiros)
- Financeiro, Relatórios, Lucro da Frota
- Frota (custos, despesas, preços)
- Live tracking, Importar Turo, Contratos, Equipe, Configurações
- Qualquer coluna/linha com `$`, total, caução, franquia, diária, receita, despesa

## Como vou implementar

### 1. Banco — novo papel `driver`
- Migration adicionando `'driver'` ao enum `app_role`
- Atualizar trigger `sync_team_member_role` para mapear `'driver'` / `'motorista'` / `'operador'` → `driver`

### 2. Criar o usuário Rui
- Edge function pontual `create-team-user` (restrita a admin) que usa service role para `auth.admin.createUser({ email, password, email_confirm: true })`
- Insere em `team_members` com role `driver` (o trigger cria automaticamente em `user_roles`)
- Senha inicial **Zeus2026** já confirmada — Rui entra direto em `/admin/login`

### 3. Rotas (`src/App.tsx`)
Liberar para `driver` somente: `bookings`, `bookings/:id`, `bookings/new`, `ops-today`, `inspection/:id`, `inspection/compare/:id`, `customers/:id` (visualização). Todas as outras rotas admin permanecem bloqueadas e o `RequireRole` redireciona.

### 4. Menu lateral e bottom nav
`AdminSidebar.tsx` e `AdminBottomNav.tsx`: incluir `driver` em "Operação" e "Reservas" apenas. Painel/Live/Frota/Financeiro/etc não aparecem para ele. A landing padrão pós-login para `driver` vira `/admin/ops-today`.

### 5. Esconder valores nas telas que ele acessa
Criar helper `useHideFinancials()` que retorna `true` quando o usuário só tem papel `driver`. Aplicar em:
- `AdminBookings.tsx` — esconder coluna **Valor**, **Caução**, **Franquia**, sumário de receita, opção de ordenar por valor, e remover esses campos do export CSV
- `AdminBookingDetail.tsx` — esconder bloco de pricing, totais, caução, franquia, diária do veículo, "reserva quitada"
- `MobileBookings.tsx` — esconder o `total_price` no card
- Verificar `AdminCustomerDetail` se mostra valores (esconder se sim)

Inspeção e Operação Hoje já não mostram valores — apenas garantir defensivamente.

### 6. Validação
- Login como Rui no preview → confirma que sidebar mostra só "Operação" e "Reservas"
- Tentar acessar `/admin/finance` direto pela URL → redireciona
- Abrir uma reserva → nenhum `$` visível em lugar nenhum
- Abrir inspeção → fluxo completo funciona

## Resumo técnico
| Camada | Arquivo |
|---|---|
| DB | nova migration (enum + trigger update) |
| Auth | edge function `create-team-user` (one-shot) |
| Rotas | `src/App.tsx` |
| Navegação | `AdminSidebar.tsx`, `AdminBottomNav.tsx` |
| Hook | `src/hooks/useHideFinancials.ts` (novo) |
| Telas | `AdminBookings.tsx`, `AdminBookingDetail.tsx`, `MobileBookings.tsx`, `AdminCustomerDetail.tsx` |

Posso seguir?
