import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/portal-jwt`;

export type PortalToken = {
  token: string;
  token_type: string;
  expires_in: number;
  expires_at: string;
  jti: string;
  roles: string[];
  app: { slug: string; name_ar: string; name_en: string; base_url: string };
  launch_url: string;
  refresh_url: string;
};

/** The URL Outpost calls when its own session expires: it re-checks the Alazab
 *  session and bounces the browser back in with a fresh Portal JWT. */
export function portalRefreshUrl(slug = "outpost") {
  return `${FUNCTIONS_BASE}/refresh?slug=${encodeURIComponent(slug)}&redirect=1`;
}

async function call(path: "issue" | "refresh", slug: string, previousJti?: string): Promise<PortalToken> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("no_session");

  const res = await fetch(`${FUNCTIONS_BASE}/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ slug, previous_jti: previousJti }),
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.ok) {
    throw new Error(payload?.error?.code ?? `portal_error_${res.status}`);
  }
  return payload.data as PortalToken;
}

export const issuePortalToken = (slug = "outpost") => call("issue", slug);
export const refreshPortalToken = (slug = "outpost", previousJti?: string) =>
  call("refresh", slug, previousJti);

/** Opens Outpost (or any registered portal app) with a freshly signed Portal JWT. */
export async function openPortal(slug = "outpost", target: "_self" | "_blank" = "_self") {
  const issued = await issuePortalToken(slug);
  if (target === "_blank") window.open(issued.launch_url, "_blank", "noopener,noreferrer");
  else window.location.href = issued.launch_url;
  return issued;
}
