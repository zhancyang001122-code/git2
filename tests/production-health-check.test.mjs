import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const script = await readFile(new URL('../scripts/health-check.mjs', import.meta.url), 'utf8')
const workflow = await readFile(new URL('../.github/workflows/health-check.yml', import.meta.url), 'utf8')

test('生产巡检会隔离两路生图并把供应商瞬态失败降级而非误报全站故障', () => {
  assert.match(script, /requestedCanarySlots\(process\.env\.ARCHFLOW_HEALTH_IMAGE_SLOTS\)/)
  assert.match(script, /const CANARY_PNG_BASE64 = /)
  assert.doesNotMatch(script, /iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB/)
  assert.match(script, /No people, no text, and no logos\./)
  assert.doesNotMatch(script, /case-thumbnails\/tank-shanghai\.jpg/)
  assert.match(script, /action: 'image-task-status'/)
  assert.match(script, /imageSize: '1024x1024'/)
  assert.match(script, /disableFailover: true/)
  assert.match(script, /function transientSupplierFailure/)
  assert.match(script, /上游\\s\*5\\d\\d/)
  assert.match(script, /status: transient \? 'degraded' : 'fail'/)
  assert.match(script, /classification: transient \? 'supplier_transient' : 'deterministic_failure'/)
  assert.match(script, /recentUserSuccess: recentUserSuccesses\[selectedSlot\] \|\| null/)
  assert.match(script, /canary_missing_final_image/)
  assert.match(script, /actualSlot === selectedSlot \? 'pass' : 'degraded'/)
  assert.match(script, /if \(payload\.ok !== true\) throw new Error\('operational_health_failed'\)/)
  assert.match(script, /if \(failed\.length\) process\.exitCode = 1/)
  assert.doesNotMatch(script, /if \(failed\.length \|\| degraded\.length\) process\.exitCode = 1/)
})
test('生产巡检由十八小时 Codex 自动运维单一调度并为真实成图预留足够时间', () => {
  assert.match(workflow, /workflow_dispatch:/)
  assert.match(workflow, /image_slots:/)
  assert.match(workflow, /ARCHFLOW_HEALTH_IMAGE_SLOTS: \$\{\{ inputs\.image_slots \|\| 'image1,image2' \}\}/)
  assert.doesNotMatch(workflow, /^\s*schedule:/m)
  assert.match(workflow, /timeout-minutes: 25/)
  assert.match(workflow, /set -o pipefail/)
  assert.match(workflow, /Open or update one incident issue/)
})
