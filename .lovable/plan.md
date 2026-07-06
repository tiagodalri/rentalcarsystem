## Plano: gerar histórico realista de viagens para todos os veículos da demo

### Escopo
Popular, para cada veículo ativo da frota (todos os 23 veículos demo hoje, e qualquer novo até 105), entre 8 e 12 viagens passadas nos últimos 30 dias, com dados completos e visualmente idênticos aos de um rastreador real. Se houver um projeto Zeus com viagens reais acessíveis via cross-project, replicar/adaptar essas rotas para os veículos da whitelabel.

### O que cada viagem terá
- Datas coerentes distribuídas nos últimos 30 dias (dias/horários variados: manhã, tarde, noite).
- Duração entre 8 min e 2h30, plausível para trajetos em Orlando/Kissimmee/Celebration/Davenport/Winter Garden/Lake Buena Vista.
- Distância coerente com a duração e a velocidade média.
- Endereços de partida e chegada plausíveis (aeroporto, parques, outlets, hotéis, bairros residenciais).
- Rota GPS com centenas de pontos suaves, com curvas, seguindo padrões de rua realistas.
- Velocidade variável ponto a ponto (arranque, cruzeiro, semáforo, rodovia, chegada).
- Heading calculado por segmento.
- Eventos: início, fim, pico de velocidade, ao menos 1–2 freadas ou acelerações fortes por viagem quando fizer sentido, paradas longas em algumas viagens.
- Consumo em galões, MPG médio, odômetro inicial e final consistentes com a distância.
- Máx/média de velocidade, contagens de hard_brake/hard_accel, idle_seconds.
- Time zone America/New_York.
- `raw` marcado como demo para rastreabilidade (`source: 'demo-seed'`, versão do seed).

### Telemetria detalhada
Para cada viagem, popular `vehicle_telemetry_history` com pontos ao longo da duração real (lat, lng, speed, heading, reported_at, event_type início/atualização/fim, raw). Isso faz o replay entrar no modo detalhado com velocímetro, G-meter, banda de velocidade, timeline e eventos posicionados corretamente.

### Estado atual do veículo
Atualizar `vehicle_telemetry` (última posição, velocidade, heading, combustível, odômetro, bateria, MIL, endereço) com valores plausíveis para cada veículo, para o card do Live já abrir com dados “vivos”.

### Espelhar dados do Zeus
Verificar se existe projeto Zeus acessível via cross-project com viagens reais. Se sim:
- ler amostras de rotas reais;
- normalizar e reatribuir aos veículos da whitelabel, preservando forma de rota mas adaptando IDs, IMEIs, placas e nomes.
Se não houver acesso, gerar rotas sintéticas com o mesmo nível de realismo (curvas, paradas, velocidades por trecho).

### Idempotência e segurança
- O seed identifica viagens demo por prefixo de id (ex.: `demo-<vehicleId>-<n>`) e por marcador em `raw.source`.
- Rodar o seed novamente não duplica: substitui/atualiza apenas viagens demo do mesmo lote.
- Não toca em viagens sem marcação demo, não afeta integrações reais, não expõe secrets.
- Não altera schema; apenas insere/atualiza dados nas tabelas existentes (`vehicle_trips`, `vehicle_telemetry_history`, `vehicle_telemetry`).

### Como executo
1. Criar uma rotina de seed no backend, aplicável via ferramenta de dados, que:
   - lista veículos ativos;
   - remove viagens/telemetria demo antigas desse lote;
   - gera 8–12 viagens por veículo, com rota+telemetria+eventos;
   - atualiza o telemetry “ao vivo” de cada veículo.
2. Rodar a rotina para os 23 veículos existentes.
3. Deixar a rotina reaproveitável para novos veículos até 105.

### Proteções extras para apresentação
- Ocultar do seletor de viagens qualquer viagem que ainda não tenha rota válida, evitando o modal de erro em cima de dado antigo.
- Manter o botão “Ver rota inteira” e “Baixar MP4” funcionando com o mesmo pipeline atual.

### Validação após implementar
- Abrir Live Tracking, escolher Ford Ranger e mais 4 veículos aleatórios.
- Reproduzir 3 viagens de cada, confirmando: rota traçada, marcador se movendo suave, velocímetro variando, eventos aparecendo na timeline, sem erro.
- Testar em desktop e tablet retrato.

### Arquivos/áreas prováveis
- Rotina/seed de dados aplicada via ferramenta de dados (não é migração de schema).
- Ajustes pequenos, se necessários, em `TripPickerDialog.tsx` para ocultar viagens inválidas.
- Nenhum ajuste esperado em `useTripReplay.ts` além de possíveis pequenos fallbacks.