## Painel Detalhado do Veículo — estilo Bouncie

Vou criar um **drawer/painel expansível** que abre ao clicar em um veículo na página `/admin/live`, com 4 abas idênticas em conceito ao app da Bouncie. O painel pequeno atual (canto inferior direito) continua existindo como "preview rápido" com um botão **"Ver detalhes completos"** que expande o drawer.

### Estrutura do Drawer (lateral direita, largura ~420px, mapa continua visível à esquerda)

**Header fixo** (em todas as abas):
- Foto do veículo + nome + placa
- Status badge (Em movimento / Parado / Estacionado)
- Strip "Estacionado • hoje 15:06" com endereço atual clicável
- Botão fechar (×)

**Footer fixo** (em todas as abas) — 4 indicadores de saúde:
- Combustível (% colorido) • Bateria (✓/⚠) • Motor/Check Engine (✓/!) • Dispositivo Bouncie (online/offline)

---

### Aba 1 — TRIPS (Viagens)
- Seletor de mês (default: mês atual)
- Lista agrupada por dia com header "SEGUNDA, 08 DE JUNHO — 93 mi total"
- Cada trip: faixa horária ("14:30 – 14:35") + distância à direita
- Click numa viagem → expande inline com:
  - **Detalhes**: Distância, Tempo, Idle, Eficiência, Vel. máx, Vel. média, Combustível usado, MPG, Freadas bruscas, Acelerações bruscas
  - **Eventos**: timeline Start / End com endereços
- Empty state: "Sem viagens registradas. Sincronize o histórico da Bouncie."
- Botão "Sincronizar últimos 30 dias" (chama `bouncie-trips`)

### Aba 2 — STATS (Estatísticas)
- Toggle: Trip / Day / Week / Últimos 30 dias
- Cards agrupados:
  - **Driving**: Distância total/média, Tempo de viagem, Tempo parado (idle)
  - **Fuel**: Combustível usado, MPG médio
  - **Speed**: Vel. movimento, Vel. geral, Pico de velocidade
  - **Habits**: Acelerações bruscas, Freadas bruscas (total + média)
- Cada métrica calculada client-side a partir de `vehicle_trips` filtrados

### Aba 3 — NOTIFICATIONS (Notificações)
- Sub-abas: Drive / Vehicle / Care
- Lista de eventos de `vehicle_events` + alertas derivados:
  - **Drive**: hardBraking, hardAcceleration, speeding, fuel warning (<10%)
  - **Vehicle**: MIL (check engine) com código DTC, Bouncie disconnect/reconnect
  - **Care**: Lembretes de manutenção (próximos vencimentos de inspeção/seguro)
- Cada item: ícone colorido + título + descrição + data clicável
- Empty state por aba

### Aba 4 — DETAILS (Detalhes)
- **Daily Summary**: localização atual, distância do dia, duração, idle, vel. máx (de hoje)
- **Vehicle Summary**: apelido, ano/marca/modelo, odômetro, placa, VIN, IMEI Bouncie, motor, tipo de carroceria
- **Insurance Summary**: provedor, agente, apólice, datas de vigência (já existe na tabela vehicles)
- **Manutenção**: última troca de óleo, próxima inspeção (de `vehicle_inspections`)

---

### Arquivos a criar/editar

**Novos**:
- `src/components/admin/live/VehicleDetailDrawer.tsx` — container do drawer com tabs
- `src/components/admin/live/tabs/TripsTab.tsx`
- `src/components/admin/live/tabs/StatsTab.tsx`
- `src/components/admin/live/tabs/NotificationsTab.tsx`
- `src/components/admin/live/tabs/DetailsTab.tsx`
- `src/components/admin/live/VehicleHealthFooter.tsx` — strip com 4 indicadores
- `src/hooks/useVehicleTrips.ts` — query `vehicle_trips` por veículo/período
- `src/hooks/useVehicleEvents.ts` — query `vehicle_events` por veículo/categoria
- `src/hooks/useVehicleDiagnostics.ts` — última snapshot de diagnóstico

**Editar**:
- `src/pages/admin/AdminLive.tsx` — adicionar botão "Ver detalhes completos" no card pequeno; estado `detailOpen`; montar `<VehicleDetailDrawer>`
- Card pequeno do canto vira preview compacto (foto + status + speed + botão "Detalhes")

### Lazy loading & performance
- Drawer só monta queries quando aberto (`enabled: !!selectedId && detailOpen`)
- Trips paginadas (50 por carregamento)
- Stats calculados em `useMemo`
- Tabs lazy-loaded (só busca dados da aba ativa)

### Estilo (mantém design system Zeus)
- Cards `bg-card/50 border-border/30 rounded-lg`
- Numbers `tabular-nums` em dourado (`text-primary`) — não azul Bouncie
- Tabs no topo com underline dourado no ativo
- Sem emojis, ícones Lucide
- Loading: skeleton compacto

### Sobre os dados
Hoje as tabelas `vehicle_trips`, `vehicle_events`, `vehicle_diagnostics` estão vazias. A UI já fica pronta com empty states. Para popular, há duas opções:
1. **Esperar dados chegarem em tempo real** pelo webhook (a partir de agora).
2. **Backfill histórico** rodando `bouncie-trips` com `{ days: 30 }`.

Após a UI pronta, posso disparar o backfill — ou você prefere clicar manualmente no botão "Sincronizar" da aba Trips.

### Riscos / observações
- Edge function `bouncie-trips` ainda não foi testada com dados reais — pode quebrar se o JSON da Bouncie vier diferente do esperado. Testaremos ao acionar o primeiro sync.
- Categorização "Care" depende de regras de manutenção que ainda não existem como tabela — vou começar mostrando apenas "Próxima inspeção" derivada de `vehicle_inspections`.
