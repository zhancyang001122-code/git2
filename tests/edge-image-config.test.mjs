import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../supabase/functions/generate/index.ts', import.meta.url), 'utf8')

test('第二路 NewAPI 使用独立密钥、真实模型和 Gemini 原生图生图协议', () => {
  assert.match(source, /env\('git2图gemini'\)/)
  assert.match(source, /model: 'gemini-3-pro-image-preview'/)
  assert.match(source, /protocol: 'gemini'/)
  assert.match(source, /baseUrl: 'https:\/\/img\.yunfei\.best'/)
  assert.doesNotMatch(source, /env\('gemini香蕉'\)/)
})

test('Gemini 图生图按服务商协议发送角色、参考图和可选原图比例', () => {
  assert.match(source, /contents: \[\{ role: 'user', parts:/)
  assert.match(source, /inline_data: \{ mime_type: attachment\.mimeType, data: attachment\.data \}/)
  assert.match(source, /if \(aspectRatio\) imageConfigPayload\.aspectRatio = aspectRatio/)
  assert.match(source, /supportsOriginalRatio: true/)
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
  assert.match(source, /availableModels: connection\.availableModels \|\| \[\]/)
  assert.match(source, /配置的模型 ID 不存在/)
  assert.match(source, /imageModes: configuredImages\.map/)
  assert.doesNotMatch(source, /configuredImages\.filter\(\(_config, index\) => imageConnections\[index\]\)/)
})

test('损坏的 UTF-8 标签回退到内置可读名称', () => {
  assert.match(source, /function readableLabel/)
  assert.match(source, /!value\.includes\('\\uFFFD'\)/)
})

test('上游生图错误保留真实原因并映射网关状态', () => {
  assert.match(source, /图生图服务请求失败（上游 \$\{response\.status\}）/)
  assert.match(source, /response\.status >= 500 \? 502 : 400/)
})
