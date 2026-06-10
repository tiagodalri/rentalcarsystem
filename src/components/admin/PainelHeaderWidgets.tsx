import { useEffect, useState } from "react";
import { Clock, DollarSign, Cloud, Sun, CloudRain, CloudSnow, CloudFog, CloudLightning, type LucideIcon } from "lucide-react";

/**
 * Compact widget strip for the Painel header:
 * Orlando time · Brazil time · USD→BRL rate · Orlando temperature.
 * All data is fetched client-side with sensible caching; failures degrade silently.
 */

const RATE_CACHE_KEY = "painel_widget_rate";
const RATE_TTL = 30 * 60 * 1000; // 30 min
const WEATHER_CACHE_KEY = "painel_widget_weather";
const WEATHER_TTL = 15 * 60 * 1000; // 15 min

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
  // WMO weather interpretation codes (open-meteo)
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

function Widget({
  icon: Icon,
  label,
  value,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/40 bg-card/40 backdrop-blur-sm min-w-0">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" strokeWidth={1.75} />
      <div className="flex flex-col leading-tight min-w-0">
        <span className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground/70 truncate">
          {label}
        </span>
        <span className="text-[12px] font-medium tabular-nums text-foreground truncate">
          {loading ? "—" : value}
        </span>
      </div>
    </div>
  );
}

export function PainelHeaderWidgets() {
  const orlandoTime = useClock("America/New_York");
  const brazilTime = useClock("America/Sao_Paulo");
  const rate = useUsdBrl();
  const weather = useOrlandoWeather();
  const WIcon = weather ? weatherIcon(weather.code) : Cloud;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
      <Widget icon={Clock} label="Orlando" value={orlandoTime} />
      <Widget icon={Clock} label="Brasil" value={brazilTime} />
      <Widget
        icon={DollarSign}
        label="USD → BRL"
        value={rate ? `R$ ${rate.toFixed(2).replace(".", ",")}` : "—"}
        loading={!rate}
      />
      <Widget
        icon={WIcon}
        label="Orlando"
        value={weather ? `${Math.round(weather.tempC)}°C` : "—"}
        loading={!weather}
      />
    </div>
  );
}
