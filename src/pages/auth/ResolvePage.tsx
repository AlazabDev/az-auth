import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { resolvePostAuthDestination } from "@/lib/auth-flow";
import { toast } from "sonner";

const ResolvePage = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("جارٍ تجهيز حسابك...");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const destination = await resolvePostAuthDestination();
        if (cancelled) return;
        if (destination.kind === "sso") {
          setMessage("جارٍ تحويلك إلى النظام المطلوب...");
          window.location.replace(destination.url);
          return;
        }
        navigate(destination.url, { replace: true });
      } catch (error) {
        if (cancelled) return;
        if (error instanceof Error && error.message === "forbidden_target") {
          toast.error("ليس لديك صلاحية الوصول إلى النظام المطلوب");
          navigate("/dashboard", { replace: true });
          return;
        }
        navigate("/", { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>{message}</span>
      </div>
    </div>
  );
};

export default ResolvePage;
