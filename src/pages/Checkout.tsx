import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Barcode from "react-barcode";
import {
  ArrowLeft, Copy, Check, Loader2, QrCode, Barcode as BarcodeIcon,
  CreditCard, Lock, ShieldCheck, AlertTriangle, Calendar, MapPin, Car,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { detectBrand, formatCardNumber } from "@/lib/cardBrand";
import { useFormDraft } from "@/hooks/useFormDraft";

const CR_APP_ID = "1781587732";
const CR_APP_PUBLIC = "pk_production_3db3d2837eb1416e00d9880aae287e6e";
const CR_HASH_SCRIPT = "https://www.cambioreal.com/js/card-hash.js";

type AddressPayload = {
  zip_code?: string; street?: string; number?: string; complement?: string;
  district?: string; city?: string; state?: string;
};

type CheckoutState = {
  vehicle_id: string;
  start_at: string; // ISO local
  end_at: string;
  amount_usd: number;
  vehicleDisplay?: { name: string; image?: string; days?: number; pickupLocation?: string };
  customer?: {
    full_name?: string; email?: string; phone?: string;
    cpf?: string; birth_date?: string;
    address?: AddressPayload;
  };
};

type CheckoutClientDraft = {
  name: string;
  email: string;
  phone: string;
  cpf: string;
  birth: string;
};

const CHECKOUT_STATE_KEY = "zeus:checkout:last-state-v2";

function hasCheckoutState(s: Partial<CheckoutState> | null | undefined): s is CheckoutState {
  return Boolean(s?.vehicle_id && s?.start_at && s?.end_at && s?.amount_usd);
}

function readCheckoutState(): CheckoutState | null {
  try {
    const raw = localStorage.getItem(CHECKOUT_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CheckoutState;
    return hasCheckoutState(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function saveCheckoutState(state: CheckoutState) {
  try { localStorage.setItem(CHECKOUT_STATE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { CardHash?: any }
}

function onlyDigits(s: string) { return (s || "").replace(/\D/g, ""); }
function maskCPF(s: string) {
  const d = onlyDigits(s).slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function maskPhone(s: string) {
  const d = onlyDigits(s).slice(0, 13);
  if (d.length <= 11) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
  return "+" + d;
}

function formatBRL(n?: number | null) {
  if (n == null) return "";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}
function formatUSD(n?: number | null) {
  if (n == null) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const incomingState = (location.state || {}) as CheckoutState;
  const restoredCheckoutState = useMemo(() => readCheckoutState(), []);
  const state = hasCheckoutState(incomingState) ? incomingState : (restoredCheckoutState || incomingState);

  useEffect(() => {
    if (hasCheckoutState(incomingState)) saveCheckoutState(incomingState);
  }, [incomingState]);

  // Guard: missing required state
  useEffect(() => {
    if (!state.vehicle_id || !state.start_at || !state.end_at || !state.amount_usd) {
      toast.error("Dados da reserva ausentes. Volte e tente de novo.");
      navigate("/frota", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 1 — customer
  const [name, setName] = useState(state.customer?.full_name || "");
  const [email, setEmail] = useState(state.customer?.email || "");
  const [phone, setPhone] = useState(maskPhone(state.customer?.phone || ""));
  const [cpf, setCpf] = useState(maskCPF(state.customer?.cpf || ""));
  const [birth, setBirth] = useState(state.customer?.birth_date || "");
  const addr: AddressPayload = state.customer?.address || {};

  const checkoutDraftKey = useMemo(
    () => `checkout-client-v2:${state.vehicle_id || "missing"}:${state.start_at || ""}:${state.end_at || ""}`,
    [state.vehicle_id, state.start_at, state.end_at],
  );
  const checkoutClientDraft = useMemo<CheckoutClientDraft>(() => ({ name, email, phone, cpf, birth }), [name, email, phone, cpf, birth]);
  useFormDraft(
    checkoutDraftKey,
    checkoutClientDraft,
    (draft) => {
      setName(draft.name || "");
      setEmail(draft.email || "");
      setPhone(draft.phone || "");
      setCpf(draft.cpf || "");
      setBirth(draft.birth || "");
    },
    hasCheckoutState(state),
    {
      debounceMs: 120,
      restoreMode: hasCheckoutState(incomingState) ? "when-empty" : "always",
      isEmpty: (draft) => Object.values(draft).every((value) => !String(value ?? "").trim()),
    },
  );

  // If we already have all required data from /reserva, skip the redundant step.
  const prefilled =
    !!(state.customer?.full_name && state.customer?.email && state.customer?.cpf &&
       state.customer?.birth_date && state.customer?.phone &&
       addr.zip_code && addr.street && addr.number && addr.city && addr.state);

  const [step, setStep] = useState<"client" | "pay" | "success">(prefilled ? "pay" : "client");
  const [method, setMethod] = useState<"pix" | "boleto" | "card">("pix");

  // Quote (cached per payment_method) — LOCKED for 15 minutes once obtained.
  type Quote = {
    rate: number | null;
    result: number | null;
    iof?: number | null;
    installments?: any;
    fallback?: boolean;
    estimated?: boolean; // true while showing public estimate (no official yet)
    locked_until?: number; // ms timestamp; while in the future the quote is frozen
    error?: string;
  };

  // Persist locked quotes in localStorage so the same value survives reloads.
  const QUOTE_TTL_MS = 15 * 60 * 1000;
  function quoteCacheKey(pm: string) {
    return `zeus_cr_quote_${pm}_${Math.round(state.amount_usd * 100)}`;
  }
  function readCachedQuote(pm: string): Quote | null {
    try {
      const raw = localStorage.getItem(quoteCacheKey(pm));
      if (!raw) return null;
      const q: Quote = JSON.parse(raw);
      if (q.locked_until && q.locked_until > Date.now() && q.result != null) return q;
    } catch { /* noop */ }
    return null;
  }
  function writeCachedQuote(pm: string, q: Quote) {
    try { localStorage.setItem(quoteCacheKey(pm), JSON.stringify(q)); } catch { /* noop */ }
  }

  const [quotes, setQuotes] = useState<Record<string, Quote>>(() => {
    const out: Record<string, Quote> = {};
    (["pix", "boleto", "card"] as const).forEach((pm) => {
      const cached = readCachedQuote(pm);
      if (cached) out[pm] = cached;
    });
    return out;
  });
  const [quoteLoading, setQuoteLoading] = useState<Record<string, boolean>>({});
  // Tick used to re-render the countdown.
  const [, setNowTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(i);
  }, []);

  // Public BRL estimate (fast, never blocks UI)
  const [publicRate, setPublicRate] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    const FALLBACK_RATE = 5.45;
    (async () => {
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 2500);
        const r = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL", { signal: ctrl.signal });
        clearTimeout(to);
        const j = await r.json();
        const ask = Number(j?.USDBRL?.ask ?? j?.USDBRL?.bid);
        if (!cancelled && ask > 0) setPublicRate(ask);
        else if (!cancelled) setPublicRate(FALLBACK_RATE);
      } catch {
        if (!cancelled) setPublicRate(FALLBACK_RATE);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Build an estimated quote from the public rate (used while official is loading/failing)
  function buildEstimate(pm: "pix" | "boleto" | "card"): Quote | null {
    if (!publicRate) return null;
    const iofRate = pm === "card" ? 0.035 : 0.011;
    const spread = 1.02;
    const effective = publicRate * spread;
    const result = state.amount_usd * effective * (1 + iofRate);
    const iof = state.amount_usd * effective * iofRate;
    let installments: any = null;
    if (pm === "card") {
      installments = Array.from({ length: 12 }, (_, i) => {
        const n = i + 1;
        const monthly = n >= 4 ? 0.03 : 0;
        const total = result * (1 + monthly * (n - 1));
        return { installment: n, installment_amount: total / n, total, fee: total - result };
      });
    }
    return { rate: effective, result, iof, installments, estimated: true };
  }

  function quoteForMethod(m: "pix" | "boleto" | "card"): Quote | undefined {
    const real = quotes[m];
    // If we have a real (non-fallback) result, use it — locked or not.
    if (real && real.result != null && !real.fallback) return real;
    return buildEstimate(m) ?? real;
  }

  // Fetch official quote for a given method (no-op if cached & still locked)
  async function fetchQuote(pm: "pix" | "boleto" | "card", force = false) {
    if (!force) {
      const existing = quotes[pm];
      // Don't refetch a locked quote until it expires
      if (existing?.locked_until && existing.locked_until > Date.now() && existing.result != null) return;
      if (existing && !existing.fallback && existing.result != null) return;
      if (quoteLoading[pm]) return;
    }
    setQuoteLoading((s) => ({ ...s, [pm]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("cambioreal-simulator", {
        body: { amount: state.amount_usd, payment_method: pm },
      });
      if (error) {
        setQuotes((s) => ({ ...s, [pm]: { rate: null, result: null, fallback: true, error: error.message } }));
      } else if (data?.fallback || data?.error) {
        setQuotes((s) => ({ ...s, [pm]: { rate: null, result: null, fallback: true, error: data?.message || data?.error } }));
      } else {
        const q: Quote = {
          rate: data?.rate ?? null,
          result: data?.result ?? null,
          iof: data?.iof ?? null,
          installments: data?.installments ?? null,
          locked_until: Date.now() + QUOTE_TTL_MS,
        };
        setQuotes((s) => ({ ...s, [pm]: q }));
        writeCachedQuote(pm, q);
      }
    } catch (e: any) {
      setQuotes((s) => ({ ...s, [pm]: { rate: null, result: null, fallback: true, error: e?.message } }));
    } finally {
      setQuoteLoading((s) => ({ ...s, [pm]: false }));
    }
  }

  // Preload all 3 methods in parallel when entering pay step (only if not locked)
  const preloadedRef = useRef(false);
  useEffect(() => {
    if (step !== "pay" || preloadedRef.current) return;
    preloadedRef.current = true;
    Promise.allSettled([fetchQuote("pix"), fetchQuote("boleto"), fetchQuote("card")]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function recalcQuote() {
    try { localStorage.removeItem(quoteCacheKey(method)); } catch { /* noop */ }
    setQuotes((s) => { const c = { ...s }; delete c[method]; return c; });
    fetchQuote(method, true);
  }

  // Pix / Boleto state
  const [payLoading, setPayLoading] = useState<null | "pix" | "boleto" | "card">(null);
  const [payError, setPayError] = useState<string | null>(null);

  const [pixResult, setPixResult] = useState<any>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [pixSeconds, setPixSeconds] = useState<number | null>(null);
  const [pixPaid, setPixPaid] = useState(false);

  const [boletoResult, setBoletoResult] = useState<any>(null);
  const [boletoCopied, setBoletoCopied] = useState(false);

  // Card state
  const [cardScriptLoaded, setCardScriptLoaded] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [installments, setInstallments] = useState(1);
  const dfpIdRef = useRef<string>("");
  const [cardSuccess, setCardSuccess] = useState<any>(null);

  // bootstrap dfpId once
  useEffect(() => {
    if (!dfpIdRef.current) {
      dfpIdRef.current =
        "dfp_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
    }
  }, []);

  // Load card-hash.js once when card tab opened
  useEffect(() => {
    if (method !== "card" || cardScriptLoaded) return;
    const existing = document.querySelector(`script[src="${CR_HASH_SCRIPT}"]`);
    if (existing && window.CardHash) { setCardScriptLoaded(true); return; }
    const s = document.createElement("script");
    s.src = CR_HASH_SCRIPT;
    s.async = true;
    s.onload = () => setCardScriptLoaded(true);
    s.onerror = () => toast.error("Não foi possível carregar o módulo de cartão.");
    document.head.appendChild(s);
  }, [method, cardScriptLoaded]);


  // Polling for pix
  useEffect(() => {
    if (!pixResult?.cr_token || pixPaid) return;
    let t: number | undefined;
    const tick = async () => {
      try {
        const { data } = await supabase.functions.invoke("cambioreal-status", {
          body: { token: pixResult.cr_token },
        });
        if (data?.paid === true) {
          setPixPaid(true);
          setStep("success");
          return;
        }
      } catch (e) { /* ignore */ }
      t = window.setTimeout(tick, 4000);
    };
    t = window.setTimeout(tick, 4000);
    return () => { if (t) clearTimeout(t); };
  }, [pixResult, pixPaid]);

  // Countdown for pix
  useEffect(() => {
    if (!pixResult?.expires_at) { setPixSeconds(null); return; }
    const target = new Date(pixResult.expires_at).getTime();
    const i = setInterval(() => {
      const s = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setPixSeconds(s);
    }, 1000);
    return () => clearInterval(i);
  }, [pixResult]);

  const clientPayload = useMemo(() => ({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    cpf: onlyDigits(cpf),
    birth_date: birth,
    phone: onlyDigits(phone).startsWith("55") ? "+" + onlyDigits(phone) : "+55" + onlyDigits(phone),
    address: {
      zip_code: onlyDigits(addr.zip_code || ""),
      street: (addr.street || "").trim(),
      number: (addr.number || "").trim(),
      complement: (addr.complement || "").trim(),
      district: (addr.district || "").trim(),
      city: (addr.city || "").trim(),
      state: (addr.state || "").trim().toUpperCase().slice(0, 2),
    },
  }), [name, email, cpf, birth, phone, addr]);

  function validateClient(): string | null {
    if (!clientPayload.name || clientPayload.name.split(" ").length < 2) return "Informe nome e sobrenome.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientPayload.email)) return "E-mail inválido.";
    if (clientPayload.cpf.length !== 11) return "CPF inválido (11 dígitos).";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clientPayload.birth_date)) return "Data de nascimento inválida.";
    if (onlyDigits(phone).length < 10) return "Telefone inválido.";
    const a = clientPayload.address;
    if (!a.zip_code || a.zip_code.length !== 8) return "CEP incompleto. Edite seus dados e refaça a busca por CEP.";
    if (!a.street || !a.number || !a.city || !a.state) return "Endereço incompleto (rua, número, cidade e UF).";
    return null;
  }

  function basePayBody(payment_method: "pix" | "boleto") {
    return {
      vehicle_id: state.vehicle_id,
      start_at: state.start_at,
      end_at: state.end_at,
      amount_usd: state.amount_usd,
      payment_method,
      client: clientPayload,
    };
  }

  function mapPayError(msg: string, cr?: any): string {
    const errsArr = cr?.cr_response?.errors || cr?.errors;
    if (Array.isArray(errsArr) && errsArr.length > 0) {
      const first = errsArr[0];
      const txt = (first?.message || first?.error || first?.detail || JSON.stringify(first)).toString();
      return mapPayError(txt);
    }
    const m = (msg || "").toLowerCase();
    if (m.includes("e-mail") || (m.includes("email") && (m.includes("uso") || m.includes("já") || m.includes("exists") || m.includes("registered")))) {
      return "Não foi possível processar o pagamento neste momento. Tente novamente em alguns segundos.";
    }
    if (m.includes("cpf") && (m.includes("nome") || m.includes("name"))) {
      return "CPF e nome não conferem na Receita Federal. Confira os dados.";
    }
    if (m.includes("cpf")) return "CPF inválido ou não encontrado na Receita Federal.";
    if (m.includes("birth") || m.includes("nascimento")) return "Data de nascimento não confere.";
    if (m.includes("address") || m.includes("endere")) return "Endereço incompleto ou inválido. Edite seus dados.";
    if (m.includes("zip") || m.includes("cep")) return "CEP inválido. Edite seus dados.";
    return msg || "Erro ao processar pagamento.";
  }

  async function handlePix() {
    setPayError(null);
    const v = validateClient(); if (v) { setPayError(v); return; }
    setPayLoading("pix");
    try {
      const { data, error } = await supabase.functions.invoke("cambioreal-pay", { body: basePayBody("pix") });
      if (error) throw error;
      if (data?.error) { setPayError(mapPayError(data.error, data)); return; }
      setPixResult(data);
    } catch (e: any) {
      setPayError(mapPayError(e?.message || String(e)));
    } finally { setPayLoading(null); }
  }

  async function handleBoleto() {
    setPayError(null);
    const v = validateClient(); if (v) { setPayError(v); return; }
    setPayLoading("boleto");
    try {
      const { data, error } = await supabase.functions.invoke("cambioreal-pay", { body: basePayBody("boleto") });
      if (error) throw error;
      if (data?.error) { setPayError(mapPayError(data.error, data)); return; }
      setBoletoResult(data);
    } catch (e: any) {
      setPayError(mapPayError(e?.message || String(e)));
    } finally { setPayLoading(null); }
  }

  async function handleCard() {
    setPayError(null);
    const v = validateClient(); if (v) { setPayError(v); return; }
    const num = onlyDigits(cardNumber);
    const exp = onlyDigits(cardExp);
    const cvv = onlyDigits(cardCvv);
    if (num.length < 13) { setPayError("Número do cartão inválido."); return; }
    if (exp.length !== 4) { setPayError("Validade inválida (MMAA)."); return; }
    if (cvv.length < 3) { setPayError("CVV inválido."); return; }
    if (cardHolder.trim().length < 3) { setPayError("Nome impresso no cartão é obrigatório."); return; }
    if (!window.CardHash) { setPayError("Módulo de cartão ainda carregando, aguarde."); return; }

    setPayLoading("card");
    try {
      const brand = detectBrand(num);
      const bin = num.slice(0, 6);
      const ch = new window.CardHash(CR_APP_ID, CR_APP_PUBLIC, dfpIdRef.current, false);
      const token: string = await ch.generateCardHash({
        number: num,
        holder_name: cardHolder,
        expiration_date: exp, // MMYY
        cvv,
      });

      const { data, error } = await supabase.functions.invoke("cambioreal-pay-card", {
        body: {
          vehicle_id: state.vehicle_id,
          start_at: state.start_at,
          end_at: state.end_at,
          amount_usd: state.amount_usd,
          installments,
          client: clientPayload,
          card: { bin, brand, dfp_id: dfpIdRef.current, holder: cardHolder.trim(), token },
        },
      });
      if (error) throw error;
      if (data?.error) { setPayError(mapPayError(data.error, data)); return; }

      if (data?.approved || data?.status === "approved" || data?.paid) {
        setCardSuccess(data);
        setStep("success");
      } else {
        setPayError(data?.message || "Pagamento recusado pelo emissor. Tente outro cartão.");
      }
    } catch (e: any) {
      setPayError(mapPayError(e?.message || String(e)));
    } finally { setPayLoading(null); }
  }

  function copy(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setter(true);
      setTimeout(() => setter(false), 2000);
    });
  }

  const activeQuote = quoteForMethod(method);
  const activeLoading = !!quoteLoading[method];
  const activeFailed = quotes[method]?.fallback === true && !activeQuote?.estimated;
  const isEstimated = activeQuote?.estimated === true;
  const totalLine = activeQuote?.result != null
    ? formatBRL(activeQuote.result)
    : (activeLoading ? "Calculando câmbio…" : "");

  const installmentsArr: Array<{ n: number; value: number; total: number; fee: number }> = useMemo(() => {
    const raw = quoteForMethod("card")?.installments;
    if (!raw) return [];
    const norm = (it: any, i: number) => ({
      n: Number(it.installment ?? it.installments ?? it.n ?? i + 1),
      value: Number(it.installment_amount ?? it.amount ?? it.value ?? 0),
      total: Number(it.total ?? it.amount_total ?? it.amount ?? 0),
      fee: Number(it.fee ?? it.interest ?? 0),
    });
    if (Array.isArray(raw)) return raw.map(norm);
    if (typeof raw === "object") return Object.entries(raw).map(([k, v]: any, i) => ({
      ...norm(v, i),
      n: Number(k) || norm(v, i).n,
    }));
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes, publicRate]);



  const days = state.vehicleDisplay?.days ?? 1;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 pt-24 pb-12 px-4">
        <div className="max-w-5xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition mb-4"
          >
            <ArrowLeft size={16} /> Voltar
          </button>

          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Finalizar Reserva</h1>
          <p className="text-sm text-muted-foreground mb-6">Pagamento seguro · GoDrive</p>

          <div className="grid lg:grid-cols-[1fr_360px] gap-6">
            {/* LEFT. main flow */}
            <div className="space-y-6">
              {step === "client" && (
                <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
                  <h2 className="text-lg font-semibold text-foreground mb-1">Seus dados</h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    Usamos esses dados para emitir o pagamento. O nome e o CPF são validados na Receita Federal.
                  </p>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Nome completo *">
                      <input className="cr-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Como no documento" />
                    </Field>
                    <Field label="E-mail *">
                      <input type="email" inputMode="email" className="cr-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
                    </Field>
                    <Field label="CPF *">
                      <input inputMode="numeric" className="cr-input" value={cpf} onChange={(e) => setCpf(maskCPF(e.target.value))} placeholder="000.000.000-00" />
                    </Field>
                    <Field label="Data de nascimento *">
                      <input type="date" className="cr-input" value={birth} onChange={(e) => setBirth(e.target.value)} />
                    </Field>
                    <Field label="Telefone *">
                      <input inputMode="tel" className="cr-input" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(11) 90000-0000" />
                    </Field>
                  </div>

                  {payError && (
                    <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
                      <AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" />
                      <p className="text-xs text-destructive">{payError}</p>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      const v = validateClient();
                      if (v) { setPayError(v); return; }
                      setPayError(null); setStep("pay");
                    }}
                    className="mt-5 w-full sm:w-auto px-6 gold-gradient text-primary-foreground py-3 rounded-lg text-sm font-bold uppercase tracking-wider hover:opacity-90 transition"
                  >
                    Continuar para pagamento
                  </button>
                </section>
              )}

              {step === "pay" && (
                <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
                  {prefilled && (
                    <div className="mb-4 p-3 rounded-lg border border-border/60 bg-secondary/30 flex items-start justify-between gap-3">
                      <div className="text-[11px] leading-relaxed">
                        <p className="font-semibold text-foreground">{clientPayload.name} · CPF {maskCPF(clientPayload.cpf)}</p>
                        <p className="text-muted-foreground">{clientPayload.email} · {clientPayload.phone}</p>
                        <p className="text-muted-foreground">
                          {clientPayload.address.street}, {clientPayload.address.number}
                          {clientPayload.address.complement ? `. ${clientPayload.address.complement}` : ""}
                          {clientPayload.address.district ? ` · ${clientPayload.address.district}` : ""}
                          {" · "}{clientPayload.address.city}/{clientPayload.address.state} · CEP {clientPayload.address.zip_code}
                        </p>
                      </div>
                      <button
                        onClick={() => navigate(-1)}
                        className="text-[11px] text-primary underline shrink-0"
                      >
                        editar
                      </button>
                    </div>
                  )}
                  <Tabs value={method} onValueChange={(v) => setMethod(v as any)}>
                    <TabsList className="grid grid-cols-3 w-full mb-4">
                      <TabsTrigger value="pix"><QrCode size={14} className="mr-1.5" />Pix</TabsTrigger>
                      <TabsTrigger value="boleto"><BarcodeIcon size={14} className="mr-1.5" />Boleto</TabsTrigger>
                      <TabsTrigger value="card"><CreditCard size={14} className="mr-1.5" />Cartão</TabsTrigger>
                    </TabsList>

                    {/* PIX */}
                    <TabsContent value="pix" className="space-y-4">
                      {!pixResult ? (
                        <>
                          <p className="text-sm text-foreground/80">
                            Pagamento instantâneo. Sua reserva é confirmada em poucos segundos após o pagamento.
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Você vai pagar <strong className="text-foreground">{totalLine}</strong>
                            {activeQuote?.rate != null && <> via Pix (câmbio R$ {activeQuote.rate.toFixed(4)})</>}.
                          </p>
                          {activeFailed && (
                            <button onClick={recalcQuote} className="text-[11px] underline text-primary">Recalcular câmbio</button>
                          )}

                          {payError && <ErrorBox msg={payError} />}
                          <button onClick={handlePix} disabled={payLoading === "pix"} className="cr-cta flex-col gap-0.5 py-3">
                            {payLoading === "pix" ? (
                              <><Loader2 size={16} className="animate-spin" /> Gerando Pix...</>
                            ) : (
                              <>
                                <span className="text-base font-bold leading-tight">
                                  Pagar com Pix · {activeQuote?.result != null ? formatBRL(activeQuote.result) : ""}
                                </span>
                                <span className="text-[10px] font-normal opacity-80 leading-tight">
                                  equivalente a {formatUSD(state.amount_usd)}
                                </span>
                              </>
                            )}
                          </button>

                        </>
                      ) : (
                        <div className="space-y-4">
                          <div className="flex flex-col sm:flex-row gap-4 items-start">
                            <div className="bg-white p-3 rounded-lg shrink-0 mx-auto sm:mx-0">
                              {pixResult.qrcode_base64 && (
                                <img src={pixResult.qrcode_base64} alt="QR Code Pix" className="w-56 h-56 object-contain" />
                              )}
                            </div>
                            <div className="flex-1 space-y-3 w-full">
                              <div>
                                <p className="text-xs text-muted-foreground">Reserva</p>
                                <p className="text-sm font-semibold text-foreground">{pixResult.booking_number}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Total</p>
                                <p className="text-base font-bold text-foreground">{formatBRL(pixResult.amount_brl)}</p>
                              </div>
                              {pixSeconds !== null && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Expira em</p>
                                  <p className={`text-sm font-bold tabular-nums ${pixSeconds < 60 ? "text-destructive" : "text-foreground"}`}>
                                    {Math.floor(pixSeconds / 60)}:{String(pixSeconds % 60).padStart(2, "0")}
                                  </p>
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 size={12} className="animate-spin" /> Aguardando pagamento...
                              </div>
                            </div>
                          </div>

                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Pix Copia e Cola</p>
                            <div className="flex gap-2">
                              <textarea readOnly value={pixResult.copia_cola || ""} className="cr-input flex-1 h-20 font-mono text-[11px]" />
                              <button onClick={() => copy(pixResult.copia_cola, setPixCopied)} className="cr-copy">
                                {pixCopied ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    {/* BOLETO */}
                    <TabsContent value="boleto" className="space-y-4">
                      {!boletoResult ? (
                        <>
                          <p className="text-sm text-foreground/80">
                            Compensação em até 3 dias úteis. A reserva é confirmada após o pagamento.
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Você vai pagar <strong className="text-foreground">{totalLine}</strong>
                            {activeQuote?.rate != null && <> via boleto (câmbio R$ {activeQuote.rate.toFixed(4)})</>}.
                          </p>
                          {activeFailed && (
                            <button onClick={recalcQuote} className="text-[11px] underline text-primary">Recalcular câmbio</button>
                          )}

                          {payError && <ErrorBox msg={payError} />}
                          <button onClick={handleBoleto} disabled={payLoading === "boleto"} className="cr-cta flex-col gap-0.5 py-3">
                            {payLoading === "boleto" ? (
                              <><Loader2 size={16} className="animate-spin" /> Gerando boleto...</>
                            ) : (
                              <>
                                <span className="text-base font-bold leading-tight">
                                  Gerar Boleto · {activeQuote?.result != null ? formatBRL(activeQuote.result) : ""}
                                </span>
                                <span className="text-[10px] font-normal opacity-80 leading-tight">
                                  equivalente a {formatUSD(state.amount_usd)}
                                </span>
                              </>
                            )}
                          </button>

                        </>
                      ) : (
                        <div className="space-y-4">
                          <div className="grid sm:grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-muted-foreground">Reserva</p>
                              <p className="text-sm font-semibold text-foreground">{boletoResult.booking_number}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Total</p>
                              <p className="text-base font-bold text-foreground">{formatBRL(boletoResult.amount_brl)}</p>
                            </div>
                          </div>

                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Linha digitável</p>
                            <div className="flex gap-2">
                              <input readOnly value={boletoResult.copia_cola || ""} className="cr-input flex-1 font-mono text-[11px]" />
                              <button onClick={() => copy(boletoResult.copia_cola, setBoletoCopied)} className="cr-copy">
                                {boletoCopied ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            </div>
                          </div>

                          {boletoResult.qrcode_base64 && onlyDigits(boletoResult.qrcode_base64).length >= 44 && (
                            <div className="bg-white p-3 rounded-lg overflow-x-auto">
                              <Barcode
                                value={onlyDigits(boletoResult.qrcode_base64).slice(0, 44)}
                                format="ITF"
                                width={1.4}
                                height={64}
                                displayValue={false}
                                margin={0}
                              />
                            </div>
                          )}

                          {boletoResult.ticket_url && (
                            <a href={boletoResult.ticket_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                              Abrir boleto para impressão
                            </a>
                          )}

                          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-300">
                            Boleto compensa em até 3 dias úteis. A reserva fica reservada até a confirmação do pagamento.
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    {/* CARD */}
                    <TabsContent value="card" className="space-y-4">
                      <p className="text-xs text-muted-foreground">
                        O número do cartão é tokenizado no seu navegador e nunca passa pelo nosso servidor.
                      </p>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <Field label="Número do cartão *" full>
                          <div className="relative">
                            <input
                              inputMode="numeric"
                              autoComplete="cc-number"
                              className="cr-input pr-16"
                              value={cardNumber}
                              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                              placeholder="0000 0000 0000 0000"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-wider text-muted-foreground">
                              {detectBrand(onlyDigits(cardNumber)) || ""}
                            </span>
                          </div>
                        </Field>
                        <Field label="Nome impresso *">
                          <input className="cr-input uppercase" autoComplete="cc-name" value={cardHolder} onChange={(e) => setCardHolder(e.target.value)} placeholder="COMO ESTÁ NO CARTÃO" />
                        </Field>
                        <Field label="Validade (MM/AA) *">
                          <input
                            inputMode="numeric" autoComplete="cc-exp" maxLength={5}
                            className="cr-input" value={cardExp}
                            onChange={(e) => {
                              const d = onlyDigits(e.target.value).slice(0, 4);
                              setCardExp(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
                            }}
                            placeholder="MM/AA"
                          />
                        </Field>
                        <Field label="CVV *">
                          <input inputMode="numeric" autoComplete="cc-csc" maxLength={4} className="cr-input" value={cardCvv} onChange={(e) => setCardCvv(onlyDigits(e.target.value))} placeholder="000" />
                        </Field>
                        <Field label="Parcelas *" full>
                          <select className="cr-input" value={installments} onChange={(e) => setInstallments(Number(e.target.value))} disabled={installmentsArr.length === 0}>
                            {installmentsArr.length === 0 ? (
                              <option>Calculando parcelas…</option>
                            ) : installmentsArr.map((it) => (
                              <option key={it.n} value={it.n}>
                                {it.n === 1
                                  ? `${isEstimated ? "≈ " : ""}à vista ${formatBRL(it.value || it.total)}`
                                  : `${isEstimated ? "≈ " : ""}${it.n}x de ${formatBRL(it.value)} · total ${formatBRL(it.total)}`}
                              </option>
                            ))}
                          </select>
                          {isEstimated && installmentsArr.length > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-1">Valores finais confirmados ao pagar.</p>
                          )}
                        </Field>

                      </div>

                      {(() => {
                        const sel = installmentsArr.find(i => i.n === installments);
                        if (!sel) return null;
                        return (
                          <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs space-y-1">
                            <div className="flex justify-between"><span className="text-muted-foreground">Parcela</span><span className="text-foreground tabular-nums">{sel.n === 1 ? `1x à vista` : `${sel.n}x de ${formatBRL(sel.value)}`}</span></div>
                            <div className="flex justify-between"><span className="text-muted-foreground">Total BRL</span><span className="text-foreground tabular-nums">{formatBRL(sel.total)}</span></div>
                            {sel.fee > 0 && (
                              <div className="flex justify-between"><span className="text-muted-foreground">Juros do parcelamento</span><span className="text-foreground tabular-nums">{formatBRL(sel.fee)}</span></div>
                            )}
                          </div>
                        );
                      })()}

                      <p className="text-[11px] text-muted-foreground">
                        O cliente assume os juros do parcelamento.
                      </p>

                      {payError && <ErrorBox msg={payError} />}
                      {activeFailed && (
                        <button onClick={recalcQuote} className="text-[11px] underline text-primary text-left">Recalcular câmbio</button>
                      )}

                      <button onClick={handleCard} disabled={payLoading === "card" || !cardScriptLoaded} className="cr-cta flex-col gap-0.5 py-3">
                        {payLoading === "card"
                          ? <><Loader2 size={16} className="animate-spin" /> Processando...</>
                          : !cardScriptLoaded ? <><Loader2 size={16} className="animate-spin" /> Preparando módulo seguro...</>
                          : (() => {
                              const sel = installmentsArr.find(i => i.n === installments);
                              const brlMain = sel
                                ? (sel.n === 1 ? `Pagar à vista ${formatBRL(sel.value || sel.total)}` : `Pagar ${sel.n}x de ${formatBRL(sel.value)}`)
                                : "Pagar com cartão";
                              return (
                                <>
                                  <span className="text-base font-bold leading-tight">{brlMain}</span>
                                  <span className="text-[10px] font-normal opacity-80 leading-tight">
                                    equivalente a {formatUSD(state.amount_usd)}
                                  </span>
                                </>
                              );
                            })()}
                      </button>


                    </TabsContent>
                  </Tabs>
                </section>
              )}

              {step === "success" && (
                <section className="rounded-xl border border-border bg-card p-6 text-center">
                  <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center mb-4">
                    <Check size={28} />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">Reserva confirmada!</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Reserva <strong className="text-foreground">{pixResult?.booking_number || cardSuccess?.booking_number}</strong> confirmada com sucesso.
                  </p>
                  <Link to="/minha-conta" className="mt-5 inline-block px-5 py-2.5 rounded-lg gold-gradient text-primary-foreground text-xs font-bold uppercase tracking-wider">
                    Ver minha reserva
                  </Link>
                </section>
              )}
            </div>

            {/* RIGHT. summary */}
            <aside className="rounded-xl border border-border bg-card p-5 h-fit space-y-4 lg:sticky lg:top-24">
              <h3 className="text-sm font-semibold text-foreground">Resumo</h3>

              {state.vehicleDisplay?.image && (
                <img src={state.vehicleDisplay.image} alt={state.vehicleDisplay.name} className="w-full h-32 object-cover rounded-lg" />
              )}

              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <Car size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-foreground">{state.vehicleDisplay?.name || "Veículo"}</span>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    {new Date(state.start_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                    <br />→ {new Date(state.end_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>
                {state.vehicleDisplay?.pickupLocation && (
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{state.vehicleDisplay.pickupLocation}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-3 space-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Total USD</span><span className="font-semibold text-foreground tabular-nums">{formatUSD(state.amount_usd)}</span></div>
                {activeQuote?.rate != null && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Câmbio</span><span className="text-foreground tabular-nums">R$ {activeQuote.rate.toFixed(4)}</span></div>
                )}
                {activeQuote?.iof != null && activeQuote.iof > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">IOF / taxas</span><span className="text-foreground tabular-nums">{formatBRL(activeQuote.iof)}</span></div>
                )}
                <div className="flex justify-between text-sm pt-1.5 border-t border-border/50 mt-1.5">
                  <span className="text-foreground font-semibold">
                    Total BRL {isEstimated && <span className="text-[10px] font-normal text-muted-foreground">(estimado)</span>}
                  </span>
                  <span className="text-foreground font-bold tabular-nums">
                    {isEstimated && activeQuote?.result != null ? "≈ " : ""}{totalLine}
                  </span>
                </div>
                {isEstimated && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" /> atualizando cotação…
                  </p>
                )}
                {!isEstimated && quotes[method]?.locked_until && quotes[method]!.locked_until! > Date.now() && (
                  <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-primary uppercase tracking-wider">
                      <Lock size={10} /> Cotação travada
                    </span>
                    <span className="text-[10px] tabular-nums text-foreground/80">
                      {(() => {
                        const ms = Math.max(0, (quotes[method]!.locked_until! - Date.now()));
                        const m = Math.floor(ms / 60000);
                        const s = Math.floor((ms % 60000) / 1000);
                        return `${m}:${String(s).padStart(2, "0")}`;
                      })()}
                    </span>
                  </div>
                )}
                {activeFailed && !isEstimated && (
                  <button onClick={recalcQuote} className="w-full mt-2 text-[11px] py-2 rounded-md border border-border text-foreground hover:bg-secondary transition">
                    Recalcular câmbio
                  </button>
                )}
                <p className="text-[10px] text-muted-foreground pt-1">
                  {!isEstimated && quotes[method]?.locked_until && quotes[method]!.locked_until! > Date.now()
                    ? "Este valor está garantido até o fim do contador. Finalize a reserva antes."
                    : "Valor final pelo Câmbio Real no momento do pagamento."}
                </p>


              </div>


              <div className="flex items-center gap-2 text-[10px] text-muted-foreground border-t border-border pt-3">
                <ShieldCheck size={12} /> Cartão tokenizado · <Lock size={10} /> Câmbio Real
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />

      <style>{`
        .cr-input {
          width: 100%;
          padding: 0.625rem 0.75rem;
          border-radius: 0.5rem;
          background: hsl(var(--background));
          border: 1px solid hsl(var(--border));
          color: hsl(var(--foreground));
          font-size: 0.875rem;
          outline: none;
          transition: border-color .15s;
        }
        .cr-input:focus { border-color: hsl(var(--primary)); }
        .cr-cta {
          display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
          width: 100%; padding: 0.875rem 1rem; border-radius: 0.5rem;
          font-size: 0.8125rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
        }
        .cr-cta { background: linear-gradient(135deg, #d4af37, #b8941f); color: #0a0a0a; }
        .cr-cta:disabled { opacity: .6; cursor: not-allowed; }
        .cr-copy {
          padding: 0 0.75rem; border-radius: 0.5rem;
          background: hsl(var(--secondary)); color: hsl(var(--secondary-foreground));
          border: 1px solid hsl(var(--border));
        }
      `}</style>
    </div>
  );
};

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "sm:col-span-2" : ""}`}>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
      <AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" />
      <p className="text-xs text-destructive">{msg}</p>
    </div>
  );
}

export default Checkout;
