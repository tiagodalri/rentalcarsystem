
# Redesign Mobile/PWA — Experiência Nativa

Objetivo: cada tela do admin no celular vira uma versão própria, pensada de baixo pra cima pro polegar — não uma redução do desktop. Trabalho em **fases sequenciais**, cada uma entregue completa e testável antes da próxima.

## Fundação compartilhada (Fase 0 — faço antes de tudo)

Vou criar primitivos que todas as próximas fases vão usar. Sem isso, cada tela vira improviso de novo.

- **MobileSheet** — bottom sheet com handle, snap points, swipe-to-dismiss, safe-area. Substitui Dialog em mobile.
- **MobileListItem** — linha 56pt+ com avatar/ícone, título, subtítulo, badge, chevron, área de toque inteira clicável.
- **SwipeAction** — swipe-left/right em itens de lista pra ações rápidas (arquivar, confirmar, ligar).
- **PullToRefresh** — gesto nativo em listas que dependem de dados frescos.
- **SegmentedControl** — substitui Tabs em mobile (iOS-style).
- **MobileFormField** — input com label flutuante, alvo 48pt, teclado correto (`inputMode`, `enterKeyHint`), scroll-into-view quando focado.
- **StickyActionBar** — barra inferior fixa pra ação primária (acima do bottom nav, respeita safe-area).
- **Hook `useIsMobileApp`** — `useIsMobile()` + detecção de standalone PWA pra decidir layouts.

Tudo isolado em `src/components/mobile/*` e `src/hooks/`, sem mexer no desktop.

---

## Fase 1 — Painel (`/admin`)

Hoje é uma versão comprimida do desktop. Vira:

- **Hero "agora"**: card grande no topo com a próxima ação (check-in/out das próximas 2h), nome do cliente, horário, botão primário "Iniciar inspeção" full-width.
- **KPIs em scroll horizontal** (chips): Frota rodando · Disponíveis · Em preparo · Pendências. Tap abre sheet com lista.
- **Timeline do dia**: lista vertical de check-ins/check-outs, agrupada por período (Manhã/Tarde/Noite), com swipe-action pra abrir reserva ou ligar pro cliente.
- **Atalhos rápidos**: 4 botões grandes (Nova reserva · Nova inspeção · Live · Frota).
- Remove KPIs duplicados e textos longos do desktop.

## Fase 2 — Operação / Hoje (`/admin/ops-today`)

- Header com data + navegação dia-anterior/próximo em swipe horizontal (gesto, não só botões).
- Segmented control: **Retiradas · Devoluções · Em preparo**.
- Lista de cards grandes com foto do veículo, cliente, horário, status (atrasada em vermelho), botão "Inspeção" primário.
- Swipe-right no card = abrir reserva. Swipe-left = ligar cliente / WhatsApp.
- FAB contextual já existe — passa a "Nova inspeção rápida".

## Fase 3 — Reservas (`/admin/bookings` + detalhe + nova)

- Lista vira cards (não tabela). Cada card: cliente, veículo, datas compactas (10-13 jun), valor, status badge.
- Filtros viram bottom sheet com chips selecionáveis (status, período, plano) — não dropdowns.
- Busca colapsada vira ícone que expande full-width.
- **Detalhe da reserva** em mobile: layout em seções colapsáveis (Cliente · Veículo · Pagamento · Contrato · Timeline), action bar fixa embaixo com ação primária por status (Confirmar / Iniciar check-in / Finalizar).
- **Nova reserva mobile**: wizard step-by-step (1 campo grande por vez quando faz sentido), barra de progresso, teclado certo por campo.

## Fase 4 — Frota + Inspeção

- **Frota**: cards grid 2 colunas com foto do carro, modelo, placa, status colorido. Filtros em sheet.
- **Detalhe do veículo**: hero image full-width, abas em segmented control (Visão · Agenda · Histórico · Documentos).
- **Inspeção** (já parcialmente ok): wizard em tela cheia, um passo por vez, action bar fixa, foto via câmera nativa (já feito), preview grande, swipe pra reordenar fotos.

## Fase 5 — Clientes + Detalhe

- Lista estilo "contatos do iPhone": avatar + nome, agrupada por inicial, busca sticky no topo, swipe pra ligar/WhatsApp.
- Detalhe: hero com avatar grande, ações inline (ligar, WhatsApp, email), seções colapsáveis (Documentos, Reservas, Notas, Tags).

## Fase 6 — Financeiro + Relatórios + Equipe + Configurações

- Financeiro: KPIs em scroll horizontal, transações como lista de extratos bancários (data agrupada, valor à direita, swipe pra editar/excluir).
- Relatórios: gráficos full-width, tap pra zoom, sem tabelas largas.
- Equipe/Configurações: lista no estilo iOS Settings (linhas com label + valor à direita + chevron).

## Fase 7 — Live (`/admin/live`)

- Mapa full-screen como base. Lista de veículos vira bottom sheet com snap points (peek/half/full).
- KPIs no topo viram chips compactos em scroll horizontal.
- Tap em veículo abre detail sheet por cima do mapa.

---

## Princípios aplicados em todas as fases

- Nada de tabelas em mobile — sempre cards/listas.
- Alvos de toque mínimo 44pt, primários 56pt+.
- Ação primária sempre visível (action bar fixa ou FAB), nunca escondida em menu.
- Modais → bottom sheets.
- Tabs → segmented control.
- Dropdowns → bottom sheet com opções.
- Forms longos → wizards / seções colapsáveis.
- Toda lista que depende de dados frescos → pull-to-refresh.
- Sem texto duplicado entre header e conteúdo.
- Safe-area respeitada em topo e base sempre.

## Como vou trabalhar

1. Faço a Fase 0 (fundação) e te aviso.
2. Faço a Fase 1 (Painel), te mostro pra testar no PWA do celular.
3. Você aprova ou pede ajuste pontual.
4. Sigo automaticamente Fase 2 → 7, sempre te mostrando ao final de cada uma.

Desktop **não é tocado** em nenhuma fase. Tudo é condicionado a `useIsMobile()` / breakpoint `lg`.

## Riscos / pontos cegos

- **Tamanho**: são ~25 telas mobile sendo reescritas. Vai durar várias rodadas. Se quiser ritmo mais rápido em troca de menos polimento, me avisa.
- **Componentes compartilhados**: alguns componentes (ex: `BookingCard`, `FleetGrid`) hoje são usados em desktop e mobile. Vou criar variantes mobile-only quando o desktop sofrer; em alguns casos, refatoro o componente pra ter dois modos.
- **Gestos (swipe-action, pull-to-refresh)**: implemento com touch events nativos + Framer Motion (já tá no projeto). Sem libs novas.
- **Performance**: listas grandes (reservas, clientes) vou virtualizar com `react-window` se passarem de ~50 itens — adiciona dep pequena.
- **Não vou mexer em**: regras de negócio, schema do banco, autenticação, edge functions. Só camada de apresentação mobile.

## Confirmação

Se ok com esse plano, começo agora pela **Fase 0 + Fase 1** numa mesma entrega. Quer ajustar prioridade de alguma fase ou pular alguma?
