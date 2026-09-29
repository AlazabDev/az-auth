import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, ShieldCheck, KeyRound, MessageCircle, Smartphone, Chrome, Building2, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ProviderRow = {
  id: string;
  key: string;
  label: string;
  type: string;
  enabled: boolean;
  status: string;
  last_checked_at: string | null;
};

const fixedProviders = [
  { key: "email", label: "Email + Password", icon: KeyRound, description: "المسار الأساسي لتسجيل الدخول." },
  { key: "whatsapp", label: "WhatsApp OTP", icon: MessageCircle, description: "المسار البديل الأسرع للمستخدمين والفنيين." },
  { key: "phone", label: "Phone OTP", icon: Smartphone, description: "SMS OTP للأجهزة والهواتف العادية." },
  { key: "google", label: "Google", icon: Chrome, description: "دخول مباشر بحساب Google." },
  { key: "azure", label: "Microsoft / Azure", icon: Building2, description: "مخصص أساساً للموظفين والعملاء المؤسسيين." },
  { key: "facebook", label: "Facebook", icon: Facebook, description: "دخول مباشر بحساب Facebook." },
] as const;

const AuthAdminPage = () => {
  const [rows, setRows] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("auth_providers").select("id,key,label,type,enabled,status,last_checked_at");
    if (error) toast.error(error.message);
    else setRows((data ?? []) as ProviderRow[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const byKey = useMemo(() => new Map(rows.map((r) => [r.key, r])), [rows]);

  const toggle = async (key: string, enabled: boolean) => {
    const row = byKey.get(key);
    if (!row) {
      toast.error(`المزوّد ${key} غير مسجل في auth_providers`);
      return;
    }
    setUpdating(key);
    const { error } = await supabase.from("auth_providers").update({ enabled }).eq("id", row.id);
    setUpdating(null);
    if (error) return toast.error(error.message);
    setRows((current) => current.map((r) => r.id === row.id ? { ...r, enabled } : r));
    toast.success(enabled ? "تم التفعيل" : "تم التعطيل");
  };

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-primary mb-2"><ShieldCheck className="w-5 h-5" /><span className="text-sm font-bold">Authentication Providers</span></div>
          <h1 className="font-heading text-3xl font-extrabold">المصادقة والمزوّدون</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">المزوّدون ثابتون حسب سياسة العزب. هذه الشاشة للتشغيل والمراجعة فقط، وليس لإنشاء مزوّدين عشوائيين أو تخزين أسرارهم في الواجهة.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} className="gap-2"><RefreshCw className="w-4 h-4" />تحديث</Button>
          <Button variant="outline" asChild className="gap-2">
            <a href="https://supabase.com/dashboard/project/bxuhcbfdoaflsgbxiqei/auth/providers" target="_blank" rel="noreferrer"><ExternalLink className="w-4 h-4" />إعداد Supabase</a>
          </Button>
        </div>
      </div>

      <section className="rounded-2xl border border-border/60 bg-card overflow-hidden">
        {loading ? (
          <div className="p-12 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <div className="divide-y divide-border/60">
            {fixedProviders.map((provider) => {
              const row = byKey.get(provider.key);
              const enabled = row?.enabled ?? false;
              const Icon = provider.icon;
              return (
                <div key={provider.key} className="p-5 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0"><Icon className="w-5 h-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm">{provider.label}</h3>
                      {provider.key === "email" && <span className="text-[10px] font-bold rounded-full bg-primary/10 text-primary px-2 py-0.5">الأساسي</span>}
                      {!row && <span className="text-[10px] rounded-full bg-amber-500/10 text-amber-600 px-2 py-0.5">غير مسجل</span>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{provider.description}</p>
                    {row?.last_checked_at && <p className="text-[10px] text-muted-foreground mt-1">آخر فحص: {new Date(row.last_checked_at).toLocaleString("ar-EG")}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold ${enabled ? "text-emerald-600" : "text-muted-foreground"}`}>{enabled ? "مفعّل" : "متوقف"}</span>
                    {updating === provider.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Switch checked={enabled} disabled={!row} onCheckedChange={(v) => void toggle(provider.key, v)} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 text-sm leading-7">
        <strong>قاعدة التشغيل:</strong> Email + Password هو الدخول الأساسي. WhatsApp وPhone OTP بدائل دخول مستقلة. Google وMicrosoft وFacebook OAuth. إعداد Client IDs / Secrets يتم في Supabase أو مزود الهوية، وليس داخل جدول واجهة الإدارة.
      </div>
    </div>
  );
};

export default AuthAdminPage;
