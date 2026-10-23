import { createClient } from 'npm:@supabase/supabase-js@2'
import { 
  AGENT_NAME, AGENT_VERSION, normalizeTarget, requestedOtp, 
  targetWasProvided, validateMessages, type OtpTarget 
} from './policy.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
}

const FOUNDRY_ENDPOINT = 'https://az-ai-resource.services.ai.azure.com/api/projects/az-ai-gateway'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

const client = () => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { 
  auth: { persistSession: false, autoRefreshToken: false } 
})

// جلب المفتاح السري إما من متغيرات البيئة أو من جدول app_secrets
async function getEffectiveFoundryKey(): Promise<string | null> {
  const envKey = Deno.env.get('FOUNDRY_API_KEY')
  if (envKey) return envKey

  if (SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false }
      })
      const { data } = await adminClient
        .from('app_secrets')
        .select('value')
        .eq('key', 'FOUNDRY_API_KEY')
        .maybeSingle()

      if (data?.value) return data.value
    } catch (e) {
      console.warn('Could not read key from app_secrets:', e)
    }
  }
  return null
}

// إرسال الرمز مباشرة عبر Supabase Auth دون الحاجة لأي وكيل أو أداة خارجية
async function sendOtp(target: OtpTarget, captchaToken?: string) {
  const auth = client()
  const { error } = target.kind === 'email'
    ? await auth.auth.signInWithOtp({ 
        email: target.target, 
        options: { shouldCreateUser: true, captchaToken } 
      })
    : await auth.auth.signInWithOtp({ 
        phone: target.target, 
        options: { shouldCreateUser: true, channel: 'whatsapp', captchaToken } 
      })

  if (error) {
    console.error('OTP delivery failed', { channel: target.kind, status: error.status, code: error.code })
    return json({ 
      error: error.status === 429
        ? 'طلبات كثيرة. انتظر دقيقة قبل طلب رمز آخر.'
        : 'تعذّر إرسال الرمز. تحقق من إعدادات مزود الخدمة (البريد/واتساب).', 
      code: error.code ?? 'OTP_DELIVERY_FAILED' 
    }, error.status === 429 ? 429 : 503)
  }

  return json({ 
    reply: `تم قبول طلب إرسال رمز التحقق عبر ${target.kind === 'email' ? 'البريد الإلكتروني' : 'واتساب'} إلى ${target.target}. أدخل الرمز في الخانة أسفل المحادثة.`, 
    otp: target, 
    agent: AGENT_NAME 
  })
}

function extractText(data: any): string {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text
  const parts: string[] = []
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const c of Array.isArray(item?.content) ? item.content : []) {
      if (typeof c?.text === 'string') parts.push(c.text)
      else if (typeof c?.text?.value === 'string') parts.push(c.text.value)
    }
  }
  return parts.join('\n')
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  
  if (req.method === 'GET' || req.method === 'HEAD') {
    const key = await getEffectiveFoundryKey()
    return json({ 
      status: key ? 'configured' : 'unconfigured', 
      agent: AGENT_NAME, 
      version: AGENT_VERSION, 
      standalone_otp: true 
    })
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json({ error: 'Auth service not configured' }, 503)

  try {
    const raw = await req.text()
    let body: any
    try { body = JSON.parse(raw) } catch { return json({ error: 'Invalid JSON' }, 400) }

    // 1. مسار طلب OTP صريح ومباشر
    if (body.action === 'send_otp') {
      const target = normalizeTarget(body.kind, body.target)
      if (!target) return json({ error: 'أدخل بريدًا صحيحًا أو رقم هاتف دولي للواتساب يبدأ بـ +.' }, 400)
      return await sendOtp(target, body.captchaToken)
    }

    if (!validateMessages(body.messages)) {
      return json({ error: 'صيغة الرسائل غير صالحة' }, 400)
    }

    const messages = body.messages
    const lastUserMessage = messages[messages.length - 1].content

    // 2. فحص ما إذا كانت الرسالة تطلب رمزاً مباشرة لتجاوز النموذج تماماً
    const directOtp = requestedOtp(lastUserMessage)
    if (directOtp) return await sendOtp(directOtp, body.captchaToken)

    const apiKey = await getEffectiveFoundryKey()
    if (!apiKey) {
      return json({ 
        error: 'مفتاح اتصال وكيل الذكاء الاصطناعي غير مضبوط في الإدارة.', 
        code: 'FOUNDRY_NOT_CONFIGURED' 
      }, 503)
    }

    // 3. التحقق من جلسة المستخدم الحالية
    const token = req.headers.get('Authorization')?.replace(/^Bearer /, '')
    let verified = false
    if (token && token !== SUPABASE_ANON_KEY) {
      const { data, error } = await client().auth.getUser(token)
      if (!error && data.user && !data.user.is_anonymous) verified = true
    }

    const systemInstruction = `أنت وكيل az-agent-auth الرسمي لبوابة مصادقة العزب (auth.alazab.com).
أجب بلغة المستخدم بدقة واختصار لمساعدته في استعادة الحساب والدخول وتخطي المشاكل.
حالة هوية المستخدم الحالية: ${verified ? 'موثّق بالفعل.' : 'غير موثّق حتى الآن.'}
عندما يحتاج المستخدم رمز دخول أو تحقق، اطلب منه تزويدك ببريده الإلكتروني أو رقم الواتساب الدولي (+).
وعند تزويدك بالبيانات، اكتب السطر التالي حصراً: <<SEND_OTP:{"email":"عنوان_البريد"}>> أو <<SEND_OTP:{"phone":"+الرقم","channel":"whatsapp"}>>.
لا تخترع رموز تحقق من عندك إطلاقاً.`

    // 4. استدعاء النموذج الصرف دون تمرير tools الخارجية لمنع خطأ OBO
    const res = await fetch(`${FOUNDRY_ENDPOINT}/openai/v1/responses`, {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        agent_reference: { 
          type: 'agent_reference', 
          name: AGENT_NAME, 
          version: AGENT_VERSION 
        },
        input: [
          { role: 'user', content: systemInstruction },
          ...messages
        ],
        tools: [], // إيقاف تمرير الأدوات الخارجية لتجنب عطل OBO تماماً
        store: false,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Foundry Agent Error:', res.status, errText)
      return json({ 
        error: 'تعذر تشغيل المعالج الذكي حالياً. يمكنك طلب رمز الدخول مباشرة عبر البريد أو واتساب.', 
        code: 'AGENT_UNAVAILABLE',
        agent: AGENT_NAME
      }, 503)
    }

    const resJson = await res.json()
    const reply = extractText(resJson)

    // 5. فحص ما إذا طلب الوكيل إرسال رمز للمستخدم
    const otpMatch = reply.match(/<<SEND_OTP:(\{[\s\S]*?\})>>/)
    if (otpMatch) {
      try {
        const args = JSON.parse(otpMatch[1])
        const target = normalizeTarget(args.phone ? 'whatsapp' : 'email', args.phone ?? args.email)
        if (target && targetWasProvided(target, messages)) {
          return await sendOtp(target, body.captchaToken)
        }
      } catch {
        // تجاهل واستمر في إرجاع الرد
      }
    }

    return json({ reply: reply.replace(/<<SEND_OTP:[\s\S]*?>>/g, '').trim(), verified, agent: AGENT_NAME })
  } catch (err) {
    console.error('Chat endpoint exception:', err)
    return json({ error: 'حدث خطأ في معالجة طلب المحادثة.', code: 'INTERNAL_ERROR' }, 500)
  }
})
