export const fmtUSD = (n: number | null | undefined) =>
  `US$ ${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtUSDCompact = (n: number | null | undefined) =>
  `US$ ${Math.round(Number(n ?? 0)).toLocaleString("en-US")}`;
