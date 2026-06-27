// Sobrepõe data/hora + endereço no canto superior-direito de uma foto da inspeção.
// Estilo "câmera de segurança / Timestamp Camera": texto branco grande, com sombra
// suave para garantir leitura em qualquer fundo. Falha = devolve o arquivo original.

export interface InspectionStampOptions {
  address?: string | null; // pode conter quebras de linha (\n) — uma por linha
  date?: Date;
  maxDim?: number;
  quality?: number;
}

export async function stampInspectionPhoto(
  file: File,
  opts: InspectionStampOptions = {},
): Promise<File> {
  try {
    if (!file.type.startsWith("image/")) return file;

    const date = opts.date ?? new Date();
    const lines = buildLines(date, opts.address);
    if (!lines.length) return file;

    const bitmap = await loadBitmap(file);
    if (!bitmap) return file;

    const maxDim = opts.maxDim ?? 2200;
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, w, h);
    drawStamp(ctx, w, h, lines);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", opts.quality ?? 0.9),
    );
    if (!blob) return file;

    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${base}-stamped.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function buildLines(date: Date, address?: string | null): string[] {
  const lines = [formatStampTime(date), formatStampDateOnly(date)];
  if (address && address.trim()) {
    const addr = address
      .split(/\n|,\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    lines.push(...addr.slice(0, 5));
  }
  return lines;
}

const MONTHS_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function formatStampDateOnly(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${MONTHS_PT[d.getMonth()]}/${d.getFullYear()}`;
}

export function formatStampTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function formatStampDate(d: Date): string {
  return `${formatStampDateOnly(d)} ${formatStampTime(d)}`;
}


async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fallback */
    }
  }
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(url);
        reject(e);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
}

function drawStamp(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lines: string[],
) {
  // Tamanho proporcional à menor dimensão — grande e legível, estilo Timestamp Camera.
  const fontSize = Math.max(28, Math.round(Math.min(w, h) * 0.048));
  const lineHeight = Math.round(fontSize * 1.25);
  const marginX = Math.round(fontSize * 0.9);
  const marginY = Math.round(fontSize * 0.9);

  ctx.font = `500 ${fontSize}px "Helvetica Neue", Inter, system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";

  // Sombra forte para garantir contraste em qualquer fundo (céu claro, etc.).
  ctx.shadowColor = "rgba(0,0,0,0.9)";
  ctx.shadowBlur = Math.max(6, Math.round(fontSize * 0.4));
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.round(fontSize * 0.1);

  // Stroke escuro reforça a borda das letras.
  ctx.strokeStyle = "rgba(0,0,0,0.7)";
  ctx.lineWidth = Math.max(2, Math.round(fontSize * 0.11));
  ctx.lineJoin = "round";

  ctx.fillStyle = "rgba(255,255,255,0.98)";

  lines.forEach((line, i) => {
    const x = w - marginX;
    const y = marginY + i * lineHeight;
    ctx.strokeText(line, x, y);
    ctx.fillText(line, x, y);
  });

  // Reset
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
}
