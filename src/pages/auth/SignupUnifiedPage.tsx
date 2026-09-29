import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, Lock, Mail, Phone, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const USER_TYPES = [
  ["employee", "موظف"],
  ["client", "عميل"],
  ["technician", "فني"],
  ["partner", "شريك / مورد"],
  ["other", "أخرى"],
] as const;

const SignupUnifiedPage = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [userType, setUserType] = useState<(typeof USER_TYPES)[number][0]>("client");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/resolve`,
          data: {
            full_name: fullName || null,
            phone: phone || null,
            user_type: userType,
          },
        },
      });
      if (error) throw error;
      setDone(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر إنشاء الحساب");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen grid place-items-center bg-background p-6">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center space-y-4">
          <h1 className="text-2xl font-bold">تم إنشاء الحساب</h1>
          <p className="text-muted-foreground">راجع بريدك لإكمال التحقق إذا كان التحقق بالبريد مفعلاً.</p>
          <Button asChild className="w-full"><Link to="/">العودة لتسجيل الدخول</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 md:p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">إنشاء حساب</h1>
          <p className="text-muted-foreground mt-1">حدد طبيعة استخدامك مرة واحدة فقط، وسيتم حفظها مع حسابك.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">الاسم</Label>
            <div className="relative"><User className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} className="ps-10 h-11" /></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="userType">طبيعة الاستخدام</Label>
            <select id="userType" value={userType} onChange={(e) => setUserType(e.target.value as typeof userType)} className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              {USER_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">البريد الإلكتروني</Label>
            <div className="relative"><Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="ps-10 h-11" dir="ltr" /></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">رقم الهاتف</Label>
            <div className="relative"><Phone className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+201XXXXXXXXX" className="ps-10 h-11" dir="ltr" /></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">كلمة المرور</Label>
            <div className="relative">
              <Lock className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input id="password" type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="ps-10 pe-10 h-11" dir="ltr" />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "إنشاء الحساب"}</Button>
        </form>
        <p className="mt-5 text-center text-sm text-muted-foreground">لديك حساب بالفعل؟ <Link to="/" className="text-primary font-semibold hover:underline">تسجيل الدخول</Link></p>
      </div>
    </div>
  );
};

export default SignupUnifiedPage;
