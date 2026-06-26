// Curated library of REAL car 3D models with permissive licenses.
// Each entry is hosted on the Lovable CDN and ships with proper attribution.
//
// IMPORTANT (licensing):
//   All models here are CC-BY (or compatible). The viewer MUST render the
//   attribution string returned from `pickVehicle3dModel`. Do not strip it.
//
// Adding more models: drop a .glb under src/assets/models3d/, register it
// here with its license + author, and update `defaultForCategories`.

import ferrariAsset from "@/assets/models3d/ferrari-458.glb.asset.json";
import conceptAsset from "@/assets/models3d/khronos-concept.glb.asset.json";

export type Vehicle3dModelDef = {
  /** Stable identifier (used as React key / DB hint) */
  key: string;
  /** Human label shown in the attribution badge */
  label: string;
  /** CDN URL of the .glb file */
  url: string;
  /** Author / license string shown in-canvas */
  attribution: string;
  /** Source URL for traceability (clickable in admin UI) */
  source?: string;
  /** Vehicle categories this model is a sensible silhouette for */
  defaultForCategories: string[];
  /** Camera initial position (x,y,z) — tuned per model scale */
  cameraPosition?: [number, number, number];
  /** Target/look-at point */
  cameraTarget?: [number, number, number];
};

export const VEHICLE_3D_MODELS: Record<string, Vehicle3dModelDef> = {
  "ferrari-458": {
    key: "ferrari-458",
    label: "Ferrari 458 Italia",
    url: ferrariAsset.url,
    attribution: "Modelo: Ferrari 458 Italia · vicent091036 · CC-BY 3.0",
    source: "https://threejs.org/examples/?q=car#webgl_materials_car",
    defaultForCategories: ["esportivo", "sports", "coupe", "cupê", "supercar", "premium"],
    cameraPosition: [4.5, 2.2, 5.5],
    cameraTarget: [0, 0.4, 0],
  },
  "khronos-concept": {
    key: "khronos-concept",
    label: "Concept Car (Khronos)",
    url: conceptAsset.url,
    attribution: "Modelo: CarConcept · Khronos Group / Unity Fan · CC-BY 4.0",
    source: "https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept",
    defaultForCategories: ["sedan", "sedã", "hatch", "hatchback", "suv", "crossover", "pickup", "picape"],
    cameraPosition: [5.0, 2.3, 6.0],
    cameraTarget: [0, 0.5, 0],
  },
};

/** All registered models, ordered for UI listings */
export const ALL_VEHICLE_3D_MODELS: Vehicle3dModelDef[] = Object.values(VEHICLE_3D_MODELS);

/** Sensible fallback when no category matches */
export const FALLBACK_MODEL: Vehicle3dModelDef = VEHICLE_3D_MODELS["ferrari-458"];

/** Lightweight subset of a vehicle row used to pick a model */
export type VehicleLike = {
  category?: string | null;
  body_type?: string | null;
  brand?: string | null;
  model?: string | null;
  name?: string | null;
} | null | undefined;

/**
 * Picks the best curated 3D model for a given vehicle.
 *
 * Strategy:
 *  1. Exact key override via brand+model heuristic (e.g. "Ferrari 458" → ferrari-458)
 *  2. Category match against `defaultForCategories`
 *  3. Fallback to a known-good model
 */
