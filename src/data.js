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
  render: { type: '渲染图库', files: 6, label: '2 张效果图 · 4K' },
  report: { type: '汇报库', files: 18, label: '12 页 · A3 / PPTX' },
}

export async function generateWithApi({ feature, prompt, files = [], options = {} }) {
  const savedConfig = window.sessionStorage.getItem('archflow-api-config')
  const config = savedConfig ? JSON.parse(savedConfig) : null

  if (config?.enabled && config.baseUrl && config.apiKey && config.model) {
    const endpoint = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`
    const featureName = features.find((item) => item.id === feature)?.nav || feature
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content: `你是企业建筑设计工作台 ArchFlow 的专业设计助手。当前模块是${featureName}。请根据输入给出结构清楚、可用于设计讨论的中文结果，避免空泛表达。`,
          },
          {
            role: 'user',
            content: `${prompt}\n\n已上传文件：${files.length ? files.join('、') : '无'}\n附加选项：${JSON.stringify(options)}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new Error(`API ${response.status}: ${detail.slice(0, 180)}`)
    }

    const payload = await response.json()
    return {
      id: `${feature}-${Date.now()}`,
      feature,
      prompt,
      files,
      options,
      createdAt: new Date().toISOString(),
      mode: 'external-api',
      content: payload.choices?.[0]?.message?.content || '接口已返回结果。',
    }
  }

  await new Promise((resolve) => window.setTimeout(resolve, 950))
  return {
    id: `${feature}-${Date.now()}`,
    feature,
    prompt,
    files,
    options,
    createdAt: new Date().toISOString(),
    mode: 'local-demo-adapter',
  }
}

export const brandIcon = Sparkles
