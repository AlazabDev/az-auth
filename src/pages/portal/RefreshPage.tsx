import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, ShieldCheck, ShieldAlert, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { refreshPortalToken } from "@/lib/portal";
import { logAuthEvent } from "@/lib/audit";
import { notify } from "@/lib/notifications";

type State = "checking" | "redirecting" | "error";

/**
 * /portal/refresh — the human-facing half of the Outpost Refresh URL.
 * Outpost sends the user here when its session dies; we verify the central
 * Alazab session and hand back a brand new Portal JWT automatically.
 */
const RefreshPage = () => {
  const [params] = useSearchParams();
  const slug = (params.get("slug") || "outpost").toLowerCase();
  const [state, setState] = useState<State>("checking");
  const [message, setMessage] = useState("جارٍ التحقق من جلستك في بوابة العزب...");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        const back = encodeURIComponent(`${window.location.origin}/portal/refresh?slug=${slug}`);
        window.location.replace(`/auth/login?redirect_uri=${back}`);
        return;
      }

      try {
        const issued = await refreshPortalToken(slug, params.get("jti") ?? undefined);
        setState("redirecting");
        setMessage(`تم إصدار رمز وصول جديد — يتم فتح ${issued.app.name_ar}...`);
        await logAuthEvent({
          event: "provider_used",
          email: data.session.user.email,
          description: `Portal JWT refreshed for ${slug}`,
          detail: { slug, jti: issued.jti },
        });
        window.location.replace(issued.launch_url);
      } catch (e) {
        const code = e instanceof Error ? e.message : "unknown";
        setState("error");
        setMessage(
          code === "forbidden"
            ? "لا تملك صلاحية الدخول إلى هذه المنصة. تواصل مع مسؤول النظام."
            : code === "app_not_found"
              ? "المنصة المطلوبة غير مسجّلة في سجل الأنظمة."
              : "تعذّر تجديد جلسة المنصة. حاول مرة أخرى.",
        );
        notify({
          title: "فشل تجديد جلسة المنصة",
          body: `تعذّر إصدار رمز جديد لمنصة ${slug}.`,
          level: "error",
          category: "portal",
        });
      }
    })();
  }, [slug, params]);

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl border border-border/50 bg-card/70 backdrop-blur p-8 text-center space-y-4">
        {state === "error" ? (
          <ShieldAlert className="w-10 h-10 mx-auto text-destructive" />
        ) : state === "redirecting" ? (
          <ShieldCheck className="w-10 h-10 mx-auto text-primary" />
        ) : (
          <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
        )}

        <h1 className="font-heading font-bold text-xl text-foreground">تجديد جلسة المنصة</h1>
        <p className="text-sm text-muted-foreground leading-7">{message}</p>

        {state === "error" && (
          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={() => window.location.reload()} className="gap-2">
              <ExternalLink className="w-4 h-4" /> إعادة المحاولة
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/dashboard">العودة إلى لوحة المستخدم</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RefreshPage;
