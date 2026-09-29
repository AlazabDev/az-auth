import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAuthEvent } from "@/lib/audit";

export type OAuthProvider = "google" | "facebook" | "azure";

const OPTIONS: Record<OAuthProvider, { scopes?: string; label: string }> = {
  google: { label: "Google" },
  facebook: { scopes: "email public_profile", label: "Facebook" },
  azure: { scopes: "email openid profile", label: "Microsoft Entra" },
};

export async function signInWithProvider(provider: OAuthProvider): Promise<boolean> {
  const cfg = OPTIONS[provider];
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/resolve`, scopes: cfg.scopes },
  });
  if (error) {
    toast.error(`${cfg.label}: ${error.message}`);
    return false;
  }
  logAuthEvent({ event: "provider_used", description: `${cfg.label} OAuth`, detail: { provider } }).catch(() => undefined);
  return true;
}

export async function sendPhoneOtp(phone: string, channel: "sms" | "whatsapp") {
  const normalized = phone.replace(/[\s-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("أدخل الرقم بالصيغة الدولية مثل +201XXXXXXXXX");
  }
  const { error } = await supabase.auth.signInWithOtp({
    phone: normalized,
    options: { shouldCreateUser: true, channel },
  });
  if (error) throw error;
  logAuthEvent({ event: "otp_requested", description: `Phone code via ${channel}`, detail: { channel } }).catch(() => undefined);
  return normalized;
}
