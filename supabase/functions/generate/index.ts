import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type Attachment = { name: string; mimeType: string; data: string }

type ImageConfig = {
  id: 'image1' | 'image2'
  label: string
  baseUrl: string
  model: string
  apiKey: string
  protocol: string
  size: string
}

class HttpError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function env(name: string) {
  return (Deno.env.get(name) || '').trim()
}

function languageConfig() {
  return {
    baseUrl: env('ARCHFLOW_LLM_BASE_URL') || 'https://ws-g9wsij6srpylaed0.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
    model: env('ARCHFLOW_LLM_MODEL') || 'qwen3.7-plus',
    apiKey: env('ARCHFLOW_LLM_API_KEY'),
  }
}

function imageConfig(slot: 'image1' | 'image2'): ImageConfig {
  const prefix = slot === 'image1' ? 'ARCHFLOW_IMAGE_1' : 'ARCHFLOW_IMAGE_2'
  return {
    id: slot,
    label: env(`${prefix}_LABEL`) || (slot === 'image1' ? '第三方生图服务' : '内置生图 API 2'),
    baseUrl: env(`${prefix}_BASE_URL`) || (slot === 'image1' ? 'https://img.yunfei.best' : ''),
    model: env(`${prefix}_MODEL`) || (slot === 'image1' ? 'gpt-image-2' : ''),
    apiKey: env(`${prefix}_API_KEY`),
    protocol: env(`${prefix}_PROTOCOL`) || 'auto',
    size: env(`${prefix}_SIZE`) || '1536x1024',
  }
}

function isReady(config: { baseUrl: string; model: string; apiKey: string }) {
  return Boolean(config.baseUrl && config.model && config.apiKey)
}

async function requireAuthenticatedUser(req: Request) {
  const authorization = req.headers.get('Authorization') || ''
  const supabaseUrl = env('SUPABASE_URL')
  const anonKey = env('SUPABASE_ANON_KEY')
  if (!authorization.startsWith('Bearer ') || !supabaseUrl || !anonKey) {
    throw new HttpError('请先登录内部账户。', 401)
  }
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: authorization, apikey: anonKey },
  })
  if (!response.ok) throw new HttpError('登录状态无效或已过期，请重新登录。', 401)
  const user = await response.json()
  if (!user?.id) throw new HttpError('无法验证当前用户。', 401)
  return user
}

function capabilities() {
  const llm = languageConfig()
  const images = [imageConfig('image1'), imageConfig('image2')].filter(isReady)
  return {
    languageReady: isReady(llm),
    languageModel: isReady(llm) ? llm.model : null,
    imageModes: images.map(({ id, label, model }) => ({ id, label, model })),
  }
}

function extractJson(content: string) {
  const cleaned = String(content || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('语言模型没有返回可解析的结构化 JSON。')
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    throw new Error('语言模型返回的 JSON 格式不完整，请重新生成。')
  }
}

function validateStructuredResult(feature: string, data: Record<string, unknown>) {
  if (feature === 'inspiration') {
    const directions = Array.isArray(data.directions) ? data.directions : []
    const sharedStrategies = Array.isArray(data.sharedStrategies) ? data.sharedStrategies : []
    if (directions.length < 3 || sharedStrategies.length < 3) throw new Error('方案灵感结果缺少三条设计方向或共同空间策略。')
    const verifiedCases = ['panlong', 'tank', 'longmuseum']
    return {
      coreConcept: String(data.coreConcept || '场地驱动的公共空间'),
      directions: directions.slice(0, 3).map((raw, index) => {
        const item = raw as Record<string, unknown>
        return {
          code: ['A', 'B', 'C'][index],
          title: String(item.title || `设计方向 ${index + 1}`),
          subtitle: String(item.subtitle || 'Design Direction'),
          strategy: String(item.strategy || ''),
          keywords: Array.isArray(item.keywords) ? item.keywords.slice(0, 4).map(String) : [],
        }
      }),
      sharedStrategies: sharedStrategies.slice(0, 4).map(String),
      caseIds: Array.isArray(data.caseIds)
        ? data.caseIds.map(String).filter((id) => verifiedCases.includes(id)).slice(0, 3)
        : verifiedCases,
    }
  }

  const schemes = Array.isArray(data.schemes) ? data.schemes : []
  if (schemes.length < 3) throw new Error('方案设计结果缺少 A / B / C 三套可比较方案。')
  return {
    schemes: schemes.slice(0, 3).map((raw, index) => {
      const item = raw as Record<string, unknown>
      const metrics = (item.metrics || {}) as Record<string, unknown>
      return {
        id: ['A', 'B', 'C'][index],
        name: String(item.name || `方案 ${index + 1}`),
        far: String(item.far || '待测算'),
        description: String(item.description || ''),
        pros: String(item.pros || ''),
        metrics: {
          openRate: String(metrics.openRate || '待测算'),
          efficiency: String(metrics.efficiency || '待测算'),
          complexity: String(metrics.complexity || '待评估'),
          recommendation: String(metrics.recommendation || '待比选'),
        },
      }
    }),
  }
}

