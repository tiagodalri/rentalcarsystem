import { useState, type ReactNode } from "react";
import { Brain, Lock, X } from "lucide-react";

const ACCESS_CODE = "123321";

// Demo: desativa o gate de acesso. Troque para true para reativar a exigencia do codigo.
const BRAIN_GATE_ENABLED = false;

export function isBrainUnlocked(): boolean {
  return false;
}

export function lockBrain() {
  // no-op: gate sempre exige código a cada acesso
}

type Props = {
  children: ReactNode;
  onCancel?: () => void;
};

/**
 * Access gate for AI Studio.
 * Always requires the private access code on every entry (no persistence).
 */
export default function BrainAccessGate({ children, onCancel }: Props) {
  const [unlocked, setUnlocked] = useState<boolean>(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!BRAIN_GATE_ENABLED) return <>{children}</>;
  if (unlocked) return <>{children}</>;

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (code.trim() === ACCESS_CODE) {
      setUnlocked(true);
      setError(null);
    } else {
      setError("Código incorreto. Tente novamente.");
    }
  }


  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center px-4 overflow-y-auto"
      style={{
        paddingTop: "max(16px, env(safe-area-inset-top))",
        paddingBottom: "max(16px, env(safe-area-inset-bottom))",
        background:
          "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(154,122,58,0.18), transparent 60%), linear-gradient(180deg, #f6f1e6 0%, #efe9dc 60%, #e9e2d2 100%)",
      }}
    >
      {onCancel && (
        <button
          onClick={onCancel}
          aria-label="Fechar"
          className="absolute top-4 right-4 inline-flex items-center justify-center w-10 h-10 rounded-full transition-all hover:opacity-90"
          style={{
            background: "#fbf7ee",
            border: "1px solid rgba(13,29,46,0.14)",
            color: "#0d1d2e",
            boxShadow: "0 4px 10px -6px rgba(13,29,46,0.25)",
          }}
        >
          <X size={16} />
        </button>
      )}

      <form
        onSubmit={submit}
        className="w-full max-w-[380px] rounded-2xl p-6 sm:p-7"
        style={{
          background: "#fbf7ee",
          border: "1px solid rgba(13,29,46,0.10)",
          boxShadow: "0 30px 60px -30px rgba(13,29,46,0.35), 0 0 0 1px rgba(154,122,58,0.10)",
        }}
      >
        <div className="flex flex-col items-center text-center">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{
              background: "linear-gradient(180deg, #14283d, #0d1d2e)",
              boxShadow: "0 10px 30px -10px rgba(13,29,46,0.55), 0 0 0 1px rgba(154,122,58,0.45)",
            }}
          >
            <Brain size={22} strokeWidth={1.6} style={{ color: "#d6bf86" }} />
          </div>
          <div
            className="text-[13px] tracking-[0.42em] font-light"
            style={{ color: "#0d1d2e" }}
          >
            GODRIVE BRAIN
          </div>
          <div
            className="text-[10.5px] uppercase tracking-[0.28em] mt-1"
            style={{ color: "rgba(13,29,46,0.55)" }}
          >
            Acesso restrito · Em preparação
          </div>

          <p
            className="text-[12.5px] mt-4 leading-relaxed"
            style={{ color: "rgba(13,29,46,0.72)" }}
          >
            Este módulo ainda está em ajustes finais. Informe o código privado
            para continuar.
          </p>
        </div>

        <label
          className="block mt-5 text-[9px] uppercase tracking-[0.28em] font-semibold"
          style={{ color: "rgba(13,29,46,0.55)" }}
        >
          Código de acesso
        </label>
        <div
          className="mt-1 flex items-center gap-2 px-3 rounded-lg"
          style={{ background: "white", border: "1px solid rgba(13,29,46,0.18)", minHeight: 44 }}
        >
          <Lock size={14} style={{ color: "#9a7a3a" }} />
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={code}
            onChange={(e) => { setCode(e.target.value); if (error) setError(null); }}
            placeholder="••••••"
            className="flex-1 bg-transparent outline-none text-[15px] tracking-[0.3em] py-2"
            style={{ color: "#0d1d2e" }}
          />
        </div>
        {error && (
          <p className="mt-2 text-[11.5px]" style={{ color: "#a05a2c" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!code.trim()}
          className="w-full mt-5 inline-flex items-center justify-center gap-2 rounded-lg text-[13px] font-semibold tracking-wide transition-all disabled:opacity-50"
          style={{
            background: "linear-gradient(180deg,#14283d,#0d1d2e)",
            color: "#d6bf86",
            border: "1px solid rgba(214,191,134,0.40)",
            minHeight: 44,
          }}
        >
          Entrar no AI Studio
        </button>
      </form>
    </div>
  );
}
