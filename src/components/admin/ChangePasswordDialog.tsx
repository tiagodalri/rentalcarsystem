import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Reuses the same rule set as src/pages/ResetPassword.tsx
const passwordSchema = z
  .string()
  .min(8, "Mínimo de 8 caracteres")
  .regex(/[A-Z]/, "Precisa de uma letra maiúscula")
  .regex(/[a-z]/, "Precisa de uma letra minúscula")
  .regex(/[0-9]/, "Precisa de um número");

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Strength = { score: 0 | 1 | 2 | 3; label: string; color: string };

function getStrength(pw: string): Strength {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  if (pw.length >= 12) s++;
  if (s >= 3) return { score: 3, label: "Forte", color: "bg-emerald-500" };
  if (s === 2) return { score: 2, label: "Média", color: "bg-amber-500" };
  if (s === 1) return { score: 1, label: "Fraca", color: "bg-red-500" };
  return { score: 0, label: "Muito fraca", color: "bg-muted" };
}

export default function ChangePasswordDialog({ open, onOpenChange }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [show3, setShow3] = useState(false);
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const currentRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setErrors({});
      setShow1(false);
      setShow2(false);
      setShow3(false);
      // Focus the first field shortly after the dialog mounts
      setTimeout(() => currentRef.current?.focus(), 50);
    }
  }, [open]);

  const strength = getStrength(newPassword);

  const validate = () => {
    const next: typeof errors = {};
    if (!currentPassword) next.current = "Informe sua senha atual.";
    const parsed = passwordSchema.safeParse(newPassword);
    if (!parsed.success) next.next = parsed.error.errors[0].message;
    if (confirmPassword !== newPassword) next.confirm = "As senhas não coincidem.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!validate()) return;

    setSubmitting(true);
    try {
      // 1. Get current user email
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user?.email) {
        toast({ title: "Sessão inválida", description: "Faça login novamente.", variant: "destructive" });
        return;
      }

      // 2. Validate current password by re-authenticating
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInErr) {
        setErrors((prev) => ({ ...prev, current: "Senha atual incorreta." }));
        toast({ title: "Senha atual incorreta", variant: "destructive" });
        return;
      }

      // 3. Update password
      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updErr) {
        toast({
          title: "Não foi possível alterar a senha",
          description: "Tente novamente em alguns instantes.",
          variant: "destructive",
        });
        return;
      }

      // 4. Invalidate other sessions (keeps current one)
      try {
        await supabase.auth.signOut({ scope: "others" });
      } catch (err) {
        console.warn("[ChangePassword] signOut others failed:", err);
      }

      // 5. Fire-and-forget confirmation email
      const userName =
        (user.user_metadata?.full_name as string | undefined) ||
        (user.user_metadata?.name as string | undefined) ||
        user.email.split("@")[0];

      supabase.functions
        .invoke("send-email", {
          body: {
            templateName: "password-changed",
            recipientEmail: user.email,
            idempotencyKey: `password-changed-${user.id}-${Date.now()}`,
            templateData: {
              userName,
              changedAt: new Date().toISOString(),
            },
            language: "pt",
          },
        })
        .catch((err) => console.warn("[ChangePassword] notification email failed:", err));

      toast({
        title: "Senha alterada com sucesso",
        description:
          "Outras sessões foram desconectadas e enviamos um email de confirmação.",
      });
      onOpenChange(false);
    } catch (err) {
      console.error("[ChangePassword] unexpected error:", err);
      toast({
        title: "Erro inesperado",
        description: "Não foi possível concluir a alteração.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    "w-full h-10 pl-10 pr-10 rounded-lg border border-border/60 bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all";

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ShieldCheck size={18} className="text-primary" />
            Alterar senha
          </DialogTitle>
          <DialogDescription className="text-xs">
            Por segurança, confirme sua senha atual antes de definir uma nova. Outras sessões ativas serão desconectadas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Senha atual
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={currentRef}
                type={show1 ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (errors.current) setErrors((p) => ({ ...p, current: undefined }));
                }}
                autoComplete="current-password"
                className={inputCls}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShow1((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {show1 ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.current && (
              <p className="text-[11px] text-destructive mt-1">{errors.current}</p>
            )}
          </div>

          {/* New */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Nova senha
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type={show2 ? "text" : "password"}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  if (errors.next) setErrors((p) => ({ ...p, next: undefined }));
                }}
                autoComplete="new-password"
                className={inputCls}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShow2((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {show2 ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Strength meter */}
            {newPassword && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i < strength.score ? strength.color : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Força: <span className="text-foreground font-medium">{strength.label}</span>
                </p>
              </div>
            )}

            {errors.next ? (
              <p className="text-[11px] text-destructive mt-1">{errors.next}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground/70 mt-1">
                Mínimo 8 caracteres, com maiúscula, minúscula e número.
              </p>
            )}
          </div>

          {/* Confirm */}
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Confirmar nova senha
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type={show3 ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirm) setErrors((p) => ({ ...p, confirm: undefined }));
                }}
                autoComplete="new-password"
                className={inputCls}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShow3((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {show3 ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.confirm && (
              <p className="text-[11px] text-destructive mt-1">{errors.confirm}</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className="h-10 px-4 rounded-lg border border-border/60 bg-background text-sm font-medium text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="h-10 px-4 gold-gradient text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Alterar senha
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
