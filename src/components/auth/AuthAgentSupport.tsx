import { useState } from "react";
import { Bot, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

const AuthAgentSupport = () => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setReply(null);
    try {
      const { data, error } = await supabase.functions.invoke("az-agent-auth", {
        body: {
          action: "diagnose",
          message: message.trim(),
          context: {
            route: window.location.pathname,
            origin: window.location.origin,
          },
        },
      });
      if (error) throw error;
      setReply(data?.message || "تم فحص طلبك. حاول تسجيل الدخول مرة أخرى أو استخدم استعادة كلمة المرور.");
    } catch {
      setReply("تعذر الوصول إلى وكيل المصادقة الآن. استخدم استعادة كلمة المرور أو وسيلة دخول أخرى.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <Button type="button" variant="ghost" className="w-full gap-2 text-muted-foreground" onClick={() => setOpen(true)}>
        <Bot className="w-4 h-4" /> مشكلة في تسجيل الدخول؟ تحدث مع az-agent-auth
      </Button>
    );
  }

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold"><Bot className="w-4 h-4 text-primary" /> az-agent-auth</div>
        <button type="button" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      <p className="text-xs text-muted-foreground">وكيل دعم المصادقة يفحص مشاكل الدخول والجلسات ومزودي الهوية.</p>
      <div className="flex gap-2">
        <Input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void send(); }} placeholder="اكتب المشكلة باختصار" />
        <Button type="button" size="icon" onClick={() => void send()} disabled={loading || !message.trim()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
      {reply && <div className="rounded-xl bg-muted/60 p-3 text-sm leading-relaxed">{reply}</div>}
    </div>
  );
};

export default AuthAgentSupport;
