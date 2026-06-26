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
import tiguanAsset from "@/assets/models3d/vw-tiguan.glb.asset.json";

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
  /**
   * OPTIONAL model-specific mesh classifier. When present, it runs BEFORE
   * the generic LABEL_RULES and the spatial inference. Returns `null` to
   * fall through to the generic pipeline. This is how we get pixel-perfect
   * part-by-part highlighting on curated GLBs (e.g. Tiguan).
   */
  meshClassifier?: (meshName: string) => MeshClassification | null;
};

export const VEHICLE_3D_MODELS: Record<string, Vehicle3dModelDef> = {
  "vw-tiguan": {
    key: "vw-tiguan",
    label: "Volkswagen Tiguan",
    url: tiguanAsset.url,
    attribution: "Modelo: 2022 Volkswagen Tiguan L 430 PHEV · CC-BY",
    defaultForCategories: [],
    cameraPosition: [5.2, 2.4, 6.2],
    cameraTarget: [0, 0.6, 0],
    meshClassifier: classifyTiguanMesh,
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
  "ferrari-458": {
    key: "ferrari-458",
    label: "Ferrari 458 Italia",
    url: ferrariAsset.url,
    attribution: "Modelo: Ferrari 458 Italia · vicent091036 · CC-BY 3.0",
    source: "https://threejs.org/examples/?q=car#webgl_materials_car",
    defaultForCategories: ["esportivo", "sports", "coupe", "cupê", "supercar"],
    cameraPosition: [4.5, 2.2, 5.5],
    cameraTarget: [0, 0.4, 0],
  },
};

/** All registered models, ordered for UI listings */
export const ALL_VEHICLE_3D_MODELS: Vehicle3dModelDef[] = Object.values(VEHICLE_3D_MODELS);

/** Default fallback — Khronos has segmented panels (hood/doors/fenders), better UX */
export const FALLBACK_MODEL: Vehicle3dModelDef = VEHICLE_3D_MODELS["khronos-concept"];

/** Lightweight subset of a vehicle row used to pick a model */
export type VehicleLike = {
  category?: string | null;
  body_type?: string | null;
  brand?: string | null;
  model?: string | null;
  name?: string | null;
} | null | undefined;

export function pickVehicle3dModel(vehicle: VehicleLike): Vehicle3dModelDef {
  if (!vehicle) return FALLBACK_MODEL;

  const haystack = [vehicle.brand, vehicle.model, vehicle.name]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (haystack.includes("tiguan")) {
    return VEHICLE_3D_MODELS["vw-tiguan"];
  }

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
// Returns a group label in pt-BR. Multiple sub-meshes can map to the same
// label — that's intentional: hovering any sub-mesh of "Porta dianteira
// esquerda" (color1, color2, handle, mirror, window…) lights up the whole
// logical part together.
//
// Handles both naming conventions:
//   - Khronos CarConcept:  BodyHood, BodyDoorLColor1, BodyDoorLMirror,
//                          BodyRoofPanel, BodyPanelsColor2, BodyRearPanels…,
//                          WheelFrontL*, BodyHeadlights, BodyTaillights, etc.
//   - Ferrari 458:         body, glass, trim, rim_fl, wheel_fr…
//   - Generic 3D artists:  hood, door_fl, fender_l, bumper_front…

type LabelRule = { test: RegExp; label: string; pickable?: boolean };

const NON_PICKABLE = false;

const LABEL_RULES: LabelRule[] = [
  // ── INTERIOR (não clicável) ──
  { test: /^interior|seat|dash|pedal|steering|carpet|floor|cage|pillar.*interior|hatchinterior|hoodinterior|hoodunder|hoodtopgrill|axles|engine|bodyunderside|leather|carbon|chrome$|^centre$|^nuts$|^brake$|brakedisc|brakepad/i, label: "Interior", pickable: NON_PICKABLE },

  // ── RODAS (cada canto agrupado) ──
  { test: /(wheel|rim|tire|tyre).*(front.?l|fl\b|_fl|frontleft)/i, label: "Roda dianteira esquerda" },
  { test: /(wheel|rim|tire|tyre).*(front.?r|fr\b|_fr|frontright)/i, label: "Roda dianteira direita" },
  { test: /(wheel|rim|tire|tyre).*(rear.?l|rl\b|_rl|back.?l)/i, label: "Roda traseira esquerda" },
  { test: /(wheel|rim|tire|tyre).*(rear.?r|rr\b|_rr|back.?r)/i, label: "Roda traseira direita" },
  { test: /(wheel|rim|tire|tyre)/i, label: "Roda" },

  // ── VIDROS ──
  { test: /windshield|windscreen|para.?brisa/i, label: "Para-brisa" },
  { test: /rearwindow|window.*rear|rear.*window|vidro.*tras/i, label: "Vidro traseiro" },
  { test: /(window|glass|vidro).*(rear.?sides|sides|laterais)/i, label: "Vidros laterais" },
  { test: /doorl.*window|window.*l\b|vidro.*esq/i, label: "Vidro porta esquerda" },
  { test: /doorr.*window|window.*r\b|vidro.*dir/i, label: "Vidro porta direita" },
  { test: /glass|window|vidro/i, label: "Vidros" },

  // ── PORTAS (todos sub-componentes agrupados) ──
  { test: /doorl(color|handle|mirror|window|gasket|$)|door.*(front.?left|_fl|fl\b)/i, label: "Porta esquerda" },
  { test: /doorr(color|handle|mirror|window|gasket|$)|door.*(front.?right|_fr|fr\b)/i, label: "Porta direita" },
  { test: /door.*(rear.?left|rl\b|_rl)/i, label: "Porta traseira esquerda" },
  { test: /door.*(rear.?right|rr\b|_rr)/i, label: "Porta traseira direita" },
  { test: /door/i, label: "Porta" },

  // ── RETROVISORES (caso queiram separar do conjunto da porta) ──
  // (deixei dentro do grupo Porta acima — comente se quiser separar)

  // ── FARÓIS / LANTERNAS ──
  { test: /headlight|head_light|light.*front|front.*light|farol/i, label: "Faróis dianteiros" },
  { test: /taillight|tail_light|light.*rear|rear.*light|brake.*light|lanterna/i, label: "Lanternas traseiras" },
  { test: /turnsignal|pisca|blinker/i, label: "Piscas" },
  { test: /fog.*light|neblina/i, label: "Farol de neblina" },

  // ── CAPÔ ──
  { test: /^bodyhood$|^hood$|bonnet|capo|capô/i, label: "Capô" },
  { test: /hoodtopgrill|grille|grade/i, label: "Grade frontal" },

  // ── TETO ──
  { test: /roofpanel|^roof$|teto/i, label: "Teto" },

  // ── TRASEIRA / PORTA-MALAS ──
  { test: /rearpanel|rear_panel|trunk|boot|tailgate|porta.?malas|bodyrear/i, label: "Traseira / Porta-malas" },

  // ── PARA-CHOQUES ──
  { test: /bumper.*(front|dianteiro)|frontbumper/i, label: "Para-choque dianteiro" },
  { test: /bumper.*(rear|back|traseiro)|rearbumper/i, label: "Para-choque traseiro" },
  { test: /bumper|para.?choque/i, label: "Para-choque" },

  // ── LATERAIS / PARALAMAS ──
  { test: /panelscolor|fender|paralama|quarter.?panel|side.?panel/i, label: "Laterais / Paralamas" },

  // ── ACESSÓRIOS ──
  { test: /mirror|retrovisor/i, label: "Retrovisor" },
  { test: /spoiler|aerofolio|aerofólio/i, label: "Aerofólio" },
  { test: /antenna|antena/i, label: "Antena" },
  { test: /exhaust|escapamento|muffler/i, label: "Escapamento" },
  { test: /wiper|limpador/i, label: "Limpador de para-brisa" },
  { test: /license.?plate|placa/i, label: "Placa" },
  { test: /trim|moldur/i, label: "Frisos / Molduras" },

  // ── CARROCERIA (Ferrari "body" cai aqui) ──
  { test: /^body$|carroceria|chassis|carbody|car_body/i, label: "Carroceria" },
];

export type MeshClassification = {
  label: string;
  pickable: boolean;
};

export function classifyMesh(meshName: string | null | undefined): MeshClassification {
  if (!meshName) return { label: "__UNKNOWN__", pickable: true };
  for (const rule of LABEL_RULES) {
    if (rule.test.test(meshName)) {
      return { label: rule.label, pickable: rule.pickable !== false };
    }
  }
  return { label: "__UNKNOWN__", pickable: true };
}

/** Back-compat helper — most callers just need the label */
export function inferMeshLabel(meshName: string | null | undefined): string {
  const c = classifyMesh(meshName);
  return c.label === "__UNKNOWN__" ? "Peça do veículo" : c.label;
}

// ─── Spatial label inference ──────────────────────────────────────────────────
// When a mesh name doesn't match any rule, infer the real part name from
// WHERE the mesh sits in the car's local coordinate system. Coordinates are
// normalized to [-1,1] using the full car bounding box, where +Z is "front"
// (towards the camera default), +Y is "top", +X is "right".
//
// This guarantees every visible panel gets a real-world Portuguese name —
// "Capô", "Teto", "Paralama dianteiro esquerdo", "Para-choque traseiro" etc.

export type NormalizedPoint = { x: number; y: number; z: number };

export function inferLabelByPosition(p: NormalizedPoint): string {
  const { x, y, z } = p;

  // Underbody / chassis — não é peça visual relevante
  if (y < -0.55) return "Assoalho / Chassi";

  // ── TOPO do carro ──
  if (y > 0.35) {
    if (z > 0.45) return "Capô";
    if (z < -0.45) return "Porta-malas / Tampa traseira";
    return "Teto";
  }

  // ── FRENTE ──
  if (z > 0.55) {
    if (y < -0.1) return "Para-choque dianteiro";
    if (Math.abs(x) > 0.45) {
      return x > 0 ? "Farol dianteiro direito" : "Farol dianteiro esquerdo";
    }
    return "Grade frontal";
  }

  // ── TRASEIRA ──
  if (z < -0.55) {
    if (y < -0.1) return "Para-choque traseiro";
    if (Math.abs(x) > 0.45) {
      return x > 0 ? "Lanterna traseira direita" : "Lanterna traseira esquerda";
    }
    return "Painel traseiro";
  }

  // ── LATERAIS ──
  if (Math.abs(x) > 0.4) {
    const side = x > 0 ? "direito" : "direita";
    const sideF = x > 0 ? "direita" : "esquerda";

    // Paralamas (extremidades do comprimento)
    if (z > 0.2) {
      return `Paralama dianteiro ${x > 0 ? "direito" : "esquerdo"}`;
    }
    if (z < -0.2) {
      return `Paralama traseiro ${x > 0 ? "direito" : "esquerdo"}`;
    }

    // Estribo / soleira embaixo
    if (y < -0.2) {
      return `Soleira ${sideF}`;
    }

    // Porta (meio lateral)
    return `Porta ${sideF}`;
  }

  // Centro do meio — provavelmente longarina/painel inferior
  if (y < -0.1) return "Painel inferior";

  return "Lateral central";
}

// ─── Tiguan-specific classifier ───────────────────────────────────────────────
// The Tiguan GLB has 148 sub-meshes with very descriptive prefixes
// (`02_car_body_lf_door_*`, `43_car_body_trunk_*`, `13_headlight_*` ...).
// We map every single mesh to a real, Portuguese, anatomically-correct part
// label so that hovering any sub-mesh lights up the exact panel.
//
// Mesh-name → part label was derived by inspecting bounding boxes against the
// car's local axes (length axis = Z, width axis = X, vertical = Y).

const TIGUAN_EXACT: Record<string, { label: string; pickable?: boolean }> = {
  // ── CAPÔ ──
  "01_car_body_carPaint_0": { label: "Capô" },
  "01_car_body_4_carPaint_0": { label: "Capô" },

  // ── PARA-CHOQUE DIANTEIRO + GRADE ──
  "01_car_body_1_carPaint_0": { label: "Para-choque dianteiro" },
  "01_car_body_2_carPaint_0": { label: "Para-choque dianteiro" },
  "01_car_body_3_carPaint_0": { label: "Para-choque dianteiro" },
  "01_car_body_12_carPaint_0": { label: "Para-choque dianteiro" },
  "01_car_body_16_carPaint_0": { label: "Para-choque dianteiro" },

  // ── PARA-CHOQUE TRASEIRO ──
  "01_car_body_8_carPaint_0": { label: "Para-choque traseiro" },
  "01_car_body_9_carPaint_0": { label: "Para-choque traseiro" },
  "01_car_body_10_carPaint_0": { label: "Para-choque traseiro" },
  "01_car_body_13_carPaint_0": { label: "Para-choque traseiro" },
  "43_car_body_trunk_4_carPaint_0": { label: "Para-choque traseiro" },

  // ── LATERAIS (sills + colunas) ──
  "01_car_body_14_carPaint_0": { label: "Coluna traseira esquerda" },
  "01_car_body_17_carPaint_0": { label: "Soleira esquerda" },
  "01_car_body_20_carPaint_0": { label: "Soleira direita" },
  "01_car_body_19_carPaint_0": { label: "Caixilho de teto esquerdo" },
  "01_car_body_21_carPaint_0": { label: "Caixilho de teto direito" },

  // ── TETO ──
  "51_car_body_top_carPaint_0": { label: "Teto" },
  "01_car_body_18_carPaint_0": { label: "Teto" },

  // ── TAMPA DO PORTA-MALAS ──
  "43_car_body_trunk_carPaint_0": { label: "Tampa do porta-malas" },
  "43_car_body_trunk_1_carPaint_0": { label: "Tampa do porta-malas" },
  "43_car_body_trunk_2_carPaint_0": { label: "Tampa do porta-malas" },
  "43_car_body_trunk_3_carPaint_0": { label: "Tampa do porta-malas" },
  "43_car_body_trunk_5_carPaint_0": { label: "Tampa do porta-malas" },

  // ── ASSOALHO / CHASSI (não clicável) ──
  "01_car_body_15_carPaint_0": { label: "Assoalho / Chassi", pickable: false },
  "58_car_body_bottom_chassis_0": { label: "Assoalho / Chassi", pickable: false },
  "jiemian_chassis_0": { label: "Assoalho / Chassi", pickable: false },
};

export function classifyTiguanMesh(name: string): MeshClassification | null {
  // 1) Exact match (body subdivisions classified by bounding box analysis)
  const exact = TIGUAN_EXACT[name];
  if (exact) return { label: exact.label, pickable: exact.pickable !== false };

  // 2) Prefix-based rules for everything else
  // PORTAS — sub-componentes (color, plastic, glass, mirror, badge…) agrupados
  if (/^0[2-9]_lf_door|^lf_volkswagen|02_car_body_lf_door/i.test(name)) {
    return { label: "Porta dianteira esquerda", pickable: true };
  }
  if (/^2[5-9]_lr_door|^3[0-1]_lr_door|25_car_body_lr_door/i.test(name)) {
    return { label: "Porta traseira esquerda", pickable: true };
  }
  if (/^3[1-8]_rf_door|^rf_volkswagen|31_car_body_rf_door/i.test(name)) {
    return { label: "Porta dianteira direita", pickable: true };
  }
  if (/^3[8-9]_rr_door|^4[0-6]_rr_door|38_car_body_rr_door/i.test(name)) {
    return { label: "Porta traseira direita", pickable: true };
  }

  // RETROVISORES (mesh dedicado)
  if (/37_rf_door_mirror/i.test(name)) return { label: "Retrovisor direito", pickable: true };
  if (/53_inner_map_c_1_mirror/i.test(name)) return { label: "Retrovisor esquerdo", pickable: true };

  // FARÓIS DIANTEIROS (todas as camadas: glass, plastic, white_plastic, chrome, badges, IQLIGHT)
  if (/^(1[3-7]|59|60_IQLIGHT|62_inner|63|64_inner|65)_/i.test(name) && !/Taillight|tail/i.test(name)) {
    // Decide lado pelo nome? não tem _l/_r — usar único grupo "Faróis dianteiros"
    return { label: "Faróis dianteiros", pickable: true };
  }
  if (/^18_car_body_black_plastic_b/i.test(name)) {
    return { label: "Faróis dianteiros", pickable: true };
  }

  // LANTERNAS TRASEIRAS
  if (/58_Taillight|^(141|142|143|146|147)_/i.test(name) || /Car_L_Rod|car_L_rod/i.test(name)) {
    return { label: "Lanternas traseiras", pickable: true };
  }

  // PARA-BRISA (glass principal da carroceria)
  if (/^09_car_body_glass/i.test(name)) return { label: "Para-brisa", pickable: true };

  // TETO SOLAR
  if (/^52_top_glass/i.test(name)) return { label: "Teto solar", pickable: true };

  // RODAS — pneus, aros, freios (não distinguimos os 4 cantos no Tiguan GLB)
  if (/^(2[1-2])_tire/i.test(name)) return { label: "Pneus", pickable: true };
  if (/^(2[3-4])_hub/i.test(name)) return { label: "Rodas (aros)", pickable: true };
  if (/^49_brake/i.test(name)) return { label: "Discos de freio", pickable: true };

  // EMBLEMA / BADGES
  if (/^54_chebiao|volkswagen_black|46_trunk_map_c_badges|14_headlight_map_c.*badges/i.test(name)) {
    return { label: "Emblemas", pickable: true };
  }

  // PLACA
  if (/license|placa|^73_PHEV|^71_inner_red|^72_inner_blue|^70_inner_white/i.test(name)) {
    return { label: "Placa", pickable: true };
  }

  // CARROCERIA — peças plásticas externas pretas restantes
  if (/^1[0-1]_car_body_(plastic|black_plastic)/i.test(name)) {
    return { label: "Frisos / Molduras externas", pickable: true };
  }
  if (/^12_car_body_metal/i.test(name)) {
    return { label: "Frisos cromados", pickable: true };
  }

  // INTERIOR — não clicável
  if (/^(5[3-7]|6[1-9]|8[0])_/i.test(name) || /chair|inner_chair|inner_map|inner_plastic|inner_metal|inner_white|inner_red|inner_blue/i.test(name)) {
    return { label: "Interior", pickable: false };
  }

  // CHASSI / underbody
  if (/chassis|jiemian/i.test(name)) {
    return { label: "Assoalho / Chassi", pickable: false };
  }

  return null; // fall through to generic rules
}


