import { useState } from "react";
import { Bot, Search, KeyRound, Loader2, UserRound, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type AgentResponse = Record<string, unknown> | null;

const AuthAgentAdminPage = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<AgentResponse>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const invoke = async (action: string, payload: Record<string, unknown> = {}) => {
    setLoading(action);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("az-agent-auth", {
        body: { action, ...payload, origin: window.location.origin },
      });
      if (error) throw error;
      setResult(data as AgentResponse);
      return data as Record<string, unknown>;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر الاتصال بوكيل المصادقة");
      return null;
    } finally {
      setLoading(null);
    }
  };

  const lookup = () => {
    if (!email.trim()) return toast.error("أدخل البريد الإلكتروني");
    void invoke("user_lookup", { email: email.trim() });
  };

  const recovery = async () => {
    if (!email.trim()) return toast.error("أدخل البريد الإلكتروني");
    const data = await invoke("generate_recovery_link", { email: email.trim() });
    const link = data?.action_link;
    if (typeof link === "string" && link) {
      await navigator.clipboard.writeText(link).catch(() => undefined);
      toast.success("تم إنشاء رابط الاستعادة ونسخه");
    }
  };

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-2 text-primary"><Bot className="w-5 h-5" /><span className="text-sm font-bold">az-agent-auth</span></div>
          <h1 className="font-heading text-3xl font-extrabold">وكيل تشغيل المصادقة</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">واجهة تشغيل داخلية لمساعدة الإدارة في تشخيص مشاكل الدخول، فحص الحسابات، وإصدار روابط الاستعادة من الباك إند.</p>
        </div>
        <Button variant="outline" onClick={() => void invoke("session")} disabled={!!loading} className="gap-2">
          {loading === "session" ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserRound className="w-4 h-4" />}فحص جلستي
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <div>
            <h2 className="font-bold">الحسابات</h2>
            <p className="text-xs text-muted-foreground mt-1">ابحث بالبريد ثم نفّذ الإجراء المطلوب.</p>
          </div>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@company.com" dir="ltr" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={lookup} disabled={!!loading} className="gap-2">
              {loading === "user_lookup" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}فحص المستخدم
            </Button>
            <Button variant="secondary" onClick={() => void recovery()} disabled={!!loading} className="gap-2">
              {loading === "generate_recovery_link" ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}إنشاء رابط استعادة
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 space-y-4">
          <div>
            <h2 className="font-bold">تشخيص سريع</h2>
            <p className="text-xs text-muted-foreground mt-1">اكتب المشكلة كما وصلتك من المستخدم.</p>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="مثال: المستخدم لا يستطيع الدخول عبر Microsoft"
            className="min-h-28 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <Button variant="outline" onClick={() => void invoke("diagnose", { message })} disabled={!!loading || !message.trim()} className="gap-2">
            {loading === "diagnose" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}تشخيص
          </Button>
        </section>
      </div>

      <section className="rounded-2xl border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b"><h2 className="font-bold">النتيجة</h2></div>
        <pre className="p-5 text-xs overflow-auto min-h-40 bg-muted/30" dir="ltr">{result ? JSON.stringify(result, null, 2) : "No operation executed yet."}</pre>
      </section>
    </div>
  );
};

export default AuthAgentAdminPage;
