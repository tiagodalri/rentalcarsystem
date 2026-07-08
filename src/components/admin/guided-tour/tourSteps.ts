// Roteiro do Tour Guiado de vendas — copy editável em um único lugar.
// Cada ato navega para a rota real do app antes de exibir o cartão.
// Estrutura de venda: 1 pergunta/título estratégico + 2-3 dores curtas + 1 teaser.

export interface TourStep {
  id: string;
  /** Label curto para a barra de bullets no topo. */
  bullet: string;
  /** Rota que o app deve exibir por trás do overlay. */
  route: string;
  /** Pergunta/título estratégico — headline grande do cartão. */
  title: string;
  /** 2 a 3 dores curtas (bullets) — o que o Turo não resolve. */
  pains: string[];
  /** Uma linha de fecho que gera expectativa. */
  teaser: string;
  /** Se este ato é o clímax (recebe destaque visual extra). */
  climax?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "abertura",
    bullet: "Abertura",
    route: "/admin",
    title: "Quanto da sua frota você realmente enxerga?",
    pains: [
      "Carros que dormem parados — e ninguém soma o custo.",
      "Um carro que parece dar lucro e, no fim do mês, não dá.",
      "Decisão no achismo, porque no olho humano é impossível ver tudo.",
    ],
    teaser: "Nos próximos minutos, sua frota num raio-x.",
  },
  {
    id: "seguranca",
    bullet: "Segurança",
    route: "/admin/live",
    title: "Onde está cada carro seu — agora?",
    pains: [
      "No Turo, entre uma locação e outra, você fica no escuro.",
      "Aqui: cada carro no mapa, em tempo real, do sofá de casa.",
      "Carro andou sem reserva? O sistema te avisa.",
    ],
    teaser: "Você para de depender da palavra dos outros.",
  },
  {
    id: "gestao",
    bullet: "Gestão",
    route: "/admin/bookings",
    title: "Sua operação inteira — numa tela só.",
    pains: [
      "O Turo traz o cliente; aqui você comanda a operação.",
      "Reservas, agenda, quem sai e quem volta, num lugar só.",
      "Cada reserva com o resultado completo: ganho, caução, milhas, fotos.",
    ],
    teaser: "Fim das cinco abas abertas ao mesmo tempo.",
  },
  {
    id: "financeiro",
    bullet: "Financeiro",
    route: "/admin/costs",
    title: "Qual carro te dá lucro — e qual te dá prejuízo?",
    pains: [
      "O Turo te mostra a diária. Não te mostra o LUCRO real de cada carro.",
      "Aqui: lucro por veículo, custo da noite parada, dinheiro na mesa.",
      "Cada carro é um ativo — com extrato próprio.",
    ],
    teaser: "É aqui que o dinheiro invisível começa a aparecer.",
  },
  {
    id: "frota-inteligente",
    bullet: "Frota Inteligente",
    route: "/admin/frota-inteligente",
    title: "E se a IA te dissesse exatamente o que trocar?",
    pains: [
      "80% da sua receita vem de poucos carros — e alguns te sangram em silêncio.",
      "A IA lê tudo e te diz o que fazer.",
      "O simulador: venda os fracos, compre os campeões, e veja o ganho com os SEUS números.",
    ],
    teaser: "Sem achismo. A decisão na palma da mão.",
    climax: true,
  },
  {
    id: "fechamento",
    bullet: "Fechamento",
    route: "/admin/frota-inteligente",
    title: "Seguir no escuro, ou acender a luz hoje?",
    pains: [
      "No começo, você não sabia qual carro dava lucro ou prejuízo.",
      "Agora sabe — e pra sempre.",
    ],
    teaser: "A luz já está acesa. Falta você decidir usá-la.",
  },
];
