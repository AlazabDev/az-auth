// Temporary admin utility: inspect the Foundry agent definition, remove duplicate
// tools, and publish a new version. Auth-gated by a verified Supabase session.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const FOUNDRY_ENDPOINT = 'https://az-ai-resource.services.ai.azure.com/api/projects/az-ai-gateway'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const AGENT_NAME = 'az-agent-auth'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

async function getFoundryKey(): Promise<string | null> {
  const envKey = Deno.env.get('FOUNDRY_API_KEY')
  if (envKey) return envKey
  if (SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    const { data } = await admin.from('app_secrets').select('value').eq('key', 'FOUNDRY_API_KEY').maybeSingle()
    if (data?.value) return data.value
  }
  return null
}

async function verifySession(req: Request): Promise<boolean> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '')
  if (!token) return false
  const { data } = await createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } })
    .auth.getUser(token)
  return !!data.user && !data.user.is_anonymous
}

type AnyTool = Record<string, any>

function toolIdentity(t: AnyTool): string {
  if (t?.type === 'mcp') return `mcp:${t.server_label}`
  if (t?.type === 'function') return `function:${t.name}`
  if (t?.type === 'mcp_approval' || t?.type === 'mcp_approval_request') return `mcp_approval:${t.server_label ?? ''}`
  return `${t?.type ?? 'unknown'}:${t?.server_label ?? t?.name ?? ''}`
}

function summarizeTools(tools: AnyTool[]) {
  return (tools ?? []).map(t => ({
    identity: toolIdentity(t),
    type: t?.type ?? 'unknown',
    server_label: t?.server_label ?? null,
    name: t?.name ?? null,
    allowed_tools: t?.allowed_tools ?? null,
    require_approval: t?.require_approval ?? null,
    auth: t?.auth ?? t?.auth_type ?? null,
  }))
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const authed = await verifySession(req)
  if (!authed) return json({ error: 'Unauthorized' }, 401)

  const apiKey = await getFoundryKey()
  if (!apiKey) return json({ error: 'FOUNDRY_API_KEY not configured' }, 503)

  const headers = { 'api-key': apiKey, 'Content-Type': 'application/json' }

  let body: any = {}
  try { body = await req.json() } catch { /* empty body allowed */ }
  const action = body.action ?? 'get'

  try {
    if (action === 'get') {
      const res = await fetch(`${FOUNDRY_ENDPOINT}/openai/v1/agents/${AGENT_NAME}`, { headers })
      const data = await res.json()
      return json({
        status: res.status,
        agent: data?.name,
        version: data?.version,
        model: data?.model,
        tool_count: (data?.tools ?? []).length,
        tools: summarizeTools(data?.tools ?? []),
        raw_keys: Object.keys(data ?? {}),
      }, res.ok ? 200 : 502)
    }

    if (action === 'versions') {
      const res = await fetch(`${FOUNDRY_ENDPOINT}/openai/v1/agents/${AGENT_NAME}/versions`, { headers })
      const data = await res.json()
      return json({ status: res.status, data }, res.ok ? 200 : 502)
    }

    if (action === 'fix') {
      const getRes = await fetch(`${FOUNDRY_ENDPOINT}/openai/v1/agents/${AGENT_NAME}`, { headers })
      const current = await getRes.json()
      if (!getRes.ok) return json({ error: 'Could not fetch agent definition', detail: current }, 502)

      const tools: AnyTool[] = current.tools ?? []
      const seen = new Map<string, AnyTool>()
      const removed: string[] = []
      for (const t of tools) {
        const id = toolIdentity(t)
        if (seen.has(id)) removed.push(id)
        else seen.set(id, t)
      }
      const deduped = [...seen.values()]

      // Rebuild a create body: strip server-managed metadata.
      const createBody: AnyTool = {
        name: current.name,
        model: current.model,
        instructions: current.instructions,
        tools: deduped,
      }
      for (const key of ['description', 'temperature', 'top_p', 'response_format', 'tool_resources', 'metadata']) {
        if (current[key] !== undefined && current[key] !== null) createBody[key] = current[key]
      }

      const postRes = await fetch(`${FOUNDRY_ENDPOINT}/openai/v1/agents`, {
        method: 'POST', headers, body: JSON.stringify(createBody),
      })
      const created = await postRes.json()

      return json({
        status: postRes.status,
        removed_duplicates: removed,
        tools_before: tools.length,
        tools_after: deduped.length,
        new_version: created?.version,
        previous_version: current.version,
        tools: summarizeTools(created?.tools ?? deduped),
        detail: postRes.ok ? undefined : created,
      }, postRes.ok ? 200 : 502)
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (err) {
    return json({ error: 'Unexpected failure', detail: String(err) }, 500)
  }
})
