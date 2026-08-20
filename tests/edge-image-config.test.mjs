import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../supabase/functions/generate/index.ts', import.meta.url), 'utf8')

test('第二路 NewAPI 使用独立密钥、模型和 OpenAI 图生图协议', () => {
  assert.match(source, /return env\('ARCHFLOW_IMAGE_2_MODEL'\) \|\| 'git2图gemini'/)
  assert.match(source, /env\('git2图gemini'\)/)
  assert.match(source, /slot === 'image1' \? 'auto' : 'openai'/)
  assert.match(source, /: 'https:\/\/img\.yunfei\.best'/)
  assert.doesNotMatch(source, /env\('gemini香蕉'\)/)
})
