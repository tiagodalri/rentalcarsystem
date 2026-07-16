import { useEffect, useState } from "react";
import {
  Clock,
  DollarSign,
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  CloudFog,
  CloudLightning,
  type LucideIcon,
} from "lucide-react";


/**
 * CNN-style colorful news ticker.
 * Full-width banner with a vivid AI-generated background, a pulsing "AO VIVO"
 * badge on the left and an infinite marquee with: Orlando time, Brasil time,
 * USD→BRL rate and Orlando weather.
 */

const RATE_CACHE_KEY = "painel_widget_rate";
const RATE_TTL = 5 * 60 * 1000; // 5 min. AwesomeAPI atualiza em quase tempo real
const WEATHER_CACHE_KEY = "painel_widget_weather";
const WEATHER_TTL = 15 * 60 * 1000;

function useClock(timeZone: string) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
}

function useUsdBrl() {
  const [rate, setRate] = useState<number | null>(() => {
    try {
      const raw = sessionStorage.getItem(RATE_CACHE_KEY);
      if (!raw) return null;
      const { rate, timestamp } = JSON.parse(raw);
      if (Date.now() - timestamp < RATE_TTL) return rate;
      return null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (rate !== null) return;
    let cancelled = false;
    (async () => {
      // Fonte primária: AwesomeAPI (PTAX-like, atualizada em segundos, padrão no Brasil)
      try {
        const res = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL");
        const data = await res.json();
        const bid = parseFloat(data?.USDBRL?.bid);
        if (!cancelled && Number.isFinite(bid) && bid > 0) {
          setRate(bid);
          try {
            sessionStorage.setItem(
              RATE_CACHE_KEY,
              JSON.stringify({ rate: bid, timestamp: Date.now() }),
            );
          } catch {}
          return;
        }
      } catch {
        /* fallback abaixo */
      }
      // Fallback: open.er-api.com (caso a AwesomeAPI esteja fora do ar)
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        const data = await res.json();
        const brl = data?.rates?.BRL;
        if (!cancelled && typeof brl === "number") {
          setRate(brl);
          try {
            sessionStorage.setItem(
              RATE_CACHE_KEY,
              JSON.stringify({ rate: brl, timestamp: Date.now() }),
            );
          } catch {}
        }
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rate]);

  return rate;
}

type Weather = { tempC: number; code: number } | null;

function weatherIcon(code: number) {
  if (code === 0) return Sun;
  if ([1, 2, 3].includes(code)) return Cloud;
  if ([45, 48].includes(code)) return CloudFog;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return CloudRain;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return CloudSnow;
  if ([95, 96, 99].includes(code)) return CloudLightning;
  return Cloud;
}

function useOrlandoWeather() {
  const [w, setW] = useState<Weather>(() => {
    try {
      const raw = sessionStorage.getItem(WEATHER_CACHE_KEY);
      if (!raw) return null;
      const { data, timestamp } = JSON.parse(raw);
      if (Date.now() - timestamp < WEATHER_TTL) return data;
      return null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (w) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=28.5383&longitude=-81.3792&current=temperature_2m,weather_code&temperature_unit=celsius",
        );
        const data = await res.json();
        const tempC = data?.current?.temperature_2m;
        const code = data?.current?.weather_code;
        if (!cancelled && typeof tempC === "number" && typeof code === "number") {
          const wx = { tempC, code };
          setW(wx);
          try {
            sessionStorage.setItem(
              WEATHER_CACHE_KEY,
              JSON.stringify({ data: wx, timestamp: Date.now() }),
            );
          } catch {}
        }
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [w]);

  return w;
}

function TickerItem({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 px-6 whitespace-nowrap">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" strokeWidth={2} />
      <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <span className="text-[12.5px] font-semibold tabular-nums text-foreground">
        {value}
      </span>
      <span className="text-border select-none ml-2" aria-hidden>
        ◆
      </span>
    </span>
  );
}

export function PainelHeaderWidgets() {
  const orlandoTime = useClock("America/New_York");
  const brazilTime = useClock("America/Sao_Paulo");
  const rate = useUsdBrl();
  const weather = useOrlandoWeather();
  const WIcon = weather ? weatherIcon(weather.code) : Cloud;

  const items = (
    <>
      <TickerItem icon={Clock} label="Orlando" value={orlandoTime} />
      <TickerItem icon={Clock} label="Brasil" value={brazilTime} />
      <TickerItem
        icon={DollarSign}
        label="USD → BRL"
        value={rate ? `R$ ${rate.toFixed(2).replace(".", ",")}` : ""}
      />
      <TickerItem
        icon={WIcon}
        label="Orlando"
        value={weather ? `${Math.round(weather.tempC)}°C` : ""}
      />
    </>
  );

  return (
    <div
      className="relative flex items-stretch w-full overflow-hidden h-9 select-none bg-card"
      role="status"
      aria-label="Informações ao vivo"
    >
      {/* AO VIVO pill. usa primary do tema */}
      <div className="relative flex items-center gap-2 px-3.5 bg-primary shrink-0">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75 animate-ping" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-foreground" />
        </span>
        <span className="text-[10px] font-semibold tracking-[0.22em] uppercase text-primary-foreground">
          Ao vivo
        </span>
      </div>

      {/* Subtle accent fade after the pill */}
      <div className="relative w-12 shrink-0 bg-gradient-to-r from-accent/40 to-transparent" aria-hidden />

      {/* Marquee track */}
      <div className="relative flex-1 overflow-hidden">
        <div className="flex h-full items-center animate-marquee whitespace-nowrap will-change-transform">
          <div className="flex items-center shrink-0">{items}</div>
          <div className="flex items-center shrink-0" aria-hidden>
            {items}
          </div>
        </div>
      </div>
    </div>
  );
}
