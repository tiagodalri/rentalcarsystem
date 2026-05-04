import type { TooltipProps } from "recharts";

const tooltipStyle: React.CSSProperties = {
  backgroundColor: "hsl(var(--card) / 0.95)",
  border: "1px solid hsl(var(--border) / 0.4)",
  borderRadius: 8,
  fontSize: 12,
  color: "hsl(var(--foreground))",
  backdropFilter: "blur(8px)",
  boxShadow: "0 4px 16px hsl(0 0% 0% / 0.3)",
};

const labelStyle: React.CSSProperties = {
  color: "hsl(var(--muted-foreground))",
  fontSize: 11,
  marginBottom: 2,
};

const itemStyle: React.CSSProperties = {
  color: "hsl(var(--foreground))",
  fontWeight: 600,
  padding: 0,
};

/** Shared dark-themed tooltip props for all Recharts charts. Spread onto <Tooltip />. */
export const darkTooltipProps: Partial<TooltipProps<number, string>> = {
  contentStyle: tooltipStyle,
  labelStyle,
  itemStyle,
  cursor: { fill: "hsl(var(--muted) / 0.3)" },
  animationDuration: 150,
  wrapperStyle: { outline: "none" },
};
