import {
  Sparkles,
  CalendarRange,
  KeyRound,
  ClipboardCheck,
  Camera,
  Users,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";

export type TutorialStep = {
  title: string;
  body: string;
  /** Optional bullet list rendered after body */
  highlights?: string[];
  /** Optional CTA to navigate the user to the actual screen of that step */
  cta?: { label: string; to: string };
  /** Optional caption shown under the illustration */
  caption?: string;
};

export type Tutorial = {
  id: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  /** Minutes, rough reading/practice estimate */
  duration: number;
  /** Tag shown on the card */
  category: "Diário" | "Operacional" | "Atendimento" | "Essencial";
  steps: TutorialStep[];
};

export const adminTutorials: Tutorial[] = [
  {
    id: "primeiro-dia",
    title: "Boas-vindas: seu primeiro dia na Zeus",
    summary:
      "Visão geral do painel, do menu lateral e do que olhar nos primeiros minutos do expediente.",
    icon: Sparkles,
    duration: 3,
    category: "Essencial",
    steps: [
      {
        title: "Bem-vindo, Rui",
        body:
          "Este painel é o seu posto de comando. Tudo que acontece com os carros, clientes e reservas passa por aqui. Vamos juntos por cada parte: vou te mostrar exatamente onde clicar e por quê.",
        caption: "Leve no seu ritmo — você pode pausar e voltar quando quiser.",
      },
      {
        title: "Menu lateral",
        body:
          "No menu da esquerda você encontra três grupos: Operações (o dia de hoje), Gestão (reservas, frota, clientes) e Administração. Comece sempre pela Operação do dia.",
        highlights: [
          "Operação: o que precisa fazer hoje",
          "Reservas: lista completa de aluguéis",
          "Frota: situação de cada veículo",
          "Clientes: cadastro e histórico",
        ],
      },
      {
        title: "Indicador da frota",
        body:
          "No rodapé do menu existe um cartão FROTA com três números: total de veículos, disponíveis e em preparação. Esse é o seu termômetro rápido — se 'em preparação' estiver alto, há carros aguardando você.",
      },
    ],
  },
  {
    id: "operacao-do-dia",
    title: "Operação do dia: entregas e devoluções",
    summary:
      "Como abrir a tela de Operação, ler a agenda do dia e priorizar entregas e devoluções.",
    icon: Sparkles,
    duration: 4,
    category: "Diário",
    steps: [
      {
        title: "Abra a Operação",
        body:
          "Clique em 'Operação' no menu lateral. A tela sempre abre no dia de hoje, com duas colunas: ENTREGAS (saídas) e DEVOLUÇÕES (retornos).",
        cta: { label: "Abrir Operação", to: "/admin/ops-today" },
      },
      {
        title: "Priorize pelo horário",
        body:
          "Cada cartão mostra o horário, o cliente e o veículo. Trabalhe sempre de cima para baixo — o primeiro horário do dia vem no topo.",
        highlights: [
          "Verde = entrega tranquila",
          "Âmbar = atenção, horário próximo",
          "Vermelho = atrasado, agir agora",
        ],
      },
      {
        title: "Mude o dia se precisar",
        body:
          "No topo da tela há um seletor de data. Use-o apenas para conferir um dia diferente — ao reabrir, ela volta sozinha para hoje.",
      },
      {
        title: "Abrir a reserva",
        body:
          "Clique em qualquer cartão para ver os detalhes completos da reserva: cliente, voo, observações, valor e ações disponíveis (iniciar entrega, registrar devolução).",
      },
    ],
  },
  {
    id: "entrega-veiculo",
    title: "Passo a passo: entregar um veículo",
    summary:
      "Do check-in do cliente à inspeção de saída e entrega das chaves, com tudo registrado.",
    icon: KeyRound,
    duration: 6,
    category: "Operacional",
    steps: [
      {
        title: "Confirme o cliente",
        body:
          "Antes de tudo, peça documento com foto e a CNH. Confira o nome na reserva e se a CNH está válida. Se algo estiver diferente, registre nas observações da reserva.",
      },
      {
        title: "Abra a inspeção de saída",
        body:
          "Dentro da reserva, clique em 'Entrega' (ou 'Iniciar inspeção'). Isso abre o mapa 3D do veículo, onde você vai marcar o estado atual antes de entregar.",
      },
      {
        title: "Mapa 3D de avarias",
        body:
          "Gire o carro arrastando com o mouse. Aproxime usando o scroll. Clique em qualquer peça (capô, porta, para-choque) para registrar uma marca. Tire foto sempre que houver risco, amassado ou sujeira relevante.",
        highlights: [
          "Pequeno arranhão = nível leve",
          "Amassado ou rasgo = nível médio",
          "Pintura comprometida = nível grave",
        ],
        caption: "Quanto mais detalhado o registro, mais protegido o cliente e a Zeus.",
      },
      {
        title: "Combustível e quilometragem",
        body:
          "Anote o nível de combustível (em oitavos: 1/8, 2/8...) e a quilometragem exata do painel. Esses dois números são a base da cobrança ao devolver.",
      },
      {
        title: "Assinatura e chaves",
        body:
          "Peça ao cliente para conferir e assinar a inspeção no tablet/celular. Só entregue as chaves depois da assinatura. A reserva muda automaticamente para 'Em andamento'.",
      },
    ],
  },
  {
    id: "devolucao-veiculo",
    title: "Passo a passo: receber a devolução",
    summary:
      "Como rodar a inspeção de retorno, comparar com a saída e fechar a reserva.",
    icon: ClipboardCheck,
    duration: 5,
    category: "Operacional",
    steps: [
      {
        title: "Receba o cliente",
        body:
          "Cumprimente, pergunte como foi a viagem e peça as chaves. Antes de abrir o sistema, dê uma volta visual no carro com o cliente ao lado — isso evita discussões depois.",
      },
      {
        title: "Inicie a devolução no sistema",
        body:
          "Localize a reserva (Operação > Devoluções ou Reservas > buscar pelo nome) e clique em 'Devolução'. O sistema abre a mesma vista 3D, agora em modo retorno.",
      },
      {
        title: "Compare lado a lado",
        body:
          "Use o botão 'Comparar com saída' para ver as marcações antigas. Qualquer marca nova é uma avaria a registrar. Sempre foto antes de marcar.",
      },
      {
        title: "Combustível, KM e taxas",
        body:
          "Atualize o combustível e a quilometragem. Se o cliente devolveu com menos combustível, o sistema calcula a taxa de reabastecimento. KM extra também é somado automaticamente.",
      },
      {
        title: "Feche e envie o resumo",
        body:
          "Clique em 'Finalizar devolução'. O cliente recebe por e-mail o resumo com fotos, valores e nota fiscal. A reserva passa para 'Concluída' e o veículo volta para 'Em preparação'.",
      },
    ],
  },
  {
    id: "mapa-avarias-3d",
    title: "Mapa 3D de avarias: domine a ferramenta",
    summary:
      "Truques para usar a vista 3D do carro de forma rápida e precisa em qualquer inspeção.",
    icon: Camera,
    duration: 3,
    category: "Operacional",
    steps: [
      {
        title: "Movimentação básica",
        body:
          "Arraste com o botão esquerdo para girar. Scroll do mouse aproxima e afasta. Botão direito move a câmera lateralmente. No celular: um dedo gira, dois dedos zoom.",
      },
      {
        title: "Selecionar uma peça",
        body:
          "Passe o cursor sobre a peça — ela acende em dourado e o nome aparece em uma etiqueta flutuante. Clique para abrir o registro de avaria daquela peça.",
      },
      {
        title: "Boas práticas de foto",
        body:
          "Sempre 3 fotos por avaria: uma geral mostrando a peça inteira, uma média de 1 metro, e uma de perto para o detalhe. Boa iluminação resolve 90% dos problemas.",
        highlights: [
          "Evite contraluz",
          "Limpe o local antes de fotografar",
          "Inclua a régua quando possível",
        ],
      },
    ],
  },
  {
    id: "nova-reserva",
    title: "Criar uma reserva manual",
    summary:
      "Quando o cliente ligar ou aparecer na loja, como cadastrar uma reserva direto no sistema.",
    icon: CalendarRange,
    duration: 4,
    category: "Atendimento",
    steps: [
      {
        title: "Acesse Reservas",
        body:
          "Pelo menu lateral, vá em 'Reservas' e clique no botão dourado 'Nova reserva' no canto superior direito.",
        cta: { label: "Ir para Reservas", to: "/admin/bookings" },
      },
      {
        title: "Dados do cliente",
        body:
          "Comece pelo telefone ou e-mail — se o cliente já existe, o sistema completa sozinho. Caso contrário, preencha nome completo, CPF/passaporte e CNH.",
      },
      {
        title: "Datas, locais e veículo",
        body:
          "Escolha retirada e devolução (data e hora). Selecione o local (aeroporto MCO costuma ser o mais comum). O sistema filtra apenas veículos disponíveis no período.",
      },
      {
        title: "Plano e extras",
        body:
          "Apresente os três planos: Essencial, Conforto (recomendado) e Premium. Adicione extras se o cliente pedir (cadeirinha, GPS, motorista adicional).",
      },
      {
        title: "Confirme e envie",
        body:
          "Revise o total. Ao confirmar, o cliente recebe e-mail e WhatsApp com a confirmação. A reserva já entra automaticamente na agenda do dia da retirada.",
      },
    ],
  },
  {
    id: "cliente-busca",
    title: "Encontrar e atender um cliente",
    summary:
      "Como localizar rapidamente um cliente, ver histórico e resolver dúvidas pelo cadastro.",
    icon: Users,
    duration: 3,
    category: "Atendimento",
    steps: [
      {
        title: "Busca rápida",
        body:
          "Em 'Clientes', use a barra de busca no topo. Funciona por nome, e-mail, telefone ou número da reserva. Resultado aparece enquanto você digita.",
        cta: { label: "Abrir Clientes", to: "/admin/customers" },
      },
      {
        title: "Ficha do cliente",
        body:
          "Ao abrir um cliente, você vê histórico de reservas, documentos enviados (CNH, passaporte), preferências e observações de atendimentos anteriores.",
      },
      {
        title: "Anote tudo",
        body:
          "Sempre que algo relevante acontecer (atraso, preferência por carro específico, restrição) registre nas observações. O próximo atendente agradece.",
      },
    ],
  },
  {
    id: "duvidas-comuns",
    title: "Dúvidas comuns do dia a dia",
    summary: "Respostas rápidas para situações que aparecem com frequência no balcão.",
    icon: CircleHelp,
    duration: 4,
    category: "Diário",
    steps: [
      {
        title: "Cliente atrasado",
        body:
          "Se passou de 30 minutos do horário, ligue para o cliente pelo WhatsApp (botão direto na reserva). Sem retorno em 1 hora, libere o carro para outra venda e mude o status para 'Cancelada'.",
      },
      {
        title: "Cliente quer trocar de carro",
        body:
          "Abra a reserva, clique em 'Trocar veículo'. O sistema mostra apenas alternativas disponíveis no mesmo período. Diferença de preço é calculada automaticamente.",
      },
      {
        title: "Extensão do aluguel",
        body:
          "Na reserva, clique em 'Estender'. Defina a nova data de devolução. Se houver outra reserva no mesmo veículo, o sistema avisa e sugere alternativas.",
      },
      {
        title: "Cliente perdeu a chave",
        body:
          "Registre nas observações, abra um chamado em 'Frota > Manutenção' marcando 'reposição de chave' e cobre a taxa prevista no contrato.",
      },
    ],
  },
];
