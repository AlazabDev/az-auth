import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type NotifyLevel = "info" | "success" | "warning" | "error";

export type NotifyOptions = {
  title: string;
  body?: string;
  level?: NotifyLevel;
  /** Logical grouping, e.g. "auth", "portal", "admin". */
  category?: string;
  /** Absolute URL opened from the email call-to-action. */
  link?: string;
  /** Show an in-app toast (default true). */
  toast?: boolean;
  /** Also deliver by email. */
  email?: boolean;
  /** Store centrally (default true when email is requested). */
  persist?: boolean;
  /** Target another user — admins only. */
  userId?: string;
};

export type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  level: string;
  category: string;
  link: string | null;
  channels: string[];
  email_status: string | null;
  read_at: string | null;
  created_at: string;
};

function showToast(level: NotifyLevel, title: string, body?: string) {
  const opts = body ? { description: body } : undefined;
  if (level === "success") toast.success(title, opts);
  else if (level === "error") toast.error(title, opts);
  else if (level === "warning") toast.warning(title, opts);
  else toast(title, opts);
}

/**
 * Central notification entry point.
 * Always safe to call: a failing backend never breaks the calling flow.
 */
export async function notify(options: NotifyOptions): Promise<{ id?: string; emailStatus?: string | null }> {
  const {
    title,
    body,
    level = "info",
    category = "general",
    link,
    toast: withToast = true,
    email = false,
    persist = email,
    userId,
  } = options;

  if (withToast && !userId) showToast(level, title, body);
  if (!persist && !email) return {};

  try {
    const { data, error } = await supabase.functions.invoke("notify", {
      body: { title, body, level, category, link, email, user_id: userId },
    });
    if (error) throw error;
    const payload = data as { ok: boolean; data?: { id: string; email_status: string | null } };
    return { id: payload?.data?.id, emailStatus: payload?.data?.email_status };
  } catch (e) {
    console.error("notify failed", e);
    return {};
  }
}

/** Convenience wrappers for toast-only usage across the app. */
export const notifySuccess = (title: string, body?: string) => showToast("success", title, body);
export const notifyError = (title: string, body?: string) => showToast("error", title, body);
export const notifyInfo = (title: string, body?: string) => showToast("info", title, body);
export const notifyWarning = (title: string, body?: string) => showToast("warning", title, body);

export async function listNotifications(limit = 50): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("adp_notifications")
    .select("id,title,body,level,category,link,channels,email_status,read_at,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function markNotificationRead(id: string) {
  await supabase.from("adp_notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
}
