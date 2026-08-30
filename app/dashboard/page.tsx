import { ArrowUpLeft, Boxes, CheckCircle2, Clock3, ShieldCheck, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const stats = [
  { label: "إجمالي المستخدمين", value: "2,481", change: "+12.4%", icon: Users },
  { label: "التطبيقات المتصلة", value: "18", change: "+3 هذا الشهر", icon: Boxes },
  { label: "معدل نجاح الدخول", value: "99.8%", change: "+0.6%", icon: ShieldCheck },
  { label: "الجلسات النشطة", value: "364", change: "الآن", icon: Clock3 },
]

const events = [
  ["تمت إضافة مستخدم جديد إلى فريق الهندسة", "منذ 8 دقائق", "success"],
  ["تم تحديث إعدادات المصادقة متعددة العوامل", "منذ 34 دقيقة", "info"],
  ["تم إنشاء مفتاح API جديد لتطبيق الإنتاج", "منذ ساعتين", "warning"],
  ["اكتملت مزامنة المستخدمين مع موفر الهوية", "أمس، 4:12 م", "success"],
]

export default function DashboardHome() {
  return <div className="space-y-8">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="mb-2 text-sm font-medium text-primary">الأربعاء، 30 أغسطس 2026</p><h1 className="text-3xl font-bold tracking-tight text-balance">مرحباً بعودتك إلى لوحة التحكم</h1><p className="mt-2 text-muted-foreground">إليك ملخص نشاط مؤسستك وحالة الهوية اليوم.</p></div>
      <Badge variant="outline" className="w-fit gap-2 rounded-full px-3 py-1.5 font-normal"><span className="size-2 rounded-full bg-emerald-500" /> بيئة الإنتاج متصلة</Badge>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map(({ label, value, change, icon: Icon }) => <Card key={label} className="overflow-hidden"><CardContent className="p-5"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></span><ArrowUpLeft className="size-4 text-emerald-500" /></div><p className="mt-5 text-sm text-muted-foreground">{label}</p><div className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-bold">{value}</span><span className="text-xs font-medium text-emerald-600">{change}</span></div></CardContent></Card>)}</div>
    <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
      <Card><CardHeader className="flex flex-row items-center justify-between"><div><CardTitle>نشاط تسجيل الدخول</CardTitle><p className="mt-1 text-sm text-muted-foreground">آخر 30 يوماً</p></div><Badge variant="secondary">+18.6%</Badge></CardHeader><CardContent><div className="flex h-56 items-end gap-2 border-b border-dashed pb-0 pt-8">{[34,48,42,68,55,74,63,82,70,88,76,96,84,92,78,100,90,94,86,98,92,100,88,96,82,91,97,89,100,94].map((height, index) => <div key={index} className="group relative flex flex-1 items-end"><div className="w-full rounded-t-md bg-primary/80 transition group-hover:bg-primary" style={{ height: `${height}%` }} /></div>)}</div><div className="mt-4 flex justify-between text-xs text-muted-foreground"><span>1 أغسطس</span><span>15 أغسطس</span><span>30 أغسطس</span></div></CardContent></Card>
      <Card><CardHeader><CardTitle>آخر النشاطات</CardTitle><p className="mt-1 text-sm text-muted-foreground">التحديثات المهمة في مؤسستك</p></CardHeader><CardContent className="space-y-5">{events.map(([text, time, type]) => <div key={text} className="flex gap-3"><span className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full ${type === "success" ? "bg-emerald-50 text-emerald-600" : type === "warning" ? "bg-amber-50 text-amber-600" : "bg-primary/10 text-primary"}`}><CheckCircle2 className="size-4" /></span><div><p className="text-sm font-medium leading-5">{text}</p><p className="mt-1 text-xs text-muted-foreground">{time}</p></div></div>)}</CardContent></Card>
    </div>
  </div>
}
