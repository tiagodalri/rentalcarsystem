// Sobrepõe data/hora + endereço no lado direito de uma foto da inspeção.
// Estilo "câmera de segurança / Timestamp Camera": texto branco grande, com sombra
// suave para garantir leitura em qualquer fundo. Falha = devolve o arquivo original.

export interface InspectionStampOptions {
  address?: string | null; // pode conter quebras de linha (\n). uma por linha
  date?: Date;
  /** Opcional: só reduz se informado. Por padrão preserva os pixels originais. */
  maxDim?: number;
  quality?: number;
}

export async function stampInspectionPhoto(
  file: File,
  opts: InspectionStampOptions = {},
): Promise<File> {
  try {
    if (!file.type.startsWith("image/")) return file;
    if (/(?:-stamped|-carimbo-final)\.(jpe?g|png|webp)$/i.test(file.name)) return file;

    const date = opts.date ?? new Date();
    const lines = buildLines(date, opts.address);
    if (!lines.length) return file;

    const orientation = file.type === "image/jpeg" ? await readJpegOrientation(file) : 1;
    const bitmap = await loadBitmap(file);
    if (!bitmap) return file;

    // Preserva a foto inteira: não recorta e não reduz por padrão. O canvas final
    // recebe a orientação EXIF manualmente para fotos de iPhone não saírem de lado.
    const swapsAxes = orientation >= 5 && orientation <= 8;
    const orientedWidth = swapsAxes ? bitmap.height : bitmap.width;
    const orientedHeight = swapsAxes ? bitmap.width : bitmap.height;
    const maxDim = opts.maxDim ?? Number.POSITIVE_INFINITY;
    const scale = Number.isFinite(maxDim) ? Math.min(1, maxDim / Math.max(orientedWidth, orientedHeight)) : 1;
    const drawWidth = Math.round(bitmap.width * scale);
    const drawHeight = Math.round(bitmap.height * scale);
    const w = Math.round(orientedWidth * scale);
    const h = Math.round(orientedHeight * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.save();
    applyExifOrientationTransform(ctx, orientation, w, h);
    ctx.drawImage(bitmap, 0, 0, drawWidth, drawHeight);
    ctx.restore();
    if ("close" in bitmap) bitmap.close();
    drawStamp(ctx, w, h, lines);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", opts.quality ?? 0.94),
    );
    if (!blob) return file;

    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${base}-stamped.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function buildLines(date: Date, address?: string | null): string[] {
  const lines = [`${formatStampTime(date)}  •  ${formatStampDateOnly(date)}`];
  if (address && address.trim()) {
    const addr = normalizeAddressLines(address);
    lines.push(...addr.slice(0, 2));
  }
  return lines;
}

function normalizeAddressLines(address: string): string[] {
  const parts = address
    .split(/\n|,\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length >= 4) {
    return [parts[0], `${parts[1]}, ${parts[2]} ${parts[3]}`];
  }
  if (parts.length >= 3) {
    return [parts[0], `${parts[1]}, ${parts[2]}`];
  }
  return parts;
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
      return await createImageBitmap(file, { imageOrientation: "none" });
    } catch {
      try {
        return await createImageBitmap(file);
      } catch {
        /* fallback */
      }
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

async function readJpegOrientation(file: File): Promise<number> {
  try {
    const buffer = await file.slice(0, 64 * 1024).arrayBuffer();
    const view = new DataView(buffer);
    if (view.getUint16(0, false) !== 0xffd8) return 1;

    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset, false);
      offset += 2;
      const size = view.getUint16(offset, false);
      offset += 2;
      if (marker === 0xffe1 && offset + 6 < view.byteLength) {
        const exif = String.fromCharCode(
          view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2),
          view.getUint8(offset + 3), view.getUint8(offset + 4), view.getUint8(offset + 5),
        );
        if (exif !== "Exif\0\0") return 1;
        const tiffOffset = offset + 6;
        const little = view.getUint16(tiffOffset, false) === 0x4949;
        const firstIfdOffset = view.getUint32(tiffOffset + 4, little);
        const ifdOffset = tiffOffset + firstIfdOffset;
        if (ifdOffset + 2 >= view.byteLength) return 1;
        const entries = view.getUint16(ifdOffset, little);
        for (let i = 0; i < entries; i += 1) {
          const entryOffset = ifdOffset + 2 + i * 12;
          if (entryOffset + 10 >= view.byteLength) break;
          if (view.getUint16(entryOffset, little) === 0x0112) {
            const orientation = view.getUint16(entryOffset + 8, little);
            return orientation >= 1 && orientation <= 8 ? orientation : 1;
          }
        }
        return 1;
      }
      offset += size - 2;
    }
  } catch {
    return 1;
  }
  return 1;
}

function applyExifOrientationTransform(
  ctx: CanvasRenderingContext2D,
  orientation: number,
  width: number,
  height: number,
) {
  switch (orientation) {
    case 2:
      ctx.transform(-1, 0, 0, 1, width, 0);
      break;
    case 3:
      ctx.transform(-1, 0, 0, -1, width, height);
      break;
    case 4:
      ctx.transform(1, 0, 0, -1, 0, height);
      break;
    case 5:
      ctx.transform(0, 1, 1, 0, 0, 0);
      break;
    case 6:
      ctx.transform(0, 1, -1, 0, width, 0);
      break;
    case 7:
      ctx.transform(0, -1, -1, 0, width, height);
      break;
    case 8:
      ctx.transform(0, -1, 1, 0, 0, height);
      break;
  }
}

function drawStamp(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lines: string[],
) {
  // Carimbo discreto no canto inferior direito: legível mas sem competir com a foto.
  const shortSide = Math.min(w, h);
  const marginX = Math.max(12, Math.round(shortSide * 0.018));
  const marginY = Math.max(12, Math.round(shortSide * 0.018));
  const maxWidth = Math.round(w * 0.55);
  const maxHeight = Math.round(h * 0.28);
  let fontSize = Math.max(20, Math.round(shortSide * 0.034));
  let lineHeight = Math.round(fontSize * 1.18);

  const measure = () => {
    ctx.font = `600 ${fontSize}px "Helvetica Neue", Inter, system-ui, -apple-system, Segoe UI, sans-serif`;
    return Math.max(...lines.map((line) => ctx.measureText(line).width));
  };

  while (fontSize > 14 && (measure() > maxWidth || lines.length * lineHeight > maxHeight)) {
    fontSize -= 1;
    lineHeight = Math.round(fontSize * 1.18);
  }
  const widestLine = measure();
  const textPadX = Math.round(fontSize * 0.35);
  const textPadY = Math.round(fontSize * 0.25);
  const blockHeight = lines.length * lineHeight;
  const stampWidth = Math.min(w - marginX * 2, widestLine + textPadX * 2);
  const stampHeight = blockHeight + textPadY * 2;
  const stampX = w - marginX - stampWidth;
  const stampY = Math.max(marginY, h - marginY - stampHeight);

  ctx.font = `600 ${fontSize}px "Helvetica Neue", Inter, system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";

  ctx.shadowColor = "rgba(0,0,0,0.72)";
  ctx.shadowBlur = Math.round(fontSize * 0.45);
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = Math.round(fontSize * 0.18);

  ctx.strokeStyle = "rgba(0,0,0,0.92)";
  ctx.lineWidth = Math.max(3, Math.round(fontSize * 0.14));
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  ctx.fillStyle = "#ffffff";

  lines.forEach((line, i) => {
    const x = w - marginX - textPadX;
    const y = stampY + textPadY + i * lineHeight;
    ctx.strokeText(line, x, y);
    ctx.fillText(line, x, y);
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
