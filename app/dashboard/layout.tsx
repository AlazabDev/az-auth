import Link from "next/link"
import { redirect } from "next/navigation"
import { Auth0Provider } from "@auth0/nextjs-auth0"
import { Activity, Boxes, ChevronLeft, LayoutDashboard, Settings2, ShieldCheck, Users } from "lucide-react"

import { appClient, managementClient } from "@/lib/auth0"
import { Button } from "@/components/ui/button"
import { LanguageSwitcher } from "@/components/language-switcher"
import { ModeToggle } from "@/components/mode-toggle"
import { OrganizationSwitcher } from "@/components/organization-switcher"
import { UserNav } from "@/components/user-nav"

const navigation = [
  { href: "/dashboard", label: "نظرة عامة", icon: LayoutDashboard },
  { href: "/dashboard/organization/members", label: "المستخدمون", icon: Users },
  { href: "/dashboard/organization/security-policies", label: "السياسات الأمنية", icon: Boxes },
  { href: "/dashboard/organization/sso", label: "موفرو الهوية", icon: ShieldCheck },
  { href: "/dashboard/organization/general", label: "إعدادات المؤسسة", icon: Settings2 },
]

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await appClient.getSession()
  if (!session?.user) redirect("/auth/login")
  const { data: orgs } = await managementClient.users.getUserOrganizations({ id: session.user.sub })
  if (!orgs.length) redirect("/onboarding/create")

  return (
    <Auth0Provider>
      <div dir="rtl" className="min-h-screen bg-background">
        <header className="border-b bg-card/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-8">
            <div className="flex items-center gap-5">
              <Link href="/dashboard" className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-xl bg-primary text-lg font-black text-primary-foreground">AZ</span>
                <span className="hidden text-lg font-bold tracking-tight sm:block">AZ Auth</span>
              </Link>
              <span className="hidden h-6 w-px bg-border sm:block" />
              <OrganizationSwitcher organizations={orgs.map((o) => ({ id: o.id, slug: o.name, displayName: o.display_name!, logoUrl: o.branding?.logo_url }))} currentOrgId={session.user.org_id!} />
            </div>
            <div className="flex items-center gap-2">
              <LanguageSwitcher /><ModeToggle /><UserNav />
            </div>
          </div>
        </header>
        <div className="mx-auto flex max-w-[1500px] flex-col gap-8 px-4 py-8 sm:px-8 lg:flex-row">
          <aside className="w-full shrink-0 lg:w-64">
            <div className="mb-6 rounded-2xl border bg-card p-4">
              <div className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary"><Activity className="size-5" /></span><div><p className="text-sm font-semibold">مساحة العمل</p><p className="text-xs text-muted-foreground">محمية ونشطة</p></div></div>
              <div className="flex items-center gap-2 text-xs text-emerald-600"><span className="size-2 rounded-full bg-emerald-500" /> جميع الأنظمة تعمل</div>
            </div>
            <nav aria-label="التنقل الرئيسي" className="space-y-1">
              <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">الإدارة</p>
              {navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"><Icon className="size-4" />{label}</Link>)}
            </nav>
          </aside>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
        <footer className="border-t py-6"><div className="mx-auto flex max-w-[1500px] items-center justify-between px-4 text-xs text-muted-foreground sm:px-8"><span>AZ Auth · منصة إدارة الهوية للمؤسسات</span><Link href="/" className="flex items-center gap-1 hover:text-foreground">العودة للموقع <ChevronLeft className="size-3" /></Link></div></footer>
      </div>
    </Auth0Provider>
  )
}
