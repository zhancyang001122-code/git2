#!/usr/bin/env node

const DEFAULT_PUBLIC_URL = 'https://archflow.zaneyang.xyz/'
const DEFAULT_SUPABASE_URL = 'https://mblnorfsegteomazffwy.supabase.co'
const DEFAULT_TIMEOUT_MS = 12_000
const CANARY_TIMEOUT_MS = 8 * 60_000
const CANARY_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

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

async function invokeGenerate(supabaseUrl, publishableKey, accessToken, body, timeoutMs = 180_000) {
  const response = await fetch(`${supabaseUrl}/functions/v1/generate`, {
    method: 'POST',
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload?.error) {
    throw new Error(String(payload?.error || `HTTP ${response.status}`).slice(0, 300))
  }
  return payload
}

async function realImageCanary({ supabaseUrl, publishableKey, accessToken, selectedSlot }) {
  const startedAt = Date.now()
  try {
    const attachment = {
      name: 'archflow-canary.png',
      mimeType: 'image/png',
      data: CANARY_PNG_BASE64,
    }
    let result = await invokeGenerate(supabaseUrl, publishableKey, accessToken, {
      action: 'generate',
      feature: 'render',
      prompt: 'Create a simple empty architectural massing study: one white rectangular pavilion on a plain light-gray background. No people, no text, and no logos.',
      fileNames: [attachment.name],
      attachments: [attachment],
      imageSlot: selectedSlot,
      imageSize: '1024x1024',
      imageAspectRatio: '1:1',
    })
    const actualSlot = String(result.imageSlot || selectedSlot)
    const deadline = Date.now() + CANARY_TIMEOUT_MS
    let pollCount = 0
    while (result?.pending && Date.now() < deadline) {
      const delay = Math.max(1_000, Math.min(5_000, Number(result.pollAfterMs) || 2_000))
      await new Promise((resolve) => setTimeout(resolve, delay))
      pollCount += 1
      result = await invokeGenerate(supabaseUrl, publishableKey, accessToken, {
        action: 'image-task-status',
        feature: 'render',
        prompt: 'Architectural massing canary',
        fileNames: [attachment.name],
        imageSlot: actualSlot,
        imageAspectRatio: '1:1',
        taskId: result.taskId,
        taskToken: result.taskToken,
      }, 90_000)
    }
    if (result?.pending) throw new Error('canary_render_timeout')
    const imageUrl = String(result?.images?.[0]?.imageUrl || '')
    if (!imageUrl.startsWith('data:image/') && !imageUrl.startsWith('https://')) {
      throw new Error('canary_missing_final_image')
    }
    return {
      name: `real_image_${selectedSlot}`,
      status: actualSlot === selectedSlot ? 'pass' : 'degraded',
      latencyMs: Date.now() - startedAt,
      selectedSlot,
      actualSlot,
      pollCount,
    }
  } catch (error) {
    return {
      name: `real_image_${selectedSlot}`,
      status: 'fail',
      latencyMs: Date.now() - startedAt,
      selectedSlot,
      detail: error instanceof Error ? error.message.slice(0, 300) : 'unknown_canary_error',
    }
  }
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
      for (const selectedSlot of ['image1', 'image2']) {
        checks.push(await realImageCanary({ supabaseUrl, publishableKey, accessToken, selectedSlot }))
      }
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
  const degraded = checks.filter((check) => check.status === 'degraded')
  const report = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    status: failed.length ? 'fail' : degraded.length ? 'degraded' : 'pass',
    checks,
  }
  process.stdout.write(`${JSON.stringify(report)}\n`)
  if (failed.length || degraded.length) process.exitCode = 1
}

await main()