function structuredPrompt(feature: string) {
  if (feature === 'inspiration') {
    return `你是资深建筑设计总监。输出必须是严格 JSON，不要 Markdown，不要解释。结构如下：
{"coreConcept":"10字以内核心概念","directions":[{"title":"中文方向名","subtitle":"英文副标题","strategy":"80字内空间策略","keywords":["关键词1","关键词2","关键词3"]},{},{}],"sharedStrategies":["策略1","策略2","策略3"],"caseIds":["panlong","tank","longmuseum"]}
必须给出三条逻辑明显不同且可落地的方向。案例只能从 panlong、tank、longmuseum 三个已审核案例中选择，不得编造网址。`
  }
  return `你是资深建筑方案设计总监。输出必须是严格 JSON，不要 Markdown，不要解释。结构如下：
{"schemes":[{"name":"中文方案名","far":"如 FAR 2.42","description":"80字内空间与功能策略","pros":"两项核心优势，用 / 分隔","metrics":{"openRate":"百分比","efficiency":"百分比","complexity":"低/中/高","recommendation":"10字内结论"}},{},{}]}
必须给出 A / B / C 三套体量与组织逻辑明显不同的可比较方案，指标应彼此合理且不完全相同。`
}

function imageDataUrl(attachment: Attachment) {
  return `data:${attachment.mimeType || 'image/png'};base64,${attachment.data}`
}

async function generateStructured(body: Record<string, unknown>) {
  const config = languageConfig()
  if (!isReady(config)) throw new Error('内部语言模型尚未完成服务端配置。')
  const feature = String(body.feature || '')
  if (!['inspiration', 'design'].includes(feature)) throw new Error('当前功能未开放真实语言模型生成。')
  const attachments = (Array.isArray(body.attachments) ? body.attachments : []) as Attachment[]
  const fileNames = Array.isArray(body.fileNames) ? body.fileNames.map(String) : []
  const userContent = [
    {
      type: 'text',
      text: `${String(body.prompt || '')}\n\n本次临时附件：${fileNames.join('、') || '无'}\n请结合附件图像中的场地、体量或空间信息作答。`,
    },
    ...attachments.slice(0, 2).map((item) => ({
      type: 'image_url',
      image_url: { url: imageDataUrl(item), detail: 'auto' },
    })),
  ]
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: structuredPrompt(feature) },
        { role: 'user', content: userContent },
      ],
    }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`语言模型 API ${response.status}: ${detail.slice(0, 180)}`)
  }
  const payload = await response.json()
  const content = payload.choices?.[0]?.message?.content || ''
  return {
    id: `${feature}-${Date.now()}`,
    feature,
    prompt: body.prompt,
    fileNames,
    createdAt: new Date().toISOString(),
    mode: 'managed-language-api',
    model: config.model,
    content,
    structured: validateStructuredResult(feature, extractJson(content)),
  }
}

