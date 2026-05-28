import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type OcrFields = {
  driver_license?: string | null;
  driver_license_expiry?: string | null;
  full_name?: string | null;
  document_number?: string | null;
  date_of_birth?: string | null;
};

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip "data:...;base64," prefix
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export function useDocumentOcr() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OcrFields | null>(null);

  const runOcr = useCallback(async (file: File): Promise<OcrFields | null> => {
    if (!file) return null;
    // Only images supported by the vision model directly
    if (!file.type.startsWith("image/")) {
      toast({
        title: "OCR indisponível para PDF",
        description: "Envie uma foto (JPG/PNG) para preenchimento automático.",
      });
      return null;
    }

    setLoading(true);
    try {
      const imageBase64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("ocr-document", {
        body: { imageBase64, mimeType: file.type },
      });
      if (error) throw error;
      const fields = (data?.data ?? null) as OcrFields | null;
      setResult(fields);
      return fields;
    } catch (err: any) {
      console.error("OCR error", err);
      toast({
        title: "Não foi possível ler o documento",
        description: err?.message || "Preencha os campos manualmente.",
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => setResult(null), []);

  return { loading, result, runOcr, reset };
}
