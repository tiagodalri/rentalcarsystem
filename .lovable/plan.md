## Frente 1 — Fundação mobile-first do admin

Objetivo: parar de parecer "desktop adaptado". Criar uma camada de padrões globais que toda tela do admin herda. Mudanças concentradas em `AdminLayout.tsx` + 3 componentes novos + 1 arquivo de tokens CSS. **Zero mudança em telas individuais nessa frente** — elas se beneficiam automaticamente da nova moldura e serão refinadas nas frentes 2 e 3.

---

### 1. Header mobile compacto e contextual

Hoje: header de 56px só com hambúrguer + fullscreen + tema + idioma. Em mobile desperdiça espaço e não mostra contexto.

Novo (`AdminLayout.tsx`, breakpoint `< lg`):
- Altura 52px, sticky, com `safe-area-inset-top`
- Esquerda: hambúrguer (sidebar continua para "Mais" / config)
- Centro: **título da tela atual** (vem de um `useAdminPageTitle()` hook simples baseado em pathname → fallback no nome da rota)
- Direita: 1 ação contextual (busca/filtro quando faz sentido) + menu kebab com tema/idioma/fullscreen agrupados
- Desktop (`≥ lg`): mantém layout atual

### 2. Bottom Tab Bar (5 seções)

Novo componente `src/components/admin/AdminBottomNav.tsx`:
- Visível só em `< lg`, fixo no rodapé com `safe-area-inset-bottom`
- 5 abas: **Hoje** (`/admin/ops-today`), **Reservas** (`/admin/bookings`), **Frota** (`/admin/fleet`), **Clientes** (`/admin/customers`), **Mais** (abre a sidebar como sheet)
- Cada aba: ícone Lucide 22px + label 11px tabular-nums, estado ativo com indicador superior fino + cor `foreground`
- Filtragem por role (reaproveita `useAdminAuth().roles` igual à sidebar — se a role não tem acesso, oculta a aba)
- Altura 64px + safe area
- Renderizado dentro do `AdminLayout` depois do `<main>`, fora do scroll do conteúdo

### 3. FAB contextual

Novo componente `src/components/admin/AdminFab.tsx` + hook `useAdminFab()` (Context API):
- Cada tela pode registrar a ação primária via `useRegisterFab({ icon, label, onClick })` no mount
- FAB renderizado pelo layout em mobile, posicionado acima da tab bar (`bottom: calc(64px + safe-area + 16px)`)
- Botão circular 56px, `bg-foreground text-background`, sombra
- Se a tela não registrar, FAB não aparece
- Nessa frente: criar a infra + ligar em Reservas (`+ Nova reserva`), Clientes (`+ Adicionar`) e Frota (`+ Veículo`). Demais telas ficam para depois.

### 4. Padding e safe-area do `<main>`

Hoje o `<main>` tem `paddingBottom` clamp genérico. Em mobile precisa reservar espaço da tab bar:
- Desktop: mantém
- Mobile: `paddingBottom: calc(64px + env(safe-area-inset-bottom) + 16px)` para o conteúdo não ficar atrás da tab bar
- `padding-top` do main some em mobile (header já cuida); horizontal cai de `p-3` para `px-4 pt-3`

### 5. Tokens mobile-first em `index.css`

Adicionar variáveis utilitárias usadas pelas telas individuais nas frentes seguintes (cria a "linguagem" agora):
- `--admin-touch-min: 44px` (alvo de toque mínimo)
- `--admin-mobile-h1: 1.5rem` / `--admin-desktop-h1: 1.875rem` aplicados via `.admin-h1` com media query
- `--admin-mobile-card-pad: 0.875rem`
- Classe `.admin-chip-scroll` → `overflow-x-auto flex gap-2 -mx-4 px-4 snap-x` (para resolver chips em wrap nas frentes 2/3)
- Classe `.admin-stack` → `flex flex-col gap-3` mobile, `gap-4` desktop

### 6. Esconder elementos redundantes em mobile

- Idioma + tema + fullscreen saem do header → entram no menu kebab + na sidebar (já existem lá)
- `AdminTabsBar` (abas de navegador) **fica oculta em `< lg`** — em celular não faz sentido ter abas de navegador competindo com bottom nav

---

### Arquivos afetados

**Editados:**
- `src/components/admin/AdminLayout.tsx` — novo header mobile, monta tab bar + FAB, ajusta padding do main
- `src/components/admin/AdminTabsBar.tsx` — adicionar `hidden lg:flex`
- `src/index.css` — tokens e utilitários novos

**Criados:**
- `src/components/admin/AdminBottomNav.tsx`
- `src/components/admin/AdminFab.tsx`
- `src/components/admin/AdminMobileHeader.tsx` (extraído do Layout pra não inchar)
- `src/hooks/useAdminFab.tsx` (Context + provider + `useRegisterFab` hook)
- `src/hooks/useAdminPageTitle.ts` (mapa pathname → título)

**Pontuais (registro do FAB):**
- `src/pages/admin/AdminBookings.tsx` — registra "Nova reserva"
- `src/pages/admin/AdminCustomers.tsx` — registra "Adicionar cliente"
- `src/pages/admin/AdminFleet.tsx` — registra "Adicionar veículo"

---

### Como testar

1. Mobile (390×844): header 52px com título da rota, tab bar 5 ícones no rodapé, FAB visível em Reservas/Clientes/Frota
2. Desktop (1280+): tudo igual ao atual — sidebar visível, tab bar **não aparece**, FAB **não aparece**, header com tema/idioma normais
3. Rotacionar entre rotas: título do header muda; aba ativa do bottom nav muda
4. Role limitada (ex: finance): só vê abas permitidas no bottom nav
5. iOS safe-area: tab bar não fica sob a barra do sistema

---

### Riscos

1. **Conflito visual com `AdminTabsBar`**: hoje aparece sempre. Ocultá-la em mobile é uma escolha — se você usa abas de browser no celular pra alternar entre 2 reservas abertas, melhor manter. Confirma: **oculta em mobile** ou **mantém visível acima do header**?
2. **FAB cobrindo conteúdo**: telas com botão "carregar mais" no rodapé podem ficar tampadas. Mitigação: padding-bottom do main já reserva espaço.
3. **"Mais" no bottom nav abre sidebar como sheet**: usa o `SidebarTrigger` programaticamente. Funciona com `collapsible="offcanvas"` (padrão do shadcn em mobile), sem mudanças extras.
4. **Performance**: 3 listeners de pathname (header título + tab bar ativo + tabs bar). Tudo barato, mas centralizo em um único `useLocation()` por componente.

---

### O que NÃO entra nessa frente (deixei pra depois)

- Redesign dos cards de reserva
- Filtros virando bottom sheet
- Calendário agenda vertical
- Tabela de clientes → cards
- Swipe actions

Essas são Frentes 2 e 3 — só fazem sentido depois que a moldura mobile estiver de pé.

---

**Confirma a Frente 1 como descrita?** Em especial o item 1 dos Riscos (ocultar `AdminTabsBar` em mobile).