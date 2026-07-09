import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  ContactShadows,
  useGLTF,
  Bounds,
  Html,
} from "@react-three/drei";
import * as THREE from "three";
import { RotateCcw, ZoomIn, ZoomOut, Info, Loader2, Plus, X, Hand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { haptic } from "@/lib/haptic";
import {
  pickVehicle3dModel,
  classifyMesh,
  inferLabelByPosition,
  inferTiguanLabelFromPoint,
  TIGUAN_AMBIGUOUS_LABELS,
  VEHICLE_3D_MODELS,
  type VehicleLike,
  type Vehicle3dModelDef,
} from "@/data/vehicle3dModels";

// Kick off the Tiguan GLB download IMMEDIATELY when this module is loaded
// (não espera o Canvas montar). Reduz drasticamente o TTI do visualizador.
try {
  useGLTF.preload(VEHICLE_3D_MODELS["vw-tiguan"].url, true);
} catch {
  /* SSR / test safety */
}


/**
 * CarRealisticViewer
 * Visualizador 3D real do veículo (modelo GLB) com:
 *  - Modelo escolhido automaticamente conforme a categoria do veículo
 *  - Rotação 360° livre (todos os eixos), zoom, pan desativado
 *  - Hover acende a peça INTEIRA em dourado emissivo — todas as sub-malhas
 *    do mesmo grupo lógico (ex: porta = color1+color2+handle+mirror+window)
 *    acendem juntas, dando o efeito de "peça recortada"
 *  - Clique na peça registra avaria
 *  - Atribuição de licença visível (CC-BY)
 */

const GOLD = new THREE.Color("#FFD700");
const DARK = new THREE.Color("#0a0a0a");
const BLACK = new THREE.Color("#000000");

type ClassifiedMesh = {
  mesh: THREE.Mesh;
  label: string;
  pickable: boolean;
};

type CarModelProps = {
  url: string;
  /** Group label currently hovered (not the raw mesh name) */
  hoveredLabel: string | null;
  damagedLabels: Set<string>;
  onHover: (label: string | null) => void;
  onPick: (label: string) => void;
  disabled?: boolean;
};

// Meshes do Tiguan que contêm decalques específicos do mercado chinês
// (texto 上汽大众, placa "New Tiguan L PHEV", marcações 430 PHEV).
// Ocultamos e substituímos por uma placa branca da Sua Marca + label "TIGUAN".
const TIGUAN_BADGES_TO_HIDE = new Set<string>([
  "46_trunk_map_c_badges_0",     // trunk: chinese text + plate + 430 PHEV
  "73_PHEV_blue_plastic_blue_plastic_0", // PHEV blue tag
  "80_map_map_0",                // front grille decal
  "80_glass_glass_0",            // front grille glass decal layer
]);

function makeZeusPlateTexture(): THREE.CanvasTexture {
  const W = 1024, H = 256;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  // fundo branco com borda preta
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#0a0a0a";
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, W - 16, H - 16);
  // faixa dourada superior
  ctx.fillStyle = "#D4AF37";
  ctx.fillRect(16, 16, W - 32, 44);
  ctx.fillStyle = "#0a0a0a";
  ctx.font = "600 26px 'Inter', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("RENTAL STUDIO · ORLANDO FL", W / 2, 38);
  // placa principal
  ctx.fillStyle = "#0a0a0a";
  ctx.font = "700 130px 'Inter', sans-serif";
  ctx.fillText("RENTAL STUDIO", W / 2, 165);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function makeTiguanBadgeTexture(): THREE.CanvasTexture {
  const W = 1024, H = 192;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "600 110px 'Inter', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.letterSpacing = "12px";
  ctx.fillText("TIGUAN", W / 2, H / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function CarModel({ url, hoveredLabel, damagedLabels, onHover, onPick, disabled, meshClassifier, isTiguan }: CarModelProps & { meshClassifier?: (n: string) => { label: string; pickable: boolean } | null; isTiguan?: boolean }) {
  const { scene } = useGLTF(url, true);
  const { invalidate } = useThree();
  const bboxRef = useRef<{ center: THREE.Vector3; half: THREE.Vector3; lengthAxis: "x" | "z"; widthAxis: "x" | "z" } | null>(null);


  // Ocultar decalques chineses e injetar placa Sua Marca + emblema TIGUAN no traseiro.
  useEffect(() => {
    if (!url.includes("tiguan")) return;
    scene.updateMatrixWorld(true);

    // 1) hide badge meshes
    scene.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && TIGUAN_BADGES_TO_HIDE.has(o.name)) {
        o.visible = false;
      }
    });

    // Evita duplicar se efeito rodar de novo
    const existing = scene.getObjectByName("__zeus_rear_overlay__");
    if (existing) return;

    const bbox = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    bbox.getSize(size);
    bbox.getCenter(center);

    // eixo de comprimento: o maior entre x e z
    const lengthAxis: "x" | "z" = size.z >= size.x ? "z" : "x";
    const widthAxis: "x" | "z" = lengthAxis === "z" ? "x" : "z";
    const rearSign = -1; // traseira no extremo negativo do eixo de comprimento
    const lengthHalf = lengthAxis === "z" ? size.z / 2 : size.x / 2;
    const carWidth = widthAxis === "x" ? size.x : size.z;

    const group = new THREE.Group();
    group.name = "__zeus_rear_overlay__";

    // PLACA RENTAL STUDIO
    const plateW = carWidth * 0.28;
    const plateH = plateW * 0.25;
    const plateGeo = new THREE.PlaneGeometry(plateW, plateH);
    const plateMat = new THREE.MeshStandardMaterial({
      map: makeZeusPlateTexture(),
      roughness: 0.55,
      metalness: 0.0,
    });
    const plateMesh = new THREE.Mesh(plateGeo, plateMat);
    plateMesh.name = "__zeus_plate__";
    plateMesh.position.set(
      center.x,
      center.y + size.y * 0.02,
      center.z + (lengthAxis === "z" ? rearSign * (lengthHalf + 0.005) : 0),
    );
    if (lengthAxis === "x") {
      plateMesh.position.x = center.x + rearSign * (lengthHalf + 0.005);
      plateMesh.rotation.y = rearSign > 0 ? 0 : Math.PI;
    } else {
      plateMesh.rotation.y = rearSign > 0 ? 0 : Math.PI;
    }
    (plateMat as any).polygonOffset = true;
    (plateMat as any).polygonOffsetFactor = -2;
    group.add(plateMesh);

    // EMBLEMA TIGUAN (acima da placa)
    const badgeW = carWidth * 0.34;
    const badgeH = badgeW * 0.13;
    const badgeGeo = new THREE.PlaneGeometry(badgeW, badgeH);
    const badgeMat = new THREE.MeshStandardMaterial({
      map: makeTiguanBadgeTexture(),
      transparent: true,
      roughness: 0.4,
      metalness: 0.3,
    });
    const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
    badgeMesh.name = "__zeus_badge__";
    badgeMesh.position.copy(plateMesh.position);
    badgeMesh.position.y = plateMesh.position.y + plateH * 0.85;
    badgeMesh.rotation.copy(plateMesh.rotation);
    (badgeMat as any).polygonOffset = true;
    (badgeMat as any).polygonOffsetFactor = -2;
    group.add(badgeMesh);

    scene.add(group);
  }, [scene, url]);


  const classified = useMemo<ClassifiedMesh[]>(() => {
    scene.updateMatrixWorld(true);

    const globalBox = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    globalBox.getSize(size);
    globalBox.getCenter(center);
    const half = { x: size.x / 2 || 1, y: size.y / 2 || 1, z: size.z / 2 || 1 };

    const lengthAxis: "x" | "z" = size.z >= size.x ? "z" : "x";
    const widthAxis: "x" | "z" = lengthAxis === "z" ? "x" : "z";
    bboxRef.current = {
      center,
      half: new THREE.Vector3(half.x, half.y, half.z),
      lengthAxis,
      widthAxis,
    };

    const list: ClassifiedMesh[] = [];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!(mesh as any).isMesh) return;
      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map((m) => (m as THREE.Material).clone());
      } else if (mesh.material) {
        mesh.material = (mesh.material as THREE.Material).clone();
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      // 1) modelo-específico (Tiguan, etc.) — alta prioridade
      let label: string | undefined;
      let pickable = true;
      if (meshClassifier) {
        const r = meshClassifier(mesh.name);
        if (r) { label = r.label; pickable = r.pickable; }
      }

      // 2) regras genéricas por nome
      if (!label) {
        const r = classifyMesh(mesh.name);
        if (r.label !== "__UNKNOWN__") { label = r.label; pickable = r.pickable; }
      }

      // 3) fallback espacial (posição no bbox)
      if (!label) {
        const meshBox = new THREE.Box3().setFromObject(mesh);
        const mc = new THREE.Vector3();
        meshBox.getCenter(mc);
        const norm = {
          x: (mc[widthAxis] - center[widthAxis]) / (widthAxis === "x" ? half.x : half.z),
          y: (mc.y - center.y) / half.y,
          z: (mc[lengthAxis] - center[lengthAxis]) / (lengthAxis === "z" ? half.z : half.x),
        };
        label = inferLabelByPosition(norm);
        pickable = label !== "Assoalho / Chassi";
      }

      list.push({ mesh, label, pickable });
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, meshClassifier]);

  // Cache da cor original de cada material p/ restaurar quando desselecionar.
  const originalColors = useRef<WeakMap<THREE.Material, THREE.Color>>(new WeakMap());

  // Aplica alto contraste: peça selecionada brilha intenso em dourado,
  // o restante do carro escurece pra destacar nitidamente a seleção.
  useEffect(() => {
    const hasSelection = hoveredLabel != null;

    classified.forEach(({ mesh, label, pickable }) => {
      const isHover = pickable && hasSelection && label === hoveredLabel;
      const isDamaged = pickable && damagedLabels.has(label);
      const isGlass = /glass|window|windshield|gasket/i.test(mesh.name);

      const applyMat = (mat: THREE.Material | null | undefined) => {
        if (!mat) return;
        const std = mat as THREE.MeshStandardMaterial;
        if (!("emissive" in std)) return;

        // Salva cor original 1x
        if (std.color && !originalColors.current.has(std)) {
          originalColors.current.set(std, std.color.clone());
        }
        const orig = originalColors.current.get(std);

        if (isGlass) {
          std.emissive?.copy(isHover ? GOLD : BLACK);
          std.emissiveIntensity = isHover ? 0.6 : 0;
          if (std.color && orig) {
            // vidros: escurece levemente quando outra peça está selecionada
            if (hasSelection && !isHover) std.color.copy(orig).multiplyScalar(0.45);
            else std.color.copy(orig);
          }
          std.needsUpdate = true;
          return;
        }

        if (isHover) {
          // Peça selecionada: dourado intenso + cor original viva
          std.emissive?.copy(GOLD);
          std.emissiveIntensity = 1.6;
          if (std.color && orig) std.color.copy(orig);
        } else if (isDamaged && !hasSelection) {
          std.emissive?.copy(GOLD);
          std.emissiveIntensity = 0.45;
          if (std.color && orig) std.color.copy(orig);
        } else if (hasSelection) {
          // Resto do carro: escurece drasticamente p/ realçar a peça
          std.emissive?.copy(BLACK);
          std.emissiveIntensity = 0;
          if (std.color && orig) std.color.copy(orig).multiplyScalar(0.22);
        } else {
          // Estado neutro: tudo restaurado
          std.emissive?.copy(BLACK);
          std.emissiveIntensity = 0;
          if (std.color && orig) std.color.copy(orig);
        }
        std.needsUpdate = true;
      };


      if (Array.isArray(mesh.material)) mesh.material.forEach(applyMat);
      else applyMat(mesh.material as THREE.Material);
    });
    invalidate();
  }, [classified, hoveredLabel, damagedLabels, invalidate]);



  const labelOf = (mesh: THREE.Object3D | undefined): ClassifiedMesh | null => {
    if (!mesh) return null;
    const found = classified.find((c) => c.mesh === mesh);
    return found ?? null;
  };

  // Refina o label usando o PONTO real do raycast (apenas Tiguan).
  // Para peças com nome ambíguo/cross-cutting (carroceria, faróis genéricos,
  // rodas únicas L+R), o ponto exato do clique resolve qual é a peça real.
  const refineByHitPoint = (info: ClassifiedMesh, e: any): ClassifiedMesh => {
    if (!isTiguan || !bboxRef.current || !e?.point) return info;
    if (!TIGUAN_AMBIGUOUS_LABELS.has(info.label)) return info;
    const { center, half, lengthAxis, widthAxis } = bboxRef.current;
    const pt = e.point as THREE.Vector3;
    const norm = {
      x: (pt[widthAxis] - center[widthAxis]) / (widthAxis === "x" ? half.x : half.z),
      y: (pt.y - center.y) / half.y,
      z: (pt[lengthAxis] - center[lengthAxis]) / (lengthAxis === "z" ? half.z : half.x),
    };
    const r = inferTiguanLabelFromPoint(norm);
    return { mesh: info.mesh, label: r.label, pickable: r.pickable };
  };

  return (
    <primitive
      object={scene}
      onPointerOver={(e: any) => {
        if (disabled) return;
        e.stopPropagation();
        const raw = labelOf(e.object);
        if (!raw) { onHover(null); document.body.style.cursor = "auto"; return; }
        const info = refineByHitPoint(raw, e);
        if (!info.pickable) {
          onHover(null);
          document.body.style.cursor = "auto";
          return;
        }
        onHover(info.label);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e: any) => {
        e.stopPropagation();
        onHover(null);
        document.body.style.cursor = "auto";
      }}
      onClick={(e: any) => {
        if (disabled) return;
        e.stopPropagation();
        const raw = labelOf(e.object);
        if (!raw) return;
        const info = refineByHitPoint(raw, e);
        if (info.pickable) onPick(info.label);
      }}
    />
  );
}


