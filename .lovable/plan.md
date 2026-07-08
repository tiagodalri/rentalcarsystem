## Objetivo

Elevar o painel admin (área logada `/admin/*`) para um acabamento **Editorial Premium** — mantendo a linguagem private-bank (navy `#0d1d2e` + dourado `#9a7a3a`) já consolidada, adicionando serifa display em headings, mais whitespace, micro-interações Framer Motion moderadas e responsividade impecável em mobile/tablet. **Zero mudança de funcionalidade, backend, rotas ou dados.** Site público (`/`, `/frota`, `/checkout`, etc.) fica intocado.

---

## Direção estética

**Tipografia**
- Headings (admin-h1, admin-section-title, títulos de KPI hero): `Instrument Serif` (via `@fontsource/instrument-serif`) — dá o ar editorial/luxuoso.
- Body, tabelas, botões, labels: mantém `Urbanist`/`Epilogue` já instalado.
- Números financeiros/KPIs: continua `tabular-nums`, agora com hierarquia maior (KPI hero em ~40–48px, valores secundários em 28px).
- Ajuste de tracking: labels uppercase ganham `letter-spacing: 0.14em` (hoje 0.10em) para reforçar o registro editorial.

**Cores (sem trocar identidade)**
- Não mexer nos tokens HSL existentes.
- Adicionar dois tokens auxiliares em `index.css`: `--surface-elevated` (card sobre card) e `--hairline` (divisor 1px, mais suave que `--border`).
- Dourado (`.gold-text`, `.gold-gradient`) continua reservado a headings hero e accents pontuais — nunca em body/tabelas.

**Espaçamento & densidade**
- `admin-page`: aumentar padding vertical em desktop (`py-6` → `py-10`) e gap entre seções (`gap-6` → `gap-8`).
- `AdminPageHeader`: `pb-4/pb-6` → `pb-6/pb-10`, com hairline dourado 1px opcional abaixo do título.
- `KpiCard`: aumentar `min-height` compact 112→124, default 128→144; padding interno mais generoso.
- Tabelas: linha `h-12` → `h-14` em desktop, com `divide-y` usando `--hairline`.

**Motion (Framer Motion, nível 3 / moderado)**
- Fade+slide-up de 8px em entrada de página (`main` do AdminLayout) com stagger de 40ms nos filhos diretos.
- KPI cards: `whileHover={{ y: -2 }}` + sombra suave, transição 200ms ease-out.
- Linhas de tabela: hover com highlight de fundo (150ms) — nada de layout shift.
- Sidebar items: indicador ativo animado com `layoutId` (barrinha dourada desliza entre itens).
- Sheets/Dialogs mobile: já usam Radix; adicionar `AnimatePresence` só onde faltar.
- Sem parallax, sem scroll-linked. Scroll suave nativo via `scroll-behavior: smooth` no html + `overscroll-behavior: none` (já existe).
- Respeitar `prefers-reduced-motion`: wrapper `useReducedMotionSafe` desativa transforms.

---

## Arquivos a criar

- `src/components/admin/motion/PageTransition.tsx` — wrapper `motion.div` para `<Outlet />`, aplica fade+slide-up com stagger.
- `src/components/admin/motion/MotionKpiCard.tsx` — variante animada do `KpiCard` (não substitui; opt-in via prop `animated`).
- `src/styles/admin-editorial.css` — camada CSS adicional importada por `index.css` com as novas utilities `.admin-editorial-heading`, `.hairline`, `.surface-elevated`.

## Arquivos a editar

- `src/main.tsx` — importar `@fontsource/instrument-serif/400.css` e `/500.css`.
- `tailwind.config.ts` — adicionar `fontFamily.serif: ['"Instrument Serif"', 'serif']`.
- `src/index.css` — adicionar tokens `--surface-elevated`, `--hairline`; ajustar `.admin-h1`/`.admin-section-title` para usar `font-serif` e novos tamanhos; aumentar letter-spacing de `.admin-label`.
- `src/components/admin/AdminLayout.tsx` — envolver `<Outlet />` com `PageTransition`; refinar padding do `<main>`.
- `src/components/admin/AdminPageHeader.tsx` — nova hierarquia visual (título maior, eyebrow com hairline dourado).
- `src/components/admin/KpiCard.tsx` — novo `min-height`, tipografia refinada, hover sutil.
- `src/components/admin/AdminSidebar.tsx` — indicador ativo com `layoutId` (Framer Motion).
- `src/components/admin/AdminMobileHeader.tsx` — título em serifa, hairline dourado inferior.
- `src/components/admin/AdminTabsBar.tsx` — transição suave de aba ativa.
- Tabelas comuns: shells de `AdminBookings`, `AdminFleet`, `AdminCustomers` — aplicar `.hairline` e altura de linha maior (mudanças mínimas de classe).

## Fora de escopo

- Site público (`Index`, `Frota`, `Checkout`, `About`, `Contato`, `Login`, `MyAccount`, componentes `HeroSection`, `FleetSection` etc.).
- Backend, edge functions, migrations, RLS.
- Lógica de negócio, hooks de dados, cálculo de pricing/margem.
- Guided Tour, PDF export, integrações Bouncie/Turo/EPass.

---

## Como testar

1. Navegar em `/admin` (Painel) — headings em serifa, KPIs com hover suave, transição de entrada.
2. Alternar rotas admin (Painel → Frota Inteligente → Reservas) — cada página faz fade+slide-up.
3. Sidebar: clicar em itens diferentes — barra dourada desliza entre eles.
4. Mobile (390px, 768px): headers, KPIs e tabelas mantêm respiro; nada estoura viewport.
5. Ativar `prefers-reduced-motion` no DevTools — animações caem para fade simples.
6. Verificar que rotas públicas (`/`, `/frota`, `/checkout`) continuam idênticas.

## Riscos

- Instrument Serif em números pode ficar estranho — por isso KPI **value** continua em Urbanist tabular-nums; só o **label eyebrow** e headings de seção ganham serifa.
- Motion excessivo em tabelas longas pode pesar — stagger só nos filhos diretos do `<main>`, não em cada `<tr>`.
- Aumentar padding pode empurrar conteúdo abaixo da dobra em mobile — validar em 360px antes de fechar.
