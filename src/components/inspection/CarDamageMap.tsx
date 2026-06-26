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
              ? "hsl(var(--destructive) / 0.28)"
              : isHover
              ? "hsl(var(--primary) / 0.22)"
              : "hsl(var(--primary) / 0.04)"
          }
          stroke={
            hasDamage
              ? "hsl(var(--destructive))"
              : isHover
              ? "hsl(var(--primary))"
              : "hsl(var(--primary) / 0.25)"
          }
          strokeWidth={hasDamage || isHover ? 1.8 : 1}
          style={{
            cursor: disabled ? "not-allowed" : "pointer",
            transition: "fill 120ms, stroke 120ms",
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
    <div className="space-y-4">
      {/* Header: contador + dropdown alternativo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            Clique na peça do veículo para registrar uma avaria
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Passe o mouse para ver o nome completo · {totalDamages} avaria{totalDamages === 1 ? "" : "s"} registrada{totalDamages === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedFromList}
            onValueChange={(v) => setSelectedFromList(v)}
            disabled={disabled}
          >
            <SelectTrigger className="h-9 w-[260px]">
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
            variant="outline"
            disabled={disabled || !selectedFromList}
            onClick={() => {
              if (selectedFromList) {
                onAddDamage(NAME_BY_ID[selectedFromList]);
                setSelectedFromList("");
              }
            }}
          >
            <Plus size={14} className="mr-1" /> Adicionar
          </Button>
        </div>
      </div>

      {/* Rótulo flutuante grande mostrando peça em destaque */}
      <div className="h-7 flex items-center justify-center">
        {hoverLabel ? (
          <span className="text-sm font-semibold text-foreground bg-muted px-3 py-1 rounded-md border border-border/60 shadow-sm">
            {hoverLabel}
            {damageCountByLabel[hoverLabel] ? (
              <span className="ml-2 text-xs font-normal text-destructive">
                · {damageCountByLabel[hoverLabel]} avaria{damageCountByLabel[hoverLabel] === 1 ? "" : "s"}
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground italic">— passe o mouse sobre uma peça —</span>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Vista superior */}
        <div className="bg-muted/20 rounded-xl p-3 border border-border/30">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground text-center mb-2">
            Vista superior
          </p>
          <svg viewBox="0 0 300 440" className="w-full h-auto" style={{ maxHeight: 460 }}>
            {/* Silhueta do carro (apenas visual) */}
            <path
              d="M150 12 C95 12 65 28 58 55 L48 100 L40 200 L40 290 L48 380 L58 415 C65 432 95 442 150 442 C205 442 235 432 242 415 L252 380 L260 290 L260 200 L252 100 L242 55 C235 28 205 12 150 12 Z"
              fill="hsl(var(--muted) / 0.25)"
              stroke="hsl(var(--border))"
              strokeWidth="1.5"
            />
            {CAR_ZONES.filter((z) => z.topPath).map((z) => renderRegion(z, z.topPath!))}
          </svg>
        </div>

        {/* Vista lateral */}
        <div className="bg-muted/20 rounded-xl p-3 border border-border/30 flex flex-col">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground text-center mb-2">
            Vista lateral (esquerda)
          </p>
          <div className="flex-1 flex items-center">
            <svg viewBox="0 0 600 180" className="w-full h-auto">
              {/* Silhueta lateral */}
              <path
                d="M30,135 C20,118 30,80 60,72 L160,42 C180,38 420,38 440,42 L540,72 C570,80 580,118 570,135 L570,160 L30,160 Z"
                fill="hsl(var(--muted) / 0.25)"
                stroke="hsl(var(--border))"
                strokeWidth="1.5"
              />
              {/* Rodas */}
              <circle cx="135" cy="155" r="28" fill="hsl(var(--foreground) / 0.08)" stroke="hsl(var(--foreground) / 0.25)" strokeWidth="1.5" />
              <circle cx="465" cy="155" r="28" fill="hsl(var(--foreground) / 0.08)" stroke="hsl(var(--foreground) / 0.25)" strokeWidth="1.5" />
              {CAR_ZONES.filter((z) => z.sidePath).map((z) => renderRegion(z, z.sidePath!))}
            </svg>
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex items-center justify-center gap-5 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-primary/10 border border-primary/30 inline-block" /> Sem avaria
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded bg-destructive/25 border border-destructive inline-block" /> Com avaria
        </span>
      </div>
    </div>
  );
}
