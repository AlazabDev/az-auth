import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, Mail, Phone, Shield, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { captureSsoTarget } from "@/lib/sso";
import { sendPhoneOtp, signInWithProvider } from "@/lib/oauth";
import { logAuthEvent } from "@/lib/audit";
import AuthAgentSupport from "@/components/auth/AuthAgentSupport";
import logoOnLight from "@/assets/brand/alazab-on-light.png";
import { toast } from "sonner";

const LoginPortalPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [providerLoading, setProviderLoading] = useState<string | null>(null);

  useEffect(() => {
    captureSsoTarget(window.location.search);
  }, []);

  const passwordLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await logAuthEvent({ event: "login", email, description: "Password sign-in" });
      navigate("/resolve", { replace: true });
    } catch (error) {
      await logAuthEvent({ event: "failed_login", status: "failure", email, description: "Password sign-in failed" });
      toast.error(error instanceof Error ? error.message : "تعذر تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  const oauthLogin = async (provider: "google" | "facebook" | "azure") => {
    setProviderLoading(provider);
    const ok = await signInWithProvider(provider);
    if (!ok) setProviderLoading(null);
  };

  const phoneLogin = async (channel: "sms" | "whatsapp") => {
    if (!phone) {
      toast.error("أدخل رقم الهاتف أولاً");
      return;
    }
    setProviderLoading(channel);
    try {
      const normalized = await sendPhoneOtp(phone, channel);
      navigate(`/verify?phone=${encodeURIComponent(normalized)}&channel=${channel}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إرسال رمز التحقق");
      setProviderLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-background grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="hidden lg:flex gradient-hero text-white p-12 items-center justify-center">
        <div className="max-w-lg">
          <div className="w-28 h-28 rounded-3xl bg-white/10 border border-white/15 p-4 mb-8">
            <img src={logoOnLight} alt="Alazab" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-4xl font-bold mb-4">هوية العزب المؤسسية</h1>
          <p className="text-white/70 text-lg leading-relaxed">دخول واحد بسيط لكل أنظمة العزب. استخدم البريد وكلمة المرور كمسار أساسي، أو اختر وسيلة الدخول المناسبة لك.</p>
          <div className="mt-8 flex items-center gap-3 text-sm text-white/60">
            <Shield className="w-4 h-4 text-primary" />
            <span>حساب واحد — جلسة واحدة — صلاحيات مركزية</span>
          </div>
        </div>
      </section>

      <main className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md space-y-7">
          <div className="lg:hidden w-20 h-20 mx-auto rounded-2xl border p-2.5">
            <img src={logoOnLight} alt="Alazab" className="w-full h-full object-contain" />
          </div>

          <div>
            <h2 className="text-3xl font-bold text-foreground">تسجيل الدخول</h2>
            <p className="text-muted-foreground mt-2">استخدم بريدك وكلمة المرور، أو إحدى وسائل الدخول المعتمدة.</p>
          </div>

          <form onSubmit={passwordLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="ps-10 h-12" dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">كلمة المرور</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">نسيت كلمة المرور؟</Link>
              </div>
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="ps-10 pe-10 h-12" dir="ltr" />
                <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "دخول"}
            </Button>
          </form>

          <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs"><span className="bg-background px-3 text-muted-foreground">أو</span></div></div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الهاتف</Label>
              <div className="relative">
                <Phone className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+201XXXXXXXXX" className="ps-10 h-11" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="h-11 gap-2" onClick={() => phoneLogin("whatsapp")} disabled={providerLoading === "whatsapp"}>
                {providerLoading === "whatsapp" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />} WhatsApp
              </Button>
              <Button type="button" variant="outline" className="h-11 gap-2" onClick={() => phoneLogin("sms")} disabled={providerLoading === "sms"}>
                {providerLoading === "sms" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />} Phone OTP
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button type="button" variant="outline" className="h-11" onClick={() => oauthLogin("google")}>Google</Button>
              <Button type="button" variant="outline" className="h-11" onClick={() => oauthLogin("azure")}>Microsoft</Button>
              <Button type="button" variant="outline" className="h-11" onClick={() => oauthLogin("facebook")}>Facebook</Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">أول مرة في النظام؟</span>
            <Link to="/signup" className="font-semibold text-primary hover:underline">إنشاء حساب</Link>
          </div>

          <AuthAgentSupport />
        </div>
      </main>
    </div>
  );
};

export default LoginPortalPage;
