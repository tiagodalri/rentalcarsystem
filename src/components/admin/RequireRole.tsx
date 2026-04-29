import { Navigate } from "react-router-dom";
import { useAdminAuth, type AppRole } from "@/hooks/useAdminAuth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

interface RequireRoleProps {
  roles: AppRole[];
  children: React.ReactNode;
}

export function RequireRole({ roles, children }: RequireRoleProps) {
  const { hasAny, loading } = useAdminAuth();
  const toastShown = useRef(false);

  const allowed = !loading && hasAny(roles);

  useEffect(() => {
    if (!loading && !hasAny(roles) && !toastShown.current) {
      toastShown.current = true;
      toast.error("Você não tem permissão para acessar esta página");
    }
  }, [loading, hasAny, roles]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}
