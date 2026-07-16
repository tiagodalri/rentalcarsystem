import { Suspense, useRef, useState, useMemo } from "react";
import { Canvas, useFrame, ThreeEvent } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Environment, Html } from "@react-three/drei";
import * as THREE from "three";

/**
 * Cena 3D imersiva do veículo. Cada peça é uma mesh clicável
 * cujo `label` corresponde 1:1 ao catálogo do CarDamageMap.
 * - Hover: destaque dourado + tooltip flutuante
 * - Click: dispara onAddDamage(label)
 * - Peças com avaria recebem material dourado emissivo
 * - OrbitControls: girar (drag), zoom (scroll), pan (right-drag)
 */

interface Car3DSceneProps {
  damageCountByLabel: Record<string, number>;
  onAddDamage: (label: string) => void;
  disabled?: boolean;
  /** Altura da tela 3D em px (default 480) */
  height?: number;
}

type PartProps = {
  label: string;
  position: [number, number, number];
  size: number[];
  rotation?: [number, number, number];
  shape?: "box" | "cyl" | "sphere";
  baseColor?: string;
  metalness?: number;
  roughness?: number;
  onHover: (label: string | null) => void;
  onClick: (label: string) => void;
  hoveredLabel: string | null;
  damaged: number;
  disabled?: boolean;
};

