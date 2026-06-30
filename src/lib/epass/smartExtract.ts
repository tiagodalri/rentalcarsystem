// Extração inteligente multi-formato para o E-Pass:
// .csv → parser local (já existente)
// .tsv/.txt → tenta delimitadores (vírgula, tab, ponto-e-vírgula, pipe); fallback IA por texto
// .xls/.xlsx/.ods → SheetJS converte pra TSV e tenta local; fallback IA por texto
// .pdf → IA multimodal (Gemini) na edge function
// .png/.jpg/.jpeg/.webp/.heic → IA multimodal (visão) na edge function
// outros → tenta ler como texto; se vazio, manda binário pra IA
import * as XLSX from "xlsx";
import { parseEpassCsv, type EpassParseResult } from "./csvParser";
import { supabase } from "@/integrations/supabase/client";

const IMG_EXT = /\.(png|jpe?g|webp|heic|heif|bmp|tiff?)$/i;
const SHEET_EXT = /\.(xlsx|xls|ods|xlsm|xlsb)$/i;

export async function extractEpassFromFile(file: File): Promise<EpassParseResult> {
  const name = file.name || "";
  const lower = name.toLowerCase();
  const mt = (file.type || "").toLowerCase();

  // PDF → IA multimodal (rota dedicada já no parseEpassCsv).
  if (/\.pdf$/i.test(lower) || mt === "application/pdf") {
    return parseEpassCsv(file);
  }

  // Imagens (extrato em foto/print) → IA visão.
  if (IMG_EXT.test(lower) || mt.startsWith("image/")) {
    return aiBinaryExtract(file, mt || guessMime(lower));
  }

  // Planilhas → SheetJS → CSV equivalente → parser local; se nada sair, IA por texto.
  if (SHEET_EXT.test(lower) || mt.includes("spreadsheet") || mt.includes("excel")) {
    return extractFromSpreadsheet(file);
  }

  // CSV “real” → parser local direto.
  if (/\.csv$/i.test(lower) || mt === "text/csv") {
    return parseEpassCsv(file);
  }

  // TXT / TSV / HTML / JSON / qualquer texto → normaliza e tenta local; fallback IA.
  if (
    /\.(txt|tsv|tab|log|dat|prn|json|ya?ml|html?)$/i.test(lower) ||
    mt.startsWith("text/") ||
    mt === "application/json"
  ) {
    return extractFromTextLike(file);
  }

  // Desconhecido: tenta como texto; se ilegível, manda binário pra IA.
  try {
    const text = await file.text();
    if (text && /[A-Za-z0-9]/.test(text)) {
      return extractFromText(text, file.name);
    }
  } catch {
    // ignora — vai pra IA binária
  }
  return aiBinaryExtract(file, mt || "application/octet-stream");
}

// ===== Planilhas =====
async function extractFromSpreadsheet(file: File): Promise<EpassParseResult> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "array" });
  const chunks: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    // CSV padrão (vírgula) — o parser local entende. Header de seção no topo pra IA fallback.
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false, strip: true });
    if (csv.trim()) {
      chunks.push(`# Sheet: ${sheetName}\n${csv}`);
    }
  }
  const merged = chunks.join("\n\n");
  if (!merged.trim()) {
    // Planilha vazia/binário estranho → manda o arquivo cru pra IA.
    return aiBinaryExtract(file, file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }
  return extractFromText(merged, file.name);
}

// ===== Texto (TXT/TSV/HTML/JSON/etc) =====
async function extractFromTextLike(file: File): Promise<EpassParseResult> {
  const text = await file.text();
  return extractFromText(text, file.name);
}

// Tenta detectar delimitador e converter pra CSV padrão E-Pass; se nada bater, vai pra IA.
async function extractFromText(text: string, filename: string): Promise<EpassParseResult> {
  const normalized = normalizeToCsv(text);

  // Heurística: precisa ter cabeçalho "Vehicle Activity" ou "Transponder Number" pra confiar no parser local.
  const lower = normalized.toLowerCase();
  if (lower.includes("vehicle activity") || lower.includes("transponder number")) {
    const fakeFile = new File([normalized], filename.replace(/\.[^.]+$/, "") + ".csv", { type: "text/csv" });
    const local = await parseEpassCsv(fakeFile);
    if (local.tolls.length > 0) return local;
  }

  // Fallback IA via texto.
  return aiTextExtract(normalized || text, filename);
}

