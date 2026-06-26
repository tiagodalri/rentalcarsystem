import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

/**
 * CarDamageMap
 * Mapa de avarias em SVG com regiões no formato real das peças.
 * - Vista superior + vista lateral (para alcançar portas, soleira, vidros laterais)
 * - Nomes completos, sem abreviações
 * - Hover mostra rótulo flutuante grande
 * - Dropdown alternativo para selecionar a peça pelo nome
 * - Hit-area generosa (a região inteira é clicável, não só um pontinho)
 *
 * Mantém o contrato existente: emite o `label` da peça via onAddDamage.
 */

export type CarZone = {
  id: string;
  label: string;
  /** Path SVG da região no viewBox 300x500 (vista superior) */
  topPath?: string;
  /** Path SVG da região no viewBox 600x180 (vista lateral) */
  sidePath?: string;
};

// ── Catálogo único de peças (nomes completos, sem abreviar) ──────────────
export const CAR_ZONES: CarZone[] = [
  // Vista superior
  { id: "hood", label: "Capô",
    topPath: "M95,52 L205,52 L210,108 L90,108 Z" },
  { id: "front-bumper", label: "Para-choque dianteiro",
    topPath: "M60,18 C90,8 210,8 240,18 L235,52 L65,52 Z" },
  { id: "windshield", label: "Para-brisa",
    topPath: "M90,108 L210,108 L218,150 L82,150 Z" },
  { id: "roof", label: "Teto",
    topPath: "M88,155 L212,155 L212,278 L88,278 Z" },
  { id: "rear-window", label: "Vidro traseiro",
    topPath: "M82,278 L218,278 L210,318 L90,318 Z" },
  { id: "trunk", label: "Tampa do porta-malas",
    topPath: "M90,318 L210,318 L205,378 L95,378 Z" },
  { id: "rear-bumper", label: "Para-choque traseiro",
    topPath: "M65,378 L235,378 L240,418 C210,432 90,432 60,418 Z" },

  { id: "front-left-fender", label: "Para-lama dianteiro esquerdo",
    topPath: "M48,52 L88,52 L88,108 L48,108 Z" },
  { id: "front-right-fender", label: "Para-lama dianteiro direito",
    topPath: "M212,52 L252,52 L252,108 L212,108 Z" },
  { id: "rear-left-fender", label: "Para-lama traseiro esquerdo",
    topPath: "M48,318 L88,318 L88,378 L48,378 Z" },
  { id: "rear-right-fender", label: "Para-lama traseiro direito",
    topPath: "M212,318 L252,318 L252,378 L212,378 Z" },

  { id: "front-left-door", label: "Porta dianteira esquerda",
    topPath: "M48,155 L88,155 L88,215 L48,215 Z" },
  { id: "front-right-door", label: "Porta dianteira direita",
    topPath: "M212,155 L252,155 L252,215 L212,215 Z" },
  { id: "rear-left-door", label: "Porta traseira esquerda",
    topPath: "M48,218 L88,218 L88,278 L48,278 Z" },
  { id: "rear-right-door", label: "Porta traseira direita",
    topPath: "M212,218 L252,218 L252,278 L212,278 Z" },

  { id: "left-mirror", label: "Retrovisor esquerdo",
    topPath: "M28,118 L48,118 L48,142 L28,142 Z" },
  { id: "right-mirror", label: "Retrovisor direito",
    topPath: "M252,118 L272,118 L272,142 L252,142 Z" },

  { id: "front-left-wheel", label: "Roda dianteira esquerda",
    topPath: "M30,108 L58,108 L58,155 L30,155 Z" },
  { id: "front-right-wheel", label: "Roda dianteira direita",
    topPath: "M242,108 L270,108 L270,155 L242,155 Z" },
  { id: "rear-left-wheel", label: "Roda traseira esquerda",
    topPath: "M30,318 L58,318 L58,365 L30,365 Z" },
  { id: "rear-right-wheel", label: "Roda traseira direita",
    topPath: "M242,318 L270,318 L270,365 L242,365 Z" },

  // Vista lateral (viewBox 600x180) — peças que ficam escondidas de cima
  { id: "left-front-headlight", label: "Farol dianteiro",
    sidePath: "M30,80 L70,75 L70,105 L30,100 Z" },
  { id: "left-front-fog", label: "Farol de neblina",
    sidePath: "M30,110 L60,108 L60,128 L30,130 Z" },
  { id: "left-rocker-panel", label: "Soleira lateral esquerda",
    sidePath: "M120,135 L480,135 L480,155 L120,155 Z" },
  { id: "left-front-window", label: "Vidro dianteiro lateral esquerdo",
    sidePath: "M170,48 L280,48 L280,90 L170,90 Z" },
  { id: "left-rear-window", label: "Vidro traseiro lateral esquerdo",
    sidePath: "M285,48 L420,48 L420,90 L285,90 Z" },
  { id: "left-tail-light", label: "Lanterna traseira",
    sidePath: "M530,80 L570,75 L570,108 L530,105 Z" },
  { id: "exhaust", label: "Escapamento",
    sidePath: "M520,148 L560,148 L560,160 L520,160 Z" },
];

