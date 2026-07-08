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
  /** Clímax recebe destaque extra. */
  climax?: boolean;
  /** Layout especial para abertura. */
  kind?: "intro";
  eyebrow?: string;
  brand?: string;
  statement?: string;
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
      "Especialistas em transformar operação em dados.",
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
      "Cada carro no mapa, ao vivo, agora.",
      "O trajeto de ontem inteiro: por onde andou, velocidade, freadas.",
      "Aviso na hora quando um carro se move sem reserva.",
      "Cerca virtual que avisa se o carro sai da região.",
      "Saúde do veículo: combustível, bateria, quilometragem.",
      "Inspeção com foto na entrega e na devolução.",
      "A IA lê o combustível e o hodômetro direto da foto.",
      "Quem pegou o carro fica registrado, com selfie e motivo.",
      "Um prontuário completo de cada veículo, pra sempre.",
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
    climax: true,
  },
  {
    id: "fechamento",
    bullet: "Fechamento",
    route: "/admin/frota-inteligente",
    title: "Continuar no escuro, ou crescer com dados?",
    pains: [
      "Antes, decisão no achismo.",
      "Agora, cada escolha com número por trás.",
    ],
    teaser: "A inteligência já está pronta. Falta você usar.",
  },
];
