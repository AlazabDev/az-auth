import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, CheckCircle2, Copy, ExternalLink, Loader2, Mail, Phone, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { fetchAuthHealth, monitoredProviders, providerState } from "@/lib/auth-health";

const dashboard = "https://supabase.com/dashboard/project/bxuhcbfdoaflsgbxiqei";
const callback = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/callback`;
type Health = Awaited<ReturnType<typeof fetchAuthHealth>>;

export default function AuthHealthPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [checking, setChecking] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attemptedAt, setAttemptedAt] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const mounted = useRef(false);

  const check = useCallback(async () => {
    if (controllerRef.current) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setChecking(true);
    try {
      const result = await fetchAuthHealth(controller.signal);
      if (mounted.current) { setHealth(result); setFailed(false); }
    } catch {
      if (mounted.current) { setFailed(true); setHealth(null); }
    } finally {
      window.clearTimeout(timeout);
      if (controllerRef.current === controller) controllerRef.current = null;
      if (mounted.current) { setChecking(false); setAttemptedAt(new Date()); }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void check();
    return () => { mounted.current = false; controllerRef.current?.abort(); };
  }, [check]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => { if (!document.hidden) void check(); }, 60000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, check]);

  const enabled = monitoredProviders.filter((provider) => providerState(health?.settings ?? null, provider.key) === "enabled").length;
  const ServiceIcon = checking ? Loader2 : failed ? XCircle : health ? CheckCircle2 : Activity;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2"><ShieldCheck className="h-4 w-4" />إعدادات النظام</div>
          <h1 className="font-heading text-2xl md:text-3xl font-extrabold">صحة مزوّدي المصادقة</h1>
        </div>
        <Button onClick={() => void check()} disabled={checking} variant="outline" className="gap-2">
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin motion-reduce:animate-none" : ""}`} />{checking ? "جارٍ الفحص" : "فحص الآن"}
        </Button>
      </header>

      <section className="border-y border-border py-5" aria-label="حالة خدمة المصادقة" aria-live="polite" aria-busy={checking}>
        <div className="grid gap-5 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground mb-2">الاتصال بخدمة المصادقة</p>
            <div className={`flex items-center gap-2 font-semibold ${failed ? "text-destructive" : health && !checking ? "text-health-success" : "text-muted-foreground"}`}>
              <ServiceIcon className={`h-5 w-5 shrink-0 ${checking ? "animate-spin motion-reduce:animate-none" : ""}`} />
              {checking ? "جارٍ التحقق" : failed ? "تعذّر الاتصال" : health ? "الخدمة تستجيب" : "لم يُفحص"}
            </div>
          </div>
          <div><p className="text-xs text-muted-foreground mb-2">زمن استجابة الإعدادات</p><p className="font-semibold">{health && !checking ? `${health.latency} ms` : "—"}</p></div>
          <div><p className="text-xs text-muted-foreground mb-2">المزوّدون المفعّلون</p><p className="font-semibold">{health && !checking ? enabled : "—"}</p></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 mt-5 pt-4 border-t border-border/60">
          <p className="text-xs text-muted-foreground">آخر محاولة: {attemptedAt ? attemptedAt.toLocaleString("ar-EG") : "—"}</p>
          <div className="flex items-center gap-3"><Switch id="health-auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} /><Label htmlFor="health-auto-refresh" className="text-xs">تحديث كل دقيقة</Label></div>
        </div>
        {failed && <p role="alert" className="mt-4 text-sm text-destructive">تعذّر قراءة الإعدادات الحالية. تحقق من الشبكة ثم أعد الفحص؛ حالة المزوّدين غير مؤكدة.</p>}
      </section>

      <section aria-label="مزوّدو المصادقة">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h2 className="font-heading text-lg font-bold">حالة المزوّدين</h2>
          <Button asChild variant="outline" size="sm" className="gap-2"><a href={`${dashboard}/auth/providers`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />إعدادات Supabase</a></Button>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {monitoredProviders.map((provider) => {
            const state = providerState(health?.settings ?? null, provider.key);
            const Icon = provider.key === "email" ? Mail : ["phone", "whatsapp"].includes(provider.key) ? Phone : ShieldCheck;
            const StateIcon = state === "enabled" ? CheckCircle2 : state === "disabled" ? XCircle : Activity;
            return (
              <article key={provider.key} className="rounded-lg border border-border bg-card p-4 min-w-0">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-10 w-10 shrink-0 grid place-items-center rounded-md bg-muted"><Icon className="h-5 w-5 text-foreground" /></div>
                  <div className="min-w-0"><h3 className="font-semibold text-sm break-words">{provider.label}</h3><p className="text-xs text-muted-foreground mt-1">{provider.kind}</p></div>
                </div>
                <dl className="space-y-3 text-xs">
                  <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">التفعيل في Supabase</dt><dd className={`inline-flex items-center gap-1.5 ${state === "enabled" ? "text-health-success" : "text-muted-foreground"}`}><StateIcon className="h-3.5 w-3.5" />{checking ? "جارٍ الفحص" : state === "enabled" ? "مفعّل" : state === "disabled" ? "معطّل" : "غير مؤكّد"}</dd></div>
                  <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">خدمة المصادقة المشتركة</dt><dd>{checking ? "جارٍ الفحص" : health ? "تستجيب" : "غير مؤكّدة"}</dd></div>
                  <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">{provider.kind === "OTP" ? "تسليم رمز الدخول" : "الدخول عبر المزوّد"}</dt><dd className="text-health-warning">لم يُختبر</dd></div>
                </dl>
                {provider.key === "whatsapp" && <p className="mt-4 text-xs text-muted-foreground">تفعيل الهاتف لا يؤكد جاهزية قناة WhatsApp.</p>}
                <Button asChild variant="ghost" size="sm" className="mt-4 w-full justify-between"><a href={`${dashboard}/auth/providers`} target="_blank" rel="noreferrer">إعدادات المزوّد<ExternalLink className="h-3.5 w-3.5" /></a></Button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="border-t border-border pt-6 space-y-4">
        <h2 className="font-heading text-lg font-bold">روابط المصادقة</h2>
        <div className="flex items-center gap-3"><div className="flex-1 min-w-0"><p className="text-xs text-muted-foreground mb-2">رابط العودة لمزوّدي OAuth</p><p dir="ltr" className="text-xs break-all font-mono">{callback}</p></div><Button variant="outline" size="icon" aria-label="نسخ رابط العودة" title="نسخ رابط العودة" onClick={async () => { try { await navigator.clipboard.writeText(callback); toast.success("تم نسخ الرابط"); } catch { toast.error("تعذّر نسخ الرابط"); } }}><Copy className="h-4 w-4" /></Button></div>
        <Button asChild variant="outline" size="sm" className="gap-2"><a href={`${dashboard}/auth/url-configuration`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />إعدادات روابط العودة</a></Button>
        <p className="text-xs text-muted-foreground leading-relaxed">نتائج الفحص تؤكد الوصول إلى إعدادات خدمة المصادقة فقط، ولا تؤكد صحة مفاتيح المزوّد أو نجاح الدخول وتسليم الأكواد.</p>
      </section>
    </div>
  );
}