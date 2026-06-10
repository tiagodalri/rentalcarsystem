import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import ChangePasswordDialog from "@/components/admin/ChangePasswordDialog";

export default function AdminSettings() {
  const { user } = useAdminAuth();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-medium text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie sua conta de administrador</p>
      </div>

      <Card className="bg-card/50 border-border/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock size={16} className="text-primary" />
            Conta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 block">E-mail</label>
            <p className="text-sm text-foreground">{user?.email || "—"}</p>
          </div>

          <div className="pt-4 border-t border-border/30 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">Senha</p>
              <p className="text-xs text-muted-foreground mt-1">
                Para alterar sua senha, confirme a senha atual e defina uma nova. Outras sessões ativas serão desconectadas automaticamente.
              </p>
            </div>
            <button
              onClick={() => setDialogOpen(true)}
              className="gold-gradient text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Alterar senha
            </button>
          </div>
        </CardContent>
      </Card>

      <ChangePasswordDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
