#!/usr/bin/env node

const DEFAULT_PUBLIC_URL = 'https://archflow.zaneyang.xyz/'
const DEFAULT_SUPABASE_URL = 'https://mblnorfsegteomazffwy.supabase.co'
const DEFAULT_TIMEOUT_MS = 12_000

function normalizedBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

async function fetchCheck(name, url, options = {}, validate = async () => undefined) {
  const startedAt = Date.now()
  try {
    const response = await fetch(url, {
      ...options,
      redirect: 'follow',
      signal: AbortSignal.timeout(Number(process.env.ARCHFLOW_HEALTH_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS),
    })
    const text = await response.text()
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    await validate({ response, text })
    return { name, status: 'pass', latencyMs: Date.now() - startedAt }
  } catch (error) {
    return {
      name,
      status: 'fail',
      latencyMs: Date.now() - startedAt,
      detail: error instanceof Error ? error.message.slice(0, 300) : 'unknown_error',
    }
  }
}

async function signInMonitor(supabaseUrl, publishableKey) {
  const email = String(process.env.ARCHFLOW_MONITOR_EMAIL || '').trim()
  const password = String(process.env.ARCHFLOW_MONITOR_PASSWORD || '')
  if (!email || !password || !publishableKey) return ''

  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(Number(process.env.ARCHFLOW_HEALTH_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`monitor_sign_in_http_${response.status}`)
  const payload = await response.json()
  if (!payload.access_token) throw new Error('monitor_sign_in_missing_access_token')
  return payload.access_token
}

async function main() {
  const publicUrl = normalizedBaseUrl(process.env.ARCHFLOW_PUBLIC_URL || DEFAULT_PUBLIC_URL)
  const supabaseUrl = normalizedBaseUrl(process.env.ARCHFLOW_SUPABASE_URL || DEFAULT_SUPABASE_URL)
  const publishableKey = String(process.env.ARCHFLOW_SUPABASE_PUBLISHABLE_KEY || '').trim()
  const checks = []

  checks.push(await fetchCheck('public_site', `${publicUrl}/`, {}, ({ text }) => {
    if (!text.includes('ArchFlow · AI Design Workspace') || !text.includes('id="root"')) {
      throw new Error('unexpected_html_marker')
    }
  }))

  checks.push(await fetchCheck('supabase_auth', `${supabaseUrl}/auth/v1/health`, {
    headers: publishableKey ? { apikey: publishableKey } : {},
  }, ({ text }) => {
    const payload = JSON.parse(text)
    if (payload?.name !== 'GoTrue') throw new Error('unexpected_auth_health_payload')
  }))

  const monitorConfigured = Boolean(publishableKey && process.env.ARCHFLOW_MONITOR_EMAIL && process.env.ARCHFLOW_MONITOR_PASSWORD)
  if (monitorConfigured) {
    try {
      const accessToken = await signInMonitor(supabaseUrl, publishableKey)
      checks.push(await fetchCheck('edge_operational_health', `${supabaseUrl}/functions/v1/generate`, {
        method: 'POST',
        headers: {
          apikey: publishableKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'health' }),
      }, ({ text }) => {
        const payload = JSON.parse(text)
        if (typeof payload?.languageReady !== 'boolean' || !Array.isArray(payload?.imageModes)) {
          throw new Error('unexpected_operational_health_payload')
        }
        if (payload.ok !== true) throw new Error('operational_health_failed')
      }))
    } catch (error) {
      checks.push({
        name: 'edge_operational_health',
        status: 'fail',
        latencyMs: 0,
        detail: error instanceof Error ? error.message.slice(0, 300) : 'monitor_sign_in_failed',
      })
    }
  } else {
    checks.push({ name: 'edge_operational_health', status: 'skip', latencyMs: 0, detail: 'monitor_credentials_not_configured' })
  }

  const failed = checks.filter((check) => check.status === 'fail')
  const report = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    status: failed.length ? 'fail' : 'pass',
    checks,
  }
  process.stdout.write(`${JSON.stringify(report)}\n`)
  if (failed.length) process.exitCode = 1
}

await main()
