import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2, Crosshair } from "lucide-react";
import { toast } from "sonner";
import { sendWhatsAppLocation, isNotConfigured, isDeviceOffline } from "@/lib/zapi";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  phone: string;
  conversationId: string;
}

export function LocationDialog({ open, onOpenChange, phone, conversationId }: Props) {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  function useCurrent() {
    if (!navigator.geolocation) {
      toast.error("Geolocalização indisponível");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude));
        setLng(String(pos.coords.longitude));
        setLocating(false);
        toast.success("Localização atual capturada");
      },
      (err) => {
        console.error(err);
        toast.error("Não foi possível obter a localização");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function send() {
    const nLat = Number(lat);
    const nLng = Number(lng);
    if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) {
      toast.error("Coordenadas inválidas");
      return;
    }
    setBusy(true);
    const res = await sendWhatsAppLocation(phone, nLat, nLng, label || undefined, undefined, conversationId);
    setBusy(false);
    if (res.ok && res.simulated) toast.success("Localização enviada", { description: "Modo demonstração." });
    else if (res.ok) toast.success("Localização enviada");
    else if (isNotConfigured(res)) return toast.error("Integração não configurada");
    else if (isDeviceOffline(res)) return toast.error("Celular offline");
    else return toast.error("Falha ao enviar localização");
    onOpenChange(false);
    setLat(""); setLng(""); setLabel("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Enviar localização
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            type="button" variant="outline" className="w-full justify-start"
            onClick={useCurrent} disabled={locating}
          >
            {locating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Crosshair className="w-4 h-4 mr-2" />}
            Usar minha localização
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="lat" className="text-xs">Latitude</Label>
              <Input id="lat" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-23.5505" inputMode="decimal" />
            </div>
            <div>
              <Label htmlFor="lng" className="text-xs">Longitude</Label>
              <Input id="lng" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-46.6333" inputMode="decimal" />
            </div>
          </div>
          <div>
            <Label htmlFor="label" className="text-xs">Rótulo (opcional)</Label>
            <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: Sede GoDrive" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={send} disabled={busy || !lat || !lng}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
