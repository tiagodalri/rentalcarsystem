import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  ContactShadows,
  useGLTF,
  Bounds,
} from "@react-three/drei";
import * as THREE from "three";
import { RotateCcw, ZoomIn, ZoomOut, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  pickVehicle3dModel,
  classifyMesh,
  type VehicleLike,
  type Vehicle3dModelDef,
} from "@/data/vehicle3dModels";

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

const GOLD = new THREE.Color("#D4AF37");
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

function CarModel({ url, hoveredLabel, damagedLabels, onHover, onPick, disabled }: CarModelProps) {
  const { scene } = useGLTF(url, true);

  // Clona materiais por malha e classifica cada uma em um grupo lógico
  const classified = useMemo<ClassifiedMesh[]>(() => {
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
      const { label, pickable } = classifyMesh(mesh.name);
      list.push({ mesh, label, pickable });
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  // Aplica brilho dourado em TODAS as sub-malhas do grupo hovered
  useEffect(() => {
    classified.forEach(({ mesh, label, pickable }) => {
      const isHover = pickable && hoveredLabel != null && label === hoveredLabel;
      const isDamaged = pickable && damagedLabels.has(label);
      const intensity = isHover ? 1.0 : isDamaged ? 0.5 : 0;
      const isGlass = /glass|window|windshield|gasket/i.test(mesh.name);

      const applyMat = (mat: THREE.Material | null | undefined) => {
        if (!mat) return;
        const std = mat as THREE.MeshStandardMaterial;
        if (!("emissive" in std)) return;
        // vidros só acendem suavemente no hover
        if (isGlass) {
          std.emissive?.copy(isHover ? GOLD : BLACK);
          std.emissiveIntensity = isHover ? 0.35 : 0;
          std.needsUpdate = true;
          return;
        }
        std.emissive?.copy(intensity > 0 ? GOLD : BLACK);
        std.emissiveIntensity = intensity;
        std.needsUpdate = true;
      };

      if (Array.isArray(mesh.material)) mesh.material.forEach(applyMat);
      else applyMat(mesh.material as THREE.Material);
    });
  }, [classified, hoveredLabel, damagedLabels]);

  const labelOf = (mesh: THREE.Object3D | undefined): ClassifiedMesh | null => {
    if (!mesh) return null;
    const found = classified.find((c) => c.mesh === mesh);
    return found ?? null;
  };

  return (
    <primitive
      object={scene}
      onPointerOver={(e: any) => {
        if (disabled) return;
        e.stopPropagation();
        const info = labelOf(e.object);
        if (!info || !info.pickable) {
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
        const info = labelOf(e.object);
        if (info && info.pickable) onPick(info.label);
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

  // Preload the chosen model so the canvas swap is instant
  useEffect(() => {
    useGLTF.preload(modelDef.url, true);
  }, [modelDef.url]);

  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [attributionOpen, setAttributionOpen] = useState(false);
  const controlsRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset hover + camera when the model changes (different vehicle category)
  useEffect(() => {
    setHoveredLabel(null);
    setResetSignal((s) => s + 1);
  }, [modelDef.key]);

  const damagedLabels = useMemo(
    () =>
      new Set(
        Object.entries(damageCountByLabel)
          .filter(([, n]) => (n || 0) > 0)
          .map(([label]) => label)
      ),
    [damageCountByLabel]
  );

  const hoverLabel = hoveredLabel;
  const hoverCount = hoverLabel ? damageCountByLabel[hoverLabel] || 0 : 0;


  useEffect(() => () => {
    document.body.style.cursor = "auto";
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const camPos = modelDef.cameraPosition || [4.5, 2.2, 5.5];
  const camTarget = modelDef.cameraTarget || [0, 0.4, 0];

  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
      {/* Barra superior — controles + nome do modelo */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/40 bg-background/40">
        <div className="flex items-center gap-3 min-w-0">
          <p className="admin-label text-[10px] flex items-center gap-2 shrink-0">
            <span className="w-1 h-1 rounded-full bg-primary" />
            Modelo 3D — Arraste · Scroll para zoom
          </p>
          <span className="hidden sm:inline text-[10px] tracking-[0.18em] uppercase text-muted-foreground/60 truncate">
            {modelDef.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => controlsRef.current?.dollyIn?.(1.2) ?? null}
            aria-label="Aproximar"
          >
            <ZoomIn size={14} />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => controlsRef.current?.dollyOut?.(1.2) ?? null}
            aria-label="Afastar"
          >
            <ZoomOut size={14} />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 px-2 gap-1.5 text-[11px]"
            onClick={() => {
              setResetSignal((s) => s + 1);
              controlsRef.current?.reset?.();
            }}
            aria-label="Restaurar vista"
          >
            <RotateCcw size={13} />
            Vista padrão
          </Button>
        </div>
      </div>

      {/* Canvas 3D */}
      <div
        ref={containerRef}
        className="relative w-full h-[460px] sm:h-[520px] bg-gradient-to-b from-[#f6f6f6] to-[#e9e9eb] dark:from-[#0e0e10] dark:to-[#050506]"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => {
          setMousePos(null);
          setHoveredMesh(null);
          document.body.style.cursor = "auto";
        }}
      >
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: camPos, fov: 38 }}
          gl={{ antialias: true, toneMappingExposure: 1.05 }}
        >
          <color attach="background" args={["#f4f4f6"]} />
          <ambientLight intensity={0.55} />
          <directionalLight
            position={[6, 8, 4]}
            intensity={1.1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
          />
          <directionalLight position={[-6, 4, -4]} intensity={0.45} />

          <Suspense fallback={null}>
            <Bounds fit clip observe margin={1.15} key={modelDef.key}>
              <CarModel
                url={modelDef.url}
                hoveredMesh={hoveredMesh}
                damagedLabels={damagedLabels}
                onHover={setHoveredMesh}
                onPick={onAddDamage}
                disabled={disabled}
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
            rotateSpeed={0.85}
            zoomSpeed={0.8}
            minDistance={3}
            maxDistance={11}
            minPolarAngle={0}
            maxPolarAngle={Math.PI}
            target={camTarget}
          />
          <CameraResetHook resetSignal={resetSignal} position={camPos} target={camTarget} />
        </Canvas>

        {/* Tooltip que segue o mouse */}
        {hoverLabel && mousePos && (
          <div
            className="pointer-events-none absolute z-20 -translate-y-[calc(100%+14px)] -translate-x-1/2"
            style={{ left: mousePos.x, top: mousePos.y }}
          >
            <div className="px-3 py-2 rounded-lg bg-background/85 backdrop-blur-md border border-primary/35 shadow-lg shadow-primary/10">
              <p className="text-[11px] font-medium text-foreground whitespace-nowrap">
                {hoverLabel}
              </p>
              {hoverCount > 0 && (
                <p className="text-[10px] text-primary tracking-wider uppercase mt-0.5 tabular-nums">
                  {String(hoverCount).padStart(2, "0")} {hoverCount === 1 ? "avaria" : "avarias"}
                </p>
              )}
              <p className="text-[9px] text-muted-foreground tracking-[0.18em] uppercase mt-1">
                Clique para registrar
              </p>
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
            onMouseEnter={() => setAttributionOpen(true)}
            onMouseLeave={() => setAttributionOpen(false)}
            aria-label="Informações de licença do modelo 3D"
            className="inline-flex items-center gap-1 px-2 h-6 rounded-full border border-border/40 bg-background/70 backdrop-blur text-[9px] tracking-[0.16em] uppercase text-muted-foreground/70 hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <Info size={10} />
            Licença
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
    </div>
  );
}
