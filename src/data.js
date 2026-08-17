import {
  Boxes,
  FolderKanban,
  Image,
  LayoutDashboard,
  Lightbulb,
  PanelsTopLeft,
  Presentation,
  Sparkles,
  SunMedium,
} from 'lucide-react'

export const features = [
  {
    id: 'inspiration',
    number: '01',
    nav: 'AI 方案灵感',
    eyebrow: 'IDEATION',
    title: '让场地，先开口说话。',
    short: '设计方向、空间策略与真实案例',
    description: '从场地条件、项目类型和目标气质出发，生成多条可比较的设计方向。',
    icon: Lightbulb,
    placeholder: '例如：江南水乡旧工业滨水地块，希望兼顾文化公共性、在地材料与夜间活力……',
    chips: ['滨水文化中心', '工业遗存更新', '江南当代性'],
    guide: [
      ['必填', '项目类型、城市 / 场地、建筑规模'],
      ['建议', '使用人群、场地矛盾、期望气质'],
      ['可选', '偏好材料、参考建筑师、预算倾向'],
    ],
  },
  {
    id: 'design',
    number: '02',
    nav: 'AI 方案设计',
    eyebrow: 'CONCEPT',
    title: '把模糊目标，变成三条路径。',
    short: 'A / B / C 概念方案与专业比选',
    description: '基于任务书和场地资料，拆解功能关系并提供三套可决策的概念方案。',
    icon: PanelsTopLeft,
    placeholder: '例如：12,000㎡ 企业总部，容积率 2.5，需要开放首层、共享中庭和可分期建设……',
    chips: ['企业总部', '开放式街区', '低碳分期'],
    guide: [
      ['必填', '建设规模、功能构成、容积率'],
      ['建议', '退界限高、出入口、分期要求'],
      ['可选', '意向体量、设计策略、成本边界'],
    ],
  },
  {
    id: 'beautify',
    number: '03',
    nav: 'AI 图纸美化',
    eyebrow: 'DRAWING',
    title: '保留设计，只提升表达。',
    short: '总图 / 平面图填彩与层次增强',
    description: '识别原图线稿与空间层级，保持几何关系不变，快速生成统一图纸表达。',
    icon: Image,
    placeholder: '例如：保留 CAD 黑线和文字位置，使用低饱和蓝绿色，突出公共空间与主要流线……',
    chips: ['总图填彩', '竞赛风格', '蓝绿低饱和'],
    guide: [
      ['必填', '上传图纸、图纸类型、保留内容'],
      ['建议', '色彩倾向、重点空间、表达层级'],
      ['可选', '参考风格、植被密度、阴影方向'],
    ],
  },
  {
    id: 'model',
    number: '04',
    nav: 'AI 建模',
    eyebrow: 'MODELING',
    title: '从二维证据，重建空间。',
    short: '图片 / CAD 到可编辑基础模型',
    description: '根据轮廓、高差和层数生成可编辑白模，并标记需要人工校核的几何位置。',
    icon: Boxes,
    placeholder: '例如：层高 4.2m，裙房 3 层、塔楼 12 层；保留中庭和连桥，屋顶设备层简化……',
    chips: ['CAD 转白模', '保留中庭', 'LOD 200'],
    guide: [
      ['必填', '上传 CAD / 图片、层高、楼层数'],
      ['建议', '重要洞口、屋顶形式、场地高差'],
      ['可选', '目标软件、模型精度、是否分组'],
    ],
  },
  {
    id: 'render',
    number: '05',
    nav: 'AI 渲染',
    eyebrow: 'VISUALIZATION',
    title: '让白模，拥有真实时间。',
    short: '材质、光影、景观与氛围生成',
    description: '锁定主体与构图，只补充材质、景观和环境光，输出可继续精修的效果图。',
    icon: SunMedium,
    placeholder: '例如：傍晚蓝调时刻，清水混凝土与暖色室内灯光，入口广场有克制的人群活动……',
    chips: ['蓝调时刻', '清水混凝土', '克制人群'],
    guide: [
      ['必填', '上传白模、视角、建筑材质'],
      ['建议', '时间天气、景观季节、人物密度'],
      ['可选', '相机参数、画幅、艺术风格'],
    ],
  },
  {
    id: 'report',
    number: '06',
    nav: 'AI 汇报',
    eyebrow: 'STORYTELLING',
    title: '把项目，讲成一个故事。',
    short: '自动选图、文案与作品集式排版',
    description: '识别项目材料的叙事结构，自动组织封面、场地、策略、图纸和总结页面。',
    icon: Presentation,
    placeholder: '例如：用于 8 分钟中期汇报，重点讲清场地问题、三条策略和首层公共性，共 12 页……',
    chips: ['8 分钟汇报', '12 页结构', '作品集风格'],
    guide: [
      ['必填', '上传项目资料、汇报时长、页数'],
      ['建议', '听众身份、核心结论、重点图纸'],
      ['可选', '品牌字体、版式参考、输出尺寸'],
    ],
  },
]

