import { useState, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import CarRealisticViewer from "./CarRealisticViewer";

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

import type { VehicleLike } from "@/data/vehicle3dModels";

interface Props {
  damageCountByLabel: Record<string, number>;
  onAddDamage: (label: string) => void;
  disabled?: boolean;
  vehicle?: VehicleLike;
}

export default function CarDamageMap({ damageCountByLabel, onAddDamage, disabled, vehicle }: Props) {
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
      {/* Header. private bank style */}
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

      {/* Visualização 3D real do veículo. modelo é escolhido pela categoria */}
      <CarRealisticViewer
        damageCountByLabel={damageCountByLabel}
        onAddDamage={onAddDamage}
        disabled={disabled}
        vehicle={vehicle}
      />



      {/* Legenda. bordas finas, sem cor crua */}
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
