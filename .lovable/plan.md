## Diagnóstico do estado atual

```
Hoje:
- 30 dias fixos, scroll horizontal
- 1 só barra por reserva, sem hover
- Sem filtros, sem busca, sem marca
- Coluna do veículo simples (nome + categoria)
- Legenda solta, KPIs zero
- Sem ação ao clicar
```

## Visão da nova versão

Um **centro de operação** estilo HQ/airline-ops: header com KPIs em tempo real, barra de controles densa, timeline rica com logos e info contextual.

```text
┌─────────────────────────────────────────────────────────────────┐
│  Calendário da Frota          [Hoje] [<][30 jun – 29 jul][>]    │
│  ▸ 24 veículos • 18 reservas • 67% ocupação • 6 entregas hoje   │
├─────────────────────────────────────────────────────────────────┤
│  [Buscar...]  Status▾  Categoria▾  Marca▾  Escala: 7d|14d|30d|60│
├──────────────┬──────────────────────────────────────────────────┤
│ VEÍCULO      │ TER QUA QUI SEX SÁB DOM SEG TER QUA QUI SEX ...  │
│              │ 10  11  12  13  14  15  16  17  18  19  20      │
│ ┌─┐ Audi Q7  │░░░░│■■■■■■■■■■■■■■■■░░░░│■■■■■■                  │
│ │A│ SUV Prem │    │ Alessandro Rossi   │ Maria S.               │
│ └─┘ ABC-1234 │    │ ZRC-0142 • 5 dias  │ ZRC-0151 • 3 dias      │
│ ┌─┐ BMW 330  │■■■■■■■■■■░░░░░░░░░░░░░░░│                        │
│ │B│ Sedan    │ João Pereira • ZRC-0118 │                        │
│ └─┘ XYZ-5678 │                         │                        │
└──────────────┴──────────────────────────────────────────────────┘
```

## Funcionalidades novas

**Header / KPIs**
- Janela navegável: Hoje · ← · intervalo · → · seletor de data direto.
- 4 KPIs ao vivo: veículos ativos, reservas no período, % ocupação, entregas/devoluções de hoje.

**Barra de filtros (sticky)**
- Busca por cliente / placa / nº reserva.
- Multi-filtro: Status, Categoria, Marca.
- Escala: 7 / 14 / 30 / 60 dias (re-densifica barras).
- Toggle "Mostrar canceladas".

**Coluna do veículo (linha)**
- Avatar com **logotipo da marca** (usa `CAR_LOGO_CDN` já existente em `src/data/carBrands.ts`).
- Nome + versão + placa em mono.
- Pílula de status do veículo (disponível, em manutenção, alugado…).
- Click → abre detalhes do veículo.

**Barras de reserva**
- Cantos arredondados com gradient sutil + ícone do status à esquerda.
- Texto adaptativo: nome curto quando estreito, completo quando largo.
- **Hover popover** com tudo: cliente, telefone, nº reserva, datas, dias, plano, valor total, motorista adicional, retirada/devolução.
- **Click** → abre detalhe da reserva.
- **Faixa "hoje"** vertical destacada cruzando todas as linhas.
- Marcadores de **fim-de-semana** sutis na grade.
- Listras vermelhas finas em dias sem reserva quando o carro está "em manutenção".

**Legendas e densidade**
- Legenda como chips clicáveis que filtram (toggle).
- Modo compacto/confortável (altura da linha 36 / 52).

**Estado vazio**
- Quando o filtro zera resultados: card amigável com botão "Limpar filtros".

## Arquitetura técnica

Refatoração de `src/pages/admin/AdminFleetGantt.tsx` em componentes:

```
src/components/admin/fleet-calendar/
  FleetCalendar.tsx          # container, fetch, estado
  CalendarHeader.tsx         # título + KPIs + navegação
  CalendarFilters.tsx        # busca, status, categoria, marca, escala
  CalendarGrid.tsx           # grid de dias + linha "hoje" + fim-de-semana
  VehicleRow.tsx             # linha (logo marca + placa + status)
  BookingBar.tsx             # barra (gradient, ícone, hover popover)
  BookingPopover.tsx         # conteúdo do hover
  useFleetCalendarData.ts    # hook de dados + agregações (KPIs)
```

- Reaproveita `CAR_LOGO_CDN` + `slugFromName()` (já existe) para o logo.
- Reaproveita `STATUS_COLORS` mas troca por design tokens HSL (sem hardcode de cores).
- `react-query` com staleTime 60s para filtros não dispararem refetch.
- Popover via `@/components/ui/popover` (já no projeto).
- Sem novas libs.

## Regras visuais
- Off-white #fafafa / preto #0a0a0a (memória core).
- `tabular-nums` em datas, valores, dias, ABC-1234.
- Sem emojis. Ícones Lucide: `Car`, `Wrench`, `CalendarDays`, `Filter`, `Search`, `LayoutGrid`, `ChevronLeft/Right`, `Circle` (status), `MoreHorizontal`.
- Densidade Linear/Notion: linhas 44px (confortável padrão), bordas suaves, grid quase invisível.

## O que NÃO vou incluir (para não inflar)
- Drag-to-move/resize de reservas (proponho num passo seguinte; muda lógica de booking).
- Visão de **mês calendário tradicional** (você já tem em Reservas).
- Criação de reserva via clique no calendário (também próxima iteração).
- Print/export PDF.

Esses 3 itens entram numa fase 2 se você quiser, após validar a base.

## Como vou testar
1. Abrir `/admin/calendar` (rota atual) — KPIs batem com a query.
2. Filtrar por marca "BMW" — só linhas BMW.
3. Mudar escala 30 → 60 — barras recompõem corretamente.
4. Hover em uma reserva — popover com todos os campos.
5. Buscar por nº reserva — uma linha apenas.
6. Mobile (375px) — KPIs viram 2x2, filtros viram dropdown sanduíche, timeline scroll horizontal.

## Riscos
- Logos do CDN podem demorar / falhar → fallback avatar com inicial da marca + cor do brand-hash.
- Performance com 50+ veículos × 60 dias → barras virtualizadas só se passar disso (não vou virtualizar agora).
- `category` na tabela pode estar como "SUV Premium" e quebrar filtros de marca; vou normalizar via `slugFromName(brand)`.

Confirma o escopo, ou quer cortar/adicionar algo antes de eu codar?