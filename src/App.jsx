import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Cloud,
  Download,
  ExternalLink,
  Eye,
  FileArchive,
  Focus,
  FolderOpen,
  Info,
  Link2,
  LoaderCircle,
  Menu,
  MoreHorizontal,
  MousePointer2,
  Plus,
  Rotate3D,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRound,
  WandSparkles,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { features, generateWithApi, initialAssets, navItems, outputMeta } from './data.js'

const validRoutes = new Set(navItems.map((item) => item.id))

function getInitialRoute() {
  const hash = window.location.hash.replace('#/', '')
  return validRoutes.has(hash) ? hash : 'home'
}

function downloadDemo(name, content = 'ArchFlow interview demo placeholder') {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default function App() {
  const [route, setRoute] = useState(getInitialRoute)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [assets, setAssets] = useState(initialAssets)
  const [dialog, setDialog] = useState(null)
  const [toast, setToast] = useState(null)
  const [apiEnabled, setApiEnabled] = useState(() => {
    try { return Boolean(JSON.parse(window.sessionStorage.getItem('archflow-api-config') || '{}').enabled) } catch { return false }
  })

  useEffect(() => {
    const onHashChange = () => setRoute(getInitialRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const navigate = (next) => {
    setRoute(next)
    setMobileNavOpen(false)
    window.location.hash = `/${next}`
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveAsset = (feature, prompt) => {
    const meta = outputMeta[feature.id]
    const asset = {
      id: Date.now(),
      title: prompt.trim().slice(0, 18) || feature.nav.replace('AI ', ''),
      type: meta.type,
      files: meta.files,
      time: '刚刚保存',
      source: feature.nav,
      tone: feature.id === 'render' ? 'mist' : feature.id === 'design' ? 'blue' : 'aqua',
    }
    setAssets((current) => [asset, ...current])
    setToast({ title: '已保存到我的资产', detail: `${asset.title} · ${meta.files} 个文件` })
  }

  const confirmDelete = (asset) => {
    setAssets((current) => current.filter((item) => item.id !== asset.id))
    setDialog(null)
    setToast({ title: '资产已删除', detail: `${asset.title} 已从项目资产库移除。` })
  }

  const currentFeature = features.find((feature) => feature.id === route)

  return (
    <div className="app-shell">
      <Sidebar
        route={route}
        open={mobileNavOpen}
        onNavigate={navigate}
        onClose={() => setMobileNavOpen(false)}
        onStatus={() => setDialog({ type: 'profile' })}
        apiEnabled={apiEnabled}
      />
      <main className="main-shell">
        <Topbar route={route} onMenu={() => setMobileNavOpen(true)} onNavigate={navigate} />
        <div className="page-shell">
          {route === 'home' && <HomeView onNavigate={navigate} />}
          {currentFeature && (
            <FeatureWorkspace
              key={currentFeature.id}
              feature={currentFeature}
              onNavigate={navigate}
              onSave={saveAsset}
              onDialog={setDialog}
              onToast={setToast}
            />
          )}
          {route === 'assets' && (
            <AssetsView assets={assets} onDialog={setDialog} onNavigate={navigate} />
          )}
        </div>
      </main>
      {dialog && <Dialog data={dialog} onClose={() => setDialog(null)} onDelete={confirmDelete} onToast={setToast} onApiChanged={setApiEnabled} />}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  )
}

function Sidebar({ route, open, onNavigate, onClose, onStatus, apiEnabled }) {
  return (
    <>
      <button className={`nav-scrim ${open ? 'is-open' : ''}`} aria-label="关闭导航" onClick={onClose} />
      <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label="主导航">
        <div className="brand-row">
          <button className="brand" onClick={() => onNavigate('home')} aria-label="返回 ArchFlow 工作台">
            <span className="brand-mark"><Sparkles /></span>
            <span><strong>ArchFlow</strong><small>AI DESIGN OS</small></span>
          </button>
          <button className="icon-button sidebar-close" onClick={onClose} aria-label="关闭导航"><X /></button>
        </div>

        <button className="project-switcher" type="button">
          <span className="project-avatar">JN</span>
          <span className="project-copy"><small>CURRENT PROJECT</small><strong>江南水岸文化中心</strong></span>
          <ChevronDown />
        </button>

        <nav className="nav-stack">
          <p className="nav-caption">WORKSPACE</p>
          {navItems.map((item, index) => {
            const Icon = item.icon
            const separated = item.id === 'assets'
            return (
              <button
                key={item.id}
                className={`nav-item ${route === item.id ? 'is-active' : ''} ${separated ? 'is-separated' : ''}`}
                onClick={() => onNavigate(item.id)}
                aria-current={route === item.id ? 'page' : undefined}
              >
                <span className="nav-icon"><Icon /></span>
                <span>{item.nav}</span>
                {index > 0 && index < 7 && <small>{String(index).padStart(2, '0')}</small>}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <button className="api-card" onClick={onStatus}>
            <span className="status-pulse" />
            <span><strong>{apiEnabled ? '用户 API 已连接' : 'API 配置入口'}</strong><small>{apiEnabled ? 'EXTERNAL API ACTIVE' : 'LOCAL DEMO ADAPTER'}</small></span>
            <ArrowRight />
          </button>
          <button className="profile-row" type="button" onClick={onStatus}>
            <span className="avatar"><UserRound /></span>
            <span><strong>方案一组</strong><small>访客演示 · 信息脱敏</small></span>
            <MoreHorizontal />
          </button>
        </div>
      </aside>
    </>
  )
}

function Topbar({ route, onMenu, onNavigate }) {
  const item = navItems.find((nav) => nav.id === route)
  return (
    <header className="topbar">
      <button className="icon-button menu-button" onClick={onMenu} aria-label="打开导航"><Menu /></button>
      <div className="breadcrumbs">
        <button onClick={() => onNavigate('home')}>ArchFlow</button>
        <span>/</span>
        <strong>{item?.nav || '工作台'}</strong>
      </div>
      <div className="topbar-actions">
        <button className="search-pill" type="button" onClick={() => onNavigate('assets')}>
          <Search /><span>搜索项目或资产</span><kbd>⌘ K</kbd>
        </button>
        <button className="icon-button" aria-label="帮助中心"><CircleHelp /></button>
        <button className="icon-button notification" aria-label="通知"><Bell /><span /></button>
      </div>
    </header>
  )
}

function HomeView({ onNavigate }) {
  return (
    <div className="home-view enter-view">
      <section className="home-hero">
        <div className="hero-copy">
          <span className="eyebrow"><span /> MONDAY · 17 AUG</span>
          <h1>早上好，<br />今天从哪一步开始？</h1>
          <p>让 AI 处理重复表达，把判断力留给真正的设计问题。</p>
          <div className="hero-actions">
            <button className="button button-primary" onClick={() => onNavigate('inspiration')}>开始新任务 <ArrowRight /></button>
            <button className="button button-secondary" onClick={() => onNavigate('assets')}>打开最近项目 <FolderOpen /></button>
          </div>
        </div>
        <WorkspaceScene onNavigate={onNavigate} />
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div><span className="eyebrow">AI WORKFLOW</span><h2>从一句需求，到可交付成果</h2></div>
          <p>六个工具对应真实设计流程，每一步都有独立输入与专业输出。</p>
        </div>
        <div className="feature-grid">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <button className="feature-card" key={feature.id} onClick={() => onNavigate(feature.id)}>
                <span className="feature-number">{feature.number}</span>
                <span className="feature-icon"><Icon /></span>
                <span className="feature-content"><strong>{feature.nav}</strong><small>{feature.short}</small></span>
                <span className="feature-arrow"><ArrowRight /></span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="insight-strip">
        <div><span>本周提效</span><strong>18.6 h</strong><small>较上周 +23%</small></div>
        <div><span>已生成成果</span><strong>42</strong><small>6 类专业输出</small></div>
        <div><span>团队复用率</span><strong>68%</strong><small>来自历史资产</small></div>
        <div className="insight-message"><BadgeCheck /><p><strong>演示数据已准备</strong><small>完整走一遍灵感 → 方案 → 资产沉淀，约需 3 分钟。</small></p></div>
      </section>
    </div>
  )
}

function WorkspaceScene({ onNavigate }) {
  return (
    <div className="workspace-scene" aria-label="ArchFlow 项目工作区预览">
      <div className="scene-topline"><span><i /> PROJECT OVERVIEW</span><span>Last synced 2 min ago</span></div>
      <div className="scene-cards">
        <button className="scene-card card-one" onClick={() => onNavigate('inspiration')}>
          <span className="mini-sheet"><i /><i /><i /></span>
          <span><small>01 / DISCOVER</small><strong>方案灵感</strong></span><ArrowRight />
        </button>
        <button className="scene-card card-two" onClick={() => onNavigate('design')}>
          <span className="mini-sheet diagram"><i /><i /><i /></span>
          <span><small>02 / DEFINE</small><strong>概念方案</strong></span><ArrowRight />
        </button>
      </div>
      <div className="scene-metrics">
        <div><small>设计进度</small><strong>68<sup>%</sup></strong></div>
        <div><small>本周生成</small><strong>16<sup>项</sup></strong></div>
        <div><small>资产复用</small><strong>9<sup>次</sup></strong></div>
      </div>
      <div className="scene-chart">
        <div className="chart-label"><span>PROJECT ACTIVITY</span><span>17 — 23 AUG</span></div>
        <svg viewBox="0 0 720 130" preserveAspectRatio="none" role="img" aria-label="项目活跃趋势">
          <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#54c8e8" stopOpacity=".28"/><stop offset="1" stopColor="#54c8e8" stopOpacity="0"/></linearGradient></defs>
          <path className="chart-area" d="M0,100 C70,92 90,36 155,61 S250,105 305,72 S410,30 474,55 S570,105 720,35 L720,130 L0,130 Z" />
          <path className="chart-line" d="M0,100 C70,92 90,36 155,61 S250,105 305,72 S410,30 474,55 S570,105 720,35" />
          {[0,155,305,474,720].map((cx, i) => <circle key={cx} cx={cx} cy={[100,61,72,55,35][i]} r="4" />)}
        </svg>
      </div>
      <div className="scene-command"><WandSparkles /><span>描述你的设计任务…</span><button aria-label="发送"><Send /></button></div>
    </div>
  )
}

function FeatureWorkspace({ feature, onNavigate, onSave, onDialog, onToast }) {
  const [prompt, setPrompt] = useState('')
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [selectedScheme, setSelectedScheme] = useState(null)
  const outputRef = useRef(null)

  const useChip = (chip) => {
    setPrompt((current) => current ? `${current}，${chip}` : chip)
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      onToast({ title: '请先描述任务', detail: '至少填写项目类型、场地或目标成果。' })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const response = await generateWithApi({ feature: feature.id, prompt, files: files.map((file) => file.name) })
      setResult(response)
      window.setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    } catch (error) {
      onToast({ title: 'API 生成失败', detail: error instanceof Error ? error.message : '请检查接口地址、密钥、模型名与跨域设置。' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = () => {
    if (feature.id === 'design' && !selectedScheme) {
      onToast({ title: '先选择一套方案', detail: 'A / B / C 三套方案中至少选择一套再保存。' })
      return
    }
    onSave(feature, prompt)
  }

  return (
    <div className="feature-view enter-view">
      <header className="feature-header">
        <button className="back-link" onClick={() => onNavigate('home')}><ChevronLeft /> 工作台</button>
        <span className="feature-step">{feature.number} / 06</span>
        <div className="feature-title-row">
          <div><span className="eyebrow">{feature.eyebrow}</span><h1>{feature.title}</h1><p>{feature.description}</p></div>
          <span className="header-icon"><feature.icon /></span>
        </div>
      </header>

      <section className="composer-layout" aria-label={`${feature.nav}输入区`}>
        <div className="composer-panel glass-panel">
          <div className="panel-heading"><span><Sparkles /></span><div><h2>告诉 ArchFlow 你正在做什么</h2><p>像和项目搭档沟通一样，写清目标和限制条件。</p></div></div>
          <label className="field-label" htmlFor={`prompt-${feature.id}`}>项目描述 <strong>必填</strong></label>
          <div className="prompt-box">
            <textarea
              id={`prompt-${feature.id}`}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={feature.placeholder}
              rows="6"
              maxLength="800"
            />
            <span className="char-count">{prompt.length} / 800</span>
          </div>
          <div className="quick-row">
            <span>快速补充</span>
            <div>{feature.chips.map((chip) => <button key={chip} onClick={() => useChip(chip)}>{chip}<Plus /></button>)}</div>
          </div>
          <div className="upload-zone">
            <input
              id={`files-${feature.id}`}
              className="sr-only"
              type="file"
              multiple
              onChange={(event) => setFiles(Array.from(event.target.files || []))}
            />
            <label htmlFor={`files-${feature.id}`}>
              <span className="upload-icon"><UploadCloud /></span>
              <span><strong>{files.length ? `已选择 ${files.length} 个文件` : '上传项目资料'}</strong><small>{files.length ? files.map((file) => file.name).join(' · ') : 'PDF、DWG、JPG、PNG，单个不超过 50MB'}</small></span>
              <span className="button button-quiet">选择文件</span>
            </label>
          </div>
          <div className="composer-footer">
            <span><Cloud /> 内容仅用于本次生成，不用于公开训练</span>
            <button className="button button-primary generate-button" onClick={handleGenerate} disabled={loading}>
              {loading ? <><LoaderCircle className="spin" /> 正在分析</> : <>生成专业结果 <WandSparkles /></>}
            </button>
          </div>
        </div>

        <aside className="guide-panel glass-panel">
          <div className="guide-title"><Info /><span><strong>怎样描述更准确？</strong><small>输入越具体，第一版越接近可用结果。</small></span></div>
          <ol>
            {feature.guide.map(([level, detail], index) => (
              <li key={level}><span>{String(index + 1).padStart(2, '0')}</span><p><strong>{level}</strong><small>{detail}</small></p></li>
            ))}
          </ol>
          <div className="guide-example"><span>推荐结构</span><p>项目是什么 + 场地有什么 + 目标是什么 + 哪些不能改</p></div>
        </aside>
      </section>

      <section className="output-anchor" ref={outputRef}>
        {loading && <OutputSkeleton feature={feature} />}
        {result && (
          <OutputPanel
            feature={feature}
            result={result}
            selectedScheme={selectedScheme}
            setSelectedScheme={setSelectedScheme}
            onSave={handleSave}
            onDialog={onDialog}
            onToast={onToast}
          />
        )}
      </section>
    </div>
  )
}

function OutputSkeleton({ feature }) {
  return (
    <div className="output-panel glass-panel loading-panel" aria-live="polite">
      <div className="loading-head"><span className="loading-orbit"><feature.icon /></span><div><strong>正在生成 {feature.nav.replace('AI ', '')}</strong><small>识别输入 · 匹配专业策略 · 组织交付结构</small></div></div>
      <div className="skeleton-grid"><i /><i /><i /></div>
    </div>
  )
}

function OutputPanel({ feature, result, selectedScheme, setSelectedScheme, onSave, onDialog, onToast }) {
  return (
    <div className="output-panel glass-panel">
      <div className="output-head">
        <div><span className="eyebrow"><Check /> GENERATION COMPLETE</span><h2>{feature.nav} · 第一版结果</h2><p>{outputMeta[feature.id].label}，所有内容均可继续调整。</p></div>
        <span className="confidence"><strong>92%</strong><small>信息完整度</small></span>
      </div>

      {result.mode === 'external-api' && (
        <div className="api-result-note">
          <span><Link2 /> USER API RESPONSE</span>
          <p>{result.content}</p>
        </div>
      )}

      {feature.id === 'inspiration' && <InspirationOutput />}
      {feature.id === 'design' && <DesignOutput selected={selectedScheme} onSelect={setSelectedScheme} />}
      {feature.id === 'beautify' && <BeautifyOutput />}
      {feature.id === 'model' && <ModelOutput onToast={onToast} />}
      {feature.id === 'render' && <RenderOutput onDialog={onDialog} />}
      {feature.id === 'report' && <ReportOutput onToast={onToast} />}

      <div className="output-actions">
        <p><Clock3 /> 生成于刚刚 · {result.mode === 'external-api' ? '用户 API 已响应' : '本地演示数据'}</p>
        <div>
          <button className="button button-secondary" onClick={() => onToast({ title: '已创建调整版本', detail: '保留当前结果，并建立 V2 迭代分支。' })}>继续调整 <SlidersHorizontal /></button>
          <button className="button button-primary" onClick={onSave}>保存到资产 <FileArchive /></button>
        </div>
      </div>
    </div>
  )
}

function InspirationOutput() {
  const directions = [
    { code: 'A', title: '水巷织补', subtitle: 'Water Alley Weaving', strategy: '延续江南巷道尺度，以三条可漫游的“水巷”切分体量，让公共活动自然渗入建筑内部。', keywords: ['在地肌理', '慢行渗透', '灰空间'], tone: 'aqua' },
    { code: 'B', title: '工业浮岛', subtitle: 'Industrial Archipelago', strategy: '保留原有结构网格，将展览、教育与商业拆分为漂浮盒体，用连桥建立可变化的公共环路。', keywords: ['遗存转译', '盒体叠置', '弹性运营'], tone: 'blue' },
    { code: 'C', title: '潮汐剧场', subtitle: 'Tidal Commons', strategy: '以高差回应滨水防洪，在临水界面形成阶梯式公共剧场，让建筑日常与节庆状态自由切换。', keywords: ['滨水台阶', '事件空间', '昼夜切换'], tone: 'mist' },
  ]
  const cases = [
    { title: '上海蟠龙天地 / BWSS', location: '上海 · 2026', href: 'https://www.archdaily.com/1039351/shanghai-panlong-tiandi-bwss', tag: '水乡更新' },
    { title: '上海油罐艺术中心 / OPEN', location: '上海西岸 · 2019', href: 'https://www.archdaily.com/935196/tank-shanghai-open-architecture', tag: '工业遗存' },
    { title: '龙美术馆西岸馆 / 大舍', location: '上海西岸 · 2014', href: 'https://www.archdaily.com/554661/long-museum-west-bund-atelier-deshaus', tag: '结构原型' },
  ]
  return (
    <div className="result-stack">
      <div className="result-section-head"><div><span>01</span><h3>设计方向</h3></div><p>三条路径拥有不同空间逻辑，可作为方案前期讨论起点。</p></div>
      <div className="direction-grid">
        {directions.map((item) => (
          <article className={`direction-card tone-${item.tone}`} key={item.code}>
            <div className="direction-visual"><span>{item.code}</span><i /><i /><i /></div>
            <div className="direction-body"><small>{item.subtitle}</small><h4>{item.title}</h4><p>{item.strategy}</p><div>{item.keywords.map((tag) => <span key={tag}>#{tag}</span>)}</div></div>
          </article>
        ))}
      </div>
      <div className="strategy-board">
        <div className="strategy-map"><span className="map-core">滨水文化<br />公共客厅</span><span className="map-node node-a">保留结构</span><span className="map-node node-b">串联水巷</span><span className="map-node node-c">激活首层</span><i /><i /><i /></div>
        <div className="strategy-copy"><span className="eyebrow">SPACE STRATEGY</span><h3>共同空间策略</h3><ul><li>将首层 42% 面积开放给城市，建立全天候公共通廊。</li><li>保留两跨工业结构作为时间证据，新增体量与旧结构脱开。</li><li>用连续檐下空间连接广场、水岸与展厅，改善雨热环境体验。</li></ul></div>
      </div>
      <div className="result-section-head"><div><span>02</span><h3>相关案例</h3></div><p>点击卡片直接进入原案例，面试演示时可说明检索依据。</p></div>
      <div className="case-grid">
        {cases.map((item, index) => (
          <a className={`case-card case-${index + 1}`} href={item.href} target="_blank" rel="noreferrer" key={item.title}>
            <span className="case-art"><i /><i /><i /></span>
            <span className="case-copy"><small>{item.location}</small><strong>{item.title}</strong><em>{item.tag}</em></span><ExternalLink />
          </a>
        ))}
      </div>
    </div>
  )
}

function DesignOutput({ selected, onSelect }) {
  const schemes = [
    { id: 'A', name: '环院聚合', stat: 'FAR 2.42', desc: '围绕共享中庭组织研发、办公与展示，内部协作效率最高。', pros: '动线清晰 / 分期友好' },
    { id: 'B', name: '双塔连桥', stat: 'FAR 2.48', desc: '以空中连桥串联两座塔楼，形成鲜明的企业识别度与立体公共层。', pros: '地标性强 / 景观面大' },
    { id: 'C', name: '城市梯田', stat: 'FAR 2.36', desc: '体量逐层退台形成可达屋顶，强化低碳形象和开放式办公体验。', pros: '绿色屋面 / 采光优' },
  ]
  return (
    <div className="result-stack">
      <div className="result-section-head"><div><span>01</span><h3>概念方案比选</h3></div><p>请选择一套主方案后保存，选择不会覆盖其他候选。</p></div>
      <div className="scheme-grid">
        {schemes.map((scheme, index) => (
          <button className={`scheme-card ${selected === scheme.id ? 'is-selected' : ''}`} onClick={() => onSelect(scheme.id)} key={scheme.id}>
            <span className={`massing massing-${index + 1}`}><i /><i /><i /><i /></span>
            <span className="scheme-heading"><em>OPTION {scheme.id}</em>{selected === scheme.id && <span><Check /> 已选择</span>}</span>
            <strong>{scheme.name}</strong><p>{scheme.desc}</p>
            <span className="scheme-stats"><small>{scheme.stat}</small><small>{scheme.pros}</small></span>
          </button>
        ))}
      </div>
      <div className="comparison-table" role="table" aria-label="三套方案专业指标对比">
        <div className="comparison-row is-head" role="row"><span>专业指标</span><strong>方案 A</strong><strong>方案 B</strong><strong>方案 C</strong></div>
        <div className="comparison-row" role="row"><span>首层开放率</span><strong>46%</strong><strong>38%</strong><strong>52%</strong></div>
        <div className="comparison-row" role="row"><span>标准层效率</span><strong>81%</strong><strong>84%</strong><strong>77%</strong></div>
        <div className="comparison-row" role="row"><span>建造复杂度</span><strong>中</strong><strong>高</strong><strong>中高</strong></div>
        <div className="comparison-row" role="row"><span>推荐结论</span><strong>综合最优</strong><strong>形象优先</strong><strong>低碳优先</strong></div>
      </div>
    </div>
  )
}

function BeautifyOutput() {
  const [position, setPosition] = useState(54)
  return (
    <div className="result-stack">
      <div className="result-section-head"><div><span>01</span><h3>图纸前后对比</h3></div><p>拖动中线查看增强效果；原图线稿、文字和尺寸关系保持不变。</p></div>
      <div className="compare-canvas" style={{ '--compare': `${position}%` }}>
        <div className="drawing drawing-after"><span className="river"/><span className="building b1"/><span className="building b2"/><span className="building b3"/><span className="green g1"/><span className="green g2"/><span className="road"/><em>AI ENHANCED</em></div>
        <div className="drawing drawing-before"><span className="river"/><span className="building b1"/><span className="building b2"/><span className="building b3"/><span className="green g1"/><span className="green g2"/><span className="road"/><em>ORIGINAL CAD</em></div>
        <input aria-label="拖动比较原图和美化图" type="range" min="8" max="92" value={position} onChange={(event) => setPosition(event.target.value)} />
        <span className="compare-line" aria-hidden="true"><MousePointer2 /></span>
      </div>
      <div className="drawing-stats"><div><strong>100%</strong><span>线稿保留</span></div><div><strong>5</strong><span>空间层级</span></div><div><strong>4K</strong><span>输出分辨率</span></div><div><strong>02</strong><span>配色版本</span></div></div>
    </div>
  )
}

function ModelOutput({ onToast }) {
  const [rotate, setRotate] = useState(-18)
  const [zoom, setZoom] = useState(1)
  return (
    <div className="result-stack">
      <div className="model-layout">
        <div className="model-viewport">
          <div className="viewport-toolbar"><span><i /> INTERACTIVE MODEL</span><div><button onClick={() => setZoom((z) => Math.max(.7, z - .1))} aria-label="缩小模型"><ZoomOut /></button><button onClick={() => setZoom((z) => Math.min(1.35, z + .1))} aria-label="放大模型"><ZoomIn /></button><button onClick={() => { setRotate(-18); setZoom(1) }} aria-label="重置视图"><Focus /></button></div></div>
          <div className="model-stage">
            <div className="model-object" style={{ transform: `rotateX(58deg) rotateZ(${rotate}deg) scale(${zoom})` }}><span className="block block-1"/><span className="block block-2"/><span className="block block-3"/><span className="bridge"/><span className="court"/></div>
          </div>
          <label className="rotate-control"><Rotate3D /><input aria-label="旋转模型" type="range" min="-65" max="40" value={rotate} onChange={(event) => setRotate(event.target.value)} /></label>
        </div>
        <aside className="model-info">
          <span className="eyebrow">MODEL REPORT</span><h3>基础模型已重建</h3><p>已识别 12 个楼层、1 个共享中庭和 2 处连桥。红色标记处建议进入专业软件复核。</p>
          <dl><div><dt>模型精度</dt><dd>LOD 200</dd></div><div><dt>闭合体块</dt><dd>98.4%</dd></div><div><dt>分组结构</dt><dd>16 groups</dd></div><div><dt>待复核</dt><dd className="warning-text">3 points</dd></div></dl>
          <div className="download-stack"><button className="button button-secondary" onClick={() => downloadDemo('ArchFlow-model.skp')}>下载 .SKP <Download /></button><button className="button button-secondary" onClick={() => downloadDemo('ArchFlow-model.3dm')}>下载 .3DM <Download /></button></div>
          <button className="text-button" onClick={() => onToast({ title: '质量报告已打开', detail: '演示版包含几何闭合、图层结构和待复核点。' })}>查看模型质量报告 <ArrowRight /></button>
        </aside>
      </div>
    </div>
  )
}

function RenderOutput({ onDialog }) {
  const renders = [
    { id: 1, title: '蓝调时刻 · 滨水入口', meta: '16:9 · 4096 × 2304', className: 'render-one' },
    { id: 2, title: '雨后清晨 · 公共内院', meta: '4:3 · 4096 × 3072', className: 'render-two' },
  ]
  return (
    <div className="result-stack">
      <div className="result-section-head"><div><span>01</span><h3>AI 渲染效果图</h3></div><p>保留原主体、体块、视角与构图，仅强化材质、景观和氛围。</p></div>
      <div className="render-grid">
        {renders.map((render) => (
          <article className="render-card" key={render.id}>
            <button className={`render-art ${render.className}`} onClick={() => onDialog({ type: 'render', item: render })} aria-label={`大图查看${render.title}`}><span className="render-building"><i/><i/><i/></span><span className="render-water"/><span className="render-people"><i/><i/><i/></span><span className="view-label"><Eye /> 点击查看大图</span></button>
            <div><span><strong>{render.title}</strong><small>{render.meta}</small></span><button className="icon-button" onClick={() => downloadDemo(`ArchFlow-render-${render.id}.jpg`)} aria-label={`下载${render.title}`}><Download /></button></div>
          </article>
        ))}
      </div>
    </div>
  )
}

function ReportOutput({ onToast }) {
  const [slide, setSlide] = useState(0)
  const slides = ['项目封面', '场地问题', '设计策略', '空间结构', '关键图纸', '总结展望']
  return (
    <div className="result-stack">
      <div className="report-layout">
        <div className="slide-rail" aria-label="页面列表">
          {slides.map((item, index) => <button className={slide === index ? 'is-active' : ''} onClick={() => setSlide(index)} key={item}><span>{String(index + 1).padStart(2, '0')}</span><i className={`slide-mini slide-mini-${index + 1}`} /><small>{item}</small></button>)}
        </div>
        <div className="slide-stage">
          <div className={`slide-canvas slide-${slide + 1}`}>
            <header><span>ARCHFLOW / 2026</span><span>{String(slide + 1).padStart(2, '0')}</span></header>
            <div className="slide-copy"><small>JIANGNAN WATERFRONT</small><h3>{slides[slide]}</h3><p>{slide === 0 ? '江南水岸文化中心' : '从场地证据出发，让公共生活重新抵达水边。'}</p></div>
            <div className="slide-graphic"><i/><i/><i/><i/></div>
          </div>
          <div className="slide-controls"><button onClick={() => setSlide((current) => Math.max(0, current - 1))} disabled={slide === 0}><ChevronLeft /></button><span>{slide + 1} / {slides.length} · 演示节选</span><button onClick={() => setSlide((current) => Math.min(slides.length - 1, current + 1))} disabled={slide === slides.length - 1}><ChevronRight /></button></div>
        </div>
        <aside className="report-info"><span className="eyebrow">STORYLINE</span><h3>12 页叙事结构</h3><ol><li>用一句结论建立项目立场</li><li>场地问题与设计策略一一对应</li><li>从总图进入关键空间体验</li><li>最后回到可量化设计价值</li></ol><button className="button button-secondary" onClick={() => downloadDemo('ArchFlow-report.pptx')}>下载 PPTX <Download /></button><button className="button button-secondary" onClick={() => downloadDemo('ArchFlow-report-A3.pdf')}>下载 A3 PDF <Download /></button><button className="text-button" onClick={() => onToast({ title: '演讲备注已生成', detail: '按 8 分钟时长分配每页讲述重点。' })}>查看演讲备注 <ArrowRight /></button></aside>
      </div>
    </div>
  )
}

function AssetsView({ assets, onDialog, onNavigate }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('全部')
  const deferredSearch = useDeferredValue(search)
  const types = ['全部', ...new Set(assets.map((asset) => asset.type))]
  const filtered = useMemo(() => assets.filter((asset) => {
    const matchesSearch = `${asset.title}${asset.type}${asset.source}`.toLowerCase().includes(deferredSearch.toLowerCase())
    return matchesSearch && (filter === '全部' || asset.type === filter)
  }), [assets, deferredSearch, filter])

  return (
    <div className="assets-view enter-view">
      <header className="assets-header">
        <div><span className="eyebrow">PROJECT MEMORY</span><h1>我的资产</h1><p>把每一次生成沉淀成下一次设计的起点，而不是散落的临时文件。</p></div>
        <button className="button button-primary" onClick={() => onNavigate('inspiration')}><Plus /> 创建新资产</button>
      </header>
      <section className="asset-stats">
        <div><span>资产包</span><strong>{assets.length}</strong><small>个可复用项目成果</small></div><div><span>总文件数</span><strong>{assets.reduce((sum, asset) => sum + asset.files, 0)}</strong><small>图纸、模型、图像与汇报</small></div><div><span>本周新增</span><strong>{Math.min(8, assets.length)}</strong><small>团队沉淀持续增长</small></div>
      </section>
      <section className="asset-toolbar glass-panel">
        <label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索项目、类型或来源" /></label>
        <div className="filter-row"><SlidersHorizontal />{types.map((type) => <button className={filter === type ? 'is-active' : ''} onClick={() => setFilter(type)} key={type}>{type}</button>)}</div>
      </section>
      {filtered.length ? (
        <div className="asset-grid">
          {filtered.map((asset) => (
            <article className="asset-card" key={asset.id}>
              <button className={`asset-preview tone-${asset.tone}`} onClick={() => onDialog({ type: 'asset', asset })} aria-label={`查看${asset.title}详情`}><span className="asset-folder"><i/><i/><i/></span><span className="asset-type">{asset.type}</span><span className="asset-count">{asset.files}<small>FILES</small></span></button>
              <div className="asset-body"><div><small>{asset.source}</small><h2>{asset.title}</h2></div><div className="asset-meta"><span>{asset.time}</span><span>Local POC</span></div><div className="asset-actions"><button className="button button-quiet" onClick={() => onDialog({ type: 'asset', asset })}>查看详情 <Eye /></button><button className="icon-button delete-icon" onClick={() => onDialog({ type: 'delete', asset })} aria-label={`删除${asset.title}`}><Trash2 /></button></div></div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state"><span><Search /></span><h2>没有找到匹配资产</h2><p>试试调整关键词或筛选条件。</p><button className="button button-secondary" onClick={() => { setSearch(''); setFilter('全部') }}>清除筛选</button></div>
      )}
    </div>
  )
}

function Dialog({ data, onClose, onDelete, onToast, onApiChanged }) {
  const closeRef = useRef(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (data.type === 'profile') {
    return <ProfileApiDialog closeRef={closeRef} onClose={onClose} onToast={onToast} onApiChanged={onApiChanged} />
  }

  if (data.type === 'delete') {
    return (
      <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <section className="dialog-card confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <button ref={closeRef} className="icon-button dialog-close" onClick={onClose} aria-label="关闭"><X /></button>
          <span className="dialog-symbol is-danger"><Trash2 /></span><span className="eyebrow">DELETE ASSET</span><h2 id="delete-title">删除资产包？</h2><p>“{data.asset.title}”及其中 {data.asset.files} 个演示文件将从我的资产移除，此 POC 不提供恢复。</p>
          <div className="dialog-actions"><button className="button button-secondary" onClick={onClose}>保留资产</button><button className="button button-danger" onClick={() => onDelete(data.asset)}>确认删除 <Trash2 /></button></div>
        </section>
      </div>
    )
  }

  if (data.type === 'render') {
    return (
      <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <section className="dialog-card render-dialog" role="dialog" aria-modal="true" aria-label={data.item.title}>
          <button ref={closeRef} className="icon-button dialog-close" onClick={onClose} aria-label="关闭"><X /></button>
          <div className={`dialog-render-art ${data.item.className}`}><span className="render-building"><i/><i/><i/></span><span className="render-water"/><span className="render-people"><i/><i/><i/></span></div>
          <div className="dialog-render-copy"><div><span className="eyebrow">AI RENDER PREVIEW</span><h2>{data.item.title}</h2><p>{data.item.meta} · 主体与构图已锁定</p></div><button className="button button-primary" onClick={() => downloadDemo(`ArchFlow-render-${data.item.id}.jpg`)}>下载原图 <Download /></button></div>
        </section>
      </div>
    )
  }

  const asset = data.asset
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card asset-dialog" role="dialog" aria-modal="true" aria-labelledby="asset-title">
        <button ref={closeRef} className="icon-button dialog-close" onClick={onClose} aria-label="关闭"><X /></button>
        <div className={`dialog-asset-preview tone-${asset.tone}`}><span className="asset-folder"><i/><i/><i/></span><FileArchive /></div>
        <div className="dialog-asset-copy"><span className="eyebrow">ASSET PACKAGE</span><h2 id="asset-title">{asset.title}</h2><p>由 {asset.source} 生成，包含可继续编辑的项目成果和过程记录。</p><dl><div><dt>资产类型</dt><dd>{asset.type}</dd></div><div><dt>文件数量</dt><dd>{asset.files} 个</dd></div><div><dt>更新时间</dt><dd>{asset.time}</dd></div></dl><div className="dialog-actions"><button className="button button-secondary" onClick={() => downloadDemo(`${asset.title}.zip`)}>下载资产 <Download /></button><button className="button button-primary" onClick={onClose}>完成 <Check /></button></div></div>
      </section>
    </div>
  )
}

function ProfileApiDialog({ closeRef, onClose, onToast, onApiChanged }) {
  const stored = window.sessionStorage.getItem('archflow-api-config')
  const initial = stored ? JSON.parse(stored) : {}
  const [enabled, setEnabled] = useState(Boolean(initial.enabled))
  const [baseUrl, setBaseUrl] = useState(initial.baseUrl || 'https://api.openai.com/v1')
  const [model, setModel] = useState(initial.model || '')
  const [apiKey, setApiKey] = useState(initial.apiKey || '')

  const save = (event) => {
    event.preventDefault()
    if (enabled && (!baseUrl.trim() || !model.trim() || !apiKey.trim())) {
      onToast({ title: 'API 配置未完成', detail: '启用真实生成前，请填写接口地址、模型名和 API Key。' })
      return
    }
    window.sessionStorage.setItem('archflow-api-config', JSON.stringify({
      enabled,
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      apiKey: apiKey.trim(),
    }))
    onApiChanged(enabled)
    onClose()
    onToast({
      title: enabled ? '用户 API 已启用' : '已切回本地演示',
      detail: enabled ? '下一次生成将直接请求你配置的兼容接口。' : '生成结果将继续使用本地演示数据。',
    })
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <button ref={closeRef} className="icon-button dialog-close" onClick={onClose} aria-label="关闭"><X /></button>
        <div className="profile-dialog-head">
          <span className="large-avatar"><UserRound /></span>
          <div><span className="eyebrow">DEMO IDENTITY</span><h2 id="profile-title">方案一组</h2><p>企业专业版 · 面试演示环境</p></div>
        </div>
        <div className="privacy-note"><BadgeCheck /><p><strong>用户信息已脱敏</strong><small>本站不展示真实姓名、邮箱或企业名称；当前身份统一以“方案一组”作为演示账号。</small></p></div>
        <form className="api-form" onSubmit={save}>
          <div className="api-form-head"><div><span className="eyebrow">BRING YOUR OWN API</span><h3>连接真实生成接口</h3></div><label className="switch"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /><span /><em>{enabled ? '已启用' : '未启用'}</em></label></div>
          <p className="api-description">支持 OpenAI-compatible <code>/chat/completions</code> 接口。密钥仅保存在当前浏览器会话，关闭标签页后自动清除。</p>
          <div className="api-fields">
            <label><span>API Base URL</span><input type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" disabled={!enabled} /></label>
            <label><span>Model</span><input value={model} onChange={(event) => setModel(event.target.value)} placeholder="请输入模型名称" disabled={!enabled} /></label>
            <label className="full-field"><span>API Key</span><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="sk-••••••••••••" autoComplete="off" disabled={!enabled} /></label>
          </div>
          <div className="security-hint"><Info /><span>浏览器直连要求接口允许 CORS。正式生产环境应由服务端代理请求，避免在前端长期保存密钥。</span></div>
          <div className="dialog-actions"><button className="button button-secondary" type="button" onClick={onClose}>取消</button><button className="button button-primary" type="submit">保存连接 <Link2 /></button></div>
        </form>
      </section>
    </div>
  )
}

function Toast({ toast, onClose }) {
  return <div className="toast" role="status"><span><Check /></span><p><strong>{toast.title}</strong><small>{toast.detail}</small></p><button onClick={onClose} aria-label="关闭提示"><X /></button></div>
}
