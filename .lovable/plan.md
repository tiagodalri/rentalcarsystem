# Plano: Seção unificada "Frota Inteligente"

## Situação atual

- **AI Studio Hub** (`src/components/admin/ai-studio/AiHub.tsx`) mostra 4 cards: Hall Estratégico, Simulador, Marketing Studio, AI Studio (em breve).
- **Briefing narrado de IA** (`AiBriefingCard`) hoje é renderizado *dentro* do Hall Estratégico (`src/pages/admin/AiPainel.tsx`, linhas ~815–896), junto com KPIs, tabs e outros gráficos. Todo o cálculo do snapshot/highlights/actions e a chamada da edge function `intelligence-summary` vivem no `AiPainel`.
- **Simulador de realocação** (`FleetSimulator`) vive numa **rota separada** `/admin/ai-studio/simulador`, servida por `src/pages/admin/AiSimulador.tsx` (carrega bookings/vehicles/expenses via Supabase, filtra por `bookingSource`, chama `computePerVehicle`).
- Card "Simulador" no hub hoje navega via `navigate("/admin/ai-studio/simulador")`.

## Objetivo

Criar **uma única seção "Frota Inteligente"** com:
1. Briefing de IA narrado no topo (mesmo `AiBriefingCard` já existente).
2. Simulador de realocação (mesmo `FleetSimulator`) logo abaixo, na mesma tela.

Sem duplicar o briefing no Hall Estratégico e sem quebrar a rota atual do simulador.

## Estrutura da nova seção

```text
Frota Inteligente (view "frota-inteligente" dentro do AI Studio)
├── Header
│   ├── Botão "voltar" para o hub
│   ├── Título "Frota Inteligente" + eyebrow
│   └── Seletor de origem (all / zeus / turo) — reaproveitado
├── Bloco 1 — Briefing narrado (AiBriefingCard)
│   ├── KPIs de contexto (opcional, enxuto)
│   └── Highlights + Ações sugeridas
├── Divisor dourado (hairline)
└── Bloco 2 — Simulador de realocação (FleetSimulator)
```

## Arquivos afetados

### Criar
- `src/components/admin/ai-studio/FrotaInteligente.tsx` — nova view unificada. Responsável por:
  - Carregar `bookings`, `vehicles`, `expenses`, `incidents`, `transactions` (Supabase).
  - Aplicar `filterBookingsBySource(bookingSource)`.
  - Chamar `computePerVehicle`.
  - Montar `snapshot / highlights / actions` do briefing (lógica extraída de `AiPainel`).
  - Invocar edge function `intelligence-summary` (com fallback `localBriefing`).
  - Renderizar `<AiBriefingCard />` + `<FleetSimulator perVehicle={...} />`.
  - Props: `onBack: () => void`, `bookingSource`, `setBookingSource`.

- `src/lib/aiStudio/briefingInputs.ts` — extrair funções puras de `AiPainel` para calcular snapshot/highlights/actions/localBriefing, reutilizáveis tanto pelo Hall Estratégico (se mantido) quanto pela nova Frota Inteligente. Evita duplicação lógica.

### Modificar
- `src/components/admin/ai-studio/AiHub.tsx`
  - Substituir o card "Simulador" pelo card **"Frota Inteligente"** (nova cover, mesmo estilo).
  - Trocar `action: () => navigate(...)` por `action: onOpenFrotaInteligente` (nova prop).
  - Manter os outros 3 cards intactos.

- `src/pages/admin/AdminPainel.tsx`
  - Adicionar `"frota-inteligente"` ao union type de `hubView`.
  - Passar `onOpenFrotaInteligente={() => setHubView("frota-inteligente")}` ao `<AiHub />`.
  - Renderizar `<FrotaInteligente ... />` quando `hubView === "frota-inteligente"`.
  - Manter o seletor de origem (linhas 347–384) também visível nessa view (ajustar condicional).
  - Nenhuma mudança no fluxo do Hall Estratégico, Marketing ou IA.

- `src/pages/admin/AiPainel.tsx`
  - **Remover** o bloco `AiBriefingCard` (linhas ~814–896) e o estado/`useEffect` do briefing (linhas 51–52, 730–780), já que a narrativa agora vive na Frota Inteligente. KPIs, tabs, "Hoje na frota", "Conselhos da semana" etc. permanecem.
  - Alternativa (se preferir preservar): manter briefing também no Hall Estratégico — decisão pra você (ver seção "Decisão pendente").

- `src/App.tsx`
  - Manter rota `/admin/ai-studio/simulador → AiSimulador` funcionando (compat com deep links). A página `AiSimulador.tsx` fica como fallback direto ao simulador. Sem mudanças aqui.

### Não tocar
- `FleetSimulator.tsx` (usado como está).
- `AiBriefingCard.tsx` (usado como está).
- `lib/aiStudio/perVehicle.ts`, `bookingSource.ts`, `aiOptimizer.ts`.
- Edge function `intelligence-summary`.

## Navegação e rotas

- **Entrada principal:** AI Studio Hub → card "Frota Inteligente" (dentro do painel admin, mesmo padrão de Hall Estratégico e Marketing — usa `hubView`, sem sair da rota `/admin`).
- **Deep link legado:** `/admin/ai-studio/simulador` continua funcionando via `AiSimulador.tsx` (útil caso apresentador tenha o link salvo).
- Nenhuma mudança no menu lateral.

## Decisão pendente (rápida)

Preciso confirmar 1 ponto antes de construir:

**O briefing narrado deve continuar aparecendo dentro do Hall Estratégico?**
- (a) **Não** — remover de lá, passa a existir só em Frota Inteligente. Mais limpo, evita duplicação. *(minha recomendação)*
- (b) **Sim** — manter nos dois lugares. Simples, mas duplica payload/chamada da edge function.

## Riscos

1. **Payload duplicado da edge function** se optar por (b) — mitigado com cache/memoização por sessão.
2. **Carregamento pesado**: a Frota Inteligente carrega bookings + vehicles + expenses + incidents + transactions. Já é o que `AiPainel` + `AiSimulador` fazem hoje isolados; consolidar numa view só aumenta o tempo da primeira renderização. Mitigar com skeleton (padrão `AiSimulador`) e `Promise.all`.
3. **`bookingSource` compartilhado**: o seletor precisa persistir entre Hall Estratégico e Frota Inteligente (já usa `read/writeBookingSource` no localStorage — ok).
4. **Deep link `/admin/ai-studio/simulador`**: continua funcionando isolado; se quiser unificar 100%, redirecionar essa rota para o hub com `hubView=frota-inteligente` — posso adicionar isso.
5. **Refactor do briefing**: extrair a lógica de snapshot/highlights/actions de `AiPainel` para `briefingInputs.ts` é a parte mais delicada. Vou preservar o comportamento atual byte-a-byte (mesmos inputs → mesma saída). Sem mudanças em `AiBriefingCard`.
6. **Regressão visual no Hall Estratégico** se remover o briefing: layout continua coeso (KPIs + Hoje + Conselhos + tabs) — validado antes de finalizar.

## Como testar depois de construir

1. Admin → AI Studio → card "Frota Inteligente" abre a nova view.
2. Briefing narrado aparece no topo com highlights/ações; simulador logo abaixo é interativo.
3. Alternar seletor de origem (all/zeus/turo) atualiza ambos os blocos.
4. Voltar para o hub volta pro grid de 4 cards.
5. Hall Estratégico continua funcional (sem briefing, se opção (a)).
6. `/admin/ai-studio/simulador` continua abrindo o simulador standalone.
7. Build + typecheck limpos.
