/**
 * Converte uma URL pública do Supabase Storage para o endpoint de
 * transformação de imagem, gerando thumbnails sob demanda.
 * Reduz drasticamente o peso de fotos exibidas em grids/listas.
 */
export function storageThumb(url: string | null | undefined, w = 400, h = 400, quality = 70): string {
  if (!url) return "";
  if (!url.includes("/storage/v1/object/public/")) return url;
  const transformed = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  const sep = transformed.includes("?") ? "&" : "?";
  return `${transformed}${sep}width=${w}&height=${h}&resize=cover&quality=${quality}`;
}
