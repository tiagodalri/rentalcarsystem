// Roteiro do Tour Guiado de vendas — copy editável em um único lugar.
// Cada ato navega para a rota real do app antes de exibir o cartão.

export interface TourStep {
  id: string;
  /** Label curto para a barra de bullets no topo. */
  bullet: string;
  /** Rota que o app deve exibir por trás do overlay. */
  route: string;
  /** Título grande do cartão. */
  headline: string;
  /** Subtexto do cartão. */
  subtext: string;
  /** Se este ato é o clímax (recebe destaque visual extra). */
  climax?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "abertura",
    bullet: "Abertura",
    route: "/admin",
    headline: "Toda frota tem dinheiro invisível.",
    subtext:
      "Noites em que o carro dorme parado. Custo que ninguém somou. Um carro que parece dar lucro, mas não dá. Não é falta de gestão: é que enxergar isso no olho humano é impossível. Nos próximos minutos, você vai ver sua operação com outra visão — a do sistema. Quantos carros você tem hoje na frota?",
  },
  {
    id: "seguranca",
    bullet: "Segurança",
    route: "/admin/live",
    headline: "Segurança — onde estão seus ativos, agora.",
    subtext:
      "Sua frota inteira no mapa, em tempo real. Quem roda, quem parou, por onde andou — do sofá da sua casa, 2 da manhã. O trajeto de ontem guardado: velocidade, paradas, freadas. E se um carro se move sem reserva? O sistema te avisa. Você para de depender da palavra de ninguém.",
  },
  {
    id: "gestao",
    bullet: "Gestão",
    route: "/admin/bookings",
    headline: "Gestão — sua operação inteira numa casa só.",
    subtext:
      "Seu Turo continua trazendo cliente lá fora. Aqui dentro, tudo se junta: reservas, agenda, quem sai e quem volta. Cada reserva com o resultado completo — quanto rendeu, caução, combustível, milhas, fotos de entrega e devolução.",
  },
  {
    id: "financeiro",
    bullet: "Financeiro",
    route: "/admin/costs",
    headline: "Financeiro — cada carro é um ativo.",
    subtext:
      "Entra dinheiro, sai dinheiro. Mas qual carro puxou o resultado e qual carregou o prejuízo? Aqui você vê o lucro real de cada veículo, o custo de cada noite parado, e o dinheiro que ficou na mesa.",
  },
  {
    id: "frota-inteligente",
    bullet: "Frota Inteligente",
    route: "/admin/frota-inteligente",
    headline: "Frota Inteligente — o dinheiro invisível, revelado.",
    subtext:
      "A IA lê sua frota por você. Mostra que a maior parte da sua receita vem de poucos carros — e quais estão te sangrando em silêncio. E o simulador: venda os fracos, compre os campeões, e veja quanto você ganharia a mais. Sem achismo — com os seus números.",
    climax: true,
  },
  {
    id: "fechamento",
    bullet: "Fechamento",
    route: "/admin/frota-inteligente",
    headline: "Sua frota, agora com a luz acesa.",
    subtext:
      "No começo você não sabia qual carro dava lucro ou prejuízo. Agora sabe — e pra sempre. Só sobra uma pergunta: seguir no escuro, ou acender a luz hoje?",
  },
];
