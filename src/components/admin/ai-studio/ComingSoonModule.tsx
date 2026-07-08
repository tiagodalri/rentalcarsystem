import { ArrowLeft, Sparkles } from "lucide-react";

type Props = {
  title: string;
  description: string;
  bullets?: string[];
  onBack: () => void;
};

export default function ComingSoonModule({ title, description, bullets, onBack }: Props) {
  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-[max(3rem,env(safe-area-inset-bottom))]">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-2 mb-8 text-[11px] uppercase font-semibold tracking-[0.22em] transition-colors"
        style={{ color: "rgba(13,29,46,0.62)" }}
      >
        <ArrowLeft size={14} />
        Voltar ao menu
      </button>

      <div
        className="rounded-[24px] overflow-hidden"
        style={{
          background: "#fbf7ee",
          border: "1px solid rgba(13,29,46,0.10)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.7) inset, 0 18px 40px -28px rgba(13,29,46,0.35)",
        }}
      >
        <div
          className="px-6 sm:px-10 py-10 sm:py-14 text-center"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(154,122,58,0.10), transparent 65%)",
          }}
        >
          <div
            className="inline-flex items-center justify-center h-14 w-14 rounded-full mb-5"
            style={{
              background: "linear-gradient(180deg, #14283d, #0d1d2e)",
              color: "#d6bf86",
              border: "1px solid rgba(214,191,134,0.40)",
              boxShadow: "0 10px 24px -12px rgba(13,29,46,0.55)",
            }}
          >
            <Sparkles size={20} strokeWidth={1.6} />
          </div>

          <div
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] uppercase font-semibold tracking-[0.28em] mb-4"
            style={{
              background: "linear-gradient(180deg, #14283d, #0d1d2e)",
              color: "#d6bf86",
              border: "1px solid rgba(214,191,134,0.40)",
            }}
          >
            Em construção
          </div>

          <h1
            className="text-[28px] sm:text-[38px] leading-tight font-light tracking-[-0.01em]"
            style={{ color: "#0d1d2e", fontFamily: "'Urbanist', 'Inter', system-ui, sans-serif" }}
          >
            {title}
          </h1>
          <p
            className="mt-3 max-w-[560px] mx-auto text-[14px] sm:text-[15px] leading-relaxed"
            style={{ color: "rgba(13,29,46,0.65)" }}
          >
            {description}
          </p>

          {bullets && bullets.length > 0 && (
            <ul className="mt-7 max-w-[520px] mx-auto text-left space-y-2.5">
              {bullets.map((b, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-[13.5px] leading-relaxed"
                  style={{ color: "rgba(13,29,46,0.78)" }}
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ background: "#9a7a3a" }}
                  />
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
