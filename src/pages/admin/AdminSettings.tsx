import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, UsersRound, ScrollText, ChevronRight, FileSignature, FileWarning, Building2, Percent } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import ChangePasswordDialog from "@/components/admin/ChangePasswordDialog";
import WhatsAppSettingsSection from "@/components/admin/whatsapp/WhatsAppSettingsSection";

export default function AdminSettings() {
  const { user, hasAny } = useAdminAuth();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  const email = user?.email || "";
  const isSuperAdmin = email.toLowerCase() === "admin@rentalcarsystem.lovable.app";

  const managementItems = [
    { title: "Equipe", url: "/admin/team", icon: UsersRound, desc: "Gerencie permissões e membros da equipe" },
    ...(hasAny(["platform_admin"])
      ? [{ title: "Locadoras", url: "/admin/platform/locadoras", icon: Building2, desc: "Gerencie locadoras parceiras da plataforma" }]
      : []),
    ...(hasAny(["admin","operations","finance"])
      ? [{ title: "Pendências", url: "/admin/pendencias", icon: FileWarning, desc: "Informações faltantes no cadastro da frota" }]
      : []),
    ...(hasAny(["admin","operations","support","finance"])
      ? [{ title: "Contratos", url: "/admin/contracts", icon: FileSignature, desc: "Gerencie contratos e templates de assinatura" }]
      : []),
    ...(isSuperAdmin ? [{ title: "Logs", url: "/admin/logs", icon: ScrollText, desc: "Visualize logs do sistema e auditoria" }] : []),
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="admin-h1 text-2xl">Configurações</h1>
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
            <p className="text-sm text-foreground">{user?.email || ""}</p>
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

      {managementItems.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gestão</h2>
          <div className="space-y-2">
            {managementItems.map((item) => (
              <button
                key={item.url}
                onClick={() => navigate(item.url)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/40 bg-card/40 hover:bg-card/70 transition-colors text-left"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <item.icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}

      {hasAny(["admin"]) && <WhatsAppSettingsSection />}

      <ChangePasswordDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