function decodeBase64(data: string) {
  const binary = atob(data)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function encodeBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function rootWithoutApiVersion(baseUrl: string) {
  return baseUrl.replace(/\/$/, '').replace(/\/(v1|v1beta)$/i, '')
}

function looksLikeGemini(model: string) {
  return /gemini/i.test(model)
}

async function generateImage(body: Record<string, unknown>) {
  const slot = body.imageSlot === 'image2' ? 'image2' : 'image1'
  const config = imageConfig(slot)
  if (!isReady(config)) throw new Error(`${config.label} 尚未完成服务端配置。`)
  const attachment = ((Array.isArray(body.attachments) ? body.attachments : []) as Attachment[])[0]
  if (!attachment?.data) throw new Error('AI 渲染需要先上传一张白模或原始效果图。')
  const originalImageUrl = imageDataUrl(attachment)
  const prompt = `专业建筑可视化效果图。严格保留原始建筑主体、体量关系、相机视角和构图，只根据以下要求改善材质、景观、灯光与氛围：${String(body.prompt || '')}。输出必须是一张连续、完整、清晰的画面；禁止水平条纹、扫描线、重复切片、错位拼接、重影、色带、画面撕裂或压缩伪影，不得复制或错位任何图像区域。画面克制、真实、可用于建筑方案汇报，不添加文字或水印。`
  const useGemini = config.protocol === 'gemini' || (config.protocol === 'auto' && looksLikeGemini(config.model))
  let imageUrl = ''

  if (useGemini) {
    const base = rootWithoutApiVersion(config.baseUrl)
    const response = await fetch(`${base}/v1beta/models/${encodeURIComponent(config.model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        contents: [{ parts: [
          { inlineData: { mimeType: attachment.mimeType, data: attachment.data } },
          { text: prompt },
        ] }],
        generationConfig: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: '16:9', imageSize: '2K' },
        },
      }),
    })
    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`Gemini 生图 API ${response.status}: ${detail.slice(0, 180)}`)
    }
    const payload = await response.json()
    const parts = payload.candidates?.[0]?.content?.parts || []
    const imagePart = parts.find((part: Record<string, unknown>) => part.inlineData || part.inline_data)
    const inlineData = imagePart?.inlineData || imagePart?.inline_data
    if (!inlineData?.data) throw new Error('Gemini API 已响应，但没有返回可显示的图片。')
    imageUrl = `data:${inlineData.mimeType || inlineData.mime_type || 'image/png'};base64,${inlineData.data}`
  } else {
    const form = new FormData()
    const bytes = decodeBase64(attachment.data)
    form.append('model', config.model)
    form.append('prompt', prompt)
    form.append('image', new Blob([bytes], { type: attachment.mimeType }), attachment.name || 'reference.png')
    form.append('n', '1')
    form.append('size', config.size)
    form.append('response_format', 'b64_json')
    const endpoint = `${rootWithoutApiVersion(config.baseUrl)}/v1/images/edits`
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: form,
    })
    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`图生图 API ${response.status}: ${detail.slice(0, 180)}`)
    }
    const payload = await response.json()
    const item = payload.data?.[0]
    if (item?.b64_json) {
      imageUrl = `data:image/png;base64,${item.b64_json}`
    } else if (item?.url) {
      const imageResponse = await fetch(item.url)
      if (!imageResponse.ok) throw new Error(`生成图下载失败（${imageResponse.status}）。`)
      const bytes = new Uint8Array(await imageResponse.arrayBuffer())
      imageUrl = `data:${imageResponse.headers.get('content-type') || 'image/png'};base64,${encodeBase64(bytes)}`
    }
    if (!imageUrl) throw new Error('图像 API 已响应，但没有返回可显示的图片。')
  }

  return {
    id: `render-${Date.now()}`,
    feature: 'render',
    prompt: body.prompt,
    fileNames: Array.isArray(body.fileNames) ? body.fileNames : [],
    createdAt: new Date().toISOString(),
    mode: 'managed-image-api',
    model: config.model,
    originalImageUrl,
    images: [{ id: 1, title: '真实生成 · 主视角', meta: `${config.model} · ${config.size}`, imageUrl }],
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    await requireAuthenticatedUser(req)
    const body = await req.json()
    if (body.action === 'capabilities') return json(capabilities())
    const feature = String(body.feature || '')
    if (feature === 'render') return json(await generateImage(body))
    return json(await generateStructured(body))
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成服务发生未知错误。'
    return json({ error: message }, error instanceof HttpError ? error.status : 400)
  }
})
