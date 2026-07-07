
## Objetivo

"Frota Inteligente" passa a ser a UNIÃO COMPLETA do Hall Estratégico (briefing narrado + TODAS as métricas, rankings, projeções, Pareto, funil, RFM, conselhos, anomalias etc.) + o Simulador de realocação, em uma única tela. Vira item destacado na sidebar do admin. O card "Hall Estratégico" do AI Studio e a view interna `hubView === "painel"` são removidos para não duplicar.

Marketing Studio e "AI (em breve)" continuam intactos no hub.

---

## Diagnóstico do bug atual

Em `src/components/admin/ai-studio/FrotaInteligente.tsx` (linha ~108) a renderização é:

```tsx
<AiPainel bookings={sourceFilteredBookings} vehicles={vehicles} briefingOnly />
```

`briefingOnly` faz o `AiPainel` esconder tudo exceto o `AiBriefingCard`. Por isso rankings, sugestões de troca, projeção futura, Pareto, "Hoje na sua frota", payback, receita por dia, funil, RFM, conselhos, operações, canais financeiros e anomalias sumiram. Basta remover a flag para o conteúdo completo voltar (o briefing já é renderizado por padrão dentro do `AiPainel`).

---

## Arquivos tocados

### 1. `src/components/admin/ai-studio/FrotaInteligente.tsx`
- Remover `briefingOnly` do `<AiPainel>` — render passa a ser o painel completo (briefing + todas as métricas).
- Ajustar o cabeçalho da seção: substituir os dois blocos "Briefing narrado" / "Simulador de realocação" por uma estrutura em dois blocos:
  1. **Painel de inteligência** (briefing + KPIs + tabs "Recomendações / Conselhos da semana / Operações / Anomalias" — tudo já vem do `AiPainel`).
  2. **Simulador de realocação** (divisor dourado + `<FleetSimulator>`).
- Tornar `bookingSource` opcional: quando não vier por prop (rota standalone via sidebar), ler de `readBookingSource()` e renderizar um seletor local reaproveitando o mesmo pill group `all/zeus/turo`.
- Aceitar prop opcional `onBack`; quando ausente (rota standalone), esconder o botão "voltar".

### 2. `src/components/admin/ai-studio/AiHub.tsx`
- Remover o card `key: "painel"` (Hall Estratégico) da lista `cards`.
- Remover prop `onOpenPainel` e o tipo correspondente em `HubModule`.
- Grid fica com 3 cards: Frota Inteligente, Marketing Studio, AI (em breve). Manter layout 2 colunas em `sm`.

### 3. `src/pages/admin/AdminPainel.tsx`
- Remover `"painel"` do union `HubView`.
- Remover o bloco `{hubView === "painel" && ...}` (linhas ~397-401).
- Remover a prop `onOpenPainel` no `<AiHub>`.
- Ajustar o gate do seletor de origem: `hubView === "frota-inteligente"` (deixa de precisar do OR com `"painel"`).
- Manter `filteredBookings`, `bookingSource` e restante do overlay do Brain.

### 4. `src/components/admin/AdminSidebar.tsx`
- Adicionar novo item no grupo **Operações**, logo abaixo de "Operação":
  ```ts
  { title: "Frota Inteligente", url: "/admin/frota-inteligente", icon: Brain, allowedRoles: ["admin","operations","finance","support"], highlight: "gold" }
  ```
- Estender o tipo `MenuItem` com `highlight?: "gold"`.
- Renderizar itens com `highlight === "gold"` com um acento visual distinto (sem quebrar o padrão existente):
  - Fina linha vertical dourada à esquerda (`bg-[hsl(var(--sidebar-primary))]` já em uso), sempre presente (não só ativo).
  - Micro-badge "IA" à direita do label (chip retangular pequeno, dourado sobre navy, mesma paleta usada no card do hub).
  - Ícone `Brain` (lucide) com stroke levemente reforçado.
  - Estado colapsado: apenas ícone + tooltip; manter o fio dourado à esquerda como marca.

### 5. `src/App.tsx`
- Adicionar rota nova dentro do layout admin:
  ```tsx
  <Route
    path="frota-inteligente"
    element={
      <RequireRole roles={["admin","operations","finance","support"]}>
        <AdminSuspense>
          <FrotaInteligentePage />
        </AdminSuspense>
      </RequireRole>
    }
  />
  ```
- `FrotaInteligentePage` é um wrapper novo (arquivo `src/pages/admin/AdminFrotaInteligente.tsx`) que:
  - Aplica o mesmo shell visual usado pelo overlay do Brain (fundo bege/dourado + header com título "Frota Inteligente" e seletor de origem).
  - Renderiza `<FrotaInteligente />` sem `onBack` e sem `bookingSource` (o componente lê do storage e mostra o seletor local).
  - Não passa pelo `BrainAccessGate` (com a flag `BRAIN_GATE_ENABLED = false` atual já estaria bypassed, mas para o item da sidebar queremos acesso direto sempre).

