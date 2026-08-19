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
  quality: string
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
    apiKey: env('ARCHFLOW_LLM_API_KEY') || env('百炼keygit2内部1'),
  }
}

function secondImageModel() {
  const explicitImageModel = env('ARCHFLOW_IMAGE_2_MODEL') || env('GEMINI_IMAGE_MODEL')
  if (explicitImageModel) return explicitImageModel

  const genericGeminiModel = env('GEMINI_MODEL')
  // gemini-3-pro-preview was a text-output model and is no longer available.
  // Keep common Gemini CLI environment names usable while selecting the
  // image-capable Nano Banana Pro model required by this function.
  if (!genericGeminiModel || genericGeminiModel === 'gemini-3-pro-preview') return 'gemini-3-pro-image-preview'
  return genericGeminiModel
}

function imageConfig(slot: 'image1' | 'image2'): ImageConfig {
  const prefix = slot === 'image1' ? 'ARCHFLOW_IMAGE_1' : 'ARCHFLOW_IMAGE_2'
  return {
    id: slot,
    label: env(`${prefix}_LABEL`) || (slot === 'image1' ? '第三方生图服务' : 'Gemini 香蕉'),
    baseUrl: env(`${prefix}_BASE_URL`) || (slot === 'image1'
      ? 'https://img.yunfei.best'
      : env('GOOGLE_GEMINI_BASE_URL') || 'https://api.uselg.top'),
    model: slot === 'image1'
      ? env(`${prefix}_MODEL`) || 'gpt-image-2'
      : secondImageModel(),
    apiKey: env(`${prefix}_API_KEY`) || (slot === 'image1'
      ? env('生图api 4k')
      : env('GEMINI_API_KEY') || env('GOOGLE_API_KEY')),
    protocol: env(`${prefix}_PROTOCOL`) || (slot === 'image1' ? 'auto' : 'gemini'),
    size: env(`${prefix}_SIZE`) || '4K',
    quality: env(`${prefix}_QUALITY`) || 'high',
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

async function checkLanguageConnection(config: ReturnType<typeof languageConfig>) {
  if (!isReady(config)) return false
  try {
    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: '仅回复 OK' }],
        max_tokens: 1,
        stream: false,
      }),
    })
    return response.ok
  } catch {
    return false
  }
}

