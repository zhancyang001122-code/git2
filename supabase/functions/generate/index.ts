import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retry-count, traceparent, tracestate, baggage',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

const ASSET_BUCKET = 'user-assets'
const ASSET_MAX_BYTES = 40 * 1024 * 1024
const ASSET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000

function corsOrigin(req: Request) {
  const origin = req.headers.get('Origin')?.trim() || ''
  if (!origin) return '*'
  if (origin === 'https://archflow.zaneyang.xyz') return origin
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin)) return origin
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(origin)) return origin
  return 'null'
}

function requestCorsHeaders(req: Request) {
  return {
    ...corsHeaders,
    'Access-Control-Allow-Origin': corsOrigin(req),
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin, Access-Control-Request-Headers',
  }
}

function preflightCorsHeaders(req: Request) {
  const requestedHeaders = req.headers.get('Access-Control-Request-Headers')?.trim()
  return {
    ...requestCorsHeaders(req),
    ...(requestedHeaders ? { 'Access-Control-Allow-Headers': requestedHeaders } : {}),
    ...(req.headers.get('Access-Control-Request-Private-Network') === 'true'
      ? { 'Access-Control-Allow-Private-Network': 'true' }
      : {}),
    'Access-Control-Max-Age': '86400',
  }
}

type Attachment = { name: string; mimeType: string; data: string }

type ImageConfig = {
  id: string
  label: string
  baseUrl: string
  model: string
  apiKey: string
  protocol: string
  responseMode: 'inline' | 'url'
  size: string
  quality: string
}

type ImageConnection = {
  connected: boolean
  status: 'connected' | 'warning' | 'error' | 'not_configured'
  reason: string
  httpStatus?: number
  availableModels?: string[]
}

type ManagedImageTask = {
  id: string
  status: 'processing' | 'completed' | 'failed'
  image_url?: string | null
  error_message?: string | null
  created_at: string
  expires_at: string
}

class HttpError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function json(data: unknown, status = 200, req?: Request) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...(req ? requestCorsHeaders(req) : corsHeaders), 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function env(name: string) {
  return (Deno.env.get(name) || '').trim()
}

function serviceRoleKey() {
  return env('SUPABASE_SERVICE_ROLE_KEY')
}

function adminRestHeaders(jsonBody = false) {
  const key = serviceRoleKey()
  if (!key) throw new HttpError('生图任务存储尚未完成服务端配置。', 500)
  return {
    ...(jsonBody ? { 'Content-Type': 'application/json' } : {}),
    apikey: key,
    Authorization: `Bearer ${key}`,
  }
}

function imageTaskRestUrl(query = '') {
  const supabaseUrl = env('SUPABASE_URL')
  if (!supabaseUrl) throw new HttpError('生图任务存储缺少 SUPABASE_URL。', 500)
  return `${supabaseUrl}/rest/v1/image_generation_tasks${query}`
}

function storageObjectUrl(objectPath: string) {
  const supabaseUrl = env('SUPABASE_URL')
  if (!supabaseUrl) throw new HttpError('资产存储缺少 SUPABASE_URL。', 500)
  const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/')
  return `${supabaseUrl}/storage/v1/object/${ASSET_BUCKET}/${encodedPath}`
}

async function createManagedImageTask(userId: string, imageSlot: string) {
  const expiredBefore = encodeURIComponent(new Date().toISOString())
  const cleanupResponse = await fetch(imageTaskRestUrl(`?expires_at=lt.${expiredBefore}`), {
    method: 'DELETE',
    headers: { ...adminRestHeaders(), Prefer: 'return=minimal' },
  })
  if (!cleanupResponse.ok) {
    console.warn(JSON.stringify({ event: 'image_task_cleanup_failed', status: cleanupResponse.status }))
  }
  const taskId = `imgtask_${crypto.randomUUID()}`
  const response = await fetch(imageTaskRestUrl(), {
    method: 'POST',
    headers: { ...adminRestHeaders(true), Prefer: 'return=minimal' },
    body: JSON.stringify({ id: taskId, user_id: userId, image_slot: imageSlot }),
  })
  if (!response.ok) {
    throw new HttpError(`无法创建 4K 生图后台任务（${response.status}）。`, 502)
  }
  return taskId
}

async function managedImageTask(taskId: string, userId: string): Promise<ManagedImageTask | null> {
  const query = `?id=eq.${encodeURIComponent(taskId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,status,image_url,error_message,created_at,expires_at&limit=1`
  const response = await fetch(imageTaskRestUrl(query), { headers: adminRestHeaders() })
  if (!response.ok) throw new HttpError(`无法读取 4K 生图任务（${response.status}）。`, 502)
  const rows = await response.json() as ManagedImageTask[]
  return rows[0] || null
}

