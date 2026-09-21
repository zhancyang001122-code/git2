import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { transientSupplierFailure } from '../scripts/health-classification.mjs'

const script = await readFile(new URL('../scripts/health-check.mjs', import.meta.url), 'utf8')
const workflow = await readFile(new URL('../.github/workflows/health-check.yml', import.meta.url), 'utf8')

test('生产巡检会隔离三路生图、跳过未配置槽位并把供应商瞬态失败降级', () => {
  assert.match(script, /requestedCanarySlots\(process\.env\.ARCHFLOW_HEALTH_IMAGE_SLOTS\)/)
  assert.match(script, /const CANARY_PNG_BASE64 = /)
  assert.doesNotMatch(script, /iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB/)
  assert.match(script, /No people, no text, and no logos\./)
  assert.doesNotMatch(script, /case-thumbnails\/tank-shanghai\.jpg/)
  assert.match(script, /action: 'image-task-status'/)
  assert.match(script, /ARCHFLOW_HEALTH_IMAGE_SIZE \|\| '1024x1024'/)
  assert.match(script, /imageSize: requestedSize/)
  assert.match(script, /disableFailover: !allowFailover/)
  assert.match(script, /import \{ transientSupplierFailure \} from '\.\/health-classification\.mjs'/)
  assert.match(script, /status: transient \? 'degraded' : 'fail'/)
  assert.match(script, /classification: transient \? 'supplier_transient' : 'deterministic_failure'/)
  assert.match(script, /recentUserSuccess: recentUserSuccesses\[selectedSlot\] \|\| null/)
  assert.match(script, /canary_missing_final_image/)
  assert.match(script, /canary_image_not_fetchable_http_/)
  assert.match(script, /canary_image_not_decodable/)
  assert.match(script, /actualSlot === selectedSlot \? 'pass' : 'degraded'/)
  assert.match(script, /if \(payload\.ok !== true\) throw new Error\('operational_health_failed'\)/)
  assert.match(script, /mode\?\.configured === true/)
  assert.match(script, /detail: 'image_provider_not_configured'/)
  assert.match(script, /if \(failed\.length\) process\.exitCode = 1/)
  assert.doesNotMatch(script, /if \(failed\.length \|\| degraded\.length\) process\.exitCode = 1/)
})

test('供应商 API 500 和网络请求错误会降级，确定性输入错误仍会失败', () => {
  assert.equal(transientSupplierFailure('Gemini 生图 API 500: upstream error: do request failed'), true)
  assert.equal(transientSupplierFailure('HTTP 503: Service Unavailable'), true)
  assert.equal(transientSupplierFailure('图生图服务请求失败（上游 500）'), true)
  assert.equal(transientSupplierFailure('Gemini 生图 API 400: service timeout, please try again later.'), true)
  assert.equal(transientSupplierFailure('invalid API key'), false)
  assert.equal(transientSupplierFailure('unsupported image size'), false)
})

test('生产巡检由十八小时 Codex 自动运维单一调度并为真实成图预留足够时间', () => {
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /image_slots:/)
  assert.match(workflow, /image_size:/)
  assert.match(workflow, /allow_failover:/)
  assert.match(workflow, /ARCHFLOW_HEALTH_IMAGE_SLOTS: \$\{\{ inputs\.image_slots \|\| 'image1,image2,image3' \}\}/)
  assert.match(workflow, /ARCHFLOW_HEALTH_IMAGE_SIZE: \$\{\{ inputs\.image_size \|\| '1024x1024' \}\}/)
  assert.match(workflow, /ARCHFLOW_HEALTH_ALLOW_FAILOVER: \$\{\{ inputs\.allow_failover \|\| false \}\}/)
  assert.doesNotMatch(workflow, /^\s*schedule:/m)
  assert.match(workflow, /timeout-minutes: 25/)
  assert.match(workflow, /set -o pipefail/)
  assert.match(workflow, /Open or update one incident issue/)
})
