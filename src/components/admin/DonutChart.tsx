import { useState, useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Sector,
  Tooltip,
} from "recharts";
import { TrendingUp } from "lucide-react";

export interface DonutDatum {
  name: string;
  value: number;
  color: string;
}

interface Props {
  data: DonutDatum[];
  title: string;
  unit?: string;
  height?: number;
}

const RADIAN = Math.PI / 180;

const renderActiveShape = (props: any) => {
  const {
    cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle,
    fill, payload, percent, value,
  } = props;

  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 6) * cos;
  const sy = cy + (outerRadius + 6) * sin;
  const mx = cx + (outerRadius + 14) * cos;
  const my = cy + (outerRadius + 14) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 10;
  const ey = my;
  const textAnchor = cos >= 0 ? "start" : "end";

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 5}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: "drop-shadow(0 2px 6px hsl(0 0% 0% / 0.25))" }}
      />
      <path
        d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`}
        stroke={fill}
        fill="none"
        strokeWidth={1.5}
      />
      <circle cx={ex} cy={ey} r={3} fill={fill} stroke="none" />
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 6}
        y={ey}
        textAnchor={textAnchor}
        fill="hsl(var(--foreground))"
        fontSize={12}
        fontWeight={600}
      >
        {payload.name}
      </text>
      <text
        x={ex + (cos >= 0 ? 1 : -1) * 6}
        y={ey}
        dy={16}
        textAnchor={textAnchor}
        fill="hsl(var(--muted-foreground))"
        fontSize={11}
      >
        {`${(percent * 100).toFixed(1)}%`}
      </text>
    </g>
  );
};

const DonutTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const d = p?.payload as DonutDatum;
  const total = p?.payload?.__total ?? 0;
  const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
  return (
    <div
      className="rounded-lg border border-border/50 bg-card/95 backdrop-blur-md px-3 py-2 shadow-lg"
      style={{ fontSize: 12 }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{ background: d.color }}
        />
        <span className="font-semibold text-foreground">{d.name}</span>
      </div>
      <div className="text-muted-foreground text-[11px]">
        Valor: <span className="text-foreground font-medium">${d.value.toLocaleString()}</span>
      </div>
      <div className="text-muted-foreground text-[11px]">
        Participação: <span className="text-foreground font-medium">{pct}%</span>
      </div>
    </div>
  );
};

export default function DonutChart({ data, title, unit = "$", height = 320 }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);
  const total = data.reduce((s, d) => s + d.value, 0);

  const dataWithTotal = data.map((d) => ({ ...d, __total: total }));

  const onPieEnter = useCallback((_: any, index: number) => {
    setActiveIndex(index);
  }, []);

  const onPieLeave = useCallback(() => {
    setActiveIndex(undefined);
  }, []);

  if (data.length === 0) return null;

  return (
    <div className="flex flex-col lg:flex-row items-center gap-6">
      {/* Chart */}
      <div className="relative w-full lg:w-1/2 donut-chart-wrap" style={{ minHeight: height }}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
            <Pie
              activeIndex={activeIndex}
              activeShape={renderActiveShape}
              data={dataWithTotal}
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="82%"
              paddingAngle={2}
              dataKey="value"
              onMouseEnter={onPieEnter}
              onMouseLeave={onPieLeave}
              animationBegin={100}
              animationDuration={600}
              isAnimationActive
            >
              {dataWithTotal.map((entry, i) => (
                <Cell key={i} fill={entry.color} stroke="hsl(var(--card))" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-medium">
            {title}
          </span>
          <span className="text-xl tabular-nums tracking-tight text-foreground font-medium mt-0.5">
            {unit}{total.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="w-full lg:w-1/2 space-y-2">
        {data.map((d, i) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          const isActive = activeIndex === i;
          return (
            <button
              key={d.name}
              className={`w-full text-left rounded-lg border px-3 py-2 transition-all duration-200 ${
                isActive
                  ? "bg-muted/60 border-border shadow-sm"
                  : "bg-transparent border-transparent hover:bg-muted/40 hover:border-border/40"
              }`}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(undefined)}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="shrink-0 w-2.5 h-2.5 rounded-full"
                    style={{ background: d.color, boxShadow: `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${d.color}40` }}
                  />
                  <span className="text-sm text-foreground truncate">{d.name}</span>
                </div>
                <span className="text-xs tabular-nums text-muted-foreground shrink-0 ml-2">
                  {pct.toFixed(1)}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: d.color,
                    opacity: isActive ? 1 : 0.75,
                  }}
                />
              </div>
              <div className="mt-1 text-xs tabular-nums text-muted-foreground">
                {unit}{d.value.toLocaleString()}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
