import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "finance" | "operations" | "support" | "driver" | "platform_admin" | "partner";

// Module-level cache of roles per user
let cachedRoles: { userId: string; roles: AppRole[] } | null = null;

const clearLocalAuthSession = async () => {
  cachedRoles = null;
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (error) {
    console.warn("[useAdminAuth] local session clear failed:", error);
  }
};

export function useAdminAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const initialCheckDone = useRef(false);

  useEffect(() => {
    let mounted = true;

    const loadRoles = async (currentUser: User | null) => {
      if (!currentUser) {
        if (mounted) { setUser(null); setRoles([]); setAuthError(null); setLoading(false); }
        return;
      }

      if (mounted) setUser(currentUser);

      if (cachedRoles && cachedRoles.userId === currentUser.id) {
        if (mounted) { setRoles(cachedRoles.roles); setLoading(false); }
        return;
      }

      // Reset roles + mark loading while we (re)fetch, so consumers don't
      // momentarily see "user logged in but with 0 roles" and redirect away.
      if (mounted) { setRoles([]); setLoading(true); }

      try {
        const rolesQuery = supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", currentUser.id);

        const timeout = new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("Tempo esgotado ao carregar permissões.")), 12000);
        });

        const { data, error } = await Promise.race([rolesQuery, timeout]);
        if (error) throw error;

        const rs = ((data || []) as { role: AppRole }[])
          .map((r) => r.role)
          .filter((r): r is AppRole =>
            r === "admin" || r === "finance" || r === "operations" || r === "support" ||
            r === "driver" || r === "platform_admin" || r === "partner"
          );

        cachedRoles = { userId: currentUser.id, roles: rs };
        console.log("[useAdminAuth] roles loaded", rs);
        if (mounted) { setRoles(rs); setAuthError(null); setLoading(false); }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao carregar permissões.";
        console.warn("[useAdminAuth] roles load failed:", message);
        if (mounted) { setRoles([]); setAuthError(message); setLoading(false); }
      }
    };

    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (!initialCheckDone.current) {
          initialCheckDone.current = true;
          if (error) throw error;
          loadRoles(session?.user ?? null);
        }
      })
      .catch(async (error) => {
        console.warn("[useAdminAuth] session recovery failed:", error?.message || error);
        await clearLocalAuthSession();
        if (mounted) { setUser(null); setRoles([]); setAuthError(null); setLoading(false); }
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      // TOKEN_REFRESHED dispara quando a aba volta ao foco. Se for o MESMO
      // usuário já carregado, não fazemos NADA — caso contrário o
      // setLoading(true) + setRoles([]) desmontaria a página inteira e
      // o usuário perderia o que estava preenchendo. Mesmo vale para
      // USER_UPDATED quando o id não mudou.
      // TOKEN_REFRESHED / USER_UPDATED / SIGNED_IN podem disparar quando a aba
      // volta ao foco (Supabase restaura sessão do storage). Se for o MESMO
      // usuário já carregado, não fazemos NADA para evitar remount da página.
      if (
        (event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || event === "SIGNED_IN") &&
        session?.user &&
        cachedRoles?.userId === session.user.id
      ) {
        return;
      }
      cachedRoles = null;
      loadRoles(session?.user ?? null);
      if (event === "SIGNED_IN" && session?.user) {
        // Fire-and-forget: function is scoped to auth.uid() and is a no-op
        // for users that aren't in team_members.
        supabase.rpc("record_last_login").then(({ error }) => {
          if (error) console.warn("[useAdminAuth] record_last_login failed:", error.message);
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    cachedRoles = null;
    setAuthError(null);
    await clearLocalAuthSession();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    cachedRoles = null;
    await supabase.auth.signOut();
    navigate("/admin/login");
  };

  const hasRole = (r: AppRole) => roles.includes(r);
  const hasAny = (rs: AppRole[]) => rs.some((r) => roles.includes(r));
  const isAdmin = roles.includes("admin");

  return { user, roles, isAdmin, hasRole, hasAny, loading, authError, signIn, signOut };
}