### 6. `src/hooks/useAdminPageTitle.ts`
- Adicionar entrada `[/^\/admin\/frota-inteligente/, "Frota Inteligente"]` antes do fallback.

### 7. Rotas legadas
- `/admin/ai-studio/simulador` (App.tsx linha 275) — manter como está para não quebrar links antigos. Nenhuma mudança.

---

## Como a Frota Inteligente carrega dados fora do contexto do painel

Hoje `FrotaInteligente` já é auto-suficiente: dispara em `useEffect` três `supabase.from(...).select(...)` para `bookings`, `vehicles` (`list_vehicles_basic` semantics via `is deleted_at null`) e `vehicle_expenses`, e computa `perVehicle` internamente via `computePerVehicle`. Isso é o que o `FleetSimulator` precisa.

O `AiPainel` só precisa de `bookings` e `vehicles` — que já são carregados. Portanto **nenhuma nova query** é necessária. A única mudança é passar os `bookings` já filtrados por origem para o `AiPainel` (sem `briefingOnly`) e continuar passando `perVehicle` para o `FleetSimulator`.

Quando aberto pela sidebar (fora do `AdminPainel`), o componente continua funcionando porque toda a carga é local; a origem vem de `readBookingSource()` e o seletor local grava via `writeBookingSource`, mantendo consistência com o overlay do Brain.

---

## Estrutura visual da nova tela

```text
┌─────────────────────────────────────────────────────────┐
│  Header (sidebar route) OU header do overlay do Brain   │
│  "Frota Inteligente"  · seletor Todas/Zeus/Turo         │
├─────────────────────────────────────────────────────────┤
│  [AiPainel completo]                                    │
│   • Briefing narrado (AiBriefingCard)                   │
│   • KPIs principais                                     │
│   • Tabs: Recomendações · Conselhos · Operações · …     │
│   • Rankings, Pareto, projeção, RFM, anomalias etc.     │
├──────── divisor dourado ────────────────────────────────┤
│  [FleetSimulator]                                       │
│   • Simulador interativo de compra/venda/realocação     │
└─────────────────────────────────────────────────────────┘
```

Dois pontos de entrada, mesma tela:
- **Sidebar** → `/admin/frota-inteligente` (novo wrapper) — fluxo padrão diário.
- **AI Studio → card "Frota Inteligente"** → mesmo componente dentro do overlay do Brain (mantém a experiência imersiva quando o usuário entra pelo Brain).

---

## Riscos

1. **Performance da tela unificada**: `AiPainel` é pesado (~1956 linhas, muitos cálculos). Somado ao `FleetSimulator` numa mesma rota, pode aumentar TTI. Mitigação: `AiPainel` já usa `useMemo` internamente; se necessário, envolver `FleetSimulator` em `React.lazy` no wrapper da rota.
2. **Duplicação de estado de origem**: o overlay do Brain e a rota standalone lêem/escrevem no mesmo `localStorage` (`zeus_booking_source`). É proposital, mas exige testar que trocar em um lado não gere loops quando ambos estão montados (não ocorre porque só um está montado por vez).
3. **Sidebar destacada**: o acento dourado precisa respeitar dark/light do sidebar sem hardcode (usar tokens `--sidebar-primary`, `--sidebar-accent`); o mock atual do sidebar já expõe esses tokens.
4. **Remoção do Hall Estratégico**: links diretos (bookmarks internos) para `hubView "painel"` deixam de existir. Como era estado local (não rota), não há URLs quebradas. Nenhuma migração necessária.
5. **`AiPainel` sendo renderizado sem estar em `AdminPainel`**: já é um componente puro que recebe `bookings`/`vehicles` por prop — sem dependência de contexto do pai. Confirmado nos arquivos lidos.
6. **Rota `/admin/ai-studio/simulador`**: mantida como fallback; se quisermos limpar depois, é uma remoção trivial de uma linha em `App.tsx`.

---

## Ordem de implementação sugerida (quando aprovar)

1. Ajustar `FrotaInteligente.tsx` (remover `briefingOnly`, tornar props opcionais, adicionar seletor local).
2. Criar `AdminFrotaInteligente.tsx` (wrapper de rota).
3. Registrar rota em `App.tsx` + `useAdminPageTitle`.
4. Adicionar item destacado na `AdminSidebar.tsx`.
5. Remover card e view `painel` do `AiHub.tsx` + `AdminPainel.tsx`.
6. Type-check e verificar navegação pelos dois pontos de entrada.
