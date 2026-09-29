import { motion } from "framer-motion";
import { Shield, Webhook, Users, ArrowUpRight, Boxes, ScrollText, Loader2, Bot, Activity } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Stats = {
  providersEnabled: number;
  providersTotal: number;
  apps: number;
  appsActive: number;
  users: number;
  webhooks: number;
  authEvents24h: number;
  failed24h: number;
};

const AdminOverviewPage = () => {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [providers, providersOn, apps, appsOn, users, wh, events, failed] = await Promise.all([
        supabase.from("auth_providers").select("*", { count: "exact", head: true }),
        supabase.from("auth_providers").select("*", { count: "exact", head: true }).eq("enabled", true),
        supabase.from("sso_apps").select("*", { count: "exact", head: true }),
        supabase.from("sso_apps").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("adp_profiles").select("*", { count: "exact", head: true }),
        supabase.from("webhook_endpoints").select("*", { count: "exact", head: true }),
        supabase.from("adp_security_events").select("*", { count: "exact", head: true }).eq("category", "auth").gte("created_at", since),
        supabase.from("adp_security_events").select("*", { count: "exact", head: true }).eq("category", "auth").eq("status", "failure").gte("created_at", since),
      ]);
      setStats({
        providersTotal: providers.count ?? 0,
        providersEnabled: providersOn.count ?? 0,
        apps: apps.count ?? 0,
        appsActive: appsOn.count ?? 0,
        users: users.count ?? 0,
        webhooks: wh.count ?? 0,
        authEvents24h: events.count ?? 0,
        failed24h: failed.count ?? 0,
      });
    })();
  }, []);

  if (!stats) {
    return <div className="min-h-[45vh] grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  const cards = [
    { icon: Users, label: "المستخدمون", value: stats.users, to: "/admin/users" },
    { icon: Shield, label: "مزوّدو الدخول المفعّلون", value: `${stats.providersEnabled}/${stats.providersTotal}`, to: "/admin/auth" },
    { icon: Boxes, label: "الأنظمة النشطة", value: `${stats.appsActive}/${stats.apps}`, to: "/admin/apps" },
    { icon: Activity, label: "أحداث آخر 24 ساعة", value: stats.authEvents24h, to: "/admin/audit" },
    { icon: ScrollText, label: "محاولات فاشلة", value: stats.failed24h, to: "/admin/audit" },
    { icon: Webhook, label: "نقاط Webhook", value: stats.webhooks, to: "/admin/webhooks" },
  ];

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-border/60 bg-card p-6 md:p-8 overflow-hidden relative">
        <div className="absolute -top-20 -end-20 w-64 h-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="text-sm font-bold text-primary mb-2">Alazab Identity Control</p>
            <h1 className="font-heading font-extrabold text-3xl md:text-4xl text-foreground">إدارة المصادقة بدون تعقيد</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-7">إدارة المستخدمين، مزوّدي الدخول، الأنظمة المرتبطة، السجل التشغيلي ووكيل المصادقة من لوحة واحدة.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/users" className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold">إدارة المستخدمين</Link>
            <Link to="/admin/agent" className="px-4 py-2.5 rounded-xl border border-border bg-background text-sm font-bold flex items-center gap-2"><Bot className="w-4 h-4" />وكيل المصادقة</Link>
          </div>
        </div>
      </section>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Link to={c.to} className="group block rounded-2xl border border-border/60 bg-card p-5 hover:border-primary/40 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center"><c.icon className="w-5 h-5" /></div>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
              </div>
              <p className="text-sm text-muted-foreground mt-5">{c.label}</p>
              <p className="font-heading font-extrabold text-2xl mt-1">{c.value}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="rounded-2xl border border-border/60 bg-card p-6">
          <h2 className="font-heading font-bold text-lg">مسارات الدخول المعتمدة</h2>
          <p className="text-xs text-muted-foreground mt-1">الترتيب التشغيلي للواجهة الجديدة.</p>
          <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
            {["Email + Password", "WhatsApp OTP", "Phone OTP", "Google", "Microsoft / Azure", "Facebook"].map((x) => (
              <div key={x} className="rounded-xl border border-border/60 px-3 py-3 bg-muted/30" dir={x.includes("+") || x.includes("/") ? "ltr" : undefined}>{x}</div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card p-6">
          <h2 className="font-heading font-bold text-lg">اختصارات التشغيل</h2>
          <div className="mt-4 space-y-2 text-sm">
            <Link to="/admin/agent" className="flex items-center justify-between rounded-xl px-3 py-3 hover:bg-muted"><span>تشخيص مشكلة دخول</span><ArrowUpRight className="w-4 h-4" /></Link>
            <Link to="/admin/auth" className="flex items-center justify-between rounded-xl px-3 py-3 hover:bg-muted"><span>مراجعة مزوّدي المصادقة</span><ArrowUpRight className="w-4 h-4" /></Link>
            <Link to="/admin/apps" className="flex items-center justify-between rounded-xl px-3 py-3 hover:bg-muted"><span>إدارة الأنظمة المرتبطة</span><ArrowUpRight className="w-4 h-4" /></Link>
            <Link to="/admin/audit" className="flex items-center justify-between rounded-xl px-3 py-3 hover:bg-muted"><span>فتح سجل التدقيق</span><ArrowUpRight className="w-4 h-4" /></Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AdminOverviewPage;
