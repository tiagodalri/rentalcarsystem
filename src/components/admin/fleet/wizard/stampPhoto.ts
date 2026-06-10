// Aplica um overlay com data/hora + km no canto inferior da imagem.
// Usado nas fotos da aba "Registro interno" para servir de prova histórica.

export async function stampPhoto(file: File, odometerKm: number | null): Promise<File> {
  try {
    const bitmap = await loadBitmap(file);
    const maxSide = 2200; // mantém qualidade sem explodir o tamanho
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, w, h);

    const stamp = buildStampText(odometerKm);
    drawStamp(ctx, w, h, stamp);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.88),
    );
    if (!blob) return file;

    const base = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${base}-registry.jpg`, { type: "image/jpeg" });
  } catch {
    return file; // falha = devolve original, nunca quebra o fluxo
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* fallback */
    }
  }
  return await new Promise((resolve, reject) => {
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
}

function buildStampText(odometerKm: number | null): string {
  const now = new Date();
  const dt = now.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const km =
    odometerKm != null && Number.isFinite(odometerKm)
      ? `${odometerKm.toLocaleString("pt-BR")} km`
      : null;
  return km ? `${dt}  •  ${km}` : dt;
}

function drawStamp(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: string,
) {
  const fontSize = Math.max(16, Math.round(Math.min(w, h) * 0.022));
  const padX = Math.round(fontSize * 0.9);
  const padY = Math.round(fontSize * 0.5);
  const marginX = Math.round(fontSize * 0.9);
  const marginY = Math.round(fontSize * 0.9);

  ctx.font = `600 ${fontSize}px Inter, system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.textBaseline = "middle";

  const metrics = ctx.measureText(text);
  const boxW = Math.ceil(metrics.width) + padX * 2;
  const boxH = fontSize + padY * 2;
  const boxX = w - boxW - marginX;
  const boxY = h - boxH - marginY;

  // pílula semi-transparente
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  roundRect(ctx, boxX, boxY, boxW, boxH, Math.round(boxH / 2));
  ctx.fill();

  // marcador dourado à esquerda da pílula
  ctx.fillStyle = "rgba(212,175,55,0.95)";
  ctx.beginPath();
  ctx.arc(boxX + padX * 0.55, boxY + boxH / 2, Math.max(3, fontSize * 0.18), 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.fillText(text, boxX + padX * 1.15, boxY + boxH / 2);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
