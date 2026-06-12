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

const CR_APP_ID = "1781587732";
const CR_APP_PUBLIC = "pk_production_3db3d2837eb1416e00d9880aae287e6e";
const CR_HASH_SCRIPT = "https://www.cambioreal.com/js/card-hash.js";

type CheckoutState = {
  vehicle_id: string;
  start_at: string; // ISO local
  end_at: string;
  amount_usd: number;
  vehicleDisplay?: { name: string; image?: string; days?: number; pickupLocation?: string };
  customer?: {
    full_name?: string; email?: string; phone?: string;
    cpf?: string; birth_date?: string;
  };
};

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
  if (n == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
}
function formatUSD(n?: number | null) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state || {}) as CheckoutState;

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
  const [step, setStep] = useState<"client" | "pay" | "success">("client");
  const [method, setMethod] = useState<"pix" | "boleto" | "card">("pix");

  // Quote (cached per payment_method so we never recall on render/keystroke)
  type Quote = {
    rate: number | null;
    result: number | null;
    iof?: number | null;
    installments?: any;
    fallback?: boolean;
    error?: string;
  };
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [quoteLoading, setQuoteLoading] = useState<Record<string, boolean>>({});
  const [quoteTick, setQuoteTick] = useState(0); // bump to force recalc
  const quoteForMethod = (m: "pix" | "boleto" | "card"): Quote | undefined => quotes[m];


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

  // Quote on entering payment step (and whenever method changes between pix/boleto/card)
  useEffect(() => {
    if (step !== "pay") return;
    let cancelled = false;
    (async () => {
      try {
        const wantCard = method === "card";
        const pm = wantCard ? "card" : (method === "boleto" ? "boleto" : "pix");
        const { data, error } = await supabase.functions.invoke("cambioreal-simulator", {
          body: { amount: state.amount_usd, payment_method: pm },
        });
        if (cancelled) return;
        if (error || data?.error) { console.warn("simulator error", error, data); return; }
        if (wantCard) setQuoteCard(data); else setQuotePix(data);
      } catch (e) { console.warn(e); }
    })();
    return () => { cancelled = true; };
  }, [step, method, state.amount_usd]);

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
  }), [name, email, cpf, birth, phone]);

  function validateClient(): string | null {
    if (!clientPayload.name || clientPayload.name.split(" ").length < 2) return "Informe nome e sobrenome.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientPayload.email)) return "E-mail inválido.";
    if (clientPayload.cpf.length !== 11) return "CPF inválido (11 dígitos).";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(clientPayload.birth_date)) return "Data de nascimento inválida.";
    if (onlyDigits(phone).length < 10) return "Telefone inválido.";
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

  function mapPayError(msg: string): string {
    const m = (msg || "").toLowerCase();
    if (m.includes("cpf") && (m.includes("nome") || m.includes("name"))) {
      return "CPF e nome não conferem na Receita Federal. Confira os dados.";
    }
    if (m.includes("cpf")) return "CPF inválido ou não encontrado na Receita Federal.";
    if (m.includes("birth") || m.includes("nascimento")) return "Data de nascimento não confere.";
    return msg || "Erro ao processar pagamento.";
  }

  async function handlePix() {
    setPayError(null);
    const v = validateClient(); if (v) { setPayError(v); return; }
    setPayLoading("pix");
    try {
      const { data, error } = await supabase.functions.invoke("cambioreal-pay", { body: basePayBody("pix") });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
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
      if (data?.error) throw new Error(data.error);
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
      if (data?.error) throw new Error(data.error);

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

  const totalLine = method === "card"
    ? (quoteCard?.result ? formatBRL(quoteCard.result) : "...")
    : (quotePix?.result ? formatBRL(quotePix.result) : "...");

  const installmentsArr: Array<{ n: number; value: number; total: number }> = useMemo(() => {
    const raw = quoteCard?.installments;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map((it: any, i: number) => ({
      n: it.installment ?? it.n ?? i + 1,
      value: Number(it.installment_amount ?? it.value ?? it.amount ?? 0),
      total: Number(it.amount ?? it.total ?? 0),
    }));
    if (typeof raw === "object") return Object.entries(raw).map(([k, v]: any) => ({
      n: Number(k), value: Number(v?.installment_amount ?? v?.value ?? 0), total: Number(v?.amount ?? v?.total ?? 0),
    }));
    return [];
  }, [quoteCard]);

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
          <p className="text-sm text-muted-foreground mb-6">Pagamento seguro · Zeus Rental Car</p>

          <div className="grid lg:grid-cols-[1fr_360px] gap-6">
            {/* LEFT — main flow */}
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
                          <p className="text-xs text-muted-foreground">Total a pagar: <strong className="text-foreground">{totalLine}</strong></p>
                          {payError && <ErrorBox msg={payError} />}
                          <button onClick={handlePix} disabled={payLoading === "pix"} className="cr-cta">
                            {payLoading === "pix" ? <><Loader2 size={16} className="animate-spin" /> Gerando Pix...</> : <>Pagar com Pix</>}
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
                          <p className="text-xs text-muted-foreground">Total a pagar: <strong className="text-foreground">{totalLine}</strong></p>
                          {payError && <ErrorBox msg={payError} />}
                          <button onClick={handleBoleto} disabled={payLoading === "boleto"} className="cr-cta">
                            {payLoading === "boleto" ? <><Loader2 size={16} className="animate-spin" /> Gerando boleto...</> : <>Gerar Boleto</>}
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
                          <select className="cr-input" value={installments} onChange={(e) => setInstallments(Number(e.target.value))}>
                            {(installmentsArr.length > 0 ? installmentsArr : Array.from({ length: 12 }, (_, i) => ({ n: i + 1, value: 0, total: 0 }))).map((it) => (
                              <option key={it.n} value={it.n}>
                                {it.n}x{it.value ? ` de ${formatBRL(it.value)}${it.total ? ` (total ${formatBRL(it.total)})` : ""}` : ""}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>

                      <p className="text-[11px] text-muted-foreground">
                        O cliente assume os juros do parcelamento.
                      </p>

                      {payError && <ErrorBox msg={payError} />}

                      <button onClick={handleCard} disabled={payLoading === "card" || !cardScriptLoaded} className="cr-cta">
                        {payLoading === "card"
                          ? <><Loader2 size={16} className="animate-spin" /> Processando...</>
                          : !cardScriptLoaded ? <><Loader2 size={16} className="animate-spin" /> Preparando módulo seguro...</>
                          : <>Pagar com cartão</>}
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

            {/* RIGHT — summary */}
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
                {(method === "card" ? quoteCard : quotePix)?.rate != null && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Cotação</span><span className="text-foreground tabular-nums">{(method === "card" ? quoteCard : quotePix)?.rate?.toFixed(4)}</span></div>
                )}
                <div className="flex justify-between text-sm pt-1.5 border-t border-border/50 mt-1.5">
                  <span className="text-foreground font-semibold">Total BRL</span>
                  <span className="text-foreground font-bold tabular-nums">{totalLine}</span>
                </div>
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
