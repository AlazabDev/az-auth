export const AGENT_NAME = 'az-agent-auth'
export const AGENT_VERSION = '12'
export type OtpTarget = { kind: 'email' | 'whatsapp'; target: string }
export type ChatMessage = { role: 'user' | 'assistant'; content: string }

export function normalizeTarget(kind: unknown, value: unknown): OtpTarget | null {
  if (typeof value !== 'string') return null
  if (kind === 'email') {
    const target = value.trim().toLowerCase()
    return target.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(target)
      ? { kind, target } : null
  }
  if (kind === 'whatsapp') {
    const target = value.replace(/[\s()-]/g, '')
    return /^\+[1-9]\d{7,14}$/.test(target) ? { kind, target } : null
  }
  return null
}

export function validateMessages(value: unknown): value is ChatMessage[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 40 &&
    value.every(m => m && ['user', 'assistant'].includes(m.role) &&
      typeof m.content === 'string' && m.content.trim().length > 0 && m.content.length <= 4000) &&
    value[value.length - 1]?.role === 'user'
}

// Only an explicit request containing the recipient can trigger delivery without AI.
export function requestedOtp(text: string): OtpTarget | null {
  if (!/(رمز|كود|otp|verification code|login code)/i.test(text)) return null
  const email = text.match(/[^\s<>]+@[^\s<>]+\.[a-z]{2,}/i)?.[0]
  if (email) return normalizeTarget('email', email)
  const phone = text.match(/\+[1-9][\d\s()-]{7,20}\d/)?.[0]
  return phone ? normalizeTarget('whatsapp', phone) : null
}

export function targetWasProvided(target: OtpTarget, messages: ChatMessage[]): boolean {
  return messages.some(m => m.role === 'user' && (
    target.kind === 'email' ? m.content.toLowerCase().includes(target.target)
      : m.content.replace(/[\s()-]/g, '').includes(target.target)
  ))
}

export function providerFailure(status: number, message: string) {
  if (/OBO auth|aml-user-token/i.test(message)) return {
    status: 503, code: 'FOUNDRY_TOOL_AUTH',
    error: 'تعذّر تشغيل وكيل az-agent-auth: مصادقة أداة في Foundry غير متوافقة مع مفتاح API. يلزم إصلاح اتصال الأداة ونشر إصدار الوكيل.',
  }
  return {
    status: status === 429 ? 429 : status === 403 ? 403 : 503,
    code: status === 401 ? 'FOUNDRY_CREDENTIALS' : status === 404 ? 'FOUNDRY_AGENT_UNAVAILABLE' : 'FOUNDRY_UNAVAILABLE',
    error: 'تعذّر الحصول على رد من وكيل az-agent-auth الآن. طلب رمز الدخول متاح بشكل مستقل.',
  }
}