const NAME_BY_ID = Object.fromEntries(CAR_ZONES.map((z) => [z.id, z.label]));

interface Props {
  damageCountByLabel: Record<string, number>;
  onAddDamage: (label: string) => void;
  disabled?: boolean;
}

export default function CarDamageMap({ damageCountByLabel, onAddDamage, disabled }: Props) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedFromList, setSelectedFromList] = useState<string>("");

  const totalDamages = useMemo(
    () => Object.values(damageCountByLabel).reduce((a, b) => a + b, 0),
    [damageCountByLabel]
  );

  const hoverLabel = hoverId ? NAME_BY_ID[hoverId] : null;

  const renderRegion = (z: CarZone, path: string) => {
    const count = damageCountByLabel[z.label] || 0;
    const hasDamage = count > 0;
    const isHover = hoverId === z.id;

    return (
      <g key={z.id}>
        <path
          d={path}
          fill={
            hasDamage
              ? "hsl(var(--primary) / 0.18)"
              : isHover
              ? "hsl(var(--primary) / 0.12)"
              : "hsl(var(--card))"
          }
          stroke={
            hasDamage
              ? "hsl(var(--primary))"
              : isHover
              ? "hsl(var(--primary) / 0.7)"
              : "hsl(var(--primary) / 0.18)"
          }
          strokeWidth={hasDamage ? 1.6 : isHover ? 1.4 : 0.9}
          style={{
            cursor: disabled ? "not-allowed" : "pointer",
            transition: "fill 200ms ease-out, stroke 200ms ease-out, stroke-width 200ms ease-out",
            filter: isHover || hasDamage ? "drop-shadow(0 0 6px hsl(var(--primary) / 0.35))" : undefined,
          }}
          onMouseEnter={() => setHoverId(z.id)}
          onMouseLeave={() => setHoverId((id) => (id === z.id ? null : id))}
          onClick={() => !disabled && onAddDamage(z.label)}
        >
          <title>{z.label}{count ? ` (${count})` : ""}</title>
        </path>
      </g>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header — private bank style */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="w-[3px] h-7 bg-primary rounded-full" />
          <div>
            <p className="admin-section-title text-sm">Mapa de Avarias</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Clique na peça do veículo para registrar uma avaria
            </p>
          </div>
          <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full bg-primary/8 border border-primary/25 text-[10px] font-medium tracking-wider uppercase text-primary tabular-nums">
            {String(totalDamages).padStart(2, "0")} {totalDamages === 1 ? "Registro" : "Registros"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedFromList}
            onValueChange={(v) => setSelectedFromList(v)}
            disabled={disabled}
          >
            <SelectTrigger className="h-9 w-full sm:w-[260px] bg-card border-border/60">
              <SelectValue placeholder="Selecionar peça pelo nome..." />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {CAR_ZONES.map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {z.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="sm"
            disabled={disabled || !selectedFromList}
            onClick={() => {
              if (selectedFromList) {
                onAddDamage(NAME_BY_ID[selectedFromList]);
                setSelectedFromList("");
              }
            }}
            className="h-9 px-4 gap-1.5"
          >
            <Plus size={14} /> Adicionar
          </Button>
        </div>
      </div>

      {/* Rótulo flutuante elegante */}
      <div className="h-8 flex items-center justify-center">
        {hoverLabel ? (
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-card/90 backdrop-blur-sm border border-primary/25 shadow-sm text-xs font-medium text-foreground transition-all duration-200 animate-in fade-in slide-in-from-bottom-1">
            {hoverLabel}
            {damageCountByLabel[hoverLabel] ? (
              <span className="text-[10px] font-semibold tracking-wider uppercase text-primary tabular-nums">
                · {damageCountByLabel[hoverLabel]} avaria{damageCountByLabel[hoverLabel] === 1 ? "" : "s"}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground/70 tracking-wider uppercase">
            Passe o mouse sobre uma peça
          </span>
        )}
      </div>

      {/* Painéis com divisor dourado central */}
      <div className="grid md:grid-cols-2 gap-0 md:gap-0 rounded-xl overflow-hidden border border-border/40 bg-gradient-to-b from-card/40 to-background relative">
        {/* Divisor vertical dourado entre os painéis (apenas md+) */}
        <div className="hidden md:block absolute left-1/2 top-6 bottom-6 w-px bg-gradient-to-b from-transparent via-primary/25 to-transparent pointer-events-none" />

        {/* Vista superior */}
        <div className="p-6 md:p-8 flex flex-col items-center relative">
          <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-muted-foreground/80 mb-5">
            Vista Superior
          </span>
          <svg viewBox="0 0 300 460" className="w-full h-auto max-w-[240px]" style={{ maxHeight: 480 }}>
            <defs>
              {/* Sombra projetada sob o veículo */}
              <radialGradient id="topGroundShadow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--foreground) / 0.35)" />
                <stop offset="60%" stopColor="hsl(var(--foreground) / 0.10)" />
                <stop offset="100%" stopColor="hsl(var(--foreground) / 0)" />
              </radialGradient>
              {/* Corpo metálico — verticalmente, claro nas bordas, escuro no centro */}
              <linearGradient id="topBodyGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="hsl(var(--card))" stopOpacity="0.95" />
                <stop offset="18%" stopColor="hsl(var(--muted) / 0.55)" />
                <stop offset="50%" stopColor="hsl(var(--card) / 0.25)" />
                <stop offset="82%" stopColor="hsl(var(--muted) / 0.55)" />
                <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="0.95" />
              </linearGradient>
              {/* Reflexo especular dourado no centro */}
              <linearGradient id="topSheen" x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--primary) / 0)" />
                <stop offset="35%" stopColor="hsl(var(--primary) / 0.10)" />
                <stop offset="65%" stopColor="hsl(var(--primary) / 0.10)" />
                <stop offset="100%" stopColor="hsl(var(--primary) / 0)" />
              </linearGradient>
              <filter id="topBodyShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="hsl(var(--foreground))" floodOpacity="0.18" />
              </filter>
            </defs>

            {/* Sombra no chão */}
            <ellipse cx="150" cy="450" rx="120" ry="8" fill="url(#topGroundShadow)" />

            {/* Corpo do carro — gradiente metálico com sombra projetada */}
            <g filter="url(#topBodyShadow)">
              <path
                d="M150 12 C95 12 65 28 58 55 L48 100 L40 200 L40 290 L48 380 L58 415 C65 432 95 442 150 442 C205 442 235 432 242 415 L252 380 L260 290 L260 200 L252 100 L242 55 C235 28 205 12 150 12 Z"
                fill="url(#topBodyGrad)"
                stroke="hsl(var(--primary) / 0.35)"
                strokeWidth="0.8"
              />
              <path
                d="M150 12 C95 12 65 28 58 55 L48 100 L40 200 L40 290 L48 380 L58 415 C65 432 95 442 150 442 C205 442 235 432 242 415 L252 380 L260 290 L260 200 L252 100 L242 55 C235 28 205 12 150 12 Z"
                fill="url(#topSheen)"
                pointerEvents="none"
              />
            </g>

            {CAR_ZONES.filter((z) => z.topPath).map((z) => renderRegion(z, z.topPath!))}

            {/* Highlight superior — brilho fino no capô */}
            <path
              d="M95,52 C115,46 185,46 205,52"
              fill="none"
              stroke="hsl(var(--primary) / 0.25)"
              strokeWidth="0.6"
              pointerEvents="none"
            />
            {/* Highlight no teto */}
            <line x1="150" y1="160" x2="150" y2="273" stroke="hsl(var(--primary) / 0.12)" strokeWidth="0.5" pointerEvents="none" />
          </svg>
        </div>

        {/* Vista lateral */}
        <div className="p-6 md:p-8 flex flex-col items-center border-t md:border-t-0 border-border/40 relative">
          <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-muted-foreground/80 mb-5">
            Vista Lateral (Esquerda)
          </span>
          <div className="w-full flex-1 flex items-center justify-center">
            <svg viewBox="0 0 600 200" className="w-full h-auto max-w-[420px]">
              <defs>
                <radialGradient id="sideGroundShadow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="hsl(var(--foreground) / 0.40)" />
                  <stop offset="60%" stopColor="hsl(var(--foreground) / 0.12)" />
                  <stop offset="100%" stopColor="hsl(var(--foreground) / 0)" />
                </radialGradient>
                {/* Corpo lateral — claro em cima (teto reflete céu), escuro embaixo */}
                <linearGradient id="sideBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="hsl(var(--card))" stopOpacity="0.95" />
                  <stop offset="40%" stopColor="hsl(var(--muted) / 0.55)" />
                  <stop offset="100%" stopColor="hsl(var(--card) / 0.25)" />
                </linearGradient>
                {/* Faixa de reflexo dourado horizontal */}
                <linearGradient id="sideSheen" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="hsl(var(--primary) / 0)" />
                  <stop offset="30%" stopColor="hsl(var(--primary) / 0.12)" />
                  <stop offset="70%" stopColor="hsl(var(--primary) / 0.12)" />
                  <stop offset="100%" stopColor="hsl(var(--primary) / 0)" />
                </linearGradient>
                {/* Roda — gradiente radial para profundidade */}
                <radialGradient id="wheelGrad" cx="50%" cy="40%" r="60%">
                  <stop offset="0%" stopColor="hsl(var(--muted))" />
                  <stop offset="55%" stopColor="hsl(var(--card))" />
                  <stop offset="100%" stopColor="hsl(var(--foreground) / 0.85)" />
                </radialGradient>
                <radialGradient id="hubGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.85" />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
                </radialGradient>
                <filter id="sideBodyShadow" x="-10%" y="-10%" width="120%" height="140%">
                  <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="hsl(var(--foreground))" floodOpacity="0.22" />
                </filter>
              </defs>

              {/* Sombra projetada no chão */}
              <ellipse cx="300" cy="185" rx="270" ry="9" fill="url(#sideGroundShadow)" />

              {/* Carroceria com gradiente + sombra projetada */}
              <g filter="url(#sideBodyShadow)">
                <path
                  d="M30,135 C20,118 30,80 60,72 L160,42 C180,38 420,38 440,42 L540,72 C570,80 580,118 570,135 L570,160 L30,160 Z"
                  fill="url(#sideBodyGrad)"
                  stroke="hsl(var(--primary) / 0.35)"
                  strokeWidth="0.8"
                />
                <path
                  d="M30,135 C20,118 30,80 60,72 L160,42 C180,38 420,38 440,42 L540,72 C570,80 580,118 570,135 L570,160 L30,160 Z"
                  fill="url(#sideSheen)"
                  pointerEvents="none"
                />
              </g>

              {/* Rodas com profundidade — pneu, aro, raios, cubo dourado */}
              {[135, 465].map((cx) => (
                <g key={cx}>
                  {/* pneu */}
                  <circle cx={cx} cy={155} r={30} fill="hsl(var(--foreground) / 0.92)" />
                  {/* aro/disco */}
                  <circle cx={cx} cy={155} r={24} fill="url(#wheelGrad)" stroke="hsl(var(--primary) / 0.5)" strokeWidth="0.8" />
                  {/* raios */}
                  {[0, 60, 120, 180, 240, 300].map((a) => (
                    <line
                      key={a}
                      x1={cx}
                      y1={155}
                      x2={cx + Math.cos((a * Math.PI) / 180) * 22}
                      y2={155 + Math.sin((a * Math.PI) / 180) * 22}
                      stroke="hsl(var(--primary) / 0.35)"
                      strokeWidth="0.7"
                    />
                  ))}
                  {/* cubo central dourado */}
                  <circle cx={cx} cy={155} r={5} fill="url(#hubGrad)" stroke="hsl(var(--primary))" strokeWidth="0.6" />
                </g>
              ))}

              {CAR_ZONES.filter((z) => z.sidePath).map((z) => renderRegion(z, z.sidePath!))}

              {/* Vinco lateral — linha de caráter sutil dourada */}
              <path
                d="M70,115 C200,108 400,108 540,115"
                fill="none"
                stroke="hsl(var(--primary) / 0.22)"
                strokeWidth="0.6"
                pointerEvents="none"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Legenda — bordas finas, sem cor crua */}
      <div className="flex items-center justify-center gap-6 pt-1">
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground tracking-wider uppercase font-medium">
          <span className="w-2.5 h-2.5 rounded-full border border-primary/35 bg-card inline-block" />
          Sem avaria
        </span>
        <span className="flex items-center gap-2 text-[11px] text-muted-foreground tracking-wider uppercase font-medium">
          <span
            className="w-2.5 h-2.5 rounded-full bg-primary inline-block"
            style={{ boxShadow: "0 0 6px hsl(var(--primary) / 0.45)" }}
          />
          Com avaria
        </span>
      </div>
    </div>
  );
}
