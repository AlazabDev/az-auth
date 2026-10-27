// Temporary maintenance trigger (one-shot): dedupes the Foundry agent tools and
// publishes a new agent version. No client input influences the operation.
// Self-locks via app_secrets flag AGENT_FIX_DONE; deleted after use.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

const FOUNDRY_ENDPOINT = 'https://az-ai-resource.services.ai.azure.com/api/projects/az-ai-gateway'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const AGENT_NAME = 'az-agent-auth'
const FLAG_KEY = 'AGENT_FIX_DONE'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
})

function admin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

async function getFoundryKey(): Promise<string | null> {
  const envKey = Deno.env.get('FOUNDRY_API_KEY')
  if (envKey) return envKey
  const { data } = await admin().from('app_secrets').select('value').eq('key', 'FOUNDRY_API_KEY').maybeSingle()
  return data?.value ?? null
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
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const apiKey = await getFoundryKey()
  if (!apiKey) return json({ error: 'FOUNDRY_API_KEY not configured' }, 503)

  const adm = admin()
  const { data: flag } = await adm.from('app_secrets').select('value').eq('key', FLAG_KEY).maybeSingle()
  if (flag?.value) {
    return json({ status: 'already_done', ran_at: flag.value })
  }

  const headers = { 'api-key': apiKey, 'Content-Type': 'application/json' }

  try {
    const getRes = await fetch(`${FOUNDRY_ENDPOINT}/openai/v1/agents/${AGENT_NAME}`, { headers })
    const getRaw = await getRes.text()
    if (!getRes.ok || !getRaw.trim()) {
      // Diagnostic probe of likely agent-management paths
      const probes: { path: string; status: number; body: string }[] = []
      for (const p of [
        `/openai/v1/agents/${AGENT_NAME}`,
        `/openai/v1/agents/${AGENT_NAME}/versions`,
        `/agents/${AGENT_NAME}`,
        `/openai/v1/assistants/${AGENT_NAME}`,
      ]) {
        try {
          const r = await fetch(`${FOUNDRY_ENDPOINT}${p}`, { headers })
          const t = await r.text()
          probes.push({ path: p, status: r.status, body: t.slice(0, 1500) })
        } catch (e) {
          probes.push({ path: p, status: -1, body: String(e) })
        }
      }
      return json({ error: 'Agent fetch empty', get_status: getRes.status, get_body: getRaw.slice(0, 1500), probes }, 502)
    }
    const current = JSON.parse(getRaw)

    const tools: AnyTool[] = current.tools ?? []
    const seen = new Map<string, AnyTool>()
    const removed: string[] = []
    for (const t of tools) {
      const id = toolIdentity(t)
      if (seen.has(id)) removed.push(id)
      else seen.set(id, t)
    }
    const deduped = [...seen.values()]

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

    const result = {
      status: postRes.ok ? 'fixed' : 'failed',
      removed_duplicates: removed,
      tools_before: tools.length,
      tools_after: deduped.length,
      previous_version: current.version,
      new_version: created?.version ?? null,
      tools: summarizeTools(created?.tools ?? deduped),
      detail: postRes.ok ? undefined : created,
    }

    if (postRes.ok) {
      await adm.from('app_secrets').upsert(
        { key: FLAG_KEY, value: new Date().toISOString() },
        { onConflict: 'key' },
      )
    }

    return json(result, postRes.ok ? 200 : 502)
  } catch (err) {
    return json({ error: 'Unexpected failure', detail: String(err) }, 500)
  }
})