export const navItems = [
  { id: 'home', nav: '工作台', icon: LayoutDashboard },
  ...features,
  { id: 'assets', nav: '我的资产', icon: FolderKanban },
]

export const initialAssets = [
  { id: 1, title: '江南水岸文化中心', type: '灵感库', files: 8, time: '刚刚更新', source: 'AI 方案灵感', tone: 'aqua' },
  { id: 2, title: '城市总部办公塔楼', type: '方案库', files: 12, time: '昨天 18:24', source: 'AI 方案设计', tone: 'blue' },
  { id: 3, title: '山地美术馆表达集', type: '渲染图库', files: 6, time: '08 月 15 日', source: 'AI 渲染', tone: 'mist' },
  { id: 4, title: '社区中心总图优化', type: '图纸库', files: 4, time: '08 月 14 日', source: 'AI 图纸美化', tone: 'blue' },
  { id: 5, title: '滨水展馆基础模型', type: '模型库', files: 3, time: '08 月 12 日', source: 'AI 建模', tone: 'aqua' },
  { id: 6, title: '毕业设计答辩图册', type: '汇报库', files: 18, time: '08 月 10 日', source: 'AI 汇报', tone: 'mist' },
]

export const outputMeta = {
  inspiration: { type: '灵感库', files: 8, label: '3 个方向 · 3 个案例' },
  design: { type: '方案库', files: 12, label: '3 套方案 · 专业比选' },
  beautify: { type: '图纸库', files: 4, label: '2 套表达 · 4K' },
  model: { type: '模型库', files: 3, label: 'SKP · 3DM · 质量报告' },
  render: { type: '渲染图库', files: 3, label: '1 张效果图 · 原图对照 · 4K' },
  report: { type: '汇报库', files: 18, label: '12 页 · A3 / PPTX' },
}

export const liveFeatureIds = ['inspiration', 'design', 'render']

const presetEnv = import.meta.env || {}

export const builtInModels = Object.freeze({
  language: Object.freeze({
    label: '语言大模型',
    baseUrl: presetEnv.VITE_LLM_BASE_URL || 'https://api.openai.com/v1',
    model: presetEnv.VITE_LLM_MODEL || 'gpt-5-mini',
  }),
  image: Object.freeze({
    label: '生图大模型',
    baseUrl: presetEnv.VITE_IMAGE_BASE_URL || 'https://api.openai.com/v1',
    model: presetEnv.VITE_IMAGE_MODEL || 'gpt-image-2',
    size: presetEnv.VITE_IMAGE_SIZE || '1536x1024',
  }),
})

const verifiedCaseIds = ['panlong', 'tank', 'longmuseum']

function readConfig() {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem('archflow-api-config') || '{}')
    const llmApiKey = stored.llmApiKey || stored.apiKey || ''
    const imageApiKey = stored.imageApiKey || stored.apiKey || ''
    return {
      enabled: Boolean(stored.enabled && llmApiKey && imageApiKey),
      llmBaseUrl: builtInModels.language.baseUrl,
      llmModel: builtInModels.language.model,
      llmApiKey,
      imageBaseUrl: builtInModels.image.baseUrl,
      imageModel: builtInModels.image.model,
      imageApiKey,
      imageSize: builtInModels.image.size,
    }
  } catch {
    return { enabled: false }
  }
}

