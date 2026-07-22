import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  CircleDot,
  Eye,
  Image as ImageIcon,
  Loader2,
  Palette,
  Trash2,
  Type as TypeIcon,
  Video as VideoIcon,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  sendStatusText,
  sendStatusImage,
  sendStatusVideo,
  isSimulated,
  isDeviceOffline,
} from "@/lib/zapi";

interface StatusRow {
  id: string;
  status_type: "text" | "image" | "video";
  text_content: string | null;
  background_color: string | null;
  font: string | null;
  media_url: string | null;
  caption: string | null;
  posted_by_name: string | null;
  view_count: number;
  posted_at: string;
  expires_at: string;
}

interface ViewerRow {
  id: string;
  viewer_phone: string | null;
  viewer_name: string | null;
  viewed_at: string;
}

const BACKGROUND_PRESETS = [
  { color: "#0D0D0D", label: "Grafite" },
  { color: "#E8B935", label: "Dourado" },
  { color: "#075E54", label: "Verde" },
  { color: "#7A5AF8", label: "Roxo" },
  { color: "#DC2626", label: "Vermelho" },
  { color: "#2563EB", label: "Azul" },
];

const FONT_PRESETS = ["SANS_SERIF", "SERIF", "NORICAN_REGULAR", "BRYNDAN_WRITE"];

function timeAgo(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
  } catch {
    return "";
  }
}

function pickTextColor(bg: string): string {
  const c = bg.replace("#", "");
  if (c.length !== 6) return "#ffffff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#0D0D0D" : "#ffffff";
}