function CameraResetHook({ resetSignal, position, target }: {
  resetSignal: number;
  position: [number, number, number];
  target: [number, number, number];
}) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(...position);
    camera.lookAt(...target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);
  return null;
}

interface Props {
  damageCountByLabel: Record<string, number>;
  onAddDamage: (label: string) => void;
  disabled?: boolean;
  /** Vehicle row used to auto-pick the 3D silhouette */
  vehicle?: VehicleLike;
}

export default function CarRealisticViewer({
  damageCountByLabel,
  onAddDamage,
  disabled,
  vehicle,
}: Props) {
  const modelDef: Vehicle3dModelDef = useMemo(() => pickVehicle3dModel(vehicle), [vehicle]);
  const isMobile = useIsMobile();

  // Preload the chosen model so the canvas swap is instant
  useEffect(() => {
    useGLTF.preload(modelDef.url, true);
  }, [modelDef.url]);

  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  // Mobile-only: tap selects, second tap (or CTA) confirms the damage.
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [attributionOpen, setAttributionOpen] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const controlsRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset hover + camera when the model changes (different vehicle category)
  useEffect(() => {
    setHoveredLabel(null);
    setSelectedLabel(null);
    setResetSignal((s) => s + 1);
  }, [modelDef.key]);

  // First-visit gesture hint on mobile (3s)
  useEffect(() => {
    if (!isMobile) return;
    const KEY = "zeus.3d.hint.seen";
    try {
      if (localStorage.getItem(KEY)) return;
    } catch { /* ignore */ }
    setShowHint(true);
    const t = setTimeout(() => {
      setShowHint(false);
      try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ }
    }, 3200);
    return () => clearTimeout(t);
  }, [isMobile]);

  const damagedLabels = useMemo(
    () =>
      new Set(
        Object.entries(damageCountByLabel)
          .filter(([, n]) => (n || 0) > 0)
          .map(([label]) => label)
      ),
    [damageCountByLabel]
  );

  // No mobile, a peça selecionada vira o "hovered" para acender em dourado.
  const effectiveHover = isMobile ? selectedLabel ?? hoveredLabel : hoveredLabel;
  const activeLabel = isMobile ? selectedLabel : hoveredLabel;
  const activeCount = activeLabel ? damageCountByLabel[activeLabel] || 0 : 0;

  useEffect(() => () => {
    document.body.style.cursor = "auto";
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isMobile || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handlePick = (label: string) => {
    if (isMobile) {
      // 1º toque: seleciona. 2º toque na mesma peça: confirma e registra.
      if (selectedLabel === label) {
        haptic.success();
        onAddDamage(label);
        setSelectedLabel(null);
      } else {
        haptic.tick();
        setSelectedLabel(label);
      }
    } else {
      onAddDamage(label);
    }
  };

  const confirmSelected = () => {
    if (!selectedLabel) return;
    haptic.success();
    onAddDamage(selectedLabel);
    setSelectedLabel(null);
  };

  const camPos = modelDef.cameraPosition || [4.5, 2.2, 5.5];
  const camTarget = modelDef.cameraTarget || [0, 0.4, 0];

  const canvasHeight = isMobile
    ? "h-[58vh] min-h-[360px] max-h-[560px]"
    : "h-[460px] sm:h-[520px]";

  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
      {/* Barra superior — controles + nome do modelo */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 sm:py-2.5 border-b border-border/40 bg-background/40">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <p className="admin-label text-[10px] flex items-center gap-2 shrink-0">
            <span className="w-1 h-1 rounded-full bg-primary" />
            <span className="hidden sm:inline">Modelo 3D. Arraste · Scroll para zoom</span>
            <span className="sm:hidden">Modelo 3D</span>
          </p>
          <span className="hidden md:inline text-[10px] tracking-[0.18em] uppercase text-muted-foreground/60 truncate">
            {modelDef.label}
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-10 w-10 sm:h-7 sm:w-7 p-0"
            onClick={() => { haptic.tick(); controlsRef.current?.dollyIn?.(1.2); }}
            aria-label="Aproximar"
          >
            <ZoomIn size={isMobile ? 18 : 14} />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-10 w-10 sm:h-7 sm:w-7 p-0"
            onClick={() => { haptic.tick(); controlsRef.current?.dollyOut?.(1.2); }}
            aria-label="Afastar"
          >
            <ZoomOut size={isMobile ? 18 : 14} />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-10 w-10 sm:h-7 sm:w-auto sm:px-2 sm:gap-1.5 sm:text-[11px] p-0"
            onClick={() => {
              haptic.tick();
              setSelectedLabel(null);
              setResetSignal((s) => s + 1);
              controlsRef.current?.reset?.();
            }}
            aria-label="Restaurar vista"
          >
            <RotateCcw size={isMobile ? 18 : 13} />
            <span className="hidden sm:inline">Vista padrão</span>
          </Button>
        </div>
      </div>

      {/* Canvas 3D */}
      <div
        ref={containerRef}
        className={`relative w-full ${canvasHeight} bg-gradient-to-b from-[#f6f6f6] to-[#e9e9eb] dark:from-[#0e0e10] dark:to-[#050506] select-none`}
        style={{ touchAction: "none", WebkitUserSelect: "none" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          setMousePos(null);
          if (!isMobile) setHoveredLabel(null);
          document.body.style.cursor = "auto";
        }}
      >
        <Canvas
          shadows
          dpr={isMobile ? [1, 1.6] : [1, 2]}
          frameloop="demand"
          camera={{ position: camPos, fov: 38 }}
          gl={{ antialias: true, toneMappingExposure: 1.05, powerPreference: "high-performance" }}
        >
          <color attach="background" args={["#f4f4f6"]} />
          <ambientLight intensity={0.55} />
          <directionalLight
            position={[6, 8, 4]}
            intensity={1.1}
            castShadow={!isMobile}
            shadow-mapSize-width={isMobile ? 1024 : 2048}
            shadow-mapSize-height={isMobile ? 1024 : 2048}
          />
          <directionalLight position={[-6, 4, -4]} intensity={0.45} />

          <Suspense fallback={<Html center><div className="flex flex-col items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin" size={22} /><span className="text-[10px] tracking-[0.22em] uppercase">Carregando modelo</span></div></Html>}>
            <Bounds fit clip observe margin={1.15} key={modelDef.key}>
              <CarModel
                url={modelDef.url}
                hoveredLabel={effectiveHover}
                damagedLabels={damagedLabels}
                onHover={isMobile ? () => {} : setHoveredLabel}
                onPick={handlePick}
                disabled={disabled}
                meshClassifier={modelDef.meshClassifier}
                isTiguan={modelDef.key === "vw-tiguan"}
              />
            </Bounds>
            <Environment preset="studio" />
          </Suspense>

          <ContactShadows
            position={[0, -0.02, 0]}
            opacity={0.55}
            scale={14}
            blur={2.6}
            far={6}
          />

          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={isMobile ? 0.7 : 0.85}
            zoomSpeed={isMobile ? 1.0 : 0.8}
            minDistance={3}
            maxDistance={11}
            minPolarAngle={0}
            maxPolarAngle={Math.PI}
            target={camTarget}
            touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
          />
          <CameraResetHook resetSignal={resetSignal} position={camPos} target={camTarget} />
        </Canvas>

        {/* Desktop: tooltip que segue o mouse */}
        {!isMobile && hoveredLabel && mousePos && (
          <div
            className="pointer-events-none absolute z-20 -translate-y-[calc(100%+14px)] -translate-x-1/2"
            style={{ left: mousePos.x, top: mousePos.y }}
          >
            <div className="px-3 py-2 rounded-lg bg-background/85 backdrop-blur-md border border-primary/35 shadow-lg shadow-primary/10">
              <p className="text-[11px] font-medium text-foreground whitespace-nowrap">
                {hoveredLabel}
              </p>
              {activeCount > 0 && (
                <p className="text-[10px] text-primary tracking-wider uppercase mt-0.5 tabular-nums">
                  {String(activeCount).padStart(2, "0")} {activeCount === 1 ? "avaria" : "avarias"}
                </p>
              )}
              <p className="text-[9px] text-muted-foreground tracking-[0.18em] uppercase mt-1">
                Clique para registrar
              </p>
            </div>
          </div>
        )}

        {/* Mobile: gesture hint flutuante (some sozinho) */}
        {isMobile && showHint && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center z-20">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/85 backdrop-blur-md border border-border/50 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
              <Hand size={12} className="text-primary" />
              <span className="text-[10px] tracking-[0.16em] uppercase text-muted-foreground">
                Arraste · Pince para zoom · Toque na peça
              </span>
            </div>
          </div>
        )}

        {/* Mobile: pill flutuante com a peça selecionada (alto da tela) */}
        {isMobile && selectedLabel && (
          <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center z-20 px-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/90 backdrop-blur-md border border-primary/40 shadow-lg shadow-primary/10 max-w-full">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
              <span className="text-[11px] font-medium text-foreground truncate">{selectedLabel}</span>
              {activeCount > 0 && (
                <span className="text-[9px] text-primary tracking-[0.18em] uppercase tabular-nums shrink-0">
                  {String(activeCount).padStart(2, "0")}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Watermark — Vista 360 */}
        <div className="pointer-events-none absolute bottom-3 left-3 text-[9px] tracking-[0.22em] uppercase text-muted-foreground/70">
          Vista 360°
        </div>

        {/* Atribuição (CC-BY) — discreta no canto */}
        <div className="absolute bottom-2 right-2 z-10">
          <button
            type="button"
            onClick={() => setAttributionOpen((v) => !v)}
            onMouseEnter={() => !isMobile && setAttributionOpen(true)}
            onMouseLeave={() => !isMobile && setAttributionOpen(false)}
            aria-label="Informações de licença do modelo 3D"
            className="inline-flex items-center gap-1 px-2 h-6 rounded-full border border-border/40 bg-background/70 backdrop-blur text-[9px] tracking-[0.16em] uppercase text-muted-foreground/70 hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <Info size={10} />
            <span className="hidden sm:inline">Licença</span>
          </button>
          {attributionOpen && (
            <div className="absolute right-0 bottom-8 w-[260px] p-3 rounded-lg border border-border/50 bg-background/95 backdrop-blur-md shadow-xl text-[11px] leading-relaxed text-foreground/85">
              <p className="font-medium text-foreground mb-1">{modelDef.label}</p>
              <p className="text-muted-foreground text-[10.5px]">{modelDef.attribution}</p>
              {modelDef.source && (
                <a
                  href={modelDef.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-block text-[10px] text-primary hover:underline truncate max-w-full"
                >
                  Ver fonte original
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile: barra de confirmação (CTA grande, estilo bottom-sheet) */}
      {isMobile && (
        <div
          className={`border-t border-border/40 bg-background/95 backdrop-blur-md transition-all duration-200 ${
            selectedLabel ? "opacity-100 max-h-32" : "opacity-0 max-h-0 overflow-hidden"
          }`}
        >
          <div className="flex items-center gap-2 p-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => { haptic.tick(); setSelectedLabel(null); }}
              className="h-11 w-11 p-0 shrink-0"
              aria-label="Cancelar seleção"
            >
              <X size={18} />
            </Button>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] tracking-[0.22em] uppercase text-muted-foreground/70">
                Peça selecionada
              </p>
              <p className="text-sm font-medium text-foreground truncate">
                {selectedLabel}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={confirmSelected}
              disabled={disabled}
              className="h-11 px-4 gap-1.5 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus size={16} />
              Registrar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