function fileToDataUrl(file, maxSizeMb = 10) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      resolve(null)
      return
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      reject(new Error(`${file.name} 超过 ${maxSizeMb}MB，请压缩后再使用。`))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error(`无法读取 ${file.name}`))
    reader.readAsDataURL(file)
  })
}

function extractJson(content) {
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

function validateStructuredResult(feature, data) {
  if (feature === 'inspiration') {
    if (!Array.isArray(data.directions) || data.directions.length < 3 || !Array.isArray(data.sharedStrategies)) {
      throw new Error('方案灵感结果缺少三条设计方向或共同空间策略。')
    }
    return {
      coreConcept: String(data.coreConcept || '场地驱动的公共空间'),
      directions: data.directions.slice(0, 3).map((item, index) => ({
        code: ['A', 'B', 'C'][index],
        title: String(item.title || `设计方向 ${index + 1}`),
        subtitle: String(item.subtitle || 'Design Direction'),
        strategy: String(item.strategy || ''),
        keywords: Array.isArray(item.keywords) ? item.keywords.slice(0, 4).map(String) : [],
      })),
      sharedStrategies: data.sharedStrategies.slice(0, 4).map(String),
      caseIds: Array.isArray(data.caseIds) ? data.caseIds.filter((id) => verifiedCaseIds.includes(id)).slice(0, 3) : verifiedCaseIds,
    }
  }

  if (!Array.isArray(data.schemes) || data.schemes.length < 3) {
    throw new Error('方案设计结果缺少 A / B / C 三套可比较方案。')
  }
  return {
    schemes: data.schemes.slice(0, 3).map((item, index) => ({
      id: ['A', 'B', 'C'][index],
      name: String(item.name || `方案 ${index + 1}`),
      far: String(item.far || '待测算'),
      description: String(item.description || ''),
      pros: String(item.pros || ''),
      metrics: {
        openRate: String(item.metrics?.openRate || '待测算'),
        efficiency: String(item.metrics?.efficiency || '待测算'),
        complexity: String(item.metrics?.complexity || '待评估'),
        recommendation: String(item.metrics?.recommendation || '待比选'),
      },
    })),
  }
}

function getStructuredPrompt(feature) {
  if (feature === 'inspiration') {
    return `你是资深建筑设计总监。输出必须是严格 JSON，不要 Markdown，不要解释。结构如下：
{"coreConcept":"10字以内核心概念","directions":[{"title":"中文方向名","subtitle":"英文副标题","strategy":"80字内空间策略","keywords":["关键词1","关键词2","关键词3"]},{},{ }],"sharedStrategies":["策略1","策略2","策略3"],"caseIds":["panlong","tank","longmuseum"]}
必须给出三条逻辑明显不同且可落地的方向。案例只能从 panlong、tank、longmuseum 三个已审核案例中选择，不得编造网址。`
  }
  return `你是资深建筑方案设计总监。输出必须是严格 JSON，不要 Markdown，不要解释。结构如下：
{"schemes":[{"name":"中文方案名","far":"如 FAR 2.42","description":"80字内空间与功能策略","pros":"两项核心优势，用 / 分隔","metrics":{"openRate":"百分比","efficiency":"百分比","complexity":"低/中/高","recommendation":"10字内结论"}},{},{ }]}
必须给出 A / B / C 三套体量与组织逻辑明显不同的可比较方案，指标应彼此合理且不完全相同。`
}

async function generateStructuredText({ feature, prompt, files, config, options }) {
  const imageFiles = files.filter((file) => file.type?.startsWith('image/')).slice(0, 2)
  const imageUrls = (await Promise.all(imageFiles.map(fileToDataUrl))).filter(Boolean)
  const fileNames = files.map((file) => file.name).join('、') || '无'
  const userContent = [
    {
      type: 'text',
      text: `${prompt}\n\n本次临时附件：${fileNames}\n附加选项：${JSON.stringify(options)}\n请结合附件图像中的场地、体量或空间信息作答。`,
    },
    ...imageUrls.map((url) => ({ type: 'image_url', image_url: { url, detail: 'auto' } })),
  ]
  const endpoint = `${config.llmBaseUrl.replace(/\/$/, '')}/chat/completions`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.llmApiKey}` },
    body: JSON.stringify({
      model: config.llmModel,
      messages: [
        { role: 'system', content: getStructuredPrompt(feature) },
        { role: 'user', content: userContent },
      ],
    }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`语言模型 API ${response.status}: ${detail.slice(0, 160)}`)
  }
  const payload = await response.json()
  const content = payload.choices?.[0]?.message?.content || ''
  return { content, structured: validateStructuredResult(feature, extractJson(content)) }
}

async function generateRenderImages({ prompt, files, config }) {
  const imageFile = files.find((file) => file.type?.startsWith('image/'))
  if (!imageFile) throw new Error('AI 渲染需要先上传一张白模或原始效果图。')
  const baseUrl = config.imageBaseUrl.replace(/\/$/, '')
  const renderPrompt = `专业建筑可视化效果图。严格保留原始建筑主体、体量关系、相机视角和构图，只根据以下要求改善材质、景观、灯光与氛围：${prompt}。画面克制、真实、可用于建筑方案汇报，不添加文字或水印。`
  let response

  if (imageFile.size > 15 * 1024 * 1024) throw new Error('渲染参考图超过 15MB，请压缩后重新上传。')
  const originalImageUrl = await fileToDataUrl(imageFile, 15)
  const form = new FormData()
  form.append('model', config.imageModel)
  form.append('prompt', renderPrompt)
  form.append('image', imageFile, imageFile.name)
  form.append('n', '1')
  form.append('size', config.imageSize)
  response = await fetch(`${baseUrl}/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.imageApiKey}` },
    body: form,
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`图生图 API ${response.status}: ${detail.slice(0, 160)}`)
  }
  const payload = await response.json()
  const images = (payload.data || []).slice(0, 1).map((item, index) => ({
    id: index + 1,
    title: index === 0 ? '真实生成 · 主视角' : '真实生成 · 候选视角',
    meta: `${config.imageModel} · ${config.imageSize}`,
    imageUrl: item.b64_json ? `data:image/png;base64,${item.b64_json}` : item.url,
  })).filter((item) => item.imageUrl)
  if (!images.length) throw new Error('图像 API 已响应，但没有返回可显示的图片。')
  return { images, originalImageUrl }
}

export async function generateWithApi({ feature, prompt, files = [], options = {} }) {
  const config = readConfig()
  const isLiveFeature = liveFeatureIds.includes(feature)

  if (config.enabled && isLiveFeature) {
    if (feature === 'render') {
      if (!config.imageBaseUrl || !config.imageModel || !config.imageApiKey) {
        throw new Error('请先在“方案一组”中填写生图大模型 API Key。')
      }
      const generated = await generateRenderImages({ prompt, files, config })
      return {
        id: `${feature}-${Date.now()}`,
        feature,
        prompt,
        fileNames: files.map((file) => file.name),
        createdAt: new Date().toISOString(),
        mode: 'external-image-api',
        model: config.imageModel,
        images: generated.images,
        originalImageUrl: generated.originalImageUrl,
      }
    }

    if (!config.llmBaseUrl || !config.llmModel || !config.llmApiKey) {
      throw new Error('请先在“方案一组”中填写语言大模型 API Key。')
    }
    const generated = await generateStructuredText({ feature, prompt, files, config, options })
    return {
      id: `${feature}-${Date.now()}`,
      feature,
      prompt,
      fileNames: files.map((file) => file.name),
      options,
      createdAt: new Date().toISOString(),
      mode: 'external-language-api',
      model: config.llmModel,
      content: generated.content,
      structured: generated.structured,
    }
  }

  const demoReference = feature === 'render' ? files.find((file) => file.type?.startsWith('image/')) : null
  const demoOriginalImageUrl = demoReference ? await fileToDataUrl(demoReference, 15) : undefined
  await new Promise((resolve) => window.setTimeout(resolve, 950))
  return {
    id: `${feature}-${Date.now()}`,
    feature,
    prompt,
    fileNames: files.map((file) => file.name || String(file)),
    options,
    createdAt: new Date().toISOString(),
    mode: 'local-demo-adapter',
    originalImageUrl: demoOriginalImageUrl,
  }
}

export const brandIcon = Sparkles