async function uploadStatusMedia(file: File): Promise<string> {
  const ext = file.name.split(".").pop() || "bin";
  const path = `status/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("whatsapp-media")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  const { data } = await supabase.storage.from("whatsapp-media").createSignedUrl(path, 60 * 60 * 24);
  if (!data?.signedUrl) throw new Error("Falha ao gerar URL do arquivo");
  return data.signedUrl;
}

export default function AdminWhatsAppStatus() {
  const [rows, setRows] = useState<StatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Text status form
  const [text, setText] = useState("");
  const [bg, setBg] = useState(BACKGROUND_PRESETS[0].color);
  const [font, setFont] = useState(FONT_PRESETS[0]);

  // Media forms
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageCaption, setImageCaption] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoCaption, setVideoCaption] = useState("");

  // Viewer dialog
  const [viewerFor, setViewerFor] = useState<StatusRow | null>(null);
  const [viewers, setViewers] = useState<ViewerRow[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_statuses")
      .select(
        "id, status_type, text_content, background_color, font, media_url, caption, posted_by_name, view_count, posted_at, expires_at",
      )
      .gt("expires_at", new Date().toISOString())
      .order("posted_at", { ascending: false });
    if (error) {
      toast.error("Não foi possível carregar os Status", { description: error.message });
      setRows([]);
    } else {
      setRows((data ?? []) as StatusRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates: someone else may post/view a status
  useEffect(() => {
    const ch = supabase
      .channel(`wa-status-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_statuses" },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_status_views" },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const openViewers = useCallback(async (row: StatusRow) => {
    setViewerFor(row);
    setViewersLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_status_views")
      .select("id, viewer_phone, viewer_name, viewed_at")
      .eq("status_id", row.id)
      .order("viewed_at", { ascending: false });
    if (error) {
      toast.error("Falha ao carregar visualizações", { description: error.message });
      setViewers([]);
    } else {
      setViewers((data ?? []) as ViewerRow[]);
    }
    setViewersLoading(false);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Remover este Status?")) return;
      const { error } = await supabase.from("whatsapp_statuses").delete().eq("id", id);
      if (error) {
        toast.error("Não foi possível remover", { description: error.message });
        return;
      }
      toast.success("Status removido");
      load();
    },
    [load],
  );

  const submitText = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      toast.error("Escreva algo antes de publicar");
      return;
    }
    setSending(true);
    const res = await sendStatusText(trimmed, bg, font);
    setSending(false);
    if (res.ok) {
      toast.success(isSimulated(res) ? "Status salvo (modo demonstração)" : "Status publicado");
      setText("");
      load();
    } else if (isDeviceOffline(res)) {
      toast.error("Aparelho offline", { description: "Reconecte o WhatsApp e tente novamente." });
    } else {
      toast.error("Falha ao publicar", { description: res.error || String(res.data ?? "") });
    }
  }, [text, bg, font, load]);

  const submitImage = useCallback(async () => {
    if (!imageFile) {
      toast.error("Selecione uma imagem");
      return;
    }
    setSending(true);
    try {
      const url = await uploadStatusMedia(imageFile);
      const res = await sendStatusImage(url, imageCaption.trim() || undefined);
      if (res.ok) {
        toast.success(isSimulated(res) ? "Status salvo (modo demonstração)" : "Status publicado");
        setImageFile(null);
        setImageCaption("");
        load();
      } else if (isDeviceOffline(res)) {
        toast.error("Aparelho offline");
      } else {
        toast.error("Falha ao publicar", { description: res.error || String(res.data ?? "") });
      }
    } catch (err) {
      toast.error("Falha no upload", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSending(false);
    }
  }, [imageFile, imageCaption, load]);

  const submitVideo = useCallback(async () => {
    if (!videoFile) {
      toast.error("Selecione um vídeo");
      return;
    }
    if (videoFile.size > 10 * 1024 * 1024) {
      toast.error("Vídeo excede 10MB");
      return;
    }
    setSending(true);
    try {
      const url = await uploadStatusMedia(videoFile);
      const res = await sendStatusVideo(url, videoCaption.trim() || undefined);
      if (res.ok) {
        toast.success(isSimulated(res) ? "Status salvo (modo demonstração)" : "Status publicado");
        setVideoFile(null);
        setVideoCaption("");
        load();
      } else if (isDeviceOffline(res)) {
        toast.error("Aparelho offline");
      } else {
        toast.error("Falha ao publicar", { description: res.error || String(res.data ?? "") });
      }
    } catch (err) {
      toast.error("Falha no upload", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSending(false);
    }
  }, [videoFile, videoCaption, load]);

  const totals = useMemo(() => {
    const totalViews = rows.reduce((acc, r) => acc + (r.view_count || 0), 0);
    return { count: rows.length, totalViews };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/admin/whatsapp">
            <Button variant="ghost" size="sm" className="h-8">
              <ArrowLeft className="w-4 h-4 mr-1" /> WhatsApp
            </Button>
          </Link>
          <div>
            <h1 className="admin-h1 text-2xl md:text-3xl flex items-center gap-2">
              <CircleDot className="w-6 h-6 text-primary" /> Status
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Publique Status (Stories) de 24h no seu WhatsApp e acompanhe quem visualizou.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {totals.count} ativo{totals.count === 1 ? "" : "s"}
          </Badge>
          <Badge variant="secondary" className="text-xs gap-1">
            <Eye className="w-3 h-3" /> {totals.totalViews}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-6">
        {/* Composer */}
        <Card className="p-4 md:p-5">
          <h2 className="admin-section-title mb-3">Novo Status</h2>
          <Tabs defaultValue="text">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="text" className="gap-1.5"><TypeIcon className="w-3.5 h-3.5" />Texto</TabsTrigger>
              <TabsTrigger value="image" className="gap-1.5"><ImageIcon className="w-3.5 h-3.5" />Imagem</TabsTrigger>
              <TabsTrigger value="video" className="gap-1.5"><VideoIcon className="w-3.5 h-3.5" />Vídeo</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="space-y-3 mt-4">
              <div
                className="rounded-2xl aspect-[9/16] max-h-[360px] w-full flex items-center justify-center p-6 text-center overflow-hidden"
                style={{ background: bg, color: pickTextColor(bg) }}
              >
                <p className="text-xl md:text-2xl font-medium whitespace-pre-wrap break-words">
                  {text || "Sua mensagem aparece aqui"}
                </p>
              </div>

              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 700))}
                placeholder="Escreva seu Status..."
                rows={3}
                maxLength={700}
              />

              <div>
                <Label className="text-xs flex items-center gap-1.5 mb-2">
                  <Palette className="w-3.5 h-3.5" /> Fundo
                </Label>
                <div className="flex flex-wrap gap-2">
                  {BACKGROUND_PRESETS.map((p) => (
                    <button
                      key={p.color}
                      type="button"
                      onClick={() => setBg(p.color)}
                      className={`w-8 h-8 rounded-full border-2 transition ${
                        bg === p.color ? "border-primary scale-110" : "border-border/50"
                      }`}
                      style={{ background: p.color }}
                      aria-label={p.label}
                      title={p.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs mb-2 block">Fonte</Label>
                <div className="flex flex-wrap gap-2">
                  {FONT_PRESETS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFont(f)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition ${
                        font === f
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f.replace("_", " ")}
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={submitText} disabled={sending || !text.trim()} className="w-full">
                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CircleDot className="w-4 h-4 mr-2" />}
                Publicar Status
              </Button>
            </TabsContent>

            <TabsContent value="image" className="space-y-3 mt-4">
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              />
              {imageFile && (
                <div className="rounded-xl overflow-hidden bg-muted/40 aspect-[9/16] max-h-[360px] flex items-center justify-center">
                  <img
                    src={URL.createObjectURL(imageFile)}
                    alt="Prévia"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              )}
              <Textarea
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value.slice(0, 500))}
                placeholder="Legenda (opcional)"
                rows={2}
              />
              <Button onClick={submitImage} disabled={sending || !imageFile} className="w-full">
                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageIcon className="w-4 h-4 mr-2" />}
                Publicar imagem
              </Button>
            </TabsContent>

            <TabsContent value="video" className="space-y-3 mt-4">
              <Input
                type="file"
                accept="video/*"
                onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
              />
              {videoFile && (
                <div className="rounded-xl overflow-hidden bg-muted/40 aspect-[9/16] max-h-[360px] flex items-center justify-center">
                  <video
                    src={URL.createObjectURL(videoFile)}
                    className="max-h-full max-w-full"
                    controls
                  />
                </div>
              )}
              <Textarea
                value={videoCaption}
                onChange={(e) => setVideoCaption(e.target.value.slice(0, 500))}
                placeholder="Legenda (opcional)"
                rows={2}
              />
              <p className="text-[11px] text-muted-foreground">Tamanho máximo: 10MB.</p>
              <Button onClick={submitVideo} disabled={sending || !videoFile} className="w-full">
                {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <VideoIcon className="w-4 h-4 mr-2" />}
                Publicar vídeo
              </Button>
            </TabsContent>
          </Tabs>
        </Card>

        {/* Grid of active statuses */}
        <div className="space-y-3">
          <h2 className="admin-section-title">Status ativos</h2>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
            </div>
          ) : rows.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Nenhum Status ativo no momento. Publique o primeiro ao lado.
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {rows.map((r) => (
                <Card key={r.id} className="overflow-hidden group relative">
                  <button
                    type="button"
                    onClick={() => openViewers(r)}
                    className="w-full text-left"
                  >
                    <div className="aspect-[9/16] w-full flex items-center justify-center overflow-hidden"
                      style={
                        r.status_type === "text"
                          ? { background: r.background_color || "#0D0D0D", color: pickTextColor(r.background_color || "#0D0D0D") }
                          : { background: "#000" }
                      }
                    >
                      {r.status_type === "text" && (
                        <p className="p-4 text-sm md:text-base font-medium text-center whitespace-pre-wrap break-words line-clamp-6">
                          {r.text_content}
                        </p>
                      )}
                      {r.status_type === "image" && r.media_url && (
                        <img src={r.media_url} alt="" className="max-h-full max-w-full object-cover w-full h-full" />
                      )}
                      {r.status_type === "video" && r.media_url && (
                        <video src={r.media_url} className="max-h-full max-w-full object-cover w-full h-full" muted />
                      )}
                    </div>
                    <div className="p-2 space-y-0.5">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{timeAgo(r.posted_at)}</span>
                        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{r.view_count}</span>
                      </div>
                      {r.caption && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{r.caption}</p>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(r.id);
                    }}
                    className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-background/80 backdrop-blur opacity-0 group-hover:opacity-100 transition"
                    aria-label="Remover"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!viewerFor} onOpenChange={(o) => !o && setViewerFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4" /> Visualizações
            </DialogTitle>
            <DialogDescription>
              {viewerFor ? `${viewerFor.view_count} contato(s) visualizaram este Status.` : ""}
            </DialogDescription>
          </DialogHeader>

          {viewersLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Carregando…
            </div>
          ) : viewers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Ninguém visualizou ainda.
            </p>
          ) : (
            <ul className="space-y-2 max-h-[400px] overflow-y-auto">
              {viewers.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between text-sm border-b border-border/40 pb-2 last:border-0"
                >
                  <div>
                    <p className="font-medium">{v.viewer_name || v.viewer_phone || "Contato"}</p>
                    {v.viewer_phone && v.viewer_name && (
                      <p className="text-xs text-muted-foreground">{v.viewer_phone}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{timeAgo(v.viewed_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
