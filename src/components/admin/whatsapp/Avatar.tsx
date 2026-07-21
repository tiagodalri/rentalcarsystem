import { formatPersonName } from "@/lib/formatName";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic pastel-ish HSL from string
function hashHue(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

export function ContactAvatar({
  name,
  phone,
  size = 40,
  className = "",
}: {
  name?: string | null;
  phone?: string | null;
  size?: number;
  className?: string;
}) {
  const label = name ? formatPersonName(name) : phone || "?";
  const hue = hashHue(label);
  return (
    <div
      className={`shrink-0 rounded-full flex items-center justify-center font-medium text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, size * 0.36),
        background: `linear-gradient(135deg, hsl(${hue} 55% 55%), hsl(${(hue + 40) % 360} 55% 42%))`,
      }}
      aria-hidden
    >
      {initials(label)}
    </div>
  );
}
