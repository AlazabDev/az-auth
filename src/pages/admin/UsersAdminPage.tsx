import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, RefreshCw, Search, Users, ShieldCheck, Mail, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { notify, notifyError, notifySuccess } from "@/lib/notifications";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ROLES: { value: AppRole; label: string }[] = [
  { value: "platform_owner", label: "مالك المنصة" },
  { value: "platform_admin", label: "مسؤول المنصة" },
  { value: "database_administrator", label: "مسؤول قواعد البيانات" },
  { value: "data_engineer", label: "مهندس بيانات" },
  { value: "data_analyst", label: "محلل بيانات" },
  { value: "read_only", label: "اطلاع فقط" },
];

type UserRow = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  banned_until: string | null;
  providers: string[] | null;
  roles: string[] | null;
  mfa_enabled: boolean | null;
};

const UsersAdminPage = () => {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_list_users", { _search: null, _limit: 500 });
    if (error) notifyError("تعذر تحميل المستخدمين", error.message);
    setRows((data ?? []) as UserRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      (r.email ?? "").toLowerCase().includes(term) ||
      (r.roles ?? []).some((role) => role.includes(term)),
    );
  }, [rows, q]);

  const toggleRole = async (user: UserRow, role: AppRole, grant: boolean) => {
    setSaving(`${user.id}:${role}`);
    const { error } = await supabase.rpc("admin_set_user_role", {
      _user_id: user.id,
      _role: role,
      _grant: grant,
    });
    setSaving(null);
    if (error) {
      notifyError(
        error.message.includes("last_owner_protected")
          ? "لا يمكن سحب صلاحية آخر مالك للمنصة"
          : "تعذر تحديث الصلاحية",
        error.message,
      );
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === user.id
          ? { ...r, roles: grant ? [...(r.roles ?? []), role] : (r.roles ?? []).filter((x) => x !== role) }
          : r,
      ),
    );
    notifySuccess(grant ? "تم منح الصلاحية" : "تم سحب الصلاحية", `${user.email} — ${role}`);
  };

  const sendNotice = async (user: UserRow) => {
    const res = await notify({
      userId: user.id,
      title: "تحديث في صلاحيات حسابك",
      body: "تم تحديث صلاحيات حسابك في بوابة المصادقة المركزية لشركة العزب.",
      level: "info",
      category: "admin",
      email: true,
      link: `${window.location.origin}/dashboard`,
    });
    if (res.emailStatus === "sent") notifySuccess("تم إرسال الإشعار بالبريد", user.email ?? "");
    else if (res.emailStatus === "failed") notifyError("تعذر إرسال البريد", "راجع سجل التدقيق للتفاصيل");
    else notifySuccess("تم تسجيل الإشعار", user.email ?? "");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading font-extrabold text-3xl text-foreground">المستخدمون والصلاحيات</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            إدارة مركزية لكل حسابات العزب: الأدوار، التحقق بخطوتين، مزوّدو الدخول وآخر تسجيل دخول.
          </p>
        </div>
        <Button variant="outline" onClick={load} className="gap-2">
          <RefreshCw className="w-4 h-4" /> تحديث
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: Users, label: "إجمالي المستخدمين", value: rows.length },
          { icon: ShieldCheck, label: "لديهم أدوار", value: rows.filter((r) => (r.roles ?? []).length > 0).length },
          { icon: Mail, label: "مفعّل التحقق الثنائي", value: rows.filter((r) => r.mfa_enabled).length },
        ].map((c) => (
          <div key={c.label} className="rounded-2xl border border-border/50 bg-card p-4 flex items-center gap-3">
            <c.icon className="w-5 h-5 text-primary" />
            <div>
              <div className="text-2xl font-bold text-foreground">{c.value}</div>
              <div className="text-xs text-muted-foreground">{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالبريد أو الدور..." className="ps-10" />
      </div>

      {loading ? (
        <div className="p-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted-foreground rounded-2xl border border-border/50 bg-card">
          لا يوجد مستخدمون مطابقون.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((user) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border/50 bg-card p-4 space-y-4"
            >
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate" dir="ltr">{user.email ?? "—"}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex gap-3 flex-wrap" dir="ltr">
                    <span>آخر دخول: {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("ar-EG") : "—"}</span>
                    <span>{(user.providers ?? []).join(" · ")}</span>
                    {user.mfa_enabled && <span className="text-primary">2FA</span>}
                    {!user.email_confirmed_at && <span className="text-destructive">بريد غير مؤكد</span>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="gap-2" onClick={() => sendNotice(user)}>
                  <Send className="w-4 h-4" /> إشعار
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ROLES.map((role) => {
                  const active = (user.roles ?? []).includes(role.value);
                  const busy = saving === `${user.id}:${role.value}`;
                  return (
                    <label
                      key={role.value}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 px-3 py-2"
                    >
                      <span className="text-sm text-foreground">{role.label}</span>
                      {busy ? (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      ) : (
                        <Switch
                          checked={active}
                          onCheckedChange={(checked) => toggleRole(user, role.value, checked)}
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UsersAdminPage;
