import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../src/lib/supabase.js', import.meta.url), 'utf8')

test('浏览器在云端生图前把参考图标准化为最大 2048 像素 JPEG', () => {
  assert.match(source, /const maxDimension = 2048/)
  assert.match(source, /Math\.min\(1, maxDimension \/ Math\.max\(bitmap\.width, bitmap\.height\)\)/)
  assert.match(source, /context\.fillStyle = '#ffffff'/)
  assert.match(source, /'image\/jpeg',\s*0\.92/)
})

test('供应商切换后轮询使用服务端返回的实际生图槽位', () => {
  const initialRequest = source.match(/const request = \{[\s\S]*?\n  \}/)?.[0] || ''
  const pollingRequest = source.match(/waitForImageTask\(initialResult,[\s\S]*?\n  \}\)\)/)?.[0] || ''
  assert.match(initialRequest, /\n    imageSlot,\n/)
  assert.doesNotMatch(initialRequest, /task\.imageSlot/)
  assert.match(pollingRequest, /imageSlot: task\.imageSlot \|\| imageSlot/)
  assert.match(pollingRequest, /imageSize: options\.imageSize/)
})
