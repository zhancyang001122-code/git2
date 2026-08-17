import assert from 'node:assert/strict'
import { File } from 'node:buffer'
import test from 'node:test'
import { checkModelConnection, createAssetRecord, generateWithApi } from '../src/data.js'

let activeConfig = {}
globalThis.window = {
  sessionStorage: {
    getItem: () => JSON.stringify(activeConfig),
  },
  setTimeout,
  clearTimeout,
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
  llmProvider: 'bailian',
  llmModel: 'qwen-plus',
  llmApiKey: 'test-language-key',
  imageProvider: 'yunfei',
  imageModel: 'gpt-image-2',
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
  assert.equal(request.url, 'https://ws-g9wsij6srpylaed0.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions')
  const payload = JSON.parse(request.options.body)
  assert.equal(payload.model, 'qwen-plus')
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
  assert.equal(request.url, 'https://img.yunfei.best/v1/images/edits')
  assert.equal(request.options.body.get('model'), 'gpt-image-2')
  assert.equal(request.options.body.get('n'), '1')
  assert.equal(request.options.body.get('response_format'), 'b64_json')
  assert.equal(request.options.body.get('image').name, 'white-model.png')
  assert.equal(result.mode, 'external-image-api')
  assert.equal(result.images.length, 1)
  assert.match(result.images[0].imageUrl, /^data:image\/png;base64,/)
  assert.match(result.originalImageUrl, /^data:image\/png;base64,/)
})

test('官方 OpenAI 配置仍使用官方模型与端点', async () => {
  activeConfig = {
    ...baseConfig,
    llmProvider: 'openai',
    llmModel: 'ignored-custom-model',
  }
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({
          coreConcept: '场地叙事',
          directions: [0, 1, 2].map((index) => ({ title: `方向${index}`, strategy: '策略', keywords: ['场地'] })),
          sharedStrategies: ['开放首层'],
          caseIds: ['panlong'],
        }) } }],
      }),
    }
  }

  const result = await generateWithApi({ feature: 'inspiration', prompt: '文化中心', files: [] })
  assert.equal(request.url, 'https://api.openai.com/v1/chat/completions')
  assert.equal(JSON.parse(request.options.body).model, 'gpt-5-mini')
  assert.equal(result.model, 'gpt-5-mini')
})

test('Gemini 生图协议支持参考图输入与图片响应', async () => {
  activeConfig = {
    ...baseConfig,
    imageProvider: 'gemini',
    imageModel: 'ignored-custom-model',
  }
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'ZmFrZQ==' } }] } }] }),
    }
  }

  const image = new File([new Uint8Array([137, 80, 78, 71])], 'reference.png', { type: 'image/png' })
  const result = await generateWithApi({ feature: 'render', prompt: '暖色夜景', files: [image] })
  assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent')
  assert.equal(request.options.headers['x-goog-api-key'], 'test-image-key')
  assert.match(result.images[0].imageUrl, /^data:image\/png;base64,/)
})

test('应用 Key 使用模型列表验证鉴权与模型可见性', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://img.yunfei.best/v1/models')
    assert.equal(options.headers.Authorization, 'Bearer test-image-key')
    return { ok: true, json: async () => ({ data: [{ id: 'gpt-image-2' }] }) }
  }

  const result = await checkModelConnection('image', {
    provider: 'yunfei',
    model: 'gpt-image-2',
    apiKey: 'test-image-key',
  })
  assert.equal(result.model, 'gpt-image-2')
  assert.match(result.message, /已连接/)
})

test('百炼应用 Key 用最小对话同时验证 Key 与模型名称', async () => {
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'OK' } }] }) }
  }

  const result = await checkModelConnection('language', {
    provider: 'bailian',
    model: 'qwen-plus',
    apiKey: 'test-language-key',
  })
  assert.equal(request.url, 'https://ws-g9wsij6srpylaed0.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions')
  assert.equal(JSON.parse(request.options.body).model, 'qwen-plus')
  assert.equal(result.model, 'qwen-plus')
})

test('百炼数字资源 ID 会在请求前给出可操作提示', async () => {
  globalThis.fetch = async () => assert.fail('数字资源 ID 不应发起请求')

  await assert.rejects(
    checkModelConnection('language', {
      provider: 'bailian',
      model: '6736696',
      apiKey: 'test-language-key',
    }),
    /需要模型名称.*不是.*数字 ID/,
  )
})

test('第三方 NewAPI 的 Gemini 生图模型自动改走原生 Gemini 端点', async () => {
  activeConfig = {
    ...baseConfig,
    imageProvider: 'yunfei',
    imageModel: 'gemini-3.1-flash-image',
  }
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'ZmFrZQ==' } }] } }] }),
    }
  }

  const image = new File([new Uint8Array([137, 80, 78, 71])], 'reference.png', { type: 'image/png' })
  const result = await generateWithApi({ feature: 'render', prompt: '滨水夜景', files: [image] })
  assert.equal(request.url, 'https://img.yunfei.best/v1beta/models/gemini-3.1-flash-image:generateContent')
  assert.equal(request.options.headers.Authorization, 'Bearer test-image-key')
  assert.match(result.images[0].imageUrl, /^data:image\/png;base64,/)
})

test('保存 AI 渲染结果时真实图片随资产保留在当前会话', () => {
  const asset = createAssetRecord(
    { id: 'render', nav: 'AI 渲染' },
    '滨水入口蓝调时刻',
    { model: 'gpt-image-2', images: [1, 2, 3, 4].map((id) => ({ id, title: `真实生成 · 视角 ${id}`, meta: '2K', imageUrl: `data:image/png;base64,ZmFrZQ${id}==` })) },
    1001,
  )
  assert.equal(asset.id, 1001)
  assert.equal(asset.files, 3)
  assert.equal(asset.sessionOnly, true)
  assert.equal(asset.artifacts.length, 3)
  assert.equal(asset.artifacts[0].imageUrl, 'data:image/png;base64,ZmFrZQ1==')
})
