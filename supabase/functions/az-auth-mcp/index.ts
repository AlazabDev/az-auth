import { createClient } from 'npm:@supabase/supabase-js@2'

// ترويسات CORS يدوية للمشروع
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const MCP_SECRET_TOKEN = Deno.env.get('MCP_SECRET_TOKEN') // لحماية استدعاء الأدوات من خارج المنظومة

// 1. تعريف الأدوات المتاحة لوكيل az-agent-auth (Schema)
const TOOLS_DEFINITIONS = [
  {
    name: 'check_account',
    description: 'فحص حالة حساب المستخدم بالبريد الإلكتروني أو رقم الهاتف لمعرفة وجوده وحالته ومزودي الدخول المربوطين.',
    inputSchema: {
      type: 'object',
      properties: {
        identifier: { type: 'string', description: 'البريد الإلكتروني أو رقم الهاتف بالصيغة الدولية (+20...)' },
      },
      required: ['identifier'],
    },
  },
  {
    name: 'send_auth_otp',
    description: 'إرسال رمز تحقق OTP إلى بريد المستخدم أو عبر تطبيق واتساب.',
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'البريد الإلكتروني أو رقم الهاتف' },
        channel: { type: 'string', enum: ['email', 'whatsapp'], description: 'قناة الإرسال' },
      },
      required: ['target', 'channel'],
    },
  },
  {
    name: 'create_auth_conflict',
    description: 'تسجيل حالة تعارض في الهوية (مثلاً بريد موجود مسبقاً بدخول Google مختلف) لتحويلها للدعم الفني.',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'بريد المستخدم' },
        conflict_type: { type: 'string', description: 'نوع التعارض (google_mismatch, phone_duplicate, etc.)' },
        details: { type: 'string', description: 'تفاصيل الحالة وسياق المشكلة' },
      },
      required: ['email', 'conflict_type'],
    },
  },
  {
    name: 'open_support_ticket',
    description: 'فتح تذكرة دعم فني خاصة بمشاكل المصادقة والدخول عند تعذر الحل التلقائي.',
    inputSchema: {
      type: 'object',
      properties: {
        user_identifier: { type: 'string', description: 'البريد أو الهاتف' },
        subject: { type: 'string', description: 'عنوان المشكلة' },
        description: { type: 'string', description: 'شرح المشكلة وتفاصيل التدقيق' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
      },
      required: ['user_identifier', 'subject', 'description'],
    },
  },
  {
    name: 'get_allowed_apps',
    description: 'استعلام قائمة التطبيقات المصرح للمستخدم بالوصول إليها (UberFix، بوابة العملاء، الأرشيف، إلخ).',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'معرف المستخدم UUID' },
      },
      required: ['user_id'],
    },
  },
]

// 2. معالجة تنفيذ الأدوات (Tool Execution)
async function executeTool(name: string, args: any) {
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  switch (name) {
    case 'check_account': {
      const isEmail = args.identifier.includes('@')
      const query = admin.from('profiles').select('id, email, phone, role, full_name, status')
      const { data, error } = isEmail 
        ? await query.eq('email', args.identifier).maybeSingle()
        : await query.eq('phone', args.identifier).maybeSingle()

      if (error) return { status: 'error', message: error.message }
      if (!data) return { exists: false, message: 'لا يوجد حساب مسجل بهذه البيانات في النظام' }

      return {
        exists: true,
        user_id: data.id,
        role: data.role || 'Guest',
        status: data.status || 'active',
        has_phone: !!data.phone,
        has_email: !!data.email,
      }
    }

    case 'send_auth_otp': {
      const { target, channel } = args
      if (channel === 'email') {
        const { error } = await admin.auth.signInWithOtp({
          email: target,
          options: { shouldCreateUser: false },
        })
        if (error) return { success: false, error: error.message }
        return { success: true, message: 'تم إرسال رمز التحقق للبريد الإلكتروني بنجاح' }
      } else {
        const { error } = await admin.auth.signInWithOtp({
          phone: target,
          options: { channel: 'whatsapp', shouldCreateUser: false },
        })
        if (error) return { success: false, error: error.message }
        return { success: true, message: 'تم إرسال رمز التحقق عبر واتساب بنجاح' }
      }
    }

    case 'create_auth_conflict': {
      // تسجيل التعارض في جدول التدقيق الأمني
      const { data, error } = await admin.from('audit_logs').insert({
        action: 'auth_conflict_detected',
        user_email: args.email,
        details: { type: args.conflict_type, notes: args.details },
        severity: 'warning',
      }).select().single()

      if (error) return { success: false, error: error.message }
      return { success: true, conflict_id: data.id, message: 'تم تسجيل حالة التعارض بنجاح' }
    }

    case 'open_support_ticket': {
      // فتح تذكرة دعم للمصادقة
      const { data, error } = await admin.from('support_tickets').insert({
        requester: args.user_identifier,
        subject: args.subject,
        body: args.description,
        priority: args.priority || 'normal',
        category: 'authentication',
      }).select().single()

      if (error) return { success: false, error: error.message }
      return { success: true, ticket_id: data?.id, message: 'تم فتح التذكرة بنجاح' }
    }

    case 'get_allowed_apps': {
      // جلب التطبيقات المتاحة (SSO Apps)
      const { data, error } = await admin.from('sso_apps').select('name, app_id, base_url, is_active')
      if (error) return { success: false, error: error.message }
      return { success: true, apps: data }
    }

    default:
      throw new Error(`Tool not found: ${name}`)
  }
}

// 3. خدمة الـ HTTP و JSON-RPC 2.0 (MCP Protocol)
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Fail closed: an unset shared token must never expose service-role tools.
  if (!MCP_SECRET_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'MCP service not configured' }), {
      status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  // التحقق الأمني الإلزامي للـ MCP Token
  if (MCP_SECRET_TOKEN) {
    const authHeader = req.headers.get('Authorization')
    if (authHeader !== `Bearer ${MCP_SECRET_TOKEN}`) {
      return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Unauthorized' } }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  // GET: معلومات الخادم والأدوات المتاحة
  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      server: 'az-auth-mcp',
      version: '1.0.0',
      protocol: 'mcp-jsonrpc-2.0',
      tools: TOOLS_DEFINITIONS.map(t => t.name),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // POST: معالجة رسائل بروتوكول MCP (JSON-RPC)
  try {
    const body = await req.json()
    const { jsonrpc, id, method, params } = body

    // 1) طلب سرد الأدوات tools/list
    if (method === 'tools/list') {
      return new Response(JSON.stringify({
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS_DEFINITIONS },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2) طلب تنفيذ أداة tools/call
    if (method === 'tools/call') {
      // Shared agent credentials are not proof of the end user's identity.
      // Keep account tools fail-closed until per-user authorization is implemented.
      return new Response(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32003, message: 'Account tools unavailable until verified per-user authorization is configured' } }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
      /*
      const { name, arguments: toolArgs } = params || {}
      try {
        const toolResult = await executeTool(name, toolArgs || {})
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(toolResult, null, 2) }],
            isError: false,
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      } catch (toolErr: any) {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: toolErr.message || 'Execution error' }],
            isError: true,
          },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      */
    }

    // طريقة غير مدعومة
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: 'Method not found' },
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err: any) {
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32700, message: 'Parse error', data: err.message },
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
