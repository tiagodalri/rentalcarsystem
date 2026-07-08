// Parâmetros econômicos do fechamento — edite aqui para ajustar a narrativa de preço.

export const PRICE_CONFIG = {
  sistemaValor: 30000,
  implantacaoPorCarro: 425,
  manutencaoPorCarroMes: 14,
  economiaPorCarroAnoMin: 988,
  economiaPorCarroAnoMax: 1726,
  diariaMediaRef: 85,
};

export const formatUSD = (n: number) =>
  `$${Math.round(n).toLocaleString("en-US")}`;
