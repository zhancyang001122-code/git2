import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const script = await readFile(new URL('../scripts/health-check.mjs', import.meta.url), 'utf8')
const workflow = await readFile(new URL('../.github/workflows/health-check.yml', import.meta.url), 'utf8')

test('生产巡检会对两路生图执行真实图片生成并验证最终图片', () => {
  assert.match(script, /for \(const selectedSlot of \['image1', 'image2'\]\)/)
  assert.match(script, /case-thumbnails\/tank-shanghai\.jpg/)
  assert.match(script, /action: 'image-task-status'/)
  assert.match(script, /canary_missing_final_image/)
  assert.match(script, /actualSlot === selectedSlot \? 'pass' : 'degraded'/)
})

test('生产巡检每六小时运行并为真实成图预留足够时间', () => {
  assert.match(workflow, /cron: '0 \*\/6 \* \* \*'/)
  assert.match(workflow, /timeout-minutes: 25/)
  assert.match(workflow, /set -o pipefail/)
  assert.match(workflow, /Open or update one incident issue/)
})