async function checkImageConnection(config: ImageConfig) {
  if (!isReady(config)) return false
  try {
    const useNativeGeminiListing = config.protocol === 'gemini'
    const endpoint = useNativeGeminiListing
      ? `${rootWithoutApiVersion(config.baseUrl)}/v1beta/models`
      : `${rootWithoutApiVersion(config.baseUrl)}/v1/models`
    const response = await fetch(endpoint, {
      headers: useNativeGeminiListing
        ? { Authorization: `Bearer ${config.apiKey}`, 'x-goog-api-key': config.apiKey }
        : { Authorization: `Bearer ${config.apiKey}` },
    })
    if (!response.ok) return false
    const payload = await response.json()
    const modelIds = Array.isArray(payload.data)
      ? payload.data.map((item: Record<string, unknown>) => String(item.id || '')).filter(Boolean)
      : Array.isArray(payload.models)
        ? payload.models.map((item: Record<string, unknown>) => String(item.name || '').replace(/^models\//, '')).filter(Boolean)
        : []
    return modelIds.length === 0 || modelIds.includes(config.model)
  } catch {
    return false
  }
}

async function capabilities() {
  const llm = languageConfig()
  const configuredImages = [imageConfig('image1'), imageConfig('image2')]
  const [languageReady, ...imageConnections] = await Promise.all([
    checkLanguageConnection(llm),
    ...configuredImages.map(checkImageConnection),
  ])
  const images = configuredImages.filter((_config, index) => imageConnections[index])
  return {
    languageReady,
    languageModel: languageReady ? llm.model : null,
    imageModes: images.map((config) => {
      const usesGeminiSizing = config.protocol === 'gemini' || (config.protocol === 'auto' && looksLikeGemini(config.model))
      return {
        id: config.id,
        label: config.label,
        model: config.model,
        maxSize: '4K',
        supportsCustomSize: !usesGeminiSizing,
      }
    }),
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
    return `你是同时具备建筑设计总监、方案主创建筑师与施工图审查负责人经验的专业建筑顾问。你的任务是把输入转译为可进入真实方案讨论的设计判断，不是生成空泛概念文案。

专业工作准则：
1. 先识别项目类型、场地矛盾、规模、使用者、气候、城市界面与既有条件，再提出策略。
2. 每个方向必须说明具体空间动作，并至少覆盖体量组织、公共空间或流线、场地/气候响应中的三项；避免“融合、赋能、打造”等无动作支撑的套话。
3. 用户明确提供的条件视为事实；合理推断必须保持克制；缺失的规范、尺寸、容积率或工程数据不得编造。
4. 三个方向必须在空间原型和组织逻辑上真正不同，而不是只更换名称。
5. 语言准确、简洁、符合建筑师汇报语境，结论应能被画成草图并继续深化。
6. 案例只能从 panlong、tank、longmuseum 三个已审核案例中选择，不得编造项目、年份或网址。

输出必须是严格 JSON，不要 Markdown，不要解释，不要输出结构之外的字段。结构如下：
{"coreConcept":"10字以内核心概念","directions":[{"title":"中文方向名","subtitle":"英文副标题","strategy":"80字内空间策略","keywords":["关键词1","关键词2","关键词3"]},{},{}],"sharedStrategies":["策略1","策略2","策略3"],"caseIds":["panlong","tank","longmuseum"]}
每条 strategy 使用完整专业句，清楚写出“针对什么问题—采取什么空间动作—产生什么结果”；sharedStrategies 应是三条方向均需遵守的场地、流线、气候或建造底线。`
  }
  return `你是同时具备建筑设计总监、方案主创建筑师与施工图审查负责人经验的专业建筑顾问。你需要给出能进入方案评审的 A / B / C 比选，不是概念口号。

专业工作准则：
1. 先核对用地、规模、功能、交通、消防、日照、限高、分期与成本信息；输入未提供的数据不得伪造。
2. 三套方案必须分别建立不同的体量拓扑、功能组织、首层公共性与交通逻辑，并说明其适用条件和代价。
3. 数值只能基于用户已给条件做推导；无法核算时使用“待测算”或“待校核”，不得制造看似精确的指标。
4. 从建筑、结构、机电、消防疏散、幕墙/材料、运营与建造复杂度角度检查明显矛盾，但不要在缺少属地规范时声称“已合规”。
5. 语言应准确、克制、可执行，优先表达空间关系、尺度逻辑和决策依据，避免空泛营销措辞。

输出必须是严格 JSON，不要 Markdown，不要解释，不要输出结构之外的字段。结构如下：
{"schemes":[{"name":"中文方案名","far":"如 FAR 2.42","description":"80字内空间与功能策略","pros":"两项核心优势，用 / 分隔","metrics":{"openRate":"百分比","efficiency":"百分比","complexity":"低/中/高","recommendation":"10字内结论"}},{},{}]}
description 必须说明体量、功能、流线和公共空间中的至少三项；recommendation 写清适用场景或首要风险。`
}

function imagePrompt(feature: string, userPrompt: string) {
  const shared = `\n\n通用质量标准：以用户上传图像为唯一几何依据，输出单张连续完整画面；最高细节、清晰锐利边缘、准确尺度、无压缩损失的专业交付品质。禁止水平条纹、扫描线、重复切片、错位拼接、重影、色带、画面撕裂、局部复制、几何融化、模糊文字、乱码、签名、Logo、水印和边框。不得裁切关键主体。用户补充要求：${userPrompt}`
  if (feature === 'beautify') {
    return `你是建筑制图总监与审图负责人，正在对一张建筑图纸做“只提升表达、不改变设计”的高保真图生图编辑。

强制保留：原图全部几何边界、轴网、墙体、柱网、门窗、道路、等高线、尺寸、标高、索引、文字、图名、指北针、比例尺及其位置与内容；不新增、不删除、不移动、不改写任何设计信息。
表达优化：建立清楚的线宽层级和空间图底关系；建筑实体、公共空间、道路、绿地和水体使用克制且可区分的低饱和配色；阴影方向统一、深浅适度；保持正投影、平面制图语言和白底洁净感。文字必须保持原样且清晰可读，不生成伪文字。
禁止：透视化、摄影化、改变平面功能、重画建筑轮廓、增减景观构筑物、移动标注、过度纹理、强渐变、插画滤镜或竞赛图式的无意义装饰。${shared}`
  }
  return `你是国际建筑可视化总监与建筑审图负责人，正在把白模或原始效果图提升为可用于方案评审的高保真建筑表现图。

几何锁定：严格保持建筑轮廓、体量层级、层数、开间、门窗洞口、屋面、结构节奏、场地边界、地平线、消失点、相机高度、焦距感、视角与构图；不得擅自增减楼层、改变立面比例、扭曲竖向线或移动主体。
专业表现：材质符合真实构造与尺度，反射和粗糙度物理可信；室内外光照方向一致，曝光与白平衡自然；景观、铺装、车辆和人物只用于表达尺度与使用状态，不遮挡建筑关键界面；细部达到建筑可视化成片标准，画面克制、真实、具有可建造感。
禁止：概念艺术化、过度戏剧灯光、超现实天空、过量人群、错误结构、漂浮物体、重复人物、塑料材质、过度锐化与虚假景深。${shared}`
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
      image_url: { url: imageDataUrl(item), detail: 'high' },
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

function maxGeminiImageSize(model: string) {
  return /gemini-3(?:\.\d+)?-(?:flash|pro)-image/i.test(model) ? '4K' : ''
}

function geminiImageSize(config: ImageConfig) {
  const configuredSize = config.size.toUpperCase()
  return /^(?:1K|2K|4K)$/.test(configuredSize) ? configuredSize : maxGeminiImageSize(config.model) || '4K'
}

function requestedImageSize(value: unknown, fallback: string) {
  const requested = String(value || fallback || '4K').trim().toUpperCase()
  if (/^(?:1K|2K|4K|AUTO)$/.test(requested)) return requested
  const match = requested.match(/^(\d{2,4})X(\d{2,4})$/)
  if (!match) throw new HttpError('图幅尺寸格式无效，请使用“宽x高”，例如 3840x2160。', 400)
  const width = Number(match[1])
  const height = Number(match[2])
  if (width < 64 || height < 64 || width > 4096 || height > 4096) {
    throw new HttpError('自定义图幅的宽和高必须在 64 到 4096 像素之间。', 400)
  }
  return `${width}x${height}`
}

function requestedAspectRatio(value: unknown, fallback: string) {
  const requested = String(value || fallback).trim()
  const supported = new Set(['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '4:5', '5:4', '21:9'])
  return supported.has(requested) ? requested : fallback
}

async function generateImage(body: Record<string, unknown>) {
  const feature = body.feature === 'beautify' ? 'beautify' : 'render'
  const slot = body.imageSlot === 'image2' ? 'image2' : 'image1'
  const config = imageConfig(slot)
  if (!isReady(config)) throw new Error(`${config.label} 尚未完成服务端配置。`)
  const attachment = ((Array.isArray(body.attachments) ? body.attachments : []) as Attachment[])[0]
  if (!attachment?.data) throw new Error(`${feature === 'beautify' ? 'AI 图纸美化' : 'AI 渲染'}需要先上传一张${feature === 'beautify' ? '原始图纸' : '白模或原始效果图'}。`)
  const originalImageUrl = imageDataUrl(attachment)
  const prompt = imagePrompt(feature, String(body.prompt || ''))
  const useGemini = config.protocol === 'gemini' || (config.protocol === 'auto' && looksLikeGemini(config.model))
  const imageSize = requestedImageSize(body.imageSize, config.size)
  const aspectRatio = requestedAspectRatio(body.imageAspectRatio, feature === 'beautify' ? '4:3' : '16:9')
  let imageUrl = ''

  if (useGemini) {
    const base = rootWithoutApiVersion(config.baseUrl)
    const geminiSize = geminiImageSize(config)
    const imageConfigPayload: Record<string, string> = { aspectRatio }
    if (geminiSize) imageConfigPayload.imageSize = geminiSize
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
          imageConfig: imageConfigPayload,
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
    form.append('size', imageSize)
    form.append('quality', config.quality)
    form.append('output_format', 'png')
    form.append('output_compression', '100')
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
    id: `${feature}-${Date.now()}`,
    feature,
    prompt: body.prompt,
    fileNames: Array.isArray(body.fileNames) ? body.fileNames : [],
    createdAt: new Date().toISOString(),
    mode: 'managed-image-api',
    model: config.model,
    originalImageUrl,
    images: [{ id: 1, title: feature === 'beautify' ? '真实生成 · 图纸美化' : '真实生成 · 主视角', meta: `${config.model} · ${useGemini ? `${aspectRatio} · ${geminiImageSize(config) || '模型原生最高分辨率'}` : `${imageSize} · ${config.quality.toUpperCase()}`}`, imageUrl }],
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    await requireAuthenticatedUser(req)
    const body = await req.json()
    if (body.action === 'capabilities') return json(await capabilities())
    const feature = String(body.feature || '')
    if (feature === 'render' || feature === 'beautify') return json(await generateImage(body))
    return json(await generateStructured(body))
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成服务发生未知错误。'
    return json({ error: message }, error instanceof HttpError ? error.status : 400)
  }
})