async function updateManagedImageTask(taskId: string, values: Record<string, unknown>) {
  const response = await fetch(imageTaskRestUrl(`?id=eq.${encodeURIComponent(taskId)}`), {
    method: 'PATCH',
    headers: { ...adminRestHeaders(true), Prefer: 'return=minimal' },
    body: JSON.stringify({ ...values, updated_at: new Date().toISOString() }),
  })
  if (!response.ok) {
    console.error(JSON.stringify({ event: 'image_task_update_failed', taskId, status: response.status }))
  }
}

function readableLabel(value: string, fallback: string) {
  return value && !value.includes('\uFFFD') ? value : fallback
}

function languageConfig() {
  return {
    baseUrl: env('ARCHFLOW_LLM_BASE_URL') || 'https://ws-g9wsij6srpylaed0.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
    model: env('ARCHFLOW_LLM_MODEL') || 'qwen3.7-plus',
    apiKey: env('ARCHFLOW_LLM_API_KEY') || env('百炼keygit2内部1'),
  }
}

function imageSlotNumber(slot: string) {
  const match = /^image([1-9]\d*)$/.exec(slot)
  return match ? Number(match[1]) : 1
}

function normalizeImageSlot(value: unknown) {
  const slot = String(value || '')
  return /^image[1-9]\d*$/.test(slot) ? slot : 'image1'
}

function legacyImageDefaults(slotNumber: number) {
  if (slotNumber === 1) {
    return {
      label: '第三方生图服务',
      baseUrl: 'https://img.yunfei.best',
      model: 'gpt-image-2',
      apiKey: env('生图api 4k'),
      protocol: 'auto',
      responseMode: 'inline',
    }
  }
  if (slotNumber === 2) {
    return {
      label: 'Git2 图 Gemini',
      baseUrl: 'https://img.yunfei.best',
      model: 'gemini-3-pro-image-preview',
      apiKey: env('git2图gemini'),
      protocol: 'gemini',
      responseMode: 'url',
    }
  }
  return {
    label: `内置生图 API ${slotNumber}`,
    baseUrl: '',
    model: '',
    apiKey: '',
    protocol: 'openai',
    responseMode: 'inline',
  }
}

function imageConfig(slot: string): ImageConfig {
  const slotNumber = imageSlotNumber(slot)
  const prefix = `ARCHFLOW_IMAGE_${slotNumber}`
  const defaults = legacyImageDefaults(slotNumber)
  const apiKeySecretName = env(`${prefix}_API_KEY_SECRET`)
  return {
    id: slot,
    label: readableLabel(env(`${prefix}_LABEL`), defaults.label),
    baseUrl: env(`${prefix}_BASE_URL`) || defaults.baseUrl,
    model: env(`${prefix}_MODEL`) || defaults.model,
    apiKey: env(`${prefix}_API_KEY`) || (apiKeySecretName ? env(apiKeySecretName) : defaults.apiKey),
    protocol: env(`${prefix}_PROTOCOL`) || defaults.protocol,
    responseMode: env(`${prefix}_RESPONSE_MODE`) === 'url' ? 'url' : defaults.responseMode,
    size: env(`${prefix}_SIZE`) || '4K',
    quality: env(`${prefix}_QUALITY`) || 'high',
  }
}

