export const monitoredProviders = [
  { key: "email", label: "البريد الإلكتروني", kind: "OTP" },
  { key: "phone", label: "الهاتف / SMS", kind: "OTP" },
  { key: "whatsapp", label: "WhatsApp", kind: "OTP" },
  { key: "google", label: "Google", kind: "OAuth" },
  { key: "facebook", label: "Facebook", kind: "OAuth" },
  { key: "azure", label: "Microsoft Entra", kind: "OAuth" },
  { key: "github", label: "GitHub", kind: "OAuth" },
] as const;

export type AuthSettings = { external: Record<string, boolean> };
export type ProviderState = "enabled" | "disabled" | "unknown";

export function parseAuthSettings(value: unknown): AuthSettings {
  if (!value || typeof value !== "object" || !("external" in value) ||
      !value.external || typeof value.external !== "object" || Array.isArray(value.external)) {
    throw new Error("Invalid authentication settings response");
  }
  const external: Record<string, boolean> = {};
  for (const [key, enabled] of Object.entries(value.external)) {
    if (typeof enabled === "boolean") external[key] = enabled;
  }
  return { external };
}

export function providerState(settings: AuthSettings | null, key: string): ProviderState {
  // Phone activation does not establish whether WhatsApp delivery is configured.
  if (!settings || key === "whatsapp") return "unknown";
  const enabled = settings.external[key];
  return enabled === true ? "enabled" : enabled === false ? "disabled" : "unknown";
}

export async function fetchAuthHealth(signal: AbortSignal) {
  const started = performance.now();
  const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/settings`, {
    headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("Authentication service unavailable");
  const settings = parseAuthSettings(await response.json());
  return { settings, latency: Math.round(performance.now() - started), checkedAt: new Date() };
}