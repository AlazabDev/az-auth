import { NavLink, Outlet, Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Shield, Webhook, LayoutGrid, LogOut, ArrowLeft, ArrowRight, Boxes,
  ScrollText, Plug, Database, Users, Bot, Home, Menu, X, UserCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { fetchMyRoles } from "@/lib/rbac";
import logo from "@/assets/brand/alazab-on-light.png";

const roleLabel = (roles: string[]) => {
  if (roles.includes("platform_owner")) return "مالك المنصة";
  if (roles.includes("platform_admin")) return "مسؤول المنصة";
  return "مسؤول";
};

const AdminLayout = () => {
  const { dir } = useLanguage();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const Arrow = dir === "rtl" ? ArrowRight : ArrowLeft;

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/", { replace: true });
        return;
      }
      const { data, error } = await supabase.rpc("is_admin");
      if (error || !data) {
        toast({ title: "غير مصرح", description: "تحتاج صلاحيات المسؤول للوصول لهذه الصفحة", variant: "destructive" });
        navigate("/dashboard", { replace: true });
        return;
      }
      setEmail(user.email || user.phone || "مستخدم إداري");
      setRoles(await fetchMyRoles(user.id));
      setIsAdmin(true);
      setChecking(false);
    })();
  }, [navigate]);

  const groups = [
    {
      label: "التشغيل",
      items: [
        { to: "/admin", icon: LayoutGrid, label: "نظرة عامة", end: true },
        { to: "/admin/users", icon: Users, label: "المستخدمون والصلاحيات" },
        { to: "/admin/agent", icon: Bot, label: "وكيل المصادقة" },
        { to: "/admin/audit", icon: ScrollText, label: "سجل التدقيق" },
      ],
    },
    {
      label: "الهوية والربط",
      items: [
        { to: "/admin/auth", icon: Shield, label: "المصادقة والمزوّدون" },
        { to: "/admin/apps", icon: Boxes, label: "الأنظمة المرتبطة" },
        { to: "/admin/api", icon: Plug, label: "بوابة API" },
      ],
    },
    {
      label: "البنية",
      items: [
        { to: "/admin/database", icon: Database, label: "قاعدة البيانات" },
        { to: "/admin/webhooks", icon: Webhook, label: "Webhooks" },
      ],
    },
  ];

  const nav = (
    <>
      <div className="p-4 border-b border-border/60">
        <Link to="/admin" className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl border border-border bg-white p-1.5 shadow-sm">
            <img src={logo} alt="Alazab" className="w-full h-full object-contain" />
          </div>
          <div className="min-w-0">
            <div className="font-heading font-extrabold text-foreground">إدارة الهوية</div>
            <div className="text-[11px] text-muted-foreground" dir="ltr">auth.alazab.com</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[11px] font-bold text-muted-foreground/70">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                  )}
                >
                  <it.icon className="w-4 h-4 shrink-0" />
                  <span>{it.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-border/60 space-y-3">
        <div className="rounded-xl bg-muted/50 p-3 flex items-center gap-3">
          <UserCircle2 className="w-8 h-8 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate" dir="ltr">{email}</p>
            <p className="text-[11px] text-muted-foreground">{roleLabel(roles)}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" asChild>
          <Link to="/dashboard"><Arrow className="w-4 h-4" />لوحة المستخدم</Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-destructive hover:text-destructive"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate("/");
          }}
        >
          <LogOut className="w-4 h-4" />تسجيل الخروج
        </Button>
      </div>
    </>
  );

  if (checking) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <div className="text-sm text-muted-foreground">جارٍ تجهيز لوحة الإدارة...</div>
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-muted/20">
      <aside className="hidden lg:flex fixed inset-y-0 start-0 w-72 flex-col border-e border-border/60 bg-background z-40">
        {nav}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة" />
          <aside className="absolute inset-y-0 start-0 w-[86%] max-w-80 bg-background border-e border-border flex flex-col shadow-2xl">
            <button className="absolute end-3 top-3 p-2 rounded-lg hover:bg-muted z-10" onClick={() => setMobileOpen(false)}><X className="w-4 h-4" /></button>
            {nav}
          </aside>
        </div>
      )}

      <div className="lg:ms-72 min-h-screen">
        <header className="sticky top-0 z-30 h-16 border-b border-border/60 bg-background/90 backdrop-blur flex items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}><Menu className="w-5 h-5" /></Button>
            <div>
              <p className="font-heading font-bold text-sm md:text-base">مركز إدارة المصادقة</p>
              <p className="text-[11px] text-muted-foreground hidden sm:block">تشغيل الهوية والمستخدمين والربط من مكان واحد</p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild className="gap-2">
            <Link to="/"><Home className="w-4 h-4" />واجهة الدخول</Link>
          </Button>
        </header>

        <main className="p-4 md:p-7 xl:p-8">
          <div className="max-w-7xl mx-auto"><Outlet /></div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