function imageConfigs() {
  const declaredSlots = new Set<number>([1, 2])
  for (const name of Object.keys(Deno.env.toObject())) {
    const match = /^ARCHFLOW_IMAGE_([1-9]\d*)_(?:LABEL|BASE_URL|MODEL|API_KEY|API_KEY_SECRET|PROTOCOL|RESPONSE_MODE|SIZE|QUALITY)$/.exec(name)
    if (match) declaredSlots.add(Number(match[1]))
  }
  return [...declaredSlots]
    .sort((left, right) => left - right)
    .map((slotNumber) => imageConfig(`image${slotNumber}`))
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

function imageConnectionMessage(connection: ImageConnection) {
  if (connection.status === 'connected') return '模型列表验证通过'
  if (connection.status === 'not_configured') return '配置不完整'
  if (connection.reason === 'model_missing') {
    const suggestions = connection.availableModels?.join('、')
    return suggestions
      ? `配置的模型 ID 不存在。服务商可用的生图模型：${suggestions}`
      : '配置的模型 ID 不存在，已禁止调用，请在服务商后台核对模型 ID'
  }
  if (connection.reason === 'model_list_empty') return '服务可连接，但模型列表为空，可继续实测生图'
  if (connection.reason === 'auth_failed') return '密钥无效或无权访问模型列表'
  if (connection.reason === 'quota_exhausted') return '额度不足或已用完'
  if (connection.reason === 'rate_limited') return '连接检测触发限流，请稍后重试'
  if (connection.reason === 'model_list_unsupported') return '服务未开放模型列表接口，可继续实测生图'
  if (connection.reason === 'timeout') return '连接检测超时'
  return '服务连接检测失败'
}

function imageModelSuggestions(modelIds: string[]) {
  const likelyImageModels = modelIds.filter((model) => /image|imagen|gemini|banana|nano|flux|dall|midjourney|\u56fe/i.test(model))
  return (likelyImageModels.length ? likelyImageModels : modelIds).slice(0, 20)
}

async function checkImageConnection(config: ImageConfig): Promise<ImageConnection> {
  if (!isReady(config)) {
    console.warn(JSON.stringify({ event: 'image_connection_check', slot: config.id, connected: false, reason: 'not_configured' }))
    return { connected: false, status: 'not_configured', reason: 'not_configured' }
  }
  try {
    const useNativeGeminiListing = config.protocol === 'gemini'
    const endpoint = useNativeGeminiListing
      ? `${rootWithoutApiVersion(config.baseUrl)}/v1beta/models`
      : `${rootWithoutApiVersion(config.baseUrl)}/v1/models`
    const response = await fetch(endpoint, {
      signal: AbortSignal.timeout(8000),
      headers: useNativeGeminiListing
        ? { Authorization: `Bearer ${config.apiKey}`, 'x-goog-api-key': config.apiKey }
        : { Authorization: `Bearer ${config.apiKey}` },
    })
    if (!response.ok) {
      const reason = response.status === 401 || response.status === 403
        ? 'auth_failed'
        : response.status === 402
          ? 'quota_exhausted'
          : response.status === 429
            ? 'rate_limited'
            : response.status === 404 || response.status === 405
              ? 'model_list_unsupported'
              : 'provider_rejected_model_list'
      const status = reason === 'model_list_unsupported' ? 'warning' : 'error'
      console.warn(JSON.stringify({
        event: 'image_connection_check',
        slot: config.id,
        model: config.model,
        protocol: config.protocol,
        connected: false,
        status: response.status,
        reason,
      }))
      return { connected: false, status, reason, httpStatus: response.status }
    }
    const payload = await response.json()
    const modelIds = Array.isArray(payload.data)
      ? payload.data.map((item: Record<string, unknown>) => String(item.id || '')).filter(Boolean)
      : Array.isArray(payload.models)
        ? payload.models.map((item: Record<string, unknown>) => String(item.name || '').replace(/^models\//, '')).filter(Boolean)
        : []
    const connected = modelIds.includes(config.model)
    const reason = connected ? 'ok' : modelIds.length === 0 ? 'model_list_empty' : 'model_missing'
    const status = connected ? 'connected' : 'warning'
    const availableModels = connected ? undefined : imageModelSuggestions(modelIds)
    console.info(JSON.stringify({
      event: 'image_connection_check',
      slot: config.id,
      model: config.model,
      protocol: config.protocol,
      connected,
      status: response.status,
      reason,
    }))
    return { connected, status, reason, httpStatus: response.status, availableModels }
  } catch (error) {
    const reason = error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : 'network_error'
    console.warn(JSON.stringify({
      event: 'image_connection_check',
      slot: config.id,
      model: config.model,
      protocol: config.protocol,
      connected: false,
      reason,
    }))
    return { connected: false, status: 'error', reason }
  }
}

async function capabilities() {
  const llm = languageConfig()
  const configuredImages = imageConfigs()
  const [languageReady, ...imageConnections] = await Promise.all([
    checkLanguageConnection(llm),
    ...configuredImages.map(checkImageConnection),
  ])
  return {
    languageReady,
    languageModel: languageReady ? llm.model : null,
    imageModes: configuredImages.map((config, index) => {
      const usesGeminiSizing = config.protocol === 'gemini' || (config.protocol === 'auto' && looksLikeGemini(config.model))
      const connection = imageConnections[index]
      return {
        id: config.id,
        label: config.label,
        model: config.model,
        maxSize: config.size || '4K',
        supportsCustomSize: !usesGeminiSizing,
        supportsOriginalRatio: true,
        configured: isReady(config),
        connected: connection.connected,
        connectionStatus: connection.status,
        connectionReason: connection.reason,
        connectionMessage: imageConnectionMessage(connection),
        availableModels: connection.availableModels || [],
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

function normalizeInputAttachment(attachment: Attachment) {
  let bytes: Uint8Array
  try {
    bytes = decodeBase64(attachment.data)
  } catch {
    throw new HttpError('参考图数据损坏，请重新选择图片。', 400)
  }
  if (!bytes.length) throw new HttpError('上传的参考图为空，请重新选择图片。', 400)
  if (bytes.length > 15 * 1024 * 1024) throw new HttpError('渲染参考图超过 15MB，请压缩后重新上传。', 413)
  let mimeType = ''
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) mimeType = 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) mimeType = 'image/jpeg'
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') mimeType = 'image/webp'
  if (!mimeType) throw new HttpError('参考图文件内容不是有效的 PNG、JPG 或 WEBP，请另存为 JPG 后重试。', 415)
  if (mimeType !== attachment.mimeType) {
    console.warn(JSON.stringify({ event: 'input_image_mime_normalized', declared: attachment.mimeType, detected: mimeType, bytes: bytes.length }))
  }
  return { ...attachment, mimeType }
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

function geminiAspectRatio(value: unknown) {
  if (value === undefined || value === null || String(value).trim() === '') return ''
  return requestedAspectRatio(value, '')
}

function geminiHeaders(config: ImageConfig, jsonBody = false) {
  return {
    ...(jsonBody ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${config.apiKey}`,
    'x-goog-api-key': config.apiKey,
    'x-api-key': config.apiKey,
  }
}

async function readProviderPayload(response: Response) {
  const text = await response.text()
  if (!text) return {}
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { raw: text.slice(0, 1000) }
  }
}

function providerErrorDetail(payload: Record<string, unknown>) {
  const nestedError = payload.error
  if (nestedError && typeof nestedError === 'object') {
    const message = (nestedError as Record<string, unknown>).message
    if (message) return String(message)
  }
  if (nestedError) return String(nestedError)
  if (payload.message) return String(payload.message)
  if (payload.detail) return String(payload.detail)
  if (payload.raw) return String(payload.raw)
  return JSON.stringify(payload).slice(0, 500)
}

function geminiImageUrl(payload: Record<string, unknown>) {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : []
  const content = (candidates[0] as Record<string, unknown> | undefined)?.content as Record<string, unknown> | undefined
  const parts = Array.isArray(content?.parts) ? content.parts as Record<string, unknown>[] : []
  for (const part of parts) {
    const fileData = (part.fileData || part.file_data) as Record<string, unknown> | undefined
    const fileUri = String(fileData?.fileUri || fileData?.file_uri || '')
    if (/^https?:\/\//i.test(fileUri)) return fileUri

    const inlineData = (part.inlineData || part.inline_data) as Record<string, unknown> | undefined
    if (inlineData?.data) {
      return `data:${inlineData.mimeType || inlineData.mime_type || 'image/png'};base64,${inlineData.data}`
    }

    const textUrl = String(part.text || '').match(/https?:\/\/[^\s<>"']+/i)?.[0] || ''
    if (textUrl) return textUrl
  }
  return ''
}

function geminiGenerationPayload(
  config: ImageConfig,
  prompt: string,
  attachment: Attachment,
  aspectRatio: string,
) {
  const imageConfigPayload: Record<string, string> = {}
  if (aspectRatio) imageConfigPayload.aspectRatio = aspectRatio
  const imageSize = geminiImageSize(config)
  if (imageSize) imageConfigPayload.imageSize = imageSize
  return {
    contents: [{ role: 'user', parts: [
      { text: prompt },
      { inlineData: { mimeType: attachment.mimeType, data: attachment.data } },
    ] }],
    generationConfig: {
      responseModalities: [config.responseMode === 'url' ? 'TEXT' : 'IMAGE'],
      imageConfig: imageConfigPayload,
    },
  }
}

const HEALTH_CHECK_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

async function checkGeminiGenerationProtocol(config: ImageConfig) {
  const base = rootWithoutApiVersion(config.baseUrl)
  try {
    const response = await fetch(`${base}/v1beta/models/${encodeURIComponent(config.model)}:generateContent`, {
      method: 'POST',
      headers: geminiHeaders(config, true),
      body: JSON.stringify(geminiGenerationPayload(
        { ...config, responseMode: 'url', size: '1K' },
        '这是自动健康检查。只识别输入图片并回复 OK，不要生成或修改图片。',
        { name: 'health-check.png', mimeType: 'image/png', data: HEALTH_CHECK_PNG_BASE64 },
        '1:1',
      )),
      signal: AbortSignal.timeout(45_000),
    })
    const payload = await readProviderPayload(response)
    const detail = response.ok ? 'ok' : providerErrorDetail(payload)
    const semanticRejection = response.status === 400 && /未能生成图片|调整提示词|更换参考图/i.test(detail)
    const protocolAccepted = response.ok || semanticRejection
    console.info(JSON.stringify({
      event: 'gemini_protocol_health_check',
      slot: config.id,
      model: config.model,
      connected: protocolAccepted,
      status: response.status,
      detail: detail.slice(0, 300),
    }))
    return {
      slot: config.id,
      connected: protocolAccepted,
      httpStatus: response.status,
      outcome: semanticRejection ? 'protocol_accepted' : response.ok ? 'ok' : 'rejected',
      detail: detail.slice(0, 300),
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown_error'
    console.warn(JSON.stringify({
      event: 'gemini_protocol_health_check',
      slot: config.id,
      model: config.model,
      connected: false,
      detail: detail.slice(0, 300),
    }))
    return { slot: config.id, connected: false, detail: detail.slice(0, 300) }
  }
}

async function operationalHealth(user: Record<string, unknown>) {
  const appMetadata = user.app_metadata as Record<string, unknown> | undefined
  if (appMetadata?.role !== 'health_monitor') throw new HttpError('无权执行生产健康检查。', 403)
  const baseHealth = await capabilities()
  const geminiConfigs = imageConfigs().filter((config) => isReady(config) && config.protocol === 'gemini')
  const protocolChecks = await Promise.all(geminiConfigs.map(checkGeminiGenerationProtocol))
  const imageModesHealthy = baseHealth.imageModes.filter((mode) => mode.configured).every((mode) => mode.connected)
  return {
    ...baseHealth,
    ok: baseHealth.languageReady && imageModesHealthy && protocolChecks.every((check) => check.connected),
    protocolChecks,
  }
}

async function requestGeminiImage(
  config: ImageConfig,
  prompt: string,
  attachment: Attachment,
  aspectRatio: string,
) {
  const base = rootWithoutApiVersion(config.baseUrl)
  const response = await fetch(`${base}/v1beta/models/${encodeURIComponent(config.model)}:generateContent`, {
    method: 'POST',
    headers: geminiHeaders(config, true),
    body: JSON.stringify(geminiGenerationPayload(config, prompt, attachment, aspectRatio)),
  })
  const payload = await readProviderPayload(response)
  if (!response.ok) {
    throw new HttpError(`Gemini 生图 API ${response.status}: ${providerErrorDetail(payload)}`, response.status >= 500 ? 502 : 400)
  }
  return { response, payload }
}

async function runManagedGeminiTask(
  taskId: string,
  config: ImageConfig,
  prompt: string,
  attachment: Attachment,
  aspectRatio: string,
) {
  try {
    const { response, payload } = await requestGeminiImage(config, prompt, attachment, aspectRatio)
    if (response.status === 202 || payload.execution_mode === 'async' || imageTaskId(payload)) {
      throw new Error('上游返回了未完成的异步任务，但当前服务未提供兼容的图片结果。')
    }
    const imageUrl = geminiImageUrl(payload)
    if (!imageUrl) throw new Error(`Gemini API 已响应，但没有返回可显示的图片：${providerErrorDetail(payload)}`)
    await updateManagedImageTask(taskId, { status: 'completed', image_url: imageUrl, error_message: null })
    console.info(JSON.stringify({ event: 'managed_image_task_completed', taskId }))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gemini 后台生图失败。'
    await updateManagedImageTask(taskId, { status: 'failed', error_message: message.slice(0, 1000), image_url: null })
    console.error(JSON.stringify({ event: 'managed_image_task_failed', taskId, message: message.slice(0, 500) }))
  }
}

function imageTaskId(payload: Record<string, unknown>) {
  return String(payload.task_id || payload.id || '')
}

function imageTaskPollAfter(payload: Record<string, unknown>) {
  const delay = Number(payload.poll_after_ms || 2000)
  if (!Number.isFinite(delay)) return 2000
  return Math.max(1000, Math.min(5000, Math.round(delay)))
}

function base64Url(bytes: Uint8Array) {
  return encodeBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function hmacSignature(secret: string, value: string) {
  if (!secret) throw new HttpError('资产保存签名尚未完成服务端配置。', 500)
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value))
  return base64Url(new Uint8Array(signature))
}

async function signRemoteArtifact(imageUrl: string, userId: string) {
  if (!/^https:\/\//i.test(imageUrl)) return undefined
  const expiresAt = Date.now() + ASSET_TOKEN_TTL_MS
  const signature = await hmacSignature(serviceRoleKey(), `${userId}\n${expiresAt}\n${imageUrl}`)
  return `${expiresAt}.${signature}`
}

async function verifyRemoteArtifactToken(imageUrl: string, userId: string, token: string) {
  const [expiresRaw, signature = ''] = token.split('.', 2)
  const expiresAt = Number(expiresRaw)
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + ASSET_TOKEN_TTL_MS + 60_000) {
    throw new HttpError('生成图保存凭据已过期，请重新生成后再保存。', 410)
  }
  const expected = await hmacSignature(serviceRoleKey(), `${userId}\n${expiresAt}\n${imageUrl}`)
  if (!safeTokenEqual(signature, expected)) throw new HttpError('生成图保存凭据无效。', 403)
}

async function authorizeRemoteArtifact(imageUrl: string, userId: string, token: string) {
  if (token) return verifyRemoteArtifactToken(imageUrl, userId, token)
  const now = encodeURIComponent(new Date().toISOString())
  const query = `?user_id=eq.${encodeURIComponent(userId)}&status=eq.completed&expires_at=gt.${now}&image_url=eq.${encodeURIComponent(imageUrl)}&select=id&limit=1`
  const response = await fetch(imageTaskRestUrl(query), { headers: adminRestHeaders() })
  if (!response.ok) throw new HttpError('无法验证历史生成图，请稍后重试。', 502)
  const tasks = await response.json() as Array<{ id: string }>
  if (!tasks.length) throw new HttpError('这张远程图片不属于当前账号的有效生成任务，请重新生成后再保存。', 403)
}

async function signImageTask(config: ImageConfig, userId: string, slot: string, taskId: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(config.apiKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${userId}:${slot}:${taskId}`))
  return base64Url(new Uint8Array(signature))
}

function safeTokenEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return difference === 0
}

async function pendingImageTask(payload: Record<string, unknown>, config: ImageConfig, userId: string, slot: string) {
  const taskId = imageTaskId(payload)
  if (!/^imgtask_[a-zA-Z0-9-]+$/.test(taskId)) {
    throw new HttpError(`Gemini 网关返回了异步任务，但缺少有效任务 ID：${providerErrorDetail(payload)}`, 502)
  }
  return {
    pending: true,
    taskId,
    taskToken: await signImageTask(config, userId, slot, taskId),
    pollAfterMs: imageTaskPollAfter(payload),
    imageSlot: slot,
    model: config.model,
  }
}

async function imageResult(
  body: Record<string, unknown>,
  config: ImageConfig,
  feature: 'render' | 'beautify',
  imageUrl: string,
  aspectRatio: string,
  imageSize: string,
  useGemini: boolean,
  userId: string,
  originalImageUrl = '',
) {
  const assetToken = await signRemoteArtifact(imageUrl, userId)
  return {
    id: `${feature}-${Date.now()}`,
    feature,
    prompt: body.prompt,
    fileNames: Array.isArray(body.fileNames) ? body.fileNames : [],
    createdAt: new Date().toISOString(),
    mode: 'managed-image-api',
    model: config.model,
    originalImageUrl: originalImageUrl || undefined,
    images: [{
      id: 1,
      title: feature === 'beautify' ? '真实生成 · 图纸美化' : '真实生成 · 主视角',
      meta: `${config.model} · ${useGemini ? `${aspectRatio || '原图比例'} · ${geminiImageSize(config) || '模型原生最高分辨率'}` : `${imageSize} · ${config.quality.toUpperCase()}`}`,
      imageUrl,
      assetToken,
    }],
  }
}

function imageTypeFromBytes(bytes: Uint8Array, declaredType: string) {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp'
  const type = declaredType.split(';', 1)[0].trim().toLowerCase()
  throw new HttpError(`生图服务返回的文件不是有效的 PNG、JPG 或 WEBP 图片（${type || '未知类型'}）。`, 415)
}

function storageImageName(value: unknown, contentType: string) {
  const extension = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/webp' ? 'webp' : 'png'
  const base = String(value || 'generated-image')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'generated-image'
  return `${base}.${extension}`
}

async function persistRemoteArtifact(body: Record<string, unknown>, user: { id: string }) {
  const imageUrl = String(body.imageUrl || '')
  const assetToken = String(body.assetToken || '')
  const packageId = String(body.packageId || '')
  if (!/^https:\/\//i.test(imageUrl)) throw new HttpError('仅允许保存由模型返回的 HTTPS 图片。', 400)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(packageId)) {
    throw new HttpError('资产包标识无效。', 400)
  }
  await authorizeRemoteArtifact(imageUrl, user.id, assetToken)

  let sourceResponse: Response
  try {
    sourceResponse = await fetch(imageUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(90_000),
      headers: { 'User-Agent': 'ArchFlow-Asset-Persistence/1.0' },
    })
  } catch {
    throw new HttpError('生成图源站暂时无法读取，请稍后重试保存。', 502)
  }
  if (!sourceResponse.ok) throw new HttpError(`生成图源站读取失败（${sourceResponse.status}）。`, 502)
  const declaredLength = Number(sourceResponse.headers.get('content-length') || 0)
  if (declaredLength > ASSET_MAX_BYTES) throw new HttpError('生成图超过资产库 40 MiB 上限。', 413)

  let bytes: Uint8Array
  try {
    bytes = new Uint8Array(await sourceResponse.arrayBuffer())
  } catch {
    throw new HttpError('生成图下载中断，请稍后重试保存。', 502)
  }
  if (!bytes.length) throw new HttpError('生成图源站返回了空文件。', 502)
  if (bytes.length > ASSET_MAX_BYTES) throw new HttpError('生成图超过资产库 40 MiB 上限。', 413)
  const contentType = imageTypeFromBytes(bytes, sourceResponse.headers.get('content-type') || '')
  const fileName = storageImageName(body.fileName, contentType)
  const storagePath = `${user.id}/${packageId}/${fileName}`
  let uploadResponse: Response
  try {
    uploadResponse = await fetch(storageObjectUrl(storagePath), {
      method: 'POST',
      headers: {
        ...adminRestHeaders(),
        'Content-Type': contentType,
        'Cache-Control': '3600',
        'x-upsert': 'true',
      },
      body: bytes,
    })
  } catch {
    throw new HttpError('资产库网络暂时不可用，请稍后重试保存。', 502)
  }
  if (!uploadResponse.ok) {
    const detail = (await uploadResponse.text()).slice(0, 300)
    throw new HttpError(`资产库上传失败（${uploadResponse.status}）：${detail || 'Storage 未返回具体原因。'}`, 502)
  }
  console.info(JSON.stringify({ event: 'asset_artifact_persisted', userId: user.id, storagePath, bytes: bytes.length }))
  return { storagePath, fileName, contentType, bytes: bytes.length }
}

async function pollImageTask(body: Record<string, unknown>, user: { id: string }) {
  const feature = body.feature === 'beautify' ? 'beautify' : 'render'
  const slot = normalizeImageSlot(body.imageSlot)
  const config = imageConfig(slot)
  const useGemini = config.protocol === 'gemini' || (config.protocol === 'auto' && looksLikeGemini(config.model))
  if (!isReady(config) || !useGemini) throw new HttpError('当前生图服务不支持异步任务查询。', 400)

  const taskId = String(body.taskId || '')
  const taskToken = String(body.taskToken || '')
  if (!/^imgtask_[a-zA-Z0-9-]+$/.test(taskId) || !taskToken) throw new HttpError('4K 生图任务凭据无效，请重新生成。', 400)
  const expectedToken = await signImageTask(config, user.id, slot, taskId)
  if (!safeTokenEqual(taskToken, expectedToken)) throw new HttpError('无权查询这个 4K 生图任务。', 403)

  const managedTask = await managedImageTask(taskId, user.id)
  if (managedTask) {
    const aspectRatio = geminiAspectRatio(body.imageAspectRatio)
    if (new Date(managedTask.expires_at).getTime() <= Date.now()) {
      throw new HttpError('这个 4K 生图任务已过期，请重新生成。', 410)
    }
    if (managedTask.status === 'completed' && managedTask.image_url) {
      return imageResult(body, config, feature, managedTask.image_url, aspectRatio, geminiImageSize(config), true, user.id)
    }
    if (managedTask.status === 'failed') {
      throw new HttpError(`Gemini 4K 生图任务失败：${managedTask.error_message || '上游未返回具体原因。'}`, 400)
    }
    const createdAt = new Date(managedTask.created_at).getTime()
    if (Number.isFinite(createdAt) && Date.now() - createdAt > 7 * 60 * 1000) {
      throw new HttpError('Gemini 4K 后台任务超过 7 分钟仍未完成，请重新生成。', 504)
    }
    return pendingImageTask({ id: taskId, poll_after_ms: 2000 }, config, user.id, slot)
  }

  const response = await fetch(`${rootWithoutApiVersion(config.baseUrl)}/v1/images/tasks/${encodeURIComponent(taskId)}`, {
    headers: geminiHeaders(config),
  })
  const payload = await readProviderPayload(response)
  if (!response.ok) {
    throw new HttpError(`Gemini 任务查询失败 ${response.status}: ${providerErrorDetail(payload)}`, response.status >= 500 ? 502 : 400)
  }

  const imageUrl = geminiImageUrl(payload)
  const aspectRatio = geminiAspectRatio(body.imageAspectRatio)
  if (imageUrl) return imageResult(body, config, feature, imageUrl, aspectRatio, geminiImageSize(config), true, user.id)

  const status = String(payload.status || '').toLowerCase()
  const failed = ['failed', 'error', 'cancelled', 'canceled', 'expired'].includes(status)
  if (failed || payload.error || payload.error_code) {
    throw new HttpError(`Gemini 4K 生图任务失败：${providerErrorDetail(payload) || status}`, 400)
  }
  return pendingImageTask(payload, config, user.id, slot)
}

async function generateImageWithSelectedProvider(body: Record<string, unknown>, user: { id: string }) {
  const feature = body.feature === 'beautify' ? 'beautify' : 'render'
  const slot = normalizeImageSlot(body.imageSlot)
  const config = imageConfig(slot)
  if (!isReady(config)) throw new Error(`${config.label} 尚未完成服务端配置。`)
  const rawAttachment = ((Array.isArray(body.attachments) ? body.attachments : []) as Attachment[])[0]
  if (!rawAttachment?.data) throw new Error(`${feature === 'beautify' ? 'AI 图纸美化' : 'AI 渲染'}需要先上传一张${feature === 'beautify' ? '原始图纸' : '白模或原始效果图'}。`)
  const attachment = normalizeInputAttachment(rawAttachment)
  const originalImageUrl = imageDataUrl(attachment)
  const prompt = imagePrompt(feature, String(body.prompt || ''))
  const useGemini = config.protocol === 'gemini' || (config.protocol === 'auto' && looksLikeGemini(config.model))
  const imageSize = requestedImageSize(body.imageSize, config.size)
  const aspectRatio = useGemini
    ? geminiAspectRatio(body.imageAspectRatio)
    : requestedAspectRatio(body.imageAspectRatio, feature === 'beautify' ? '4:3' : '16:9')
  let imageUrl = ''

  if (useGemini) {
    if (config.responseMode === 'url') {
      const taskId = await createManagedImageTask(user.id, slot)
      EdgeRuntime.waitUntil(runManagedGeminiTask(taskId, config, prompt, attachment, aspectRatio))
      return pendingImageTask({ id: taskId, poll_after_ms: 2000 }, config, user.id, slot)
    }
    const { response, payload } = await requestGeminiImage(config, prompt, attachment, aspectRatio)
    if (response.status === 202 || payload.execution_mode === 'async' || imageTaskId(payload)) {
      return pendingImageTask(payload, config, user.id, slot)
    }
    imageUrl = geminiImageUrl(payload)
    if (!imageUrl) throw new HttpError(`Gemini API 已响应，但没有返回可显示的图片：${providerErrorDetail(payload)}`, 502)
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
    const payload = await readProviderPayload(response)
    if (!response.ok) {
      throw new HttpError(
        `图生图服务请求失败（上游 ${response.status}）：${providerErrorDetail(payload)}`,
        response.status >= 500 ? 502 : 400,
      )
    }
    const data = Array.isArray(payload.data) ? payload.data as Record<string, unknown>[] : []
    const item = data[0]
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

  return imageResult(body, config, feature, imageUrl, aspectRatio, imageSize, useGemini, user.id, originalImageUrl)
}

async function generateImage(body: Record<string, unknown>, user: { id: string }) {
  try {
    return await generateImageWithSelectedProvider(body, user)
  } catch (error) {
    const selectedSlot = normalizeImageSlot(body.imageSlot)
    const fallbackConfig = imageConfig('image2')
    const transientProviderFailure = error instanceof HttpError && error.status === 502
    if (selectedSlot !== 'image2' && transientProviderFailure && isReady(fallbackConfig)) {
      console.warn(JSON.stringify({
        event: 'image_provider_failover',
        from: selectedSlot,
        to: 'image2',
        reason: error.message.slice(0, 300),
      }))
      return generateImageWithSelectedProvider({ ...body, imageSlot: 'image2' }, user)
    }
    throw error
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: preflightCorsHeaders(req) })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, req)

  try {
    const user = await requireAuthenticatedUser(req)
    const body = await req.json()
    if (body.action === 'capabilities') return json(await capabilities(), 200, req)
    if (body.action === 'health') return json(await operationalHealth(user), 200, req)
    if (body.action === 'image-task-status') return json(await pollImageTask(body, user), 200, req)
    if (body.action === 'persist-artifact') return json(await persistRemoteArtifact(body, user), 200, req)
    const feature = String(body.feature || '')
    if (feature === 'render' || feature === 'beautify') return json(await generateImage(body, user), 200, req)
    return json(await generateStructured(body), 200, req)
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成服务发生未知错误。'
    console.error(JSON.stringify({ event: 'generate_error', message: message.slice(0, 1000) }))
    return json({ error: message }, error instanceof HttpError ? error.status : 400, req)
  }
})
