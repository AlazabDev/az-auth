import { createClient } from 'npm:@supabase/supabase-js@2'
import { AGENT_NAME, AGENT_VERSION, normalizeTarget, requestedOtp, targetWasProvided, validateMessages, providerFailure, type OtpTarget } from './policy.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
}
const FOUNDRY_ENDPOINT = 'https://az-ai-resource.services.ai.azure.com/api/projects/az-ai-gateway'
const FOUNDRY_API_KEY = Deno.env.get('FOUNDRY_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})
const client = () => createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })

// Delivery uses public Auth rather than service-role privileges. Supabase enforces
// shared OTP rate limits and configured CAPTCHA across all function instances.
async function sendOtp(target: OtpTarget, captchaToken?: string) {
  const auth = client()
  const { error } = target.kind === 'email'
    ? await auth.auth.signInWithOtp({ email: target.target, options: { shouldCreateUser: true, captchaToken } })
    : await auth.auth.signInWithOtp({ phone: target.target, options: { shouldCreateUser: true, channel: 'whatsapp', captchaToken } })
  if (error) {
    console.error('OTP delivery failed', { channel: target.kind, status: error.status, code: error.code })
    return json({ error: error.status === 429
      ? 'طلبات كثيرة. انتظر قبل طلب رمز آخر.'
      : 'تعذّر إرسال الرمز. تحقق من إعدادات البريد أو واتساب ورصيد خدمة الإرسال.', code: error.code ?? 'OTP_DELIVERY_FAILED' }, error.status === 429 ? 429 : 503)
  }
  return json({ reply: `تم قبول طلب إرسال رمز عبر ${target.kind === 'email' ? 'البريد' : 'واتساب'} إلى ${target.target}. أدخل الرمز في الخانة أسفل الدردشة؛ إن لم يصل فراجع الرسائل غير المرغوبة أو حاول لاحقًا.`, otp: target, agent: AGENT_NAME })
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
    return json({ status: FOUNDRY_API_KEY ? 'configured' : 'unconfigured', agent: AGENT_NAME, version: AGENT_VERSION, ai_verified: false })
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return json({ error: 'Auth service not configured' }, 503)
  try {
    const raw = await req.text()
    if (new TextEncoder().encode(raw).byteLength > 180000) return json({ error: 'Request too large' }, 413)
    let body: any
    try { body = JSON.parse(raw) } catch { return json({ error: 'Invalid JSON' }, 400) }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Invalid request' }, 400)
    if (body.captchaToken !== undefined && (typeof body.captchaToken !== 'string' || body.captchaToken.length > 4096)) return json({ error: 'Invalid CAPTCHA token' }, 400)
    if (body.action === 'send_otp') {
      const target = normalizeTarget(body.kind, body.target)
      if (!target) return json({ error: 'أدخل بريدًا صحيحًا أو رقم واتساب يبدأ بـ + ورمز الدولة.' }, 400)
      return await sendOtp(target, body.captchaToken)
    }
    if (body.action !== undefined) return json({ error: 'Unknown action' }, 400)
    if (!validateMessages(body.messages)) return json({ error: 'Invalid messages: 1–40 user/assistant messages, max 4000 characters each, ending with user' }, 400)
    const messages = body.messages
    const directOtp = requestedOtp(messages[messages.length - 1].content)
    if (directOtp) return await sendOtp(directOtp, body.captchaToken)
    if (!FOUNDRY_API_KEY) return json({ error: 'مفتاح اتصال وكيل az-agent-auth غير مضبوط.', code: 'FOUNDRY_NOT_CONFIGURED' }, 503)

    // Client messages can never establish identity. Resolve only a real Auth JWT.
    const token = req.headers.get('Authorization')?.replace(/^Bearer /, '')
    let verified = false
    if (token && token !== SUPABASE_ANON_KEY) {
      const { data, error } = await client().auth.getUser(token)
      if (!error && data.user && !data.user.is_anonymous) verified = true
    }
    const instruction = `أنت وكيل az-agent-auth الرسمي. أجب بلغة المستخدم بإجابات مفيدة ودقيقة عن الدخول والتحقق واستعادة الوصول. لا تدّع تنفيذ إجراء بلا نتيجة أداة مؤكدة. لا تعرض رموزًا ولا تطلب كتابتها في المحادثة. قبل المساعدة الخاصة بالحساب يجب التحقق من الهوية. حالة الهوية من الخادم: ${verified ? 'موثّق، ساعده دون طلب رمز جديد' : 'غير موثّق؛ اسأله البريد أم واتساب ثم اطلب العنوان أو الرقم الدولي'}. لإرسال رمز أخرج <<SEND_OTP:{"email":"عنوان المستخدم"}>> أو <<SEND_OTP:{"phone":"+رقم المستخدم","channel":"whatsapp"}>>. لا تستدع أداة إرسال أخرى؛ التطبيق ينفذ الإرسال. الحساب الموثق لا يمنح صلاحية إدارة مستخدمين آخرين. لا تدّع قراءة الصور أو الملفات المرفقة لأن محتواها لم يرسل إلى النموذج.`
    const res = await fetch(`${FOUNDRY_ENDPOINT}/openai/v1/responses`, {
      method: 'POST', headers: { 'api-key': FOUNDRY_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_reference: { type: 'agent_reference', name: AGENT_NAME, version: AGENT_VERSION }, input: [{ role: 'user', content: instruction }, ...messages], store: false }),
    })
    if (!res.ok) {
      const upstream = await res.text()
      const failure = providerFailure(res.status, upstream)
      console.error('Foundry request failed', { status: res.status, code: failure.code, requestId: res.headers.get('x-request-id') })
      return json({ error: failure.error, code: failure.code, agent: AGENT_NAME }, failure.status)
    }
    let reply = extractText(await res.json())
    if (!reply.trim()) return json({ error: 'لم يعُد الوكيل بإجابة. لم يتم إرسال رمز.', code: 'FOUNDRY_EMPTY_REPLY' }, 502)
    const call = reply.match(/<<SEND_OTP:(\{[\s\S]*?\})>>/)
    if (call) {
      let args: any
      try { args = JSON.parse(call[1]) } catch { return json({ error: 'طلب إرسال غير صالح؛ لم يُرسل رمز.' }, 400) }
      const target = normalizeTarget(args.phone ? 'whatsapp' : 'email', args.phone ?? args.email)
      if (!target || !targetWasProvided(target, messages)) return json({ error: 'أرسل بريدك أو رقم واتساب الصحيح لطلب الرمز.' }, 400)
      return await sendOtp(target, body.captchaToken)
    }
    return json({ reply, verified, agent: AGENT_NAME })
  } catch {
    console.error('Chat request failed')
    return json({ error: 'تعذّر إكمال الطلب. حاول لاحقًا.', code: 'CHAT_REQUEST_FAILED' }, 503)
  }
})
