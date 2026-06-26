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
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * CarRealisticViewer
 * Visualizador 3D real do veículo (modelo GLB) com:
 *  - Rotação 360° livre (todos os eixos), zoom e pan desativado
 *  - SEM pins/marcadores — a própria peça brilha em dourado no hover
 *  - Clique na peça registra avaria
 *  - Peças com avaria mantêm um leve glow dourado persistente
 *
 * Modelo: Ferrari (three.js examples) — confiável, DRACO-comprimido,
 * com malhas separadas (body, rim_fl/fr/rl/rr, trim, glass).
 */

const MODEL_URL = "https://threejs.org/examples/models/gltf/ferrari.glb";
useGLTF.preload(MODEL_URL, true);

// Mapeia nomes técnicos das malhas para nomes humanos em pt-BR
const MESH_LABEL: Record<string, string> = {
  body: "Carroceria",
  rim_fl: "Roda dianteira esquerda",
  rim_fr: "Roda dianteira direita",
  rim_rl: "Roda traseira esquerda",
  rim_rr: "Roda traseira direita",
  trim: "Detalhes cromados",
  glass: "Vidros",
};

const labelFor = (meshName: string) => MESH_LABEL[meshName] || "Peça do veículo";

const GOLD = new THREE.Color("#D4AF37");
const BLACK = new THREE.Color("#000000");

type CarModelProps = {
  hoveredMesh: string | null;
  damagedLabels: Set<string>;
  onHover: (meshName: string | null) => void;
  onPick: (label: string) => void;
  disabled?: boolean;
};

function CarModel({ hoveredMesh, damagedLabels, onHover, onPick, disabled }: CarModelProps) {
  const { scene } = useGLTF(MODEL_URL, true);

  // Clona materiais por malha p/ permitir emissive individual
  const meshes = useMemo(() => {
    const list: THREE.Mesh[] = [];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if ((mesh as any).isMesh) {
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((m) => (m as THREE.Material).clone());
        } else if (mesh.material) {
          mesh.material = (mesh.material as THREE.Material).clone();
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        list.push(mesh);
      }
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  // Aplica brilho dourado no hover / mantém leve glow nas peças com avaria
  useEffect(() => {
    meshes.forEach((m) => {
      const meshName = m.name;
      const label = labelFor(meshName);
      const isHover = hoveredMesh === meshName;
      const isDamaged = damagedLabels.has(label);
      const intensity = isHover ? 0.95 : isDamaged ? 0.45 : 0;

      const applyMat = (mat: THREE.Material | null | undefined) => {
        if (!mat) return;
        const std = mat as THREE.MeshStandardMaterial;
        if (!("emissive" in std)) return;
        // Vidros não recebem brilho dourado (ficaria estranho)
        if (meshName === "glass" && !isHover) {
          std.emissive?.copy(BLACK);
          std.emissiveIntensity = 0;
          return;
        }
        std.emissive?.copy(GOLD);
        std.emissiveIntensity = intensity;
        std.needsUpdate = true;
      };

      if (Array.isArray(m.material)) m.material.forEach(applyMat);
      else applyMat(m.material as THREE.Material);
    });
  }, [meshes, hoveredMesh, damagedLabels]);

  return (
    <primitive
      object={scene}
      onPointerOver={(e: any) => {
        if (disabled) return;
        e.stopPropagation();
        const name = e.object?.name as string | undefined;
        if (name) {
          onHover(name);
          document.body.style.cursor = "pointer";
        }
      }}
      onPointerOut={(e: any) => {
        e.stopPropagation();
        onHover(null);
        document.body.style.cursor = "auto";
      }}
      onClick={(e: any) => {
        if (disabled) return;
        e.stopPropagation();
        const name = e.object?.name as string | undefined;
        if (name) onPick(labelFor(name));
      }}
    />
  );
}

function CameraResetHook({ resetSignal }: { resetSignal: number }) {
  const { camera } = useThree();
  const initial = useRef<THREE.Vector3 | null>(null);
  useEffect(() => {
    if (!initial.current) initial.current = camera.position.clone();
  }, [camera]);
  useEffect(() => {
    if (initial.current) {
      camera.position.copy(initial.current);
      camera.lookAt(0, 0.4, 0);
    }
  }, [resetSignal, camera]);
  return null;
}

interface Props {
  damageCountByLabel: Record<string, number>;
  onAddDamage: (label: string) => void;
  disabled?: boolean;
}

export default function CarRealisticViewer({
  damageCountByLabel,
  onAddDamage,
  disabled,
}: Props) {
  const [hoveredMesh, setHoveredMesh] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const controlsRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const damagedLabels = useMemo(
    () =>
      new Set(
        Object.entries(damageCountByLabel)
          .filter(([, n]) => (n || 0) > 0)
          .map(([label]) => label)
      ),
    [damageCountByLabel]
  );

  const hoverLabel = hoveredMesh ? labelFor(hoveredMesh) : null;
  const hoverCount = hoverLabel ? damageCountByLabel[hoverLabel] || 0 : 0;

  // Limpa o cursor ao desmontar
  useEffect(() => () => {
    document.body.style.cursor = "auto";
  }, []);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
      {/* Barra superior — controles */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-border/40 bg-background/40">
        <p className="admin-label text-[10px] flex items-center gap-2">
          <span className="w-1 h-1 rounded-full bg-primary" />
          Modelo 3D — Arraste para girar · Scroll para zoom
        </p>
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
          camera={{ position: [4.5, 2.2, 5.5], fov: 38 }}
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
            <Bounds fit clip observe margin={1.15}>
              <CarModel
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
            // Rotação 360° livre em todos os eixos
            minPolarAngle={0}
            maxPolarAngle={Math.PI}
            target={[0, 0.4, 0]}
          />
          <CameraResetHook resetSignal={resetSignal} />
        </Canvas>

        {/* Rótulo flutuante elegante que segue o mouse */}
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

        {/* Watermark de instruções no canto */}
        <div className="pointer-events-none absolute bottom-3 left-3 text-[9px] tracking-[0.22em] uppercase text-muted-foreground/70">
          Vista 360°
        </div>
      </div>
    </div>
  );
}

function LoadingOverlay() {
  // Renderiza apenas enquanto suspense estiver pendente — pendurado em Suspense pai
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/30 backdrop-blur-sm pointer-events-none">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 size={14} className="animate-spin text-primary" />
        Carregando modelo 3D…
      </div>
    </div>
  );
}
