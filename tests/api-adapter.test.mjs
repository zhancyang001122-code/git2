import assert from 'node:assert/strict'
import { File } from 'node:buffer'
import test from 'node:test'
import { generateWithApi } from '../src/data.js'

let activeConfig = {}
globalThis.window = {
  sessionStorage: {
    getItem: () => JSON.stringify(activeConfig),
  },
  setTimeout,
}
globalThis.FileReader = class FileReader {
  readAsDataURL(file) {
    file.arrayBuffer().then((buffer) => {
      this.result = `data:${file.type};base64,${Buffer.from(buffer).toString('base64')}`
      this.onload?.()
    }).catch((error) => this.onerror?.(error))
  }
}

const baseConfig = {
  enabled: true,
  llmApiKey: 'test-language-key',
  imageApiKey: 'test-image-key',
}

test('方案灵感使用语言模型结构化结果', async () => {
  activeConfig = baseConfig
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          coreConcept: '滨水公共客厅',
          directions: [
            { title: '水巷', subtitle: 'Water Alley', strategy: '串联水岸空间', keywords: ['水巷', '公共性'] },
            { title: '浮岛', subtitle: 'Floating Blocks', strategy: '拆分复合体量', keywords: ['浮岛', '弹性'] },
            { title: '剧场', subtitle: 'Tidal Theater', strategy: '建立滨水台阶', keywords: ['剧场', '潮汐'] },
          ],
          sharedStrategies: ['开放首层', '保留结构', '串联水岸'],
          caseIds: ['panlong', 'tank', 'longmuseum'],
        }) } }],
      }),
    }
  }

  const result = await generateWithApi({ feature: 'inspiration', prompt: '滨水文化中心', files: [] })
  assert.equal(request.url, 'https://api.openai.com/v1/chat/completions')
  const payload = JSON.parse(request.options.body)
  assert.equal(payload.model, 'gpt-5-mini')
  assert.equal('temperature' in payload, false)
  assert.equal(result.mode, 'external-language-api')
  assert.equal(result.structured.directions.length, 3)
  assert.deepEqual(result.structured.caseIds, ['panlong', 'tank', 'longmuseum'])
})

test('方案设计返回三套可比较方案', async () => {
  activeConfig = baseConfig
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify({
        schemes: ['环院', '双塔', '梯田'].map((name, index) => ({
          name,
          far: `FAR 2.${index + 3}`,
          description: `${name}空间策略`,
          pros: '清晰 / 可实施',
          metrics: { openRate: `${40 + index}%`, efficiency: `${80 + index}%`, complexity: '中', recommendation: '可推进' },
        })),
      }) } }],
    }),
  })

  const result = await generateWithApi({ feature: 'design', prompt: '企业总部', files: [] })
  assert.equal(result.mode, 'external-language-api')
  assert.deepEqual(result.structured.schemes.map((scheme) => scheme.id), ['A', 'B', 'C'])
  assert.equal(result.structured.schemes[1].name, '双塔')
})

test('AI 渲染使用单张图生图接口并返回原图对比数据', async () => {
  activeConfig = baseConfig
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return {
      ok: true,
      json: async () => ({ data: [{ b64_json: 'ZmFrZS1pbWFnZQ==' }] }),
    }
  }

  const image = new File([new Uint8Array([137, 80, 78, 71])], 'white-model.png', { type: 'image/png' })
  const result = await generateWithApi({ feature: 'render', prompt: '蓝调时刻', files: [image] })
  assert.equal(request.url, 'https://api.openai.com/v1/images/edits')
  assert.equal(request.options.body.get('model'), 'gpt-image-2')
  assert.equal(request.options.body.get('n'), '1')
  assert.equal(request.options.body.get('image').name, 'white-model.png')
  assert.equal(result.mode, 'external-image-api')
  assert.equal(result.images.length, 1)
  assert.match(result.images[0].imageUrl, /^data:image\/png;base64,/)
  assert.match(result.originalImageUrl, /^data:image\/png;base64,/)
})
