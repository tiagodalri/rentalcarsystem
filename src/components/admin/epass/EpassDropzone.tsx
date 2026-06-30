import { useCallback, useRef, useState } from "react";
import { Upload, FileSpreadsheet, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onFiles: (files: File[]) => void;
  files: File[];
  onRemove: (index: number) => void;
  disabled?: boolean;
}

export function EpassDropzone({ onFiles, files, onRemove, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback((list: FileList | null) => {
    if (!list) return;
    const arr = Array.from(list).filter((f) => /\.(csv|pdf)$/i.test(f.name));
    if (arr.length > 0) onFiles(arr);
  }, [onFiles]);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        disabled={disabled}
        className={cn(
          "w-full rounded-xl border-2 border-dashed p-8 text-center transition-all",
          "flex flex-col items-center justify-center gap-3 min-h-[180px]",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Upload className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">Arraste os CSVs ou PDFs do portal E-Pass aqui</p>
          <p className="text-xs text-muted-foreground mt-1">
            Aceita vários arquivos .CSV e .PDF. PDFs são interpretados por OCR de alta qualidade (IA).
          </p>
        </div>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv,.pdf,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40 border border-border/60">
              <FileSpreadsheet className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{f.name}</div>
                <div className="text-[10px] text-muted-foreground tabular-nums">{(f.size / 1024).toFixed(1)} KB</div>
              </div>
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="h-7 w-7 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive flex items-center justify-center"
                aria-label="Remover"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
