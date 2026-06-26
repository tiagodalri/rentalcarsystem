import {
  Sparkles,
  CalendarRange,
  KeyRound,
  ClipboardCheck,
  Camera,
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
  category: "Diário" | "Operacional" | "Essencial";
  steps: TutorialStep[];
};

export const adminTutorials: Tutorial[] = [
  {
    id: "primeiro-dia",
    title: "Boas-vindas: seu primeiro dia na Zeus",
    summary:
      "Visão geral do painel, do menu lateral e o que olhar nos primeiros minutos do expediente.",
    icon: Sparkles,
    duration: 4,
    category: "Essencial",
    steps: [
      {
        title: "Bem-vindo, Rui",
        body:
          "Este painel é o seu posto de comando. Tudo que acontece com os carros e clientes da Zeus passa por aqui. Vou te mostrar exatamente onde olhar e por quê — leve no seu ritmo, pode pausar e voltar quando quiser.",
        caption:
          "Regra de ouro: na dúvida, registre. Foto, observação, marcação de avaria — registrar sempre protege você, o cliente e a Zeus.",
      },
      {
        title: "Menu lateral",
        body:
          "À esquerda você tem três áreas que vai usar todo dia: Operação (a agenda de hoje), Reservas (todos os aluguéis) e Agenda (visão semanal e mensal). Comece sempre pela Operação.",
        highlights: [
          "Operação — o que você precisa fazer hoje",
          "Reservas — busca completa de aluguéis",
          "Agenda — visão de calendário para conferir a semana",
          "Frota — situação atual de cada veículo",
        ],
      },
      {
        title: "Termômetro da frota",
        body:
          "No rodapé do menu existe o cartão FROTA com três números: total de veículos, disponíveis e em preparação. Esse é o seu pulso rápido — se 'em preparação' estiver alto, há carros aguardando atenção.",
        highlights: [
          "Total — quantos veículos a Zeus tem hoje",
          "Disponíveis — prontos para sair",
          "Em preparação — limpeza, manutenção ou reabastecimento",
        ],
      },
      {
        title: "Rotina de início de expediente",
        body:
          "Logo ao chegar, faça este check de 3 minutos: abra Operação, role a coluna de entregas conferindo horários, depois a coluna de devoluções. Identifique o que vem na próxima 1 hora e separe as chaves correspondentes.",
        cta: { label: "Abrir Operação agora", to: "/admin/ops-today" },
      },
    ],
  },
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
        title: "Abra a Operação",
        body:
          "Clique em 'Operação' no menu lateral. A tela sempre abre no dia de hoje, com duas colunas: ENTREGAS (saídas previstas) e DEVOLUÇÕES (retornos previstos). É daqui que você comanda o dia.",
        cta: { label: "Abrir Operação", to: "/admin/ops-today" },
      },
      {
        title: "Leia cada cartão",
        body:
          "Em cada cartão você tem horário, nome do cliente, veículo, local (aeroporto MCO, loja ou hotel) e voo quando houver. Trabalhe sempre de cima para baixo — o primeiro horário do dia vem no topo.",
        highlights: [
          "Verde — entrega/devolução tranquila",
          "Âmbar — atenção, horário próximo (menos de 30 min)",
          "Vermelho — atrasado, precisa de ação imediata",
        ],
      },
      {
        title: "Mude o dia se precisar",
        body:
          "No topo há um seletor de data. Use-o para conferir o dia seguinte (separar chaves com antecedência) ou rever o dia anterior. Ao reabrir a tela, ela volta sozinha para hoje.",
      },
      {
        title: "Abrir a reserva completa",
        body:
          "Clique em qualquer cartão para ver: dados do cliente, voo, observações de atendimentos anteriores, valor, plano contratado e os botões de ação (Entrega ou Devolução, Inspeção e Histórico).",
      },
      {
        title: "Final do expediente",
        body:
          "Antes de fechar o dia, role a Operação até o fim e confira: todas as entregas viraram 'Em andamento'? Todas as devoluções previstas viraram 'Concluída'? Se alguma estiver pendente, registre no campo de observações o que aconteceu (cliente atrasou, remarcou, não apareceu).",
      },
    ],
  },
  {
    id: "entrega-veiculo",
    title: "Passo a passo: entregar um veículo",
    summary:
      "Do check-in do cliente à inspeção de saída e entrega das chaves, com tudo registrado.",
    icon: KeyRound,
    duration: 7,
    category: "Operacional",
    steps: [
      {
        title: "Confirme o cliente",
        body:
          "Antes de tudo, peça documento com foto e a CNH. Confira o nome igual ao da reserva e se a CNH está válida. Para cliente estrangeiro, peça também o passaporte. Se algo estiver diferente do cadastro, ajuste em 'Editar cliente' antes de seguir.",
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
        title: "Abra a inspeção de saída",
        body:
          "Dentro da reserva, clique em 'Entrega' (ou 'Iniciar inspeção'). Isso abre o mapa do veículo, onde você vai registrar o estado atual antes de entregar as chaves.",
      },
      {
        title: "Mapa de avarias",
        body:
          "Use o seletor de ângulo (Frontal, Traseira, Superior) para circular o carro. Clique no pin sobre cada peça onde houver marca. Anote o nível e tire foto sempre que houver risco, amassado ou sujeira relevante.",
        highlights: [
          "Pequeno arranhão superficial = nível leve",
          "Amassado ou rasgo visível = nível médio",
          "Pintura comprometida ou peça quebrada = nível grave",
        ],
        caption:
          "Quanto mais detalhado o registro, mais protegido o cliente e a Zeus na hora da devolução.",
      },
      {
        title: "Combustível e quilometragem",
        body:
          "Anote o nível de combustível em oitavos (1/8, 2/8, 3/8...) olhando direto no painel ligado. Registre a quilometragem exata. Esses dois números são a base do cálculo de cobrança na devolução — erre aqui e a fatura sai errada.",
      },
      {
        title: "Acessórios entregues",
        body:
          "Confira na aba 'Acessórios' o que foi contratado (cadeirinha, GPS, motorista adicional, pacote de pedágio) e marque cada item que estiver entregando junto. Tudo deixado para trás na loja é considerado não entregue.",
      },
      {
        title: "Assinatura e chaves",
        body:
          "Peça ao cliente para conferir e assinar a inspeção no tablet ou celular. Só entregue as chaves DEPOIS da assinatura. A reserva muda automaticamente para 'Em andamento' e o cliente recebe o comprovante por e-mail.",
      },
    ],
  },
  {
    id: "devolucao-veiculo",
    title: "Passo a passo: receber a devolução",
    summary:
      "Como rodar a inspeção de retorno, comparar com a saída e fechar a reserva sem deixar nada passar.",
    icon: ClipboardCheck,
    duration: 6,
    category: "Operacional",
    steps: [
      {
        title: "Receba o cliente com calma",
        body:
          "Cumprimente, pergunte como foi a viagem. Antes de abrir o sistema, dê uma volta visual no carro com o cliente ao lado, olhando todas as faces. Esse momento define o tom do encerramento — relaxado e atento ao mesmo tempo.",
      },
      {
        title: "Inicie a devolução no sistema",
        body:
          "Localize a reserva (em Operação > Devoluções de hoje, ou em Reservas buscando pelo nome) e clique em 'Devolução'. O sistema abre a mesma vista do veículo, agora em modo retorno.",
      },
      {
        title: "Compare lado a lado",
        body:
          "Use o botão 'Comparar com saída' para ver todas as marcações anteriores em cinza. Qualquer marca nova que você notar é uma avaria de devolução — registre clicando no pin da peça, sempre com foto antes de marcar.",
        highlights: [
          "Foto geral da peça inteira",
          "Foto média a cerca de 1 metro de distância",
          "Foto de perto mostrando o detalhe da avaria",
        ],
      },
      {
        title: "Combustível e quilometragem",
        body:
          "Atualize o combustível e a quilometragem. Se o cliente devolveu com menos combustível do que recebeu, o sistema calcula automaticamente a taxa de reabastecimento. KM rodado acima da franquia também é somado sozinho.",
      },
      {
        title: "Conferir acessórios devolvidos",
        body:
          "Cheque a aba 'Acessórios' e marque o que voltou. Se faltar cadeirinha, GPS ou qualquer item, registre como 'não devolvido' — o sistema aplica a taxa de reposição conforme o contrato.",
      },
      {
        title: "Feche e envie o resumo",
        body:
          "Clique em 'Finalizar devolução'. O cliente recebe por e-mail o resumo completo com fotos, valores e nota fiscal. A reserva passa para 'Concluída' e o veículo automaticamente entra em 'Em preparação' para a próxima locação.",
      },
      {
        title: "Encaminhe para preparação",
        body:
          "Leve o carro para a área de preparação. Se houver avaria que precise de oficina, abra um chamado em 'Frota > Manutenção' descrevendo o que aconteceu e anexando as fotos da devolução.",
      },
    ],
  },
  {
    id: "mapa-avarias",
    title: "Mapa de avarias: domine a ferramenta",
    summary:
      "Truques para usar o viewer de avarias de forma rápida e precisa em qualquer inspeção.",
    icon: Camera,
    duration: 4,
    category: "Operacional",
    steps: [
      {
        title: "Os três ângulos",
        body:
          "No topo do viewer você tem três botões: Frontal, Traseira e Superior. Use os três sempre — cada um cobre peças diferentes. A vista superior é a melhor para teto, capô, porta-malas e rodas.",
        highlights: [
          "Frontal — capô, para-choque, faróis, lado esquerdo",
          "Traseira — porta-malas, lanternas, lado direito",
          "Superior — teto, parte de cima e rodas",
        ],
      },
      {
        title: "Os pins clicáveis",
        body:
          "Cada bolinha sobre o carro é uma peça. Passe o mouse para ver o nome. Clique para abrir o formulário e registrar a avaria com nível, descrição e fotos.",
      },
      {
        title: "Pin dourado = peça já com registro",
        body:
          "Quando uma peça já tem avaria registrada, o pin fica dourado com a contagem dentro. Pode clicar de novo para adicionar mais uma avaria na mesma peça — é comum quando o cliente bate em mais de um ponto da mesma porta, por exemplo.",
      },
      {
        title: "Boas práticas de foto",
        body:
          "Sempre 3 fotos por avaria: uma geral mostrando a peça inteira, uma média de 1 metro, e uma de perto para o detalhe. Boa iluminação resolve 90% dos problemas — evite contraluz e limpe o local antes.",
        highlights: [
          "Evite contraluz e reflexos no para-brisa",
          "Limpe a peça antes de fotografar",
          "Inclua uma régua ou moeda quando der, para escala",
        ],
        caption:
          "Foto ruim é prova fraca. Foto boa fecha qualquer discussão.",
      },
    ],
  },
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
          "No menu lateral, clique em 'Agenda'. Você vê uma grade no estilo calendário, com cada reserva ocupando o veículo durante o período locado. Use para visualizar a semana inteira de uma vez.",
        cta: { label: "Abrir Agenda", to: "/admin/calendar" },
      },
      {
        title: "Identifique gargalos",
        body:
          "Procure por dias com várias entregas ou devoluções concentradas no mesmo horário. Sábado de manhã e segunda à noite costumam ser pesados. Avise o gestor se você precisar de reforço.",
      },
      {
        title: "Separe chaves com antecedência",
        body:
          "Na véspera, abra a Agenda do dia seguinte, identifique todas as entregas previstas e separe as chaves no painel. Isso economiza minutos cruciais quando o cliente chega com pressa.",
      },
    ],
  },
  {
    id: "duvidas-comuns",
    title: "Dúvidas comuns do dia a dia",
    summary:
      "Respostas rápidas para as situações que mais aparecem no balcão da Zeus.",
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
      },
      {
        title: "Cliente quer estender por telefone",
        body:
          "Pergunte o número da reserva ou o nome completo, abra em 'Reservas', confirme dados e siga o passo de Extensão. Sempre confirme o pagamento da diferença antes de salvar — geralmente cartão na hora, registrado em 'Pagamentos' da reserva.",
      },
    ],
  },
];
