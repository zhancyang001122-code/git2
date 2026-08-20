import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../supabase/functions/generate/index.ts', import.meta.url), 'utf8')

test('第二路 NewAPI 使用独立密钥、模型和 OpenAI 图生图协议', () => {
  assert.match(source, /env\('git2图gemini'\)/)
  assert.match(source, /model: 'git2图gemini'/)
  assert.match(source, /protocol: 'openai'/)
  assert.match(source, /baseUrl: 'https:\/\/img\.yunfei\.best'/)
  assert.doesNotMatch(source, /env\('gemini香蕉'\)/)
})

test('按 ARCHFLOW_IMAGE_N_* 自动发现后续生图 API', () => {
  assert.match(source, /Object\.keys\(Deno\.env\.toObject\(\)\)/)
  assert.match(source, /ARCHFLOW_IMAGE_\(\[1-9\]\\d\*\)_/)
  assert.match(source, /API_KEY_SECRET/)
  assert.match(source, /\.map\(\(slotNumber\) => imageConfig\(`image\$\{slotNumber\}`\)\)/)
  assert.match(source, /normalizeImageSlot\(body\.imageSlot\)/)
})

test('连接检测只报告状态，不再隐藏检测异常的模型', () => {
  assert.match(source, /connectionStatus: connection\.status/)
  assert.match(source, /connectionMessage: imageConnectionMessage\(connection\)/)
  assert.match(source, /imageModes: configuredImages\.map/)
  assert.doesNotMatch(source, /configuredImages\.filter\(\(_config, index\) => imageConnections\[index\]\)/)
})
