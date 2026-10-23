import { useEffect, useState } from "react";
import { 
  KeyRound, Plus, Trash2, Copy, Eye, EyeOff, RefreshCw, 
  ShieldCheck, AlertTriangle, CheckCircle2, Loader2, Sparkles 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AppSecret {
  id: string;
  key: string;
  value: string;
  created_at: string | null;
  updated_at: string | null;
}

const PRESET_KEYS = [
  { key: "FOUNDRY_API_KEY", label: "مفتاح Azure AI Foundry (الشات)" },
  { key: "MCP_SECRET_TOKEN", label: "رمز حماية أدوات MCP" },
  { key: "AZABOT_CHAT_KEY", label: "مفتاح الدخول المباشر لدالة الشات" },
  { key: "ELEVENLABS_API_KEY", label: "مفتاح الصوت ElevenLabs" },
];

export default function TokensAdminPage() {
  const [secrets, setSecrets] = useState<AppSecret[]>([]);
  const [loading, setLoading] = useState(true);
  const [showValues, setShowValues] = useState<Record<string, boolean>>({});
  
  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState("FOUNDRY_API_KEY");
  const [customKey, setCustomKey] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AppSecret | null>(null);

  // Health check state
  const [chatHealth, setChatHealth] = useState<"idle" | "checking" | "ok" | "error">("idle");
  const [healthMessage, setHealthMessage] = useState("");

  const loadSecrets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("app_secrets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSecrets((data as AppSecret[]) || []);
    } catch (err: any) {
      toast.error("فشل تحميل المفاتيح: " + (err.message || "خطأ غير متوقع"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSecrets();
  }, []);

  const generateRandomToken = () => {
    const array = new Uint8Array(24);
    crypto.getRandomValues(array);
    const token = Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
    setSecretValue(`az_${token}`);
  };

  const handleSave = async () => {
    const keyName = selectedKey === "CUSTOM" ? customKey.trim() : selectedKey;
    if (!keyName) {
      toast.error("يرجى تحديد أو إدخال اسم المفتاح");
      return;
    }
    if (!secretValue.trim()) {
      toast.error("يرجى إدخال قيمة الرمز أو المفتاح");
      return;
    }

    setSaving(true);
    try {
      // Upsert: check if key exists
      const existing = secrets.find((s) => s.key === keyName);
      if (existing) {
        const { error } = await supabase
          .from("app_secrets")
          .update({ value: secretValue.trim(), updated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
        toast.success(`تم تحديث المفتاح ${keyName} بنجاح`);
      } else {
        const { error } = await supabase
          .from("app_secrets")
          .insert({ key: keyName, value: secretValue.trim() });
        if (error) throw error;
        toast.success(`تم إنشاء المفتاح ${keyName} بنجاح`);
      }

      setCreateOpen(false);
      setSecretValue("");
      setCustomKey("");
      loadSecrets();
    } catch (err: any) {
      toast.error("فشل حفظ المفتاح: " + (err.message || "خطأ غير متوقع"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from("app_secrets")
        .delete()
        .eq("id", deleteTarget.id);

      if (error) throw error;
      toast.success(`تم حذف المفتاح ${deleteTarget.key}`);
      setDeleteTarget(null);
      loadSecrets();
    } catch (err: any) {
      toast.error("فشل الحذف: " + (err.message || "خطأ غير متوقع"));
    }
  };

  const testChatHealth = async () => {
    setChatHealth("checking");
    setHealthMessage("");
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/azabot-chat`, {
        method: "GET",
      });
      const data = await res.json();
      if (res.ok) {
        setChatHealth("ok");
        setHealthMessage(`الدالة تعمل بنجاح (الوكيل: ${data.agent || "az-agent-auth"} - الحالة: ${data.status})`);
      } else {
        setChatHealth("error");
        setHealthMessage(data.error || `خطأ استجابة HTTP ${res.status}`);
      }
    } catch (e: any) {
      setChatHealth("error");
      setHealthMessage("تعذر الوصول لنقطة النهاية: " + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <KeyRound className="w-6 h-6 text-primary" />
            إدارة مفاتيح الرموز والشات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            إدارة وتوليد مفاتيح الوصول وربطها المباشر بدوال المعالجة والشات بوت دون وسائط خارجية.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={testChatHealth} className="gap-2">
            {chatHealth === "checking" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : chatHealth === "ok" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            فحص اتصال الشات
          </Button>

          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            إنشاء / تحديث مفتاح
          </Button>
        </div>
      </div>

      {healthMessage && (
        <div
          className={`p-3 rounded-lg text-sm flex items-center gap-2 border ${
            chatHealth === "ok"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          {chatHealth === "ok" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {healthMessage}
        </div>
      )}

      {loading ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
          جارٍ تحميل المفاتيح...
        </Card>
      ) : secrets.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <KeyRound className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <h3 className="font-semibold text-foreground">لا توجد مفاتيح مسجلة بعد</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            قم بإنشاء أول مفتاح لربط خدمة الشات أو مفاتيح التحقق المباشرة.
          </p>
          <Button onClick={() => setCreateOpen(true)} size="sm">
            إضافة مفتاح جديد
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4">
          {secrets.map((sec) => {
            const isVisible = showValues[sec.id] || false;
            return (
              <Card key={sec.id} className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-foreground">{sec.key}</span>
                    <Badge variant="outline" className="text-xs">
                      {sec.updated_at ? "مُحدّث" : "جديد"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <span>
                      {isVisible ? sec.value : "••••••••••••••••••••••••••••••••"}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setShowValues((prev) => ({ ...prev, [sec.id]: !isVisible }))}
                    >
                      {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      navigator.clipboard.writeText(sec.value);
                      toast.success(`تم نسخ قيمة ${sec.key}`);
                    }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    نسخ
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => setDeleteTarget(sec)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* إنشاء مفتاح */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة أو تحديث مفتاح سري</DialogTitle>
            <DialogDescription>
              يتم حفظ المفتاح بأمان في جدول النظام واستخدامه مباشرة في عمليات المصادقة والشات.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>نوع المفتاح</Label>
              <Select value={selectedKey} onValueChange={setSelectedKey}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر نوع المفتاح" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {PRESET_KEYS.map((p) => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.label} ({p.key})
                    </SelectItem>
                  ))}
                  <SelectItem value="CUSTOM">مفتاح مخصص آخر...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedKey === "CUSTOM" && (
              <div className="space-y-2">
                <Label>اسم المفتاح المخصص</Label>
                <Input
                  placeholder="مثال: CUSTOM_API_KEY"
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  dir="ltr"
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>قيمة المفتاح / الرمز</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-primary"
                  onClick={generateRandomToken}
                >
                  <Sparkles className="w-3 h-3" />
                  توليد رمز عشوائي
                </Button>
              </div>
              <Input
                placeholder="أدخل القيمة أو انقر توليد رمز"
                value={secretValue}
                onChange={(e) => setSecretValue(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ المفتاح"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* تأكيد الحذف */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف المفتاح</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من رغبتك في حذف المفتاح <strong className="font-mono text-foreground">{deleteTarget?.key}</strong>؟
              قد يتسبب ذلك في توقف الخدمات التي تعتمد عليه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              تأكيد الحذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
