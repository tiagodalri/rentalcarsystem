// Roteiro do Tour Guiado de vendas — copy editável em um único lugar.
// Cada ato navega para a rota real do app antes de exibir o cartão.

export interface TourStep {
  id: string;
  /** Label curto para a barra de bullets no topo. */
  bullet: string;
  /** Rota que o app deve exibir por trás do overlay. */
  route: string;
  /** Pergunta/título estratégico. */
  title: string;
  /** Bullets de dor/diferencial. */
  pains: string[];
  /** Linha de fecho. */
  teaser: string;
  /** Layout especial. "intro" abre o tour; "price" entra na Sala de Fechamento (tema escuro). */
  kind?: "intro" | "price";
  eyebrow?: string;
  brand?: string;
  statement?: string;
  /** Variante da tela de preço (usada quando kind === "price"). */
  priceVariant?:
    | "confirmacao"
    | "combined"
    | "investment"
    | "loss"
    | "turn"
    | "founder"
    | "maintenance"
    | "decision";
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "abertura",
    bullet: "Abertura",
    route: "/admin",
    kind: "intro",
    eyebrow: "Dados · Inteligência Artificial · Metrificação",
    brand: "GoDalz Solutions",
    statement:
      "Não entregamos um sistema. Entregamos visão, informação e escala pra sua operação.",
    title: "",
    pains: [
      "Especialistas em transformar dados em decisões.",
      "O que hoje vive espalhado e desorganizado, a gente vira decisão.",
      "Métricas agrupadas de um jeito que nenhuma plataforma entrega.",
    ],
    teaser: "Nos próximos minutos, a sua frota vista pela primeira vez de verdade.",
  },
  {
    id: "seguranca",
    bullet: "Segurança",
    route: "/admin/live",
    title: "Você sabe onde estão seus carros neste exato momento?",
    pains: [
      "Cada carro no mapa, ao vivo, agora: quem está rodando e quem está parado.",
      "O trajeto de ontem inteiro: por onde andou, a que velocidade e onde freou forte.",
      "Aviso na hora quando um carro se move sem nenhuma reserva.",
      "Cerca virtual: o sistema avisa se o carro sai da região combinada.",
      "Saúde do veículo sempre à mão: combustível, bateria e quilometragem.",
      "Na entrega e na devolução, o funcionário tira as fotos e elas ficam guardadas.",
      "A IA lê o nível de combustível e a quilometragem direto da foto do painel.",
      "Quem pegou cada carro fica registrado, com selfie e motivo.",
      "Um prontuário completo de cada veículo, guardado pra sempre.",
    ],
    teaser: "Você para de confiar na palavra dos outros e passa a confiar nos fatos.",
  },
  {
    id: "gestao",
    bullet: "Gestão",
    route: "/admin/bookings",
    title: "Sua operação inteira cabe numa tela só?",
    pains: [
      "Turo, reservas diretas e agenda, tudo junto.",
      "Cada reserva com ganho, caução, combustível e milhas.",
      "Fotos de entrega e devolução anexadas na reserva.",
      "Calendário visual de quem sai e quem volta.",
      "Base de clientes com histórico e aniversários.",
      "Pedágios importados sozinhos.",
      "Contratos gerados e assinados dentro do sistema.",
    ],
    teaser: "Acaba a bagunça de cinco planilhas abertas ao mesmo tempo.",
  },
  {
    id: "financeiro",
    bullet: "Financeiro",
    route: "/admin/costs",
    title: "Qual carro te dá lucro, e qual te dá prejuízo?",
    pains: [
      "O sistema enxerga o lucro real de cada carro, não só a diária.",
      "Mostra de onde sai a sua maior despesa.",
      "Aponta os carros que mais rendem e os que só dão custo.",
      "Calcula o preço de cada dia que o carro fica parado.",
      "Soma o dinheiro perdido em cancelamento e ociosidade.",
      "Payback e retorno de cada veículo.",
      "Recibo lançado por foto, sem digitar nada.",
    ],
    teaser: "É aqui que o dinheiro invisível aparece.",
  },
  {
    id: "frota-inteligente",
    bullet: "Frota Inteligente",
    route: "/admin/frota-inteligente",
    title: "E se a inteligência artificial te dissesse o que fazer?",
    pains: [
      "A IA lê a frota inteira e resume em segundos.",
      "Mostra que a maior parte da receita vem de poucos carros.",
      "Aponta quais estão te sangrando em silêncio.",
      "Recomenda o que trocar, promover e ajustar na semana.",
      "O simulador testa vender os fracos e comprar os campeões.",
      "E projeta quanto você ganharia a mais, com os seus números.",
    ],
    teaser: "A decisão que levava meses de conta, agora na palma da mão.",
  },
  {
    id: "fechamento",
    bullet: "Fechamento",
    route: "/admin/frota-inteligente",
    title: "Agora, a melhor parte.",
    pains: [
      "Cada carro da sua frota sob controle, ao vivo.",
      "Cada real de lucro e de custo, visível pela primeira vez.",
      "A inteligência te dizendo, toda semana, o que fazer.",
    ],
    teaser: "Agora vamos falar de quanto custa colocar tudo isso na sua operação. Prepara, porque o número vai te surpreender.",
  },
  {
    id: "preco-combinado",
    bullet: "Combinado",
    route: "/admin/frota-inteligente",
    kind: "price",
    priceVariant: "combined",
    title: "Antes dos números, um acordo.",
    pains: [],
    teaser: "",
  },
  {
    id: "preco-investimento",
    bullet: "Investimento",
    route: "/admin/frota-inteligente",
    kind: "price",
    priceVariant: "investment",
    title: "Quanto custa ter um sistema desse nível na sua operação?",
    pains: [],
    teaser: "",
  },
  {
    id: "preco-perda",
    bullet: "Perda",
    route: "/admin/frota-inteligente",
    kind: "price",
    priceVariant: "loss",
    title: "E quanto isso está te custando, sem você ver?",
    pains: [],
    teaser: "",
  },
  {
    id: "preco-virada",
    bullet: "Virada",
    route: "/admin/frota-inteligente",
    kind: "price",
    priceVariant: "turn",
    title: "A GoDalz está em expansão nos Estados Unidos.",
    pains: [],
    teaser: "",
  },
  {
    id: "preco-fundador",
    bullet: "Fundador",
    route: "/admin/frota-inteligente",
    kind: "price",
    priceVariant: "founder",
    title: "A sua condição de fundador.",
    pains: [],
    teaser: "",
  },
  {
    id: "preco-manutencao",
    bullet: "Manutenção",
    route: "/admin/frota-inteligente",
    kind: "price",
    priceVariant: "maintenance",
    title: "E pra manter tudo rodando, evoluindo e seguro.",
    pains: [],
    teaser: "",
  },
  {
    id: "preco-decisao",
    bullet: "Decisão",
    route: "/admin/frota-inteligente",
    kind: "price",
    priceVariant: "decision",
    title: "A decisão que combinamos no começo.",
    pains: [],
    teaser: "",
  },
];
