import { supabase } from "@/integrations/supabase/client";
import { buildHandoffUrl, clearSsoTarget, fetchSsoApps, getSsoTarget, resolveSsoApp } from "@/lib/sso";
import { canAccessApp, fetchMyRoles } from "@/lib/rbac";

export type AuthDestination =
  | { kind: "oauth"; url: string }
  | { kind: "sso"; url: string }
  | { kind: "admin"; url: "/admin" }
  | { kind: "dashboard"; url: "/dashboard" };

export async function resolvePostAuthDestination(): Promise<AuthDestination> {
  const oauthReturnTo = sessionStorage.getItem("alazab_oauth_return_to");
  if (oauthReturnTo) {
    sessionStorage.removeItem("alazab_oauth_return_to");
    return { kind: "oauth", url: oauthReturnTo };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("unauthenticated");

  const target = getSsoTarget();
  if (target) {
    const apps = await fetchSsoApps();
    const app = resolveSsoApp(target, apps);
    if (app) {
      const roles = await fetchMyRoles(user.id);
      if (!canAccessApp(app, roles)) {
        clearSsoTarget();
        throw new Error("forbidden_target");
      }
      const url = await buildHandoffUrl(app);
      clearSsoTarget();
      return { kind: "sso", url };
    }
    clearSsoTarget();
  }

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (!error && isAdmin) return { kind: "admin", url: "/admin" };
  return { kind: "dashboard", url: "/dashboard" };
}