export function pickVehicle3dModel(vehicle: VehicleLike): Vehicle3dModelDef {
  if (!vehicle) return FALLBACK_MODEL;

  const haystack = [
    vehicle.brand,
    vehicle.model,
    vehicle.name,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Explicit overrides for vehicles whose name matches a curated silhouette
  if (haystack.includes("ferrari") || haystack.includes("458")) {
    return VEHICLE_3D_MODELS["ferrari-458"];
  }

  const cat = (vehicle.category || vehicle.body_type || "").toLowerCase().trim();
  if (cat) {
    for (const def of ALL_VEHICLE_3D_MODELS) {
      if (def.defaultForCategories.some((c) => cat.includes(c))) {
        return def;
      }
    }
  }

  return FALLBACK_MODEL;
}

// ─── Smart mesh labelling ─────────────────────────────────────────────────────
//
// We don't know in advance the mesh naming convention of every GLB, so we infer
// a friendly pt-BR label from substrings. This works across the Ferrari (uses
// "body", "rim_fl", "trim", "glass") AND the Khronos concept car (uses
// "Body", "Wheel", "Glass" etc.), and any future asset that follows the usual
// 3D-artist conventions.

type LabelRule = { test: RegExp; label: string };

const LABEL_RULES: LabelRule[] = [
  // Wheels — position-aware
  { test: /(wheel|rim|tire|tyre).*(fl|front.*left|frontleft|_l$)/i, label: "Roda dianteira esquerda" },
  { test: /(wheel|rim|tire|tyre).*(fr|front.*right|frontright|_r$)/i, label: "Roda dianteira direita" },
  { test: /(wheel|rim|tire|tyre).*(rl|rear.*left|back.*left)/i, label: "Roda traseira esquerda" },
  { test: /(wheel|rim|tire|tyre).*(rr|rear.*right|back.*right)/i, label: "Roda traseira direita" },
  { test: /(wheel|rim|tire|tyre)/i, label: "Roda" },

  // Glass surfaces
  { test: /windshield|windscreen/i, label: "Para-brisa" },
  { test: /(glass|window).*(rear|back)/i, label: "Vidro traseiro" },
  { test: /(glass|window).*(left|_l)/i, label: "Vidro lateral esquerdo" },
  { test: /(glass|window).*(right|_r)/i, label: "Vidro lateral direito" },
  { test: /glass|window/i, label: "Vidros" },

  // Doors
  { test: /door.*(front.*left|fl|_fl)/i, label: "Porta dianteira esquerda" },
  { test: /door.*(front.*right|fr|_fr)/i, label: "Porta dianteira direita" },
  { test: /door.*(rear.*left|rl|_rl|back.*left)/i, label: "Porta traseira esquerda" },
  { test: /door.*(rear.*right|rr|_rr|back.*right)/i, label: "Porta traseira direita" },
  { test: /door/i, label: "Porta" },

  // Lights
  { test: /(headlight|head_light|light.*front|front.*light)/i, label: "Farol" },
  { test: /(taillight|tail_light|light.*rear|rear.*light|brake.*light)/i, label: "Lanterna traseira" },
  { test: /fog.*light/i, label: "Farol de neblina" },

  // Body sections
  { test: /(hood|bonnet|capo)/i, label: "Capô" },
  { test: /(trunk|boot|tailgate|porta.?malas)/i, label: "Porta-malas" },
  { test: /roof|teto/i, label: "Teto" },
  { test: /(bumper|para.?choque).*(front|dianteiro)/i, label: "Para-choque dianteiro" },
  { test: /(bumper|para.?choque).*(rear|back|traseiro)/i, label: "Para-choque traseiro" },
  { test: /(bumper|para.?choque)/i, label: "Para-choque" },
  { test: /mirror|retrovisor/i, label: "Retrovisor" },
  { test: /grille|grade/i, label: "Grade frontal" },
  { test: /spoiler|aerofolio/i, label: "Aerofólio" },
  { test: /antenna|antena/i, label: "Antena" },
  { test: /exhaust|escapamento|muffler/i, label: "Escapamento" },
  { test: /trim|chrome|cromad|moldur/i, label: "Detalhes cromados" },
  { test: /fender|paralama/i, label: "Paralama" },

  // Whole-body fallback
  { test: /^body$|carroceria|chassis|carbody|car_body/i, label: "Carroceria" },
];

export function inferMeshLabel(meshName: string | null | undefined): string {
  if (!meshName) return "Peça do veículo";
  for (const rule of LABEL_RULES) {
    if (rule.test.test(meshName)) return rule.label;
  }
  return "Peça do veículo";
}