function normalizeToCsv(text: string): string {
  // Detecta delimitador mais provável a partir das primeiras 30 linhas com conteúdo.
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 30);
  if (lines.length === 0) return text;

  const candidates: Array<{ d: string; score: number }> = [];
  for (const d of [",", "\t", ";", "|"]) {
    const counts = lines.map((l) => l.split(d).length);
    const avg = counts.reduce((s, n) => s + n, 0) / counts.length;
    const stable = counts.filter((n) => n === Math.round(avg)).length / counts.length;
    // Pontua: muitas colunas em média + consistência.
    candidates.push({ d, score: avg > 1 ? avg * stable : 0 });
  }
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  if (!best || best.score < 2 || best.d === ",") return text; // já está em CSV ou ilegível

  // Converte para vírgula respeitando aspas simples.
  return text
    .split(/\r?\n/)
    .map((line) => {
      if (!line.trim()) return line;
      const cells = line.split(best.d);
      return cells
        .map((c) => {
          const v = c.trim();
          return /[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        })
        .join(",");
    })
    .join("\n");
}

// ===== IA: texto =====
async function aiTextExtract(text: string, filename: string): Promise<EpassParseResult> {
  const { data, error } = await supabase.functions.invoke("epass-pdf-parse", {
    body: { text, filename },
  });
  if (error) throw new Error(error.message || "Falha ao interpretar arquivo com IA.");
  return toResult(data, filename);
}

// ===== IA: binário (PDF/imagem/outros) =====
async function aiBinaryExtract(file: File, mimeType: string): Promise<EpassParseResult> {
  const fileBase64 = await fileToBase64(file);
  const { data, error } = await supabase.functions.invoke("epass-pdf-parse", {
    body: { fileBase64, mimeType, filename: file.name },
  });
  if (error) throw new Error(error.message || "Falha ao interpretar arquivo com IA.");
  return toResult(data, file.name);
}

// ===== Helpers =====
async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const chunk = 0x8000;
  let bin = "";
  for (let i = 0; i < buf.length; i += chunk) {
    bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function guessMime(name: string): string {
  if (/\.png$/i.test(name)) return "image/png";
  if (/\.jpe?g$/i.test(name)) return "image/jpeg";
  if (/\.webp$/i.test(name)) return "image/webp";
  if (/\.heic$/i.test(name)) return "image/heic";
  if (/\.bmp$/i.test(name)) return "image/bmp";
  if (/\.tiff?$/i.test(name)) return "image/tiff";
  return "application/octet-stream";
}

async function toResult(resp: any, filename: string): Promise<EpassParseResult> {
  const payload = resp?.data;
  const rawTolls: any[] = Array.isArray(payload?.tolls) ? payload.tolls : [];
  // Reaproveita a normalização do parser local: monta um CSV mínimo e roda.
  const header = "Vehicle Activity\nTransponder Number,Date,Time,Posting Date,Location,Amount,Toll Type\n";
  const body = rawTolls
    .map((t) => {
      const transponder = String(t?.transponder_number ?? "").replace(/"/g, "");
      const date = isoToEpass(String(t?.date ?? ""));
      const time = String(t?.time ?? "00:00:00");
      const posting = isoToEpass(String(t?.posting_date ?? t?.date ?? ""));
      const location = String(t?.location ?? "").replace(/"/g, "");
      const amount = typeof t?.amount === "number" ? t.amount : parseFloat(String(t?.amount ?? "0"));
      const tollType = String(t?.toll_type ?? "").replace(/"/g, "");
      return `${transponder},${date},${time},${posting},"${location}",${isNaN(amount) ? 0 : amount.toFixed(2)},${tollType}`;
    })
    .join("\n");
  const fakeFile = new File([header + body], filename.replace(/\.[^.]+$/, "") + ".csv", { type: "text/csv" });
  const result = await parseEpassCsv(fakeFile);
  if (typeof payload?.account_number === "string") result.account_number = payload.account_number;
  if (typeof payload?.period_label === "string") result.period_label = payload.period_label;
  result.filename = filename;
  return result;
}

// "2026-05-01" → "1-May-26" (formato aceito pelo parser local).
function isoToEpass(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dd = parseInt(m[3], 10);
  const mm = months[parseInt(m[2], 10) - 1] || "Jan";
  const yy = m[1].slice(2);
  return `${dd}-${mm}-${yy}`;
}
