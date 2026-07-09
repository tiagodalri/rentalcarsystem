import {
  Sparkles,
  CalendarRange,
  KeyRound,
  ClipboardCheck,
  Camera,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";
import type { Hotspot } from "@/components/admin/tutorials/AnnotatedScreenshot";
import type { TutorialScreenKey } from "./tutorialScreens";

export type TutorialStep = {
  title: string;
  body: string;
  /** Optional bullet list rendered after body */
  highlights?: string[];
  /** Optional CTA to navigate the user to the actual screen of that step */
  cta?: { label: string; to: string };
  /** Optional caption shown under the illustration */
  caption?: string;
  /** Reference key for a real screenshot of the system (see tutorialScreens.ts) */
  imageRef?: TutorialScreenKey;
  /** Numbered callouts overlaid on the screenshot */
  hotspots?: Hotspot[];
};

export type Tutorial = {
  id: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  duration: number;
  category: "Diário" | "Operacional" | "Essencial";
  steps: TutorialStep[];
};

export const adminTutorials: Tutorial[] = [
  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "primeiro-dia",
    title: "Boas-vindas: seu primeiro dia na Sua Marca",
    summary:
      "Visão geral do painel, do menu lateral e o que olhar nos primeiros minutos do expediente.",
    icon: Sparkles,
    duration: 4,
    category: "Essencial",
    steps: [
      {
        title: "Bem-vindo, Rui",
        body:
          "Este painel é o seu posto de comando. Tudo que acontece com os carros e clientes da Sua Marca passa por aqui. Vou te mostrar exatamente onde olhar e por quê — leve no seu ritmo, pode pausar e voltar quando quiser.",
        imageRef: "opsToday",
        hotspots: [
          { n: 1, x: 8.5, y: 5, w: 16, h: 7, label: "Logo Sua Marca — clique para voltar ao painel a qualquer momento" },
          { n: 2, x: 8.5, y: 96, w: 17, h: 6, label: "Seu usuário e atalho para sair" },
        ],
        caption:
          "Regra de ouro: na dúvida, registre. Foto, observação, marcação de avaria — registrar sempre protege você, o cliente e a Sua Marca.",
      },
      {
        title: "Conheça o menu lateral",
        body:
          "À esquerda você tem três blocos: OPERAÇÕES (o dia a dia), GESTÃO (busca e cadastros) e APRENDA (estes tutoriais). Comece sempre pela Operação — é onde tudo acontece.",
        imageRef: "opsToday",
        hotspots: [
          { n: 1, x: 8.5, y: 19, w: 17, h: 4.5, label: "Operação — agenda do dia (use ao chegar)" },
          { n: 2, x: 8.5, y: 30, w: 17, h: 4.5, label: "Reservas — busca completa por nome ou ID" },
          { n: 3, x: 8.5, y: 41, w: 17, h: 4.5, label: "Agenda — visão semanal/mensal de todos os carros" },
          { n: 4, x: 8.5, y: 45.5, w: 17, h: 4.5, label: "Frota — situação de cada veículo da Sua Marca" },
          { n: 5, x: 8.5, y: 66.5, w: 17, h: 4.5, label: "Tutoriais — você está aqui agora" },
        ],
      },
      {
        title: "Termômetro da frota",
        body:
          "No rodapé do menu existe um cartão FROTA com números rápidos: total de veículos e quantos estão disponíveis. Bate o olho ao chegar — se 'disponíveis' estiver baixo, dia cheio pela frente.",
        imageRef: "opsToday",
        hotspots: [
          { n: 1, x: 8.5, y: 84, w: 17, h: 9, label: "Cartão FROTA — total e disponíveis em tempo real" },
        ],
      },
      {
        title: "Check de 3 minutos ao chegar",
        body:
          "Logo no início do expediente: abra a Operação, role a coluna de ENTREGAS conferindo horários, depois a de DEVOLUÇÕES. Identifique o que vem na próxima hora e separe as chaves correspondentes.",
        imageRef: "opsToday",
        hotspots: [
          { n: 1, x: 8.5, y: 19, w: 17, h: 4.5, label: "Clique em Operação no menu" },
          { n: 2, x: 39, y: 32, w: 36, h: 4, label: "Coluna RETIRADAS de hoje" },
          { n: 3, x: 78, y: 32, w: 36, h: 4, label: "Coluna DEVOLUÇÕES de hoje" },
        ],
        cta: { label: "Abrir Operação agora", to: "/admin/ops-today" },
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "operacao-do-dia",
    title: "Operação do dia: entregas e devoluções",
    summary:
      "Como ler a agenda, priorizar pelos horários, abrir uma reserva e agir nos pontos críticos.",
    icon: Sparkles,
    duration: 5,
    category: "Diário",
    steps: [
      {
        title: "A tela abre sempre no dia de hoje",
        body:
          "A Operação é organizada em duas colunas: RETIRADAS (saídas previstas) e DEVOLUÇÕES (retornos). No topo, três cartões mostram o resumo: quantas retiradas, devoluções e carros em preparação.",
        imageRef: "opsToday",
        hotspots: [
          { n: 1, x: 26, y: 21, w: 14, h: 4, label: "Data do dia em foco — abre sempre no atual" },
          { n: 2, x: 67, y: 21, w: 12, h: 8, label: "Resumo RETIRADAS do dia" },
          { n: 3, x: 80, y: 21, w: 12, h: 8, label: "Resumo DEVOLUÇÕES do dia" },
          { n: 4, x: 93, y: 21, w: 12, h: 8, label: "Carros EM PREPARAÇÃO" },
        ],
        cta: { label: "Abrir Operação", to: "/admin/ops-today" },
      },
      {
        title: "Leia cada cartão de reserva",
        body:
          "Cada linha mostra horário, cliente, veículo, local de retirada e o status. Trabalhe sempre de cima para baixo — o primeiro horário vem no topo. A barrinha colorida à esquerda indica urgência.",
        imageRef: "opsToday",
        hotspots: [
          { n: 1, x: 25, y: 43, w: 1.5, h: 6, label: "Barra de urgência (verde, âmbar ou vermelho)" },
          { n: 2, x: 30, y: 43, w: 8, h: 4, label: "Horário da retirada" },
          { n: 3, x: 39, y: 43, w: 10, h: 4, label: "Nome do cliente" },
          { n: 4, x: 36, y: 47, w: 14, h: 3, label: "Veículo + local de retirada" },
          { n: 5, x: 46, y: 43, w: 7, h: 3.5, label: "Status PENDENTE / EM ANDAMENTO / CONCLUÍDA" },
          { n: 6, x: 52, y: 43, w: 8, h: 4, label: "Botão INSPEÇÃO — abre o fluxo de entrega" },
        ],
      },
      {
        title: "Navegue entre dias",
        body:
          "Use as setas e o botão 'Hoje' no seletor de data para conferir o dia seguinte (separar chaves com antecedência) ou revisar o anterior. Ao sair da tela e voltar, ela volta sozinha para hoje.",
        imageRef: "opsToday",
        hotspots: [
          { n: 1, x: 21, y: 25, w: 3, h: 3.5, label: "Voltar 1 dia" },
          { n: 2, x: 24, y: 25, w: 6, h: 3.5, label: "Botão Hoje (reseta para o dia atual)" },
          { n: 3, x: 30, y: 25, w: 3, h: 3.5, label: "Avançar 1 dia" },
        ],
      },
      {
        title: "Abra a reserva completa",
        body:
          "Clique em qualquer cartão para abrir a reserva. Você verá período, dias, valor total, status de pagamento e os três botões de ação principais: Entrega, Devolução e Enviar Contrato.",
        imageRef: "bookingDetail",
        hotspots: [
          { n: 1, x: 23, y: 21.5, w: 8, h: 4, label: "Nome do cliente" },
          { n: 2, x: 22, y: 26, w: 6, h: 3, label: "Status da reserva" },
          { n: 3, x: 40, y: 26, w: 12, h: 3, label: "Status do pagamento" },
          { n: 4, x: 33, y: 32, w: 28, h: 6, label: "Período, dias e valor total" },
          { n: 5, x: 78, y: 22.5, w: 9, h: 4, label: "Botão ENTREGA — inicia checkout do veículo" },
          { n: 6, x: 86, y: 22.5, w: 9, h: 4, label: "Botão DEVOLUÇÃO — registra o retorno" },
          { n: 7, x: 94, y: 22.5, w: 9, h: 4, label: "Enviar Contrato — envia por e-mail/WhatsApp" },
        ],
      },
      {
        title: "Final do expediente",
        body:
          "Antes de fechar o dia, role a Operação até o fim e confira: todas as RETIRADAS viraram 'Em andamento'? Todas as DEVOLUÇÕES previstas viraram 'Concluída'? Se algo ficou pendente, registre nas observações o motivo (cliente atrasou, remarcou, não apareceu).",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "entrega-veiculo",
    title: "Passo a passo: entregar um veículo",
    summary:
      "Do check-in do cliente à inspeção de saída e entrega das chaves, com tudo registrado.",
    icon: KeyRound,
    duration: 8,
    category: "Operacional",
    steps: [
      {
        title: "Confirme o cliente",
        body:
          "Antes de tudo, peça documento com foto e a CNH. Confira o nome igual ao da reserva e se a CNH está válida. Para cliente estrangeiro, peça também o passaporte. Se algo estiver diferente, ajuste em 'Editar cliente' antes de seguir.",
        highlights: [
          "Nome igual ao da reserva e do cartão de crédito",
          "CNH dentro do prazo de validade",
          "Idade mínima de 21 anos (25 para SUV e premium)",
        ],
      },
      {
        title: "Apresente o veículo ao cliente",
        body:
          "Antes de abrir o sistema, leve o cliente até o carro e dê uma volta completa com ele. Aponte arranhões ou marcas existentes, mostre o nível de combustível e a quilometragem. Esse momento evita 90% das discussões na devolução.",
      },
      {
        title: "Inicie a Entrega na reserva",
        body:
          "Na tela da reserva, clique no botão 'Entrega' (dourado, canto superior direito). Ele abre a inspeção de saída em 5 etapas: Odômetro, Fotos, Avarias, Acessórios e Assinaturas.",
        imageRef: "bookingDetail",
        hotspots: [
          { n: 1, x: 78, y: 22.5, w: 9, h: 4, label: "Botão ENTREGA — começa a inspeção" },
        ],
      },
      {
        title: "Etapa 1 — Odômetro e Combustível",
        body:
          "Digite a quilometragem exata olhando direto no painel ligado. Em seguida marque o nível de combustível em oitavos (Vazio, 1/8, 1/4, 3/8, 1/2, 5/8, 3/4, 7/8, Cheio). Tire foto do painel mostrando os dois claramente.",
        imageRef: "inspectionOdometro",
        hotspots: [
          { n: 1, x: 30, y: 29, w: 14, h: 4, label: "Aba ativa: Odômetro & Combustível" },
          { n: 2, x: 42, y: 48, w: 19, h: 4, label: "Leitura do odômetro em milhas" },
          { n: 3, x: 80, y: 49, w: 30, h: 4, label: "Barra contínua do nível de combustível" },
          { n: 4, x: 80, y: 54, w: 30, h: 3, label: "Chips de fração — selecione o oitavo mais próximo" },
          { n: 5, x: 60, y: 76, w: 40, h: 22, label: "Foto do painel aceso (obrigatória)" },
        ],
        caption:
          "Esses dois números são a base do cálculo de cobrança na devolução. Errou aqui, a fatura sai errada.",
      },
      {
        title: "Etapa 2 — Fotos do Veículo",
        body:
          "Tire as fotos obrigatórias: dianteira, traseira, ambas as laterais e o painel. Use boa luz, sem contraluz, e enquadre o carro inteiro. Essas fotos são a prova oficial do estado de entrega.",
        imageRef: "inspectionFotos",
        hotspots: [
          { n: 1, x: 41, y: 29, w: 14, h: 4, label: "Aba ativa: Fotos do Veículo" },
        ],
      },
      {
        title: "Etapa 3 — Mapa de Avarias 3D",
        body:
          "Aqui mora a parte mais importante. Gire o modelo 3D do veículo com o mouse (arraste para girar, scroll para zoom). Ao passar o mouse, a peça acende em dourado — clique para registrar a avaria.",
        imageRef: "inspectionAvarias",
        hotspots: [
          { n: 1, x: 51.5, y: 29, w: 10, h: 4, label: "Aba ativa: Avarias" },
          { n: 2, x: 76, y: 46, w: 17, h: 4, label: "Selecionar peça pelo nome (alternativa ao clique 3D)" },
          { n: 3, x: 91, y: 46, w: 9, h: 4, label: "Botão Adicionar — registra a avaria selecionada" },
          { n: 4, x: 71, y: 38, w: 9, h: 3, label: "Contador de registros nesta inspeção" },
          { n: 5, x: 88, y: 56, w: 10, h: 3, label: "Vista padrão — reseta a rotação do modelo" },
          { n: 6, x: 60, y: 78, w: 35, h: 30, label: "Modelo 3D — clique direto na peça para marcar" },
        ],
        highlights: [
          "Pequeno arranhão superficial = nível LEVE",
          "Amassado ou rasgo visível = nível MÉDIO",
          "Pintura comprometida ou peça quebrada = nível GRAVE",
        ],
        caption:
          "Sempre 3 fotos por avaria: geral, média a 1 metro e detalhe de perto.",
      },
      {
        title: "Etapa 4 — Acessórios contratados",
        body:
          "Confira o que foi contratado (cadeirinha, GPS, motorista adicional, pacote de pedágio) e marque cada item que está realmente entregando. O que ficar desmarcado é considerado não entregue.",
        imageRef: "inspectionAcessorios",
        hotspots: [
          { n: 1, x: 62, y: 29, w: 12, h: 4, label: "Aba ativa: Acessórios" },
        ],
      },
      {
        title: "Etapa 5 — Assinatura e chaves",
        body:
          "Vire o tablet ou celular para o cliente, deixe-o conferir e assinar. Só entregue as chaves DEPOIS da assinatura. A reserva muda automaticamente para 'Em andamento' e o cliente recebe o comprovante por e-mail.",
        imageRef: "inspectionAssinaturas",
        hotspots: [
          { n: 1, x: 73, y: 29, w: 12, h: 4, label: "Aba ativa: Assinaturas" },
        ],
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "devolucao-veiculo",
    title: "Passo a passo: receber a devolução",
    summary:
      "Como rodar a inspeção de retorno, comparar com a saída e fechar a reserva sem deixar nada passar.",
    icon: ClipboardCheck,
    duration: 7,
    category: "Operacional",
    steps: [
      {
        title: "Receba o cliente com calma",
        body:
          "Cumprimente, pergunte como foi a viagem. Antes de abrir o sistema, dê uma volta visual no carro com o cliente ao lado, olhando todas as faces. Esse momento define o tom do encerramento.",
      },
      {
        title: "Inicie a Devolução no sistema",
        body:
          "Em Operação > Devoluções de hoje, clique em INSPEÇÃO no cartão da reserva. Você também pode abrir pela reserva direto e clicar no botão 'Devolução' (branco, ao lado de Entrega).",
        imageRef: "bookingDetail",
        hotspots: [
          { n: 1, x: 86, y: 22.5, w: 9, h: 4, label: "Botão DEVOLUÇÃO — modo retorno" },
        ],
      },
      {
        title: "Compare lado a lado com a saída",
        body:
          "Use o botão 'Comparar' no topo da inspeção para ver todas as avarias registradas na saída. Qualquer marca nova é avaria de devolução — registre clicando na peça do modelo 3D, sempre com foto antes de marcar.",
        imageRef: "inspectionAvarias",
        hotspots: [
          { n: 1, x: 91, y: 23, w: 11, h: 4, label: "Botão Comparar — mostra avarias registradas na saída" },
          { n: 2, x: 60, y: 78, w: 35, h: 30, label: "Marque aqui apenas o que apareceu de novo" },
        ],
        highlights: [
          "Foto geral mostrando a peça inteira",
          "Foto média, cerca de 1 metro de distância",
          "Foto de perto com o detalhe da avaria",
        ],
      },
      {
        title: "Atualize Odômetro e Combustível",
        body:
          "Atualize a quilometragem e o combustível devolvido. Se voltou com menos combustível, o sistema calcula a taxa de reabastecimento. KM rodado acima da franquia também é somado sozinho.",
        imageRef: "inspectionOdometro",
        hotspots: [
          { n: 1, x: 42, y: 48, w: 19, h: 4, label: "Nova leitura do odômetro" },
          { n: 2, x: 80, y: 54, w: 30, h: 3, label: "Nível de combustível devolvido" },
        ],
      },
      {
        title: "Confira acessórios devolvidos",
        body:
          "Marque o que voltou. Se faltar cadeirinha, GPS ou qualquer item, registre como 'não devolvido' — o sistema aplica a taxa de reposição conforme o contrato.",
        imageRef: "inspectionAcessorios",
        hotspots: [
          { n: 1, x: 62, y: 29, w: 12, h: 4, label: "Aba Acessórios — marque o que foi devolvido" },
        ],
      },
      {
        title: "Assine e finalize",
        body:
          "Cliente assina, você finaliza. A reserva passa para 'Concluída' e o veículo entra automaticamente em 'Em preparação' para a próxima locação. O cliente recebe por e-mail o resumo completo com fotos e valores.",
        imageRef: "inspectionAssinaturas",
        hotspots: [
          { n: 1, x: 73, y: 29, w: 12, h: 4, label: "Aba Assinaturas — finalize após o cliente assinar" },
        ],
      },
      {
        title: "Encaminhe para preparação",
        body:
          "Leve o carro para a área de preparação. Se houver avaria que precise de oficina, abra um chamado em 'Frota > Manutenção' descrevendo o que aconteceu e anexando as fotos da devolução.",
        imageRef: "fleet",
        hotspots: [
          { n: 1, x: 8.5, y: 45.5, w: 17, h: 4.5, label: "Menu Frota — abra para criar chamado de manutenção" },
        ],
        cta: { label: "Abrir Frota", to: "/admin/fleet" },
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "mapa-avarias",
    title: "Mapa de avarias 3D: domine a ferramenta",
    summary:
      "Truques para usar o viewer 3D de avarias com agilidade e precisão cirúrgica.",
    icon: Camera,
    duration: 4,
    category: "Operacional",
    steps: [
      {
        title: "Gire em 360°",
        body:
          "Arraste com o botão esquerdo do mouse para girar o veículo em qualquer eixo (cima, baixo, esquerda, direita). Use o scroll do mouse para zoom. Sempre rode o carro inteiro antes de marcar — você pode esquecer uma marca atrás se ficar só de frente.",
        imageRef: "inspectionAvarias",
        hotspots: [
          { n: 1, x: 60, y: 78, w: 35, h: 30, label: "Arraste para girar · scroll para zoom" },
          { n: 2, x: 88, y: 56, w: 10, h: 3, label: "Vista padrão — volta para o ângulo inicial" },
        ],
      },
      {
        title: "Destaque dourado = peça selecionada",
        body:
          "Ao passar o mouse, a peça (porta, capô, roda, vidro) acende em dourado emissivo com contorno preciso. Esse é o feedback de que o clique vai registrar a avaria naquela peça específica.",
        imageRef: "inspectionAvarias",
        hotspots: [
          { n: 1, x: 60, y: 78, w: 35, h: 30, label: "Mouse sobre a peça → ela acende em dourado" },
        ],
      },
      {
        title: "Alternativa por lista",
        body:
          "Se o mouse falhar ou você preferir, use o seletor 'Selecionar peça pelo nome' e depois clique em 'Adicionar'. O efeito é idêntico ao clique direto no 3D.",
        imageRef: "inspectionAvarias",
        hotspots: [
          { n: 1, x: 76, y: 46, w: 17, h: 4, label: "Seletor por nome da peça" },
          { n: 2, x: 91, y: 46, w: 9, h: 4, label: "Botão Adicionar" },
        ],
      },
      {
        title: "Contador no topo",
        body:
          "O badge dourado mostra quantas avarias já foram registradas nesta inspeção. Use como conferência rápida ao final.",
        imageRef: "inspectionAvarias",
        hotspots: [
          { n: 1, x: 71, y: 38, w: 9, h: 3, label: "Contador de registros" },
        ],
        caption:
          "Foto ruim é prova fraca. Foto boa fecha qualquer discussão. Sempre 3 fotos por avaria: geral, média e detalhe.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "agenda-semana",
    title: "Agenda: planejar a semana",
    summary:
      "Como usar o calendário para antecipar o movimento da semana e separar chaves com folga.",
    icon: CalendarRange,
    duration: 3,
    category: "Diário",
    steps: [
      {
        title: "Abra a Agenda",
        body:
          "No menu lateral, clique em 'Agenda'. Você vê uma grade tipo calendário, com cada reserva ocupando o veículo durante o período locado. Use para visualizar a semana inteira de uma vez.",
        imageRef: "calendar",
        hotspots: [
          { n: 1, x: 8.5, y: 41, w: 17, h: 4.5, label: "Menu Agenda" },
        ],
        cta: { label: "Abrir Agenda", to: "/admin/calendar" },
      },
      {
        title: "Identifique gargalos",
        body:
          "Procure dias com várias entregas ou devoluções no mesmo horário. Sábado de manhã e segunda à noite costumam ser pesados. Avise o gestor se precisar de reforço.",
        imageRef: "calendar",
      },
      {
        title: "Separe chaves com antecedência",
        body:
          "Na véspera, abra a Agenda do dia seguinte, identifique todas as entregas previstas e separe as chaves no painel. Isso economiza minutos cruciais quando o cliente chega com pressa.",
      },
    ],
  },

  // ────────────────────────────────────────────────────────────────────────────
  {
    id: "duvidas-comuns",
    title: "Dúvidas comuns do dia a dia",
    summary:
      "Respostas rápidas para as situações que mais aparecem no balcão da Sua Marca.",
    icon: CircleHelp,
    duration: 5,
    category: "Diário",
    steps: [
      {
        title: "Cliente atrasado",
        body:
          "Se passou de 30 minutos do horário, ligue pelo WhatsApp (botão direto na reserva). Sem retorno em 1 hora, comunique o gestor antes de liberar o carro para outra venda. Registre tudo nas observações da reserva.",
      },
      {
        title: "Cliente quer trocar de carro",
        body:
          "Abra a reserva e clique em 'Trocar veículo'. O sistema mostra apenas alternativas disponíveis no mesmo período. Se houver diferença de preço, ela é calculada automaticamente — apresente ao cliente antes de confirmar.",
      },
      {
        title: "Extensão do aluguel",
        body:
          "Na reserva, clique em 'Estender' e defina a nova data de devolução. Se houver outra reserva do mesmo veículo no período, o sistema avisa e sugere alternativas. Confirme com o cliente o valor adicional antes de salvar.",
      },
      {
        title: "Cliente perdeu a chave",
        body:
          "Registre nas observações da reserva o que aconteceu. Abra um chamado em 'Frota > Manutenção' marcando 'reposição de chave' e cobre a taxa prevista no contrato. Avise o gestor se precisar acionar o chaveiro de emergência.",
      },
      {
        title: "Carro com problema mecânico",
        body:
          "Não devolva à frota antes de abrir manutenção. Vá em 'Frota' > clique no veículo > 'Manutenção' > 'Novo chamado'. Descreva o sintoma com detalhe (ruído, luz no painel, vazamento) e foto se possível. O carro fica bloqueado para nova locação até ser liberado.",
        imageRef: "fleet",
        hotspots: [
          { n: 1, x: 8.5, y: 45.5, w: 17, h: 4.5, label: "Menu Frota" },
        ],
      },
      {
        title: "Cliente quer estender por telefone",
        body:
          "Pergunte o número da reserva ou o nome completo, abra em 'Reservas', confirme dados e siga o passo de Extensão. Sempre confirme o pagamento da diferença antes de salvar — geralmente cartão na hora, registrado em 'Pagamentos' da reserva.",
      },
    ],
  },
];
