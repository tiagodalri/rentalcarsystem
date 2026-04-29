import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type AppRole = "admin" | "finance" | "operations" | "support";

// Module-level cache of roles per user
let cachedRoles: { userId: string; roles: AppRole[] } | null = null;

export function useAdminAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const initialCheckDone = useRef(false);

  useEffect(() => {
    let mounted = true;

    const loadRoles = async (currentUser: User | null) => {
      if (!currentUser) {
        if (mounted) { setUser(null); setRoles([]); setLoading(false); }
        return;
      }

      if (mounted) setUser(currentUser);

      if (cachedRoles && cachedRoles.userId === currentUser.id) {
        if (mounted) { setRoles(cachedRoles.roles); setLoading(false); }
        return;
      }

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", currentUser.id);

      const rs = ((data || []) as { role: AppRole }[])
        .map((r) => r.role)
        .filter((r): r is AppRole =>
          r === "admin" || r === "finance" || r === "operations" || r === "support"
        );

      cachedRoles = { userId: currentUser.id, roles: rs };
      console.log("[useAdminAuth] roles loaded:", { email: currentUser.email, userId: currentUser.id, roles: rs });
      if (mounted) { setRoles(rs); setLoading(false); }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!initialCheckDone.current) {
        initialCheckDone.current = true;
        loadRoles(session?.user ?? null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      cachedRoles = null;
      loadRoles(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    cachedRoles = null;
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

  return { user, roles, isAdmin, hasRole, hasAny, loading, signIn, signOut };
}
