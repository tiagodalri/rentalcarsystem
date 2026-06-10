## Objetivo

Transformar o admin em um app mobile de verdade — densidade certa, bordas e espaçamentos consistentes, áreas de toque confortáveis, transições sutis, zero sensação de "site espremido". Manter a estética **private-bank** já registrada (off-white/preto, Inter, tabular-nums), só refinando.

Como o admin tem ~25 páginas, divido em **4 ondas**. Após cada onda você revisa antes da próxima.

---

## Onda 1 — Fundação (toca tudo de uma vez)

São as mudanças que sozinhas elevam a cara do app inteiro, sem mexer página por página.

1. **Tokens mobile no `index.css`**
   - Escala tipográfica mobile (`.admin-h1`, `.admin-h2`, `.admin-section-title`, `.admin-kpi`, `.admin-label`) recalibrada para 360–414px.
   - Espaçamento padrão: gap 12 / pad 14 mobile → 16/24 desktop (via utilitários `.admin-stack`, `.admin-pad`, `.admin-gap`).
   - Raio de bordas unificado: `0.625rem` mobile / `0.75rem` desktop (cards, inputs, botões).
   - Bordas hairline (`border-border/50`) e sombras quase imperceptíveis (private-bank style).
   - `.admin-card`, `.admin-card-row`, `.admin-list-row` com bordas e divisões alinhadas pixel-perfect.
   - `font-feature-settings` ligado globalmente: `"ss01","cv11","tnum"` → números mais limpos.

2. **Shell mobile (`AdminLayout`, `AdminMobileHeader`, `AdminBottomNav`, `AdminFab`)**
   - Header mobile: altura 56px, título com `tracking-tight` e peso 500, separador hairline em vez de `border-border/40` cheio.
   - Safe-area top: `max(env(safe-area-inset-top), 8px)` para não colar no notch.
   - Bottom nav: 64px → 56px de altura útil + safe-area; ícones 22px, label `text-[10px]` em `font-medium` (não uppercase pesado), indicador ativo virá uma "barra-pílula" 4×4 no topo do item ativo, com transição.
   - FAB reposicionado: `right-4 bottom-[calc(64px+safe+12px)]`, sombra mais leve, ring sutil no active.
   - Conteúdo principal: padding lateral 16px, topo 12px, bottom reserva `64+safe+12` (já existe mas refinado).

3. **Componentes base globais**
   - `Button`: tamanho default mobile 44px (atende WCAG), `size="sm"` vira 40px (era 36px). `size="icon"` mobile = 44×44.
   - `Input`, `Select`, `Textarea`: altura 44px mobile, font-size 16px (impede zoom do iOS), label acima com `text-xs` consistente.
   - `Dialog`: em mobile vira sheet de baixo (full-width, rounded-t-2xl, drag handle no topo, max-h 92dvh com scroll interno), em vez do dialog centralizado que estoura a tela.
   - `Card`: padding mobile 14px / desktop 20px, divisões internas com `border-border/40`.
   - `Badge`: altura 22px com `text-[10px]` tabular, ponto colorido inline padronizado (verde/âmbar/azul/cinza/vermelho).
   - `Switch`, `Checkbox`, `Radio`: tap-area 44px via wrapper.

4. **PWA polish**
   - Manifest já tem ícones e shortcuts — vou só validar `display_override: ["standalone"]` e `theme_color` reagindo ao tema atual via JS (já tem meta light/dark).
   - `apple-mobile-web-app-status-bar-style` mantido `black-translucent` (combina com fundo escuro).

---

## Onda 2 — Listas e tabelas (a dor #1)

Reservas, Frota, Clientes, Financeiro hoje usam tabelas que viram um aperto no celular.

1. **Padronizar `<MobileListCard>`** — um único componente reusável (avatar opcional, título, linha 2 metadados, status à direita, chevron) usado por:
   - `AdminBookings` (já tem `MobileBookingCard` — uniformizar).
   - `AdminFleet` → `FleetGrid` mobile já existe; refinar e mover o switch "site" para um sheet de ações.
   - `AdminCustomers` → criar `MobileCustomerCard`.
   - `AdminFinance` → criar `MobileTransactionRow`.
   - `AdminTeam` → criar `MobileTeamMemberCard`.

2. **Headers de página padronizados** — H1 + subtítulo + ações primárias (botão único + ícone "filtro") via componente `<AdminPageHeader />`. Hoje cada página inventa o seu.

3. **Filtros em sheet** — em vez de chips/dropdowns espalhados, um botão "Filtros" abre sheet com tudo (status, datas, busca avançada), botão "Aplicar" sticky no rodapé do sheet.

4. **Toolbar de busca sticky** abaixo do header mobile, com clear icon e contador de resultados.

---

## Onda 3 — Formulários, diálogos e detalhes

1. **`NewBookingDialog`, `EditBookingDialog`, `BookingIncidentDialog`, `InformalBookingDialog`** → migrar para o novo `<Sheet>` mobile com seções acordeáveis.
2. **`AdminBookingDetail`, `AdminVehicleDetail`, `AdminCustomerDetail`** → 3 colunas viram 1 coluna com seções em cards, tabs sticky no topo, ações primárias em barra fixa no rodapé (acima do bottom-nav).
3. **Datepickers mobile** — usar input nativo `type="date"` em mobile (mais rápido e familiar) e calendário rich em desktop.
4. **Wizard de veículo (`VehicleWizard`)** — stepper compacto no topo, navegação anterior/próximo sticky no rodapé.

---

## Onda 4 — Agenda, Live, Painel, Inspeção

1. **Agenda da Frota** — em mobile vira lista vertical por veículo com mini-timeline horizontal scrollável (já é Gantt, precisa adaptar).
2. **Painel** — KPIs em grid 2×N, com a sequência de prioridade reordenada para mobile.
3. **Live tracking** — mapa full-bleed com card flutuante inferior arrastável (já existe lógica, refinar).
4. **Inspeção** — mantém o fluxo atual, só ajusta paddings e botão de câmera maior.

---

## Como vamos validar

Após cada onda eu listo:
- Arquivos alterados.
- Como testar (3–5 rotas-chave + viewport 390×844 e 414×896).
- Riscos / regressões possíveis no desktop.

Você aprova/ajusta antes de eu seguir para a próxima onda.

---

## Confirma?

Quer que eu comece pela **Onda 1 (fundação)** agora? Ela é a que dá retorno visual imediato em **toda** a aplicação e é pré-requisito para as outras ondas.