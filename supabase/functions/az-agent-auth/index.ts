import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getCaller(req: Request) {
  const authorization = req.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user } } = await client.auth.getUser();
  return { client, user };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, message: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const action = String(body?.action || "diagnose");

    if (action === "diagnose") {
      const message = String(body?.message || "").toLowerCase();
      let answer = "أستطيع مساعدتك في مشاكل كلمة المرور، OTP، WhatsApp، Google، Microsoft، Facebook والجلسات.";
      if (message.includes("password") || message.includes("كلمة") || message.includes("باسورد")) {
        answer = "إذا كانت كلمة المرور لا تعمل، استخدم استعادة كلمة المرور أولاً. بعد التغيير ارجع إلى الصفحة الرئيسية وسجل الدخول بالبريد وكلمة المرور.";
      } else if (message.includes("whatsapp") || message.includes("واتس")) {
        answer = "تأكد أن الرقم مكتوب بالصيغة الدولية مثل +201XXXXXXXXX ثم استخدم زر WhatsApp. إذا لم يصل الرمز استخدم Phone OTP كبديل.";
      } else if (message.includes("google")) {
        answer = "مشكلة Google غالباً تكون من إعداد Provider أو Redirect URL. جرّب مرة أخرى، وإذا استمرت المشكلة يمكن للمسؤول فحص إعدادات المزود من لوحة الإدارة.";
      } else if (message.includes("microsoft") || message.includes("azure")) {
        answer = "Microsoft/Azure مخصص أساساً للموظفين والعملاء المسموح لهم. إذا ظهر رفض، افحص Tenant وإعداد Provider وربط الحساب.";
      } else if (message.includes("facebook")) {
        answer = "إذا فشل Facebook، افحص تفعيل المزود وRedirect URL في إعدادات Supabase وMeta.";
      }
      return json({ ok: true, message: answer });
    }

    const caller = await getCaller(req);
    if (!caller?.user) return json({ ok: false, message: "Authentication required" }, 401);

    if (action === "session") {
      return json({ ok: true, user: { id: caller.user.id, email: caller.user.email, phone: caller.user.phone } });
    }

    const { data: isAdmin, error: adminCheckError } = await caller.client.rpc("is_admin");
    if (adminCheckError || !isAdmin) return json({ ok: false, message: "Admin role required" }, 403);

    if (action === "generate_recovery_link") {
      const email = String(body?.email || "").trim();
      if (!email) return json({ ok: false, message: "Email is required" }, 400);
      const { data, error } = await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${body?.origin || "https://auth.alazab.com"}/reset-password` },
      });
      if (error) return json({ ok: false, message: error.message }, 400);
      return json({ ok: true, action_link: data.properties?.action_link || null });
    }

    if (action === "user_lookup") {
      const email = String(body?.email || "").trim().toLowerCase();
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (error) return json({ ok: false, message: error.message }, 400);
      const user = data.users.find((u) => (u.email || "").toLowerCase() === email);
      return json({ ok: true, user: user ? { id: user.id, email: user.email, phone: user.phone, confirmed_at: user.confirmed_at, last_sign_in_at: user.last_sign_in_at } : null });
    }

    return json({ ok: false, message: "Unknown action" }, 400);
  } catch (error) {
    return json({ ok: false, message: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
