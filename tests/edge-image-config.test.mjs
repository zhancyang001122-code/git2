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
  assert.match(source, /inlineData: \{ mimeType: attachment\.mimeType, data: attachment\.data \}/)
  assert.doesNotMatch(source, /\{ inline_data: \{ mime_type: attachment\.mimeType/)
  assert.match(source, /if \(aspectRatio\) imageConfigPayload\.aspectRatio = aspectRatio/)
  assert.match(source, /supportsOriginalRatio: true/)
})

test('生产健康检查以最小无敏感图片验证 Gemini 请求协议', () => {
  assert.match(source, /HEALTH_CHECK_PNG_BASE64/)
  assert.match(source, /geminiGenerationPayload\([\s\S]*?responseMode: 'url', size: '1K'/)
  assert.match(source, /appMetadata\?\.role !== 'health_monitor'/)
  assert.match(source, /body\.action === 'health'/)
  assert.match(source, /protocolChecks\.every\(\(check\) => check\.connected\)/)
})

test('第二路 4K Gemini 使用 URL 响应，避免 Edge Function 承载超大 base64', () => {
  assert.match(source, /responseMode: 'url'/)
  assert.match(source, /ARCHFLOW_IMAGE_\(\[1-9\]\\d\*\)_\(\?:LABEL\|BASE_URL\|MODEL\|API_KEY\|API_KEY_SECRET\|PROTOCOL\|RESPONSE_MODE/)
  assert.match(source, /responseModalities: \[config\.responseMode === 'url' \? 'TEXT' : 'IMAGE'\]/)
  assert.match(source, /part\.fileData \|\| part\.file_data/)
  assert.match(source, /fileData\?\.fileUri \|\| fileData\?\.file_uri/)
})

test('长耗时 4K 请求转为服务端后台任务并由前端轮询', () => {
  assert.match(source, /createManagedImageTask\(user\.id, slot\)/)
  assert.match(source, /EdgeRuntime\.waitUntil\(runManagedGeminiTask/)
  assert.match(source, /image_generation_tasks/)
  assert.match(source, /const managedTask = await managedImageTask\(taskId, user\.id\)/)
  assert.match(source, /managedTask\.status === 'completed'/)
  assert.match(source, /managedTask\.status === 'failed'/)
  assert.match(source, /expires_at=lt\./)
})

test('CORS 允许当前 Supabase 客户端的重试与链路追踪请求头', () => {
  assert.match(source, /x-retry-count, traceparent, tracestate, baggage/)
  assert.match(source, /GET, POST, PUT, PATCH, DELETE, OPTIONS/)
  assert.match(source, /req\.headers\.get\('Access-Control-Request-Headers'\)/)
  assert.match(source, /headers: preflightCorsHeaders\(req\)/)
  assert.match(source, /Access-Control-Allow-Credentials': 'true'/)
  assert.match(source, /Access-Control-Request-Private-Network/)
  assert.match(source, /origin === 'https:\/\/archflow\.zaneyang\.xyz'/)
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

test('远程生成图通过带用户签名的 Edge Function 写入私有资产桶', () => {
  assert.match(source, /action === 'persist-artifact'/)
  assert.match(source, /signRemoteArtifact\(imageUrl, userId\)/)
  assert.match(source, /authorizeRemoteArtifact\(imageUrl, user\.id, assetToken\)/)
  assert.match(source, /image_url=eq\.\$\{encodeURIComponent\(imageUrl\)\}/)
  assert.match(source, /storagePath = `\$\{user\.id\}\/\$\{packageId\}\/\$\{fileName\}`/)
  assert.match(source, /'x-upsert': 'true'/)
  assert.match(source, /ASSET_MAX_BYTES = 40 \* 1024 \* 1024/)
})
