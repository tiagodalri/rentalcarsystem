import { useState } from "react";
import { stampInspectionPhoto } from "@/lib/inspectionStamp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminStampPreview() {
  const [original, setOriginal] = useState<string | null>(null);
  const [stamped, setStamped] = useState<string | null>(null);
  const [address, setAddress] = useState("8810 Albury Drive, Orlando, FL 32829");
  const [busy, setBusy] = useState(false);

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      setOriginal(URL.createObjectURL(file));
      // Força o stamp mesmo se o arquivo já termina com -stamped
      const renamed = new File([file], file.name.replace(/-stamped|-carimbo-final/gi, ""), {
        type: file.type,
      });
      const out = await stampInspectionPhoto(renamed, {
        address,
        date: new Date(),
      });
      setStamped(URL.createObjectURL(out));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-shell p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="admin-h1">Pré-visualização do carimbo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Anexe uma foto qualquer para ver exatamente como o novo carimbo (tamanho e espaçamento atualizados) vai aparecer nas próximas inspeções.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
        <div>
          <Label htmlFor="addr">Endereço de teste</Label>
          <Input id="addr" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <Button asChild disabled={busy}>
          <label className="cursor-pointer">
            {busy ? "Processando..." : "Escolher foto"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
              }}
            />
          </label>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <p className="admin-label mb-2">Original</p>
          {original ? (
            <img src={original} alt="Original" className="w-full rounded-lg border border-border/40" />
          ) : (
            <div className="aspect-video rounded-lg border border-dashed border-border/40 grid place-items-center text-xs text-muted-foreground">
              Sem foto
            </div>
          )}
        </div>
        <div>
          <p className="admin-label mb-2">Com novo carimbo</p>
          {stamped ? (
            <>
              <img src={stamped} alt="Stamped" className="w-full rounded-lg border border-primary/40" />
              <a
                href={stamped}
                download="preview-carimbo.jpg"
                className="inline-block mt-2 text-xs underline text-primary"
              >
                Baixar exemplo
              </a>
            </>
          ) : (
            <div className="aspect-video rounded-lg border border-dashed border-border/40 grid place-items-center text-xs text-muted-foreground">
              Aparece aqui
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