function Part({
  label,
  position,
  size,
  rotation = [0, 0, 0],
  shape = "box",
  baseColor = "#1a1a1a",
  metalness = 0.85,
  roughness = 0.28,
  onHover,
  onClick,
  hoveredLabel,
  damaged,
  disabled,
}: PartProps) {
  const ref = useRef<THREE.Mesh>(null);
  const isHover = hoveredLabel === label;
  const isDamaged = damaged > 0;

  // Cor primária dourada do tema
  const goldColor = "#c9a24b";

  const color = isDamaged
    ? goldColor
    : isHover
    ? "#3a3a3a"
    : baseColor;

  const emissive = isDamaged ? goldColor : isHover ? "#5a4418" : "#000000";
  const emissiveIntensity = isDamaged ? 0.45 : isHover ? 0.35 : 0;

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (disabled) return;
    onHover(label);
    document.body.style.cursor = "pointer";
  };
  const handleOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(null);
    document.body.style.cursor = "default";
  };
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (disabled) return;
    onClick(label);
  };

  return (
    <mesh
      ref={ref}
      position={position}
      rotation={rotation}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
      onClick={handleClick}
      castShadow
      receiveShadow
    >
      {shape === "box" && <boxGeometry args={[size[0], size[1], size[2]]} />}
      {shape === "cyl" && <cylinderGeometry args={[size[0], size[0], size[1], 32]} />}
      {shape === "sphere" && <sphereGeometry args={[size[0], 24, 24]} />}
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={roughness}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

function Glass({ position, size, rotation = [0, 0, 0] }: { position: [number, number, number]; size: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={size} />
      <meshPhysicalMaterial
        color="#0a1420"
        metalness={0.2}
        roughness={0.05}
        transmission={0.6}
        transparent
        opacity={0.55}
      />
    </mesh>
  );
}

function CarRig({
  damageCountByLabel,
  onAddDamage,
  disabled,
  hoveredLabel,
  setHoveredLabel,
}: {
  damageCountByLabel: Record<string, number>;
  onAddDamage: (label: string) => void;
  disabled?: boolean;
  hoveredLabel: string | null;
  setHoveredLabel: (s: string | null) => void;
}) {
  const group = useRef<THREE.Group>(null);

  // Rotação suave automática quando nada está em hover
  useFrame((_, dt) => {
    if (!group.current) return;
    if (!hoveredLabel) {
      group.current.rotation.y += dt * 0.12;
    }
  });

  const partProps = (label: string) => ({
    label,
    hoveredLabel,
    damaged: damageCountByLabel[label] || 0,
    onHover: setHoveredLabel,
    onClick: onAddDamage,
    disabled,
  });

  // Eixos (carro deitado no plano XZ, comprimento Z, largura X, altura Y)
  // Frente em +Z. Lado esquerdo do carro em -X (vista do motorista).
  return (
    <group ref={group} position={[0, 0, 0]}>
      {/* Chassi inferior (não interativo, visual apenas) */}
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.85, 0.18, 4.1]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.6} roughness={0.5} />
      </mesh>

      {/* === CARROCERIA. TOPO === */}
      <Part {...partProps("Capô")}
        position={[0, 0.72, 1.35]} size={[1.78, 0.18, 1.0]} />
      <Part {...partProps("Teto")}
        position={[0, 1.18, 0.0]} size={[1.6, 0.12, 1.55]} />
      <Part {...partProps("Tampa do porta-malas")}
        position={[0, 0.72, -1.45]} size={[1.78, 0.18, 0.9]} />

      {/* Para-choques */}
      <Part {...partProps("Para-choque dianteiro")}
        position={[0, 0.55, 1.95]} size={[1.85, 0.42, 0.22]} />
      <Part {...partProps("Para-choque traseiro")}
        position={[0, 0.55, -1.95]} size={[1.85, 0.42, 0.22]} />

      {/* Vidros */}
      <Part {...partProps("Para-brisa")}
        position={[0, 1.05, 0.82]} rotation={[Math.PI * 0.18, 0, 0]} size={[1.55, 0.05, 0.85]}
        baseColor="#0a1420" metalness={0.2} roughness={0.05} />
      <Part {...partProps("Vidro traseiro")}
        position={[0, 1.05, -0.85]} rotation={[-Math.PI * 0.2, 0, 0]} size={[1.55, 0.05, 0.85]}
        baseColor="#0a1420" metalness={0.2} roughness={0.05} />

      {/* === LATERAIS. ESQUERDA (X negativo) === */}
      <Part {...partProps("Para-lama dianteiro esquerdo")}
        position={[-0.93, 0.7, 1.35]} size={[0.08, 0.55, 0.9]} />
      <Part {...partProps("Porta dianteira esquerda")}
        position={[-0.93, 0.78, 0.45]} size={[0.06, 0.7, 0.85]} />
      <Part {...partProps("Porta traseira esquerda")}
        position={[-0.93, 0.78, -0.45]} size={[0.06, 0.7, 0.85]} />
      <Part {...partProps("Para-lama traseiro esquerdo")}
        position={[-0.93, 0.7, -1.35]} size={[0.08, 0.55, 0.9]} />
      <Part {...partProps("Soleira lateral esquerda")}
        position={[-0.92, 0.35, 0]} size={[0.06, 0.18, 2.4]} />
      <Part {...partProps("Vidro dianteiro lateral esquerdo")}
        position={[-0.82, 1.05, 0.4]} size={[0.04, 0.35, 0.7]}
        baseColor="#0a1420" metalness={0.2} roughness={0.05} />
      <Part {...partProps("Vidro traseiro lateral esquerdo")}
        position={[-0.82, 1.05, -0.45]} size={[0.04, 0.35, 0.7]}
        baseColor="#0a1420" metalness={0.2} roughness={0.05} />
      <Part {...partProps("Retrovisor esquerdo")}
        position={[-1.0, 0.95, 0.85]} size={[0.18, 0.12, 0.16]} />

      {/* === LATERAIS. DIREITA (X positivo) === */}
      <Part {...partProps("Para-lama dianteiro direito")}
        position={[0.93, 0.7, 1.35]} size={[0.08, 0.55, 0.9]} />
      <Part {...partProps("Porta dianteira direita")}
        position={[0.93, 0.78, 0.45]} size={[0.06, 0.7, 0.85]} />
      <Part {...partProps("Porta traseira direita")}
        position={[0.93, 0.78, -0.45]} size={[0.06, 0.7, 0.85]} />
      <Part {...partProps("Para-lama traseiro direito")}
        position={[0.93, 0.7, -1.35]} size={[0.08, 0.55, 0.9]} />
      <Part {...partProps("Retrovisor direito")}
        position={[1.0, 0.95, 0.85]} size={[0.18, 0.12, 0.16]} />

      {/* === ILUMINAÇÃO / DETALHES === */}
      <Part {...partProps("Farol dianteiro")}
        position={[-0.55, 0.65, 2.02]} size={[0.45, 0.18, 0.06]}
        baseColor="#e8e8e8" metalness={0.4} roughness={0.15} />
      <Part {...partProps("Farol dianteiro")}
        position={[0.55, 0.65, 2.02]} size={[0.45, 0.18, 0.06]}
        baseColor="#e8e8e8" metalness={0.4} roughness={0.15} />
      <Part {...partProps("Farol de neblina")}
        position={[-0.7, 0.4, 2.04]} size={[0.18, 0.1, 0.04]}
        baseColor="#cccccc" metalness={0.3} roughness={0.2} />
      <Part {...partProps("Farol de neblina")}
        position={[0.7, 0.4, 2.04]} size={[0.18, 0.1, 0.04]}
        baseColor="#cccccc" metalness={0.3} roughness={0.2} />
      <Part {...partProps("Lanterna traseira")}
        position={[-0.7, 0.7, -2.02]} size={[0.4, 0.18, 0.06]}
        baseColor="#7a1a1a" metalness={0.4} roughness={0.2} />
      <Part {...partProps("Lanterna traseira")}
        position={[0.7, 0.7, -2.02]} size={[0.4, 0.18, 0.06]}
        baseColor="#7a1a1a" metalness={0.4} roughness={0.2} />
      <Part {...partProps("Escapamento")}
        position={[0.6, 0.22, -2.08]} size={[0.08, 0.16]} shape="cyl"
        rotation={[Math.PI / 2, 0, 0]}
        baseColor="#444444" metalness={0.9} roughness={0.4} />

      {/* === RODAS === */}
      <Part {...partProps("Roda dianteira esquerda")}
        position={[-0.95, 0.38, 1.35]} size={[0.38, 0.22]} shape="cyl"
        rotation={[0, 0, Math.PI / 2]}
        baseColor="#0d0d0d" metalness={0.5} roughness={0.7} />
      <Part {...partProps("Roda dianteira direita")}
        position={[0.95, 0.38, 1.35]} size={[0.38, 0.22]} shape="cyl"
        rotation={[0, 0, Math.PI / 2]}
        baseColor="#0d0d0d" metalness={0.5} roughness={0.7} />
      <Part {...partProps("Roda traseira esquerda")}
        position={[-0.95, 0.38, -1.35]} size={[0.38, 0.22]} shape="cyl"
        rotation={[0, 0, Math.PI / 2]}
        baseColor="#0d0d0d" metalness={0.5} roughness={0.7} />
      <Part {...partProps("Roda traseira direita")}
        position={[0.95, 0.38, -1.35]} size={[0.38, 0.22]} shape="cyl"
        rotation={[0, 0, Math.PI / 2]}
        baseColor="#0d0d0d" metalness={0.5} roughness={0.7} />

      {/* Tooltip 3D flutuante */}
      {hoveredLabel && (
        <Html position={[0, 2.2, 0]} center distanceFactor={8} zIndexRange={[100, 0]}>
          <div className="pointer-events-none whitespace-nowrap px-3 py-1.5 rounded-full bg-card/95 backdrop-blur-sm border border-primary/30 shadow-xl text-xs font-medium text-foreground">
            {hoveredLabel}
            {damageCountByLabel[hoveredLabel] ? (
              <span className="ml-2 text-primary text-[10px] font-semibold tracking-wider uppercase">
                · {damageCountByLabel[hoveredLabel]} avaria{damageCountByLabel[hoveredLabel] === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
        </Html>
      )}
    </group>
  );
}

export default function Car3DScene({
  damageCountByLabel,
  onAddDamage,
  disabled,
  height = 480,
}: Car3DSceneProps) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  return (
    <div
      className="w-full rounded-xl overflow-hidden border border-border/40 relative"
      style={{
        height,
        background:
          "radial-gradient(ellipse at 50% 30%, hsl(var(--card) / 0.6) 0%, hsl(var(--background)) 70%)",
      }}
    >
      {/* Dica de interação */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-2.5 py-1 rounded-full bg-card/80 backdrop-blur-sm border border-border/40 text-[10px] uppercase tracking-wider text-muted-foreground font-medium pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        Arraste para girar · Scroll para zoom
      </div>

      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [4.5, 3, 5.5], fov: 38 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={["#0b0b0d"]} />
        <fog attach="fog" args={["#0b0b0d", 8, 22]} />

        {/* Iluminação cinemática */}
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[6, 8, 4]}
          intensity={1.6}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-5, 4, -3]} intensity={0.6} color="#c9a24b" />
        <spotLight position={[0, 6, 0]} intensity={0.5} angle={0.6} penumbra={0.8} />

        <Suspense fallback={null}>
          <Environment preset="city" />
          <CarRig
            damageCountByLabel={damageCountByLabel}
            onAddDamage={onAddDamage}
            disabled={disabled}
            hoveredLabel={hoveredLabel}
            setHoveredLabel={setHoveredLabel}
          />
          <ContactShadows
            position={[0, 0.01, 0]}
            opacity={0.55}
            scale={10}
            blur={2.4}
            far={4}
            color="#000000"
          />
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={3.5}
          maxDistance={11}
          minPolarAngle={Math.PI * 0.12}
          maxPolarAngle={Math.PI * 0.48}
          makeDefault
        />
      </Canvas>
    </div>
  );
}
