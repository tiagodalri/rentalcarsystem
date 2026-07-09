/**
 * Demo mode global configuration.
 *
 * Este projeto é uma cópia (remix) da plataforma real da Sua Marca,
 * usada exclusivamente como ambiente de demonstração para apresentações
 * comerciais. Nenhuma integração externa (Bouncie, Stripe, ClickSign,
 * CambioReal, Resend, Google Maps, E-Pass) está conectada — tudo é
 * simulado sobre dados fictícios persistentes no banco.
 */

export const DEMO_MODE = true;

/** Configurações do simulador de rastreamento. */
export const DEMO_TRACKER = {
  /** Intervalo entre "pings" simulados — 4s para movimento fluido em apresentação. */
  intervalMs: 4_000,
  /** Delta máximo de posição por tick. */
  maxLatDelta: 0.006,
  maxLngDelta: 0.006,
  /** Faixa de velocidade para veículos em movimento (mph). */
  minSpeed: 18,
  maxSpeed: 72,
  /** Chance de um veículo ficar parado neste tick (sinaleiro / trânsito). */
  idleChance: 0.15,
} as const;
