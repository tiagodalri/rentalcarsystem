import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export type Currency = "USD" | "BRL";

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  toggleCurrency: () => void;
  formatPrice: (usdAmount: number) => string;
  formatPriceValue: (usdAmount: number) => number;
  formatPriceIn: (usdAmount: number, c: Currency) => string;
  currencySymbol: string;
  exchangeRate: number | null;
  loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const STORAGE_KEY = "zeus_currency";
const RATE_CACHE_KEY = "zeus_exchange_rate";
const RATE_CACHE_TTL = 1000 * 60 * 60; // 1 hour
const MARKUP = 1.10; // +10%

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as Currency) || "USD";
    } catch {
      return "USD";
    }
  });

  const [exchangeRate, setExchangeRate] = useState<number | null>(() => {
    try {
      const cached = localStorage.getItem(RATE_CACHE_KEY);
      if (cached) {
        const { rate, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < RATE_CACHE_TTL) return rate;
      }
    } catch {}
    return null;
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchRate = async () => {
      // Only fetch if we don't have a cached rate or it's expired
      try {
        const cached = localStorage.getItem(RATE_CACHE_KEY);
        if (cached) {
          const { rate, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < RATE_CACHE_TTL) {
            setExchangeRate(rate);
            return;
          }
        }
      } catch {}

      setLoading(true);
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/USD");
        const data = await res.json();
        if (data?.rates?.BRL) {
          const rate = data.rates.BRL * MARKUP;
          setExchangeRate(rate);
          localStorage.setItem(RATE_CACHE_KEY, JSON.stringify({ rate, timestamp: Date.now() }));
        }
      } catch {
        // Fallback rate if API fails
        if (!exchangeRate) {
          const fallback = 5.7 * MARKUP;
          setExchangeRate(fallback);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchRate();
  }, []);

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c);
    try { localStorage.setItem(STORAGE_KEY, c); } catch {}
  }, []);

  const toggleCurrency = useCallback(() => {
    setCurrency(currency === "USD" ? "BRL" : "USD");
  }, [currency, setCurrency]);

  const currencySymbol = currency === "USD" ? "US$" : "R$";

  const formatPriceValue = useCallback(
    (usdAmount: number): number => {
      if (currency === "USD") return usdAmount;
      if (!exchangeRate) return usdAmount;
      return Math.ceil(usdAmount * exchangeRate);
    },
    [currency, exchangeRate]
  );

  const formatPrice = useCallback(
    (usdAmount: number): string => {
      const value = formatPriceValue(usdAmount);
      if (currency === "BRL") {
        return `R$ ${value.toLocaleString("pt-BR")}`;
      }
      return `US$ ${value.toLocaleString("en-US")}`;
    },
    [currency, formatPriceValue]
  );

  const formatPriceIn = useCallback(
    (usdAmount: number, c: Currency): string => {
      if (c === "BRL") {
        const v = exchangeRate ? Math.ceil(usdAmount * exchangeRate) : usdAmount;
        return `R$ ${v.toLocaleString("pt-BR")}`;
      }
      return `US$ ${usdAmount.toLocaleString("en-US")}`;
    },
    [exchangeRate]
  );

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, toggleCurrency, formatPrice, formatPriceValue, formatPriceIn, currencySymbol, exchangeRate, loading }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
  return ctx;
}
