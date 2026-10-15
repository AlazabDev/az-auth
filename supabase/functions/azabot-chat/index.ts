import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const FOUNDRY_API_KEY = Deno.env.get('FOUNDRY_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const FOUNDRY_ENDPOINT = 'https://az-ai-resource.services.ai.azure.com/api/projects/az-ai-gateway'
const AGENT_NAME = 'az-agent-auth'
const AGENT_VERSION = '2'

const MAX_MESSAGES = 40
const MAX_CONTENT_LEN = 4000

const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const REDIRECT_TO = 'https://auth.alazab.com/auth/verify'

// Simple in-memory throttle (per isolate) to limit code-sending abuse
const otpThrottle = new Map<string, number>()
const OTP_COOLDOWN_MS = 60_000

const TOOL_SYSTEM_PROMPT = `أنت وكيل مصادقة العزب الرسمي (az-agent-auth) في بوابة auth.alazab.com.
نطاقك: تسجيل الدخول، رموز التحقق (OTP) والتحقق الثنائي، استعادة الوصول وكلمة المرور، الدخول عبر Google/Microsoft/Facebook/GitHub، الجلسات والأجهزة، والدخول الموحد لأنظمة العزب، ومشكلات الحساب.
خارج ذلك اعتذر بلطف ووجّه المستخدم للموقع المختص.

قاعدة التحقق: قبل مساعدة المستخدم في أي مشكلة تخص حسابه يجب التحقق من هويته برمز.
اسأله: هل يفضل استلام الرمز على البريد الإلكتروني أم واتساب؟
- للبريد، أخرج سطرًا وحيدًا: <<SEND_OTP:{"email":"user@example.com"}>>
- لواتساب، اطلب رقمه بالصيغة الدولية ثم أخرج: <<SEND_OTP:{"phone":"+201XXXXXXXXX","channel":"whatsapp"}>>
لا تخترع رمزًا ولا تطلب من المستخدم كتابة الرمز في الرسالة؛ ستظهر له خانة إدخال الرمز في الدردشة تلقائيًا.
بعد التحقق (ستُبلَّغ بحالة المستخدم الموثّق) ساعده خطوة بخطوة في حل مشكلته. لإدارة الجلسات والتحقق الثنائي وجّهه إلى /auth/security.`

function isEmail(v: unknown): v is string {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254
}
function isPhone(v: unknown): v is string {
  return typeof v === 'string' && /^\+[1-9]\d{7,14}$/.test(v)
}

type OtpTarget = { kind: 'email' | 'whatsapp'; target: string }

async function sendOtp(t: OtpTarget, lang: 'ar' | 'en'): Promise<{ text: string; ok: boolean }> {
  const now = Date.now()
  const last = otpThrottle.get(t.target) ?? 0
  if (now - last < OTP_COOLDOWN_MS) {
    return { ok: true, text: lang === 'ar'
      ? '⏳ أُرسل رمز قبل قليل. أدخله في الخانة أدناه أو انتظر دقيقة لطلب رمز جديد.'
      : '⏳ A code was just sent. Enter it below or wait a minute to request a new one.' }
  }
  otpThrottle.set(t.target, now)

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { error } = t.kind === 'email'
    ? await admin.auth.signInWithOtp({ email: t.target, options: { shouldCreateUser: true, emailRedirectTo: REDIRECT_TO } })
    : await admin.auth.signInWithOtp({ phone: t.target, options: { shouldCreateUser: true, channel: 'whatsapp' } })
  if (error) {
    otpThrottle.delete(t.target)
    console.error('sendOtp error:', t.kind, error.message)
    return { ok: false, text: lang === 'ar'
      ? `⚠️ تعذّر إرسال الرمز عبر ${t.kind === 'email' ? 'البريد' : 'واتساب'} الآن. جرّب الطريقة الأخرى أو حاول لاحقًا.`
      : `⚠️ Could not send the code via ${t.kind === 'email' ? 'email' : 'WhatsApp'}. Try the other method or retry later.` }
  }
  const where = t.kind === 'email' ? (lang === 'ar' ? 'بريدك' : 'your email') : (lang === 'ar' ? 'واتساب' : 'WhatsApp')
  return { ok: true, text: lang === 'ar'
    ? `✅ أرسلت رمز تحقق إلى ${where} **${t.target}**.\n\nأدخل الرمز في الخانة أسفل الدردشة لإكمال التحقق. 🔐 لن يظهر الرمز هنا أبدًا.`
    : `✅ I sent a verification code to ${where} **${t.target}**.\n\nEnter it in the box below to finish verification. 🔐 The code is never shown in chat.` }
}


function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function extractText(data: any): string {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text
  const parts: string[] = []
  for (const item of data?.output ?? []) {
    for (const c of item?.content ?? []) {
      if (typeof c?.text === 'string') parts.push(c.text)
      else if (typeof c?.text?.value === 'string') parts.push(c.text.value)
    }
  }
  if (parts.length) return parts.join('\n')
  return data?.choices?.[0]?.message?.content ?? ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Lightweight health check for the widget status indicator (no auth needed)
  if (req.method === 'GET' || req.method === 'HEAD') {
    return json({ status: 'ok', agent: AGENT_NAME })
  }

  if (!FOUNDRY_API_KEY) {
    console.error('FOUNDRY_API_KEY not configured')
    return json({ error: 'Service unavailable' }, 500)
  }

  // Public chatbot: authentication is optional. If a real user token is sent,
  // we resolve the user for logging; anonymous visitors are allowed.
  const authHeader = req.headers.get('Authorization')
  let userId: string | null = null
  let userLabel = ''
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
      const token = authHeader.replace('Bearer ', '')
      const { data: userData } = await supabase.auth.getUser(token)
      userId = userData?.user?.id ?? null
      userLabel = userData?.user?.email ?? userData?.user?.phone ?? ''
    } catch {
      userId = null
    }
  }
  console.log('azabot-chat caller:', userId ?? 'anonymous')


  try {
    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return json({ error: 'messages array required' }, 400)
    }
    if (messages.length > MAX_MESSAGES) {
      return json({ error: `too many messages (max ${MAX_MESSAGES})` }, 400)
    }
    for (const m of messages) {
      if (!m || typeof m.role !== 'string' || typeof m.content !== 'string') {
        return json({ error: 'invalid message shape' }, 400)
      }
      if (!['user', 'assistant', 'system'].includes(m.role)) {
        return json({ error: 'invalid role' }, 400)
      }
      if (m.content.length > MAX_CONTENT_LEN) {
        return json({ error: `message too long (max ${MAX_CONTENT_LEN})` }, 400)
      }
    }

    const identityNote = userId
      ? `حالة المستخدم: موثّق ✅ (${userLabel}). لا تطلب رمزًا مرة أخرى؛ ساعده مباشرة في حل مشكلته.`
      : 'حالة المستخدم: غير موثّق بعد. اطلب التحقق قبل المساعدة في أي أمر يخص الحساب.'

    const input = [
      { type: 'message', role: 'user', content: TOOL_SYSTEM_PROMPT + '\n\n' + identityNote },
      ...messages.map((m: { role: string; content: string }) => ({
        type: 'message',
        role: m.role === 'system' ? 'user' : m.role,
        content: m.content,
      })),
    ]

    const res = await fetch(`${FOUNDRY_ENDPOINT}/openai/v1/responses`, {
      method: 'POST',
      headers: {
        'api-key': FOUNDRY_API_KEY,
        'Authorization': `Bearer ${FOUNDRY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_reference: { type: 'agent_reference', name: AGENT_NAME, version: AGENT_VERSION },
        input,
        store: false,
      }),
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error(`Foundry agent error [${res.status}]: ${errorText}`)
      return json({ error: 'Agent service error' }, 502)
    }

    const data = await res.json()
    let reply = extractText(data) || 'عذراً، لم أتمكن من المعالجة.'
    let otp: OtpTarget | null = null

    const call = reply.match(/<<SEND_OTP:(\{[\s\S]*?\})>>/)
    if (call) {
      const lastUser = [...messages].reverse().find((m: any) => m.role === 'user')?.content ?? ''
      const lang: 'ar' | 'en' = /[\u0600-\u06FF]/.test(lastUser) ? 'ar' : 'en'
      let args: any = {}
      try { args = JSON.parse(call[1]) ?? {} } catch { args = {} }
      const phone = typeof args.phone === 'string' ? args.phone.replace(/[\s-]/g, '') : undefined
      const prefix = reply.replace(call[0], '').trim()

      let target: OtpTarget | null = null
      if (isPhone(phone)) target = { kind: 'whatsapp', target: phone }
      else if (isEmail(args.email)) target = { kind: 'email', target: args.email.toLowerCase() }

      if (!target) {
        reply = lang === 'ar'
          ? 'من فضلك أرسل بريدًا صحيحًا أو رقم واتساب بالصيغة الدولية (مثل +2010...) لأرسل إليه الرمز.'
          : 'Please share a valid email or a WhatsApp number in international format (e.g. +2010...).'
      } else {
        const r = await sendOtp(target, lang)
        reply = (prefix + '\n\n' + r.text).trim()
        if (r.ok) otp = target
      }
    }

    return json({ reply, otp, verified: !!userId, agent: AGENT_NAME })

  } catch (error) {
    console.error('AzaBot agent error:', error)
    return json({ error: 'An internal error occurred' }, 500)
  }
})
