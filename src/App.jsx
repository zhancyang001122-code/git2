import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  BrainCircuit,
  Check,
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
  ImagePlus,
  Link2,
  LayoutDashboard,
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
import { checkModelConnection, createAssetRecord, features, generateWithApi, getConfiguredImageModes, initialAssets, modelProviders, navItems, outputMeta, resolveModelConnection } from './data.js'
import {
  deletePersistentAsset,
  generateWithCloudApi,
  getCloudCapabilities,
  getCurrentSession,
  insertMemo,
  internalAccountUsername,
  isSupabaseConfigured,
  loadInternalWorkspace,
  persistAsset,
  recordGeneration,
  recoverInvalidSession,
  signInInternalAccount,
  signOutInternalAccount,
  subscribeToAuth,
  updateMemo,
} from './lib/supabase.js'
import { formatElapsedTime } from './lib/time.js'
import { imageModeConnection, imageModeOptionLabel, isImageModeSelectable } from './lib/image-mode-status.js'
import { originalImageOutputSize } from './lib/image-output-size.js'
import { isInvalidSessionError } from './lib/session.js'
import { loadWorkspaceAndCapabilities } from './lib/workspace-loader.js'

const validRoutes = new Set(navItems.map((item) => item.id))
const sidebarNavItems = navItems.filter((item) => item.id !== 'home')
const imageFrameOptions = [
  { id: 'original', label: '跟随原图比例 · 4K', requiresOriginalRatio: true },
  { id: '16:9', label: '横图 16:9 · 3840×2160', size: '3840x2160', aspectRatio: '16:9' },
  { id: '4:3', label: '横图 4:3 · 3840×2880', size: '3840x2880', aspectRatio: '4:3' },
  { id: '1:1', label: '方图 1:1 · 3840×3840', size: '3840x3840', aspectRatio: '1:1' },
  { id: '3:4', label: '竖图 3:4 · 2880×3840', size: '2880x3840', aspectRatio: '3:4' },
  { id: '9:16', label: '竖图 9:16 · 2160×3840', size: '2160x3840', aspectRatio: '9:16' },
]
const demoMemos = [
  { id: 2, text: '周五前完成 A / B / C 方案比选，准备甲方沟通版。', time: '今天 10:20' },
  { id: 1, text: '确认滨水入口雨棚净高，与结构顾问同步 4.8m 控制线。', time: '今天 09:35' },
]

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

function downloadGeneratedAsset(url, name) {
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.target = '_blank'
  link.rel = 'noreferrer'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export default function App() {
  const [route, setRoute] = useState(getInitialRoute)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [assets, setAssets] = useState(initialAssets)
  const [memos, setMemos] = useState(demoMemos)
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [syncState, setSyncState] = useState('guest')
  const [managedModels, setManagedModels] = useState({ languageReady: false, languageModel: '', imageModes: [] })
  const [dialog, setDialog] = useState(null)
  const [toast, setToast] = useState(null)
  const [imageModes, setImageModes] = useState(getConfiguredImageModes)
  const [apiEnabled, setApiEnabled] = useState(() => {
    try {
      const config = JSON.parse(window.sessionStorage.getItem('archflow-api-config') || '{}')
      const hasVerifiedImage = config.version
        ? (config.imageApiKey && config.imageVerified) || (config.image2ApiKey && config.image2Verified)
        : config.imageApiKey || config.apiKey
      return Boolean(config.enabled && config.llmApiKey && hasVerifiedImage)
    } catch { return false }
  })
  const currentUserName = session?.user?.user_metadata?.display_name
    || session?.user?.user_metadata?.username
    || (session ? internalAccountUsername : '方案一组')

  useEffect(() => {
    const onHashChange = () => setRoute(getInitialRoute())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    let active = true
    getCurrentSession()
      .then((currentSession) => active && setSession(currentSession))
      .catch(() => active && setSession(null))
      .finally(() => active && setAuthReady(true))
    const unsubscribe = subscribeToAuth((nextSession, event) => {
      if (!active) return
      if (event === 'INITIAL_SESSION') return
      setSession(nextSession)
      setAuthReady(true)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true
    if (!session) {
      setAssets(initialAssets)
      setMemos(demoMemos)
      setSyncState('guest')
      setManagedModels({ languageReady: false, languageModel: '', imageModes: [] })
      setImageModes(getConfiguredImageModes())
      return () => { active = false }
    }

    setSyncState('loading')
    loadWorkspaceAndCapabilities(loadInternalWorkspace, getCloudCapabilities)
      .then(({ workspace, capabilities, capabilitiesError }) => {
        if (!active) return
        setAssets(workspace.assets)
        setMemos(workspace.memos)
        if (capabilities) {
          setImageModes(capabilities.imageModes.length ? capabilities.imageModes : [{ id: 'image1', label: '内置生图 API 1', model: '等待服务端配置' }])
          setManagedModels(capabilities)
        } else {
          setImageModes([{ id: 'image1', label: '内置生图 API', model: '模型服务暂不可用' }])
          setManagedModels({ languageReady: false, languageModel: '', imageModes: [] })
          setToast({
            title: '工作区已加载，模型服务暂不可用',
            detail: capabilitiesError instanceof Error ? capabilitiesError.message : '请稍后刷新模型状态。',
          })
        }
        setSyncState('ready')
      })
      .catch(async (error) => {
        if (!active) return
        if (isInvalidSessionError(error)) {
          await recoverInvalidSession()
          if (!active) return
          setSession(null)
          setSyncState('guest')
          setToast({ title: '登录状态已失效', detail: '为保护云端数据，已安全退出。请重新登录内部账户。' })
          return
        }
        setAssets([])
        setMemos([])
        setSyncState('error')
        setToast({ title: '云端工作区加载失败', detail: error instanceof Error ? error.message : '请稍后重新登录。' })
      })
    return () => { active = false }
  }, [session])

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

  const saveAsset = async (feature, prompt, result) => {
    const draftAsset = { ...createAssetRecord(feature, prompt, result), resultData: result }
    try {
      const asset = session ? await persistAsset(draftAsset) : draftAsset
      setAssets((current) => [asset, ...current])
      setToast({
        title: '已保存到我的资产',
        detail: session
          ? `${asset.title} · 已同步至内部账户云端资产库`
          : asset.sessionOnly
            ? `${asset.title} · 生成图可在当前标签页内继续下载`
            : `${asset.title} · ${asset.files} 个文件`,
      })
    } catch (error) {
      setToast({ title: '资产保存失败', detail: error instanceof Error ? error.message : '请检查云端存储配置。' })
    }
  }

  const confirmDelete = async (asset) => {
    try {
      if (session && asset.persistent) await deletePersistentAsset(asset)
      setAssets((current) => current.filter((item) => item.id !== asset.id))
      setDialog(null)
      setToast({ title: '资产已删除', detail: `${asset.title} 已从项目资产库移除。` })
    } catch (error) {
      setToast({ title: '资产删除失败', detail: error instanceof Error ? error.message : '请稍后再试。' })
    }
  }

  const addWorkspaceMemo = async (text) => {
    if (session) {
      const memo = await insertMemo(text)
      setMemos((current) => [memo, ...current])
      return
    }
    const time = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
    setMemos((current) => [{ id: Date.now(), text, time: `今天 ${time}` }, ...current])
  }

  const updateWorkspaceMemo = async (memo, text) => {
    const saved = session ? await updateMemo(memo.id, text) : { ...memo, text }
    setMemos((current) => current.map((item) => item.id === memo.id ? saved : item))
  }

  const login = async (username, password) => {
    const nextSession = await signInInternalAccount(username, password)
    setSession(nextSession)
    return nextSession
  }

  const logout = async () => {
    await signOutInternalAccount()
    setSession(null)
    setDialog(null)
    setToast({ title: '已退出内部账户', detail: '已恢复为“方案一组”访客演示数据。' })
  }

  const saveGenerationHistory = async (payload) => {
    if (!session) return
    await recordGeneration(payload)
  }

  const handleApiChanged = (enabled) => {
    setApiEnabled(enabled)
    setImageModes(getConfiguredImageModes())
  }

  return (
    <div className="app-shell">
      <Sidebar
        route={route}
        open={mobileNavOpen}
        onNavigate={navigate}
        onClose={() => setMobileNavOpen(false)}
        onApiConfig={() => setDialog({ type: 'api-config' })}
        onProfile={() => setDialog({ type: 'profile' })}
        apiEnabled={session ? managedModels.languageReady && managedModels.imageModes.length > 0 : apiEnabled}
        apiKeyCount={session ? (managedModels.languageReady ? 1 : 0) + managedModels.imageModes.length : apiEnabled ? 1 + imageModes.length : 0}
        session={session}
        userName={currentUserName}
        syncState={syncState}
      />
      <main className="main-shell">
        <Topbar route={route} onMenu={() => setMobileNavOpen(true)} onNavigate={navigate} onDialog={setDialog} />
        <div className="page-shell">
          {route === 'home' && <HomeView userName={currentUserName} onNavigate={navigate} onDialog={setDialog} memos={memos} onAddMemo={addWorkspaceMemo} onUpdateMemo={updateWorkspaceMemo} persistent={Boolean(session)} />}
          {features.map((feature) => (
            <div hidden={route !== feature.id} key={feature.id}>
              <FeatureWorkspace
                feature={feature}
                active={route === feature.id}
                onNavigate={navigate}
                onSave={saveAsset}
                onDialog={setDialog}
                onToast={setToast}
                imageModes={imageModes}
                managed={Boolean(session)}
                onGenerationComplete={saveGenerationHistory}
              />
            </div>
          ))}
          {route === 'assets' && (
            <AssetsView assets={assets} onDialog={setDialog} onNavigate={navigate} />
          )}
        </div>
      </main>
      {dialog && <Dialog data={dialog} onClose={() => setDialog(null)} onDelete={confirmDelete} onToast={setToast} onApiChanged={handleApiChanged} session={session} authReady={authReady} syncState={syncState} onLogin={login} onLogout={logout} managedModels={managedModels} />}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
    </div>
  )
}

function Sidebar({ route, open, onNavigate, onClose, onApiConfig, onProfile, apiEnabled, apiKeyCount, session, userName, syncState }) {
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

        <button
          className={`project-switcher ${route === 'home' ? 'is-active' : ''}`}
          type="button"
          onClick={() => onNavigate('home')}
          aria-current={route === 'home' ? 'page' : undefined}
        >
          <span className="project-avatar"><LayoutDashboard /></span>
          <span className="project-copy"><small>WORKSPACE HOME</small><strong>工作台</strong></span>
          <ArrowRight />
        </button>

        <nav className="nav-stack">
          <p className="nav-caption">AI WORKFLOW</p>
          {sidebarNavItems.map((item) => {
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
                {item.number && <small>{item.number}</small>}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <button className="api-card" onClick={onApiConfig}>
            <span className="status-pulse" />
            <span><strong>{session ? (apiEnabled ? '内置模型已连接' : '内置模型待配置') : apiEnabled ? '模型密钥已配置' : 'API Key 配置'}</strong><small>{session ? `${apiKeyCount} SERVER MODEL${apiKeyCount === 1 ? '' : 'S'} · ${syncState === 'ready' ? 'CLOUD READY' : 'SYNCING'}` : apiEnabled ? `${apiKeyCount} MODEL KEYS READY` : 'LOCAL DEMO ADAPTER'}</small></span>
            <ArrowRight />
          </button>
          <button className="profile-row" type="button" onClick={onProfile}>
            <span className="avatar"><UserRound /></span>
            <span><strong>{userName}</strong><small>{session ? '内部账户 · 云端同步' : '访客演示 · 信息脱敏'}</small></span>
            <MoreHorizontal />
          </button>
        </div>
      </aside>
    </>
  )
}

function Topbar({ route, onMenu, onNavigate, onDialog }) {
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
          <Search /><span>搜索项目或资产</span>
        </button>
        <button className="icon-button" aria-label="帮助中心" onClick={() => onDialog({ type: 'help' })}><CircleHelp /></button>
        <button className="icon-button notification" aria-label="通知" onClick={() => onDialog({ type: 'notification' })}><Bell /><span /></button>
      </div>
    </header>
  )
}

function HomeView({ userName, onNavigate, onDialog, memos, onAddMemo, onUpdateMemo, persistent }) {
  return (
    <div className="home-view enter-view">
      <section className="home-hero">
        <div className="hero-copy">
          <span className="eyebrow"><span /> MONDAY · 17 AUG</span>
          <h1><span className="hero-user-name">{userName}，</span><br />今天从哪一步开始？</h1>
          <p>让 AI 处理重复表达，把判断力留给真正的设计问题。</p>
          <div className="hero-actions">
            <button className="button button-primary" onClick={() => onNavigate('inspiration')}>开始新任务 <ArrowRight /></button>
            <button className="button button-secondary" onClick={() => onNavigate('assets')}>打开最近项目 <FolderOpen /></button>
          </div>
        </div>
        <WorkspaceScene onDialog={onDialog} memos={memos} onAddMemo={onAddMemo} onUpdateMemo={onUpdateMemo} persistent={persistent} />
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

function WorkspaceScene({ onDialog, memos, onAddMemo, onUpdateMemo, persistent }) {
  const [draft, setDraft] = useState('')
  const [showAllMemos, setShowAllMemos] = useState(false)
  const [saving, setSaving] = useState(false)

  const addMemo = async (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    setSaving(true)
    try {
      await onAddMemo(text)
      setDraft('')
    } finally {
      setSaving(false)
    }
  }

  const openMemo = (memo) => {
    onDialog({
      type: 'memo',
      memo,
      persistent,
      onSave: (text) => onUpdateMemo(memo, text),
    })
  }

  return (
    <div className="workspace-scene" aria-label="ArchFlow 项目工作区预览">
      <div className="scene-topline"><span><i /> WEEKLY OVERVIEW</span><span>17 — 23 AUG</span></div>
      {showAllMemos ? (
        <section className="memo-detail-panel" aria-label="备忘录详情">
          <div className="memo-detail-head">
            <button onClick={() => setShowAllMemos(false)}><ChevronLeft /> 返回本周概况</button>
            <span>{memos.length} 条备忘录</span>
          </div>
          <div className="memo-detail-list">
            {memos.map((memo, index) => (
              <button className="memo-detail-item" type="button" onClick={() => openMemo(memo)} key={memo.id}><span>{String(memos.length - index).padStart(2, '0')}</span><p>{memo.text}</p><small><Clock3 /> {memo.time}</small></button>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="scene-memo-block" aria-label="最近备忘录">
            <div className="memo-block-head"><span>PROJECT MEMOS · {String(memos.length).padStart(2, '0')}</span>{memos.length > 2 && <button className="memo-more-tab" onClick={() => setShowAllMemos(true)}>更多 {memos.length - 2}<ArrowRight /></button>}</div>
            <div className="memo-card-grid" aria-live="polite">
              {!memos.length && <div className="memo-empty"><WandSparkles /><p><strong>还没有真实备忘录</strong><small>在下方写下第一条，登录后会长期保留。</small></p></div>}
              {memos.slice(0, 2).map((memo, index) => (
                <button className="memo-card" type="button" onClick={() => openMemo(memo)} aria-label={`查看并编辑备忘录：${memo.text}`} key={memo.id}><span>{String(memos.length - index).padStart(2, '0')}</span><p>{memo.text}</p><small><Clock3 /> {memo.time}</small></button>
              ))}
            </div>
          </section>
          <div className="scene-metrics">
            <div><small>设计进度</small><strong>68<sup>%</sup></strong></div>
            <div><small>本周生成</small><strong>16<sup>项</sup></strong></div>
            <div><small>资产复用</small><strong>9<sup>次</sup></strong></div>
          </div>
          <div className="scene-chart">
            <div className="chart-label"><span>PROJECT ACTIVITY</span><span>本周概况</span></div>
            <svg viewBox="0 0 720 130" preserveAspectRatio="none" role="img" aria-label="本周项目活跃趋势">
              <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#54c8e8" stopOpacity=".28"/><stop offset="1" stopColor="#54c8e8" stopOpacity="0"/></linearGradient></defs>
              <path className="chart-area" d="M0,100 C70,92 90,36 155,61 S250,105 305,72 S410,30 474,55 S570,105 720,35 L720,130 L0,130 Z" />
              <path className="chart-line" d="M0,100 C70,92 90,36 155,61 S250,105 305,72 S410,30 474,55 S570,105 720,35" />
              {[0,155,305,474,720].map((cx, i) => <circle key={cx} cx={cx} cy={[100,61,72,55,35][i]} r="4" />)}
            </svg>
          </div>
        </>
      )}
      <form className="scene-command" onSubmit={addMemo}><WandSparkles /><input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength="120" aria-label="新增项目备忘录" placeholder="写下本周项目备忘录…" /><button type="submit" aria-label="保存备忘录" disabled={!draft.trim() || saving}>{saving ? <LoaderCircle className="spin" /> : <Send />}</button></form>
    </div>
  )
}

function FeatureWorkspace({ feature, active, onNavigate, onSave, onDialog, onToast, imageModes, managed, onGenerationComplete }) {
  const [prompt, setPrompt] = useState('')
  const [files, setFiles] = useState([])
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [result, setResult] = useState(null)
  const [selectedScheme, setSelectedScheme] = useState(null)
  const [imageMode, setImageMode] = useState(imageModes[0]?.id || 'demo')
  const [imageFrame, setImageFrame] = useState(feature.id === 'beautify' ? '4:3' : '16:9')
  const [customImageWidth, setCustomImageWidth] = useState('3840')
  const [customImageHeight, setCustomImageHeight] = useState(feature.id === 'beautify' ? '2880' : '2160')
  const outputRef = useRef(null)
  const dragDepth = useRef(0)
  const activeRef = useRef(active)
  const scrollOnReveal = useRef(false)
  const usesImageModel = ['beautify', 'render'].includes(feature.id)
  const renderImageModes = imageModes.length ? imageModes : [{ id: 'demo', label: '本地演示', model: '未连接 API', maxSize: '4K', supportsCustomSize: true, connected: false, connectionStatus: 'warning' }]
  const activeImageMode = renderImageModes.find((mode) => mode.id === imageMode) || renderImageModes[0]
  const availableImageFrameOptions = imageFrameOptions.filter((frame) => !frame.requiresOriginalRatio || activeImageMode?.supportsOriginalRatio !== false)
  const activeFrame = availableImageFrameOptions.find((frame) => frame.id === imageFrame) || availableImageFrameOptions[0]

  useEffect(() => {
    activeRef.current = active
    if (!active || !result || !scrollOnReveal.current) return undefined
    scrollOnReveal.current = false
    const timer = window.setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
    return () => window.clearTimeout(timer)
  }, [active, result])

  useEffect(() => {
    const nextModes = imageModes.length ? imageModes : [{ id: 'demo' }]
    if (!nextModes.some((mode) => mode.id === imageMode)) setImageMode(nextModes[0].id)
  }, [imageMode, imageModes])

  useEffect(() => {
    if ((imageFrame === 'custom' && !activeImageMode?.supportsCustomSize)
      || (imageFrame === 'original' && activeImageMode?.supportsOriginalRatio === false)) {
      setImageFrame(feature.id === 'beautify' ? '4:3' : '16:9')
    }
  }, [activeImageMode?.supportsCustomSize, activeImageMode?.supportsOriginalRatio, feature.id, imageFrame])

  useEffect(() => {
    if (!loading || !usesImageModel) return undefined
    const startedAt = Date.now()
    const updateElapsedTime = () => setElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    updateElapsedTime()
    const timer = window.setInterval(updateElapsedTime, 1000)
    return () => window.clearInterval(timer)
  }, [loading, usesImageModel])

  const useChip = (chip) => {
    setPrompt((current) => current ? `${current}，${chip}` : chip)
  }

  const appendFiles = (incomingFiles) => {
    const supportedFiles = Array.from(incomingFiles || []).filter((file) => (
      file.type?.startsWith('image/') || /\.(pdf|dwg|dxf)$/i.test(file.name)
    ))
    if (!supportedFiles.length) return 0
    const existing = new Set(files.map((file) => `${file.name}-${file.size}-${file.lastModified}`))
    const addedFiles = supportedFiles
      .filter((file) => !existing.has(`${file.name}-${file.size}-${file.lastModified}`))
      .slice(0, Math.max(0, 6 - files.length))
    if (addedFiles.length) setFiles((current) => [...current, ...addedFiles].slice(0, 6))
    return addedFiles.length
  }

  const handlePaste = (event) => {
    const clipboardFiles = Array.from(event.clipboardData?.files || [])
    const itemFiles = clipboardFiles.length ? [] : Array.from(event.clipboardData?.items || [])
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter(Boolean)
    const pastedImages = [...clipboardFiles, ...itemFiles].filter((file) => file.type?.startsWith('image/'))
    if (!pastedImages.length) return
    event.preventDefault()
    const added = appendFiles(pastedImages)
    onToast({ title: '已粘贴图片', detail: `${added} 张图片已加入本次临时附件，可直接用于识图或渲染。` })
  }

  const isFileDrag = (event) => Array.from(event.dataTransfer?.types || []).includes('Files')

  const handleDragEnter = (event) => {
    if (!isFileDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    dragDepth.current += 1
    setDragActive(true)
  }

  const handleDragLeave = (event) => {
    if (!isFileDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragActive(false)
  }

  const handleDragOver = (event) => {
    if (!isFileDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = (event) => {
    if (!event.dataTransfer?.files?.length) return
    event.preventDefault()
    event.stopPropagation()
    dragDepth.current = 0
    setDragActive(false)
    const added = appendFiles(event.dataTransfer?.files)
    onToast(added
      ? { title: '拖拽上传成功', detail: `${added} 个文件已加入本次临时附件。` }
      : { title: '没有可添加的文件', detail: '支持 JPG、PNG、WEBP、PDF、DWG 和 DXF，最多保留 6 个。' })
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      onToast({ title: '请先描述任务', detail: '至少填写项目类型、场地或目标成果。' })
      return
    }
    if (usesImageModel && !files.some((file) => file.type?.startsWith('image/'))) {
      onToast({ title: '请先上传参考图', detail: feature.id === 'beautify' ? 'AI 图纸美化需要一张原始图纸，生成后才能进行滑杆对比。' : 'AI 渲染需要一张白模或原始效果图，生成后才能进行滑杆对比。' })
      return
    }
    const customWidth = Number(customImageWidth)
    const customHeight = Number(customImageHeight)
    if (usesImageModel && imageFrame === 'custom' && (!Number.isInteger(customWidth) || !Number.isInteger(customHeight) || customWidth < 64 || customHeight < 64 || customWidth > 4096 || customHeight > 4096)) {
      onToast({ title: '自定义图幅无效', detail: '宽和高请输入 64–4096 之间的整数像素值。' })
      return
    }
    let requestedImageSize
    let requestedAspectRatio
    if (imageFrame === 'original') {
      try {
        requestedImageSize = await originalImageOutputSize(files.find((file) => file.type?.startsWith('image/')))
      } catch (error) {
        onToast({ title: '无法跟随原图比例', detail: error instanceof Error ? error.message : '请改用固定比例或自定义图幅。' })
        return
      }
    } else {
      requestedImageSize = imageFrame === 'custom' ? `${customWidth}x${customHeight}` : activeFrame.size
      requestedAspectRatio = imageFrame === 'custom' ? undefined : activeFrame.aspectRatio
    }
    setElapsedSeconds(0)
    setLoading(true)
    setResult(null)
    try {
      const generate = managed ? generateWithCloudApi : generateWithApi
      const response = await generate({
        feature: feature.id,
        prompt,
        files,
        options: {
          imageSlot: imageMode === 'demo' ? undefined : imageMode,
          imageSize: requestedImageSize,
          imageAspectRatio: requestedAspectRatio,
        },
      })
      setResult(response)
      if (managed) {
        try {
          await onGenerationComplete({
            feature: feature.id,
            prompt,
            fileNames: files.map((file) => file.name),
            result: response,
          })
        } catch (historyError) {
          onToast({ title: '结果已生成，历史记录同步失败', detail: historyError instanceof Error ? historyError.message : '稍后可重新生成。' })
        }
      }
      if (activeRef.current) {
        window.setTimeout(() => outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
      } else {
        scrollOnReveal.current = true
        onToast({ title: `${feature.nav}生成完成`, detail: '任务已在后台完成，切回该栏目即可查看结果。' })
      }
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
    onSave(feature, prompt, result)
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
        <div
          className={`composer-panel glass-panel ${dragActive ? 'is-dragging' : ''}`}
          onPaste={handlePaste}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="panel-heading"><span><Sparkles /></span><div><h2>告诉 ArchFlow 你正在做什么</h2><p>像和项目搭档沟通一样，写清目标和限制条件。</p></div></div>
          {files.length > 0 && <FilePreviewList files={files} onRemove={(index) => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} />}
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
            <div className="prompt-drop-overlay" aria-hidden={!dragActive}><UploadCloud /><strong>松开即可上传到项目描述</strong><small>图片会显示预览，文件数量同步更新</small></div>
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
              accept=".pdf,.dwg,.dxf,image/png,image/jpeg,image/webp"
              onChange={(event) => {
                appendFiles(event.target.files)
                event.target.value = ''
              }}
            />
            <label htmlFor={`files-${feature.id}`}>
              <span className="upload-icon"><UploadCloud /></span>
              <span><strong>{files.length ? `已加载 ${files.length} 个临时文件` : '上传项目资料'}</strong><small>{files.length ? '可继续选择、拖入文件或按 Ctrl + V 粘贴图片，最多保留 6 个' : '选择、拖拽或 Ctrl + V 均可上传；PDF / DWG 当前仅记录文件名'}</small></span>
              <span className="button button-quiet upload-button">选择文件{files.length > 0 && <em>{files.length}</em>}</span>
            </label>
          </div>
          <div className="composer-footer">
            <span><Cloud /> {managed ? '项目资料仍为临时附件 · 生成记录登录后云端保留' : '当前标签页内存 · 切换栏目不中断，刷新后释放'}</span>
            <div className="composer-actions">
              {usesImageModel && <label className={`image-mode-picker ${renderImageModes.length === 1 ? 'is-locked' : ''}`}><span><ImagePlus /> 生图模型</span><select aria-label="选择生图模型" value={imageMode} onChange={(event) => setImageMode(event.target.value)} disabled={loading || renderImageModes.length === 1}>{renderImageModes.map((mode) => <option value={mode.id} key={mode.id} disabled={!isImageModeSelectable(mode)}>{imageModeOptionLabel(mode)}</option>)}</select></label>}
              {usesImageModel && <label className="image-mode-picker image-frame-picker"><span><SlidersHorizontal /> 输出图幅</span><select aria-label="选择输出图幅" value={imageFrame} onChange={(event) => setImageFrame(event.target.value)} disabled={loading}>{availableImageFrameOptions.map((frame) => <option value={frame.id} key={frame.id}>{frame.label}</option>)}{activeImageMode?.supportsCustomSize && <option value="custom">自定义宽 × 高</option>}</select></label>}
              {usesImageModel && imageFrame === 'custom' && activeImageMode?.supportsCustomSize && <div className="custom-image-size" aria-label="自定义输出图幅"><label><span>宽</span><input type="number" min="64" max="4096" step="1" inputMode="numeric" value={customImageWidth} onChange={(event) => setCustomImageWidth(event.target.value)} disabled={loading} /></label><b>×</b><label><span>高</span><input type="number" min="64" max="4096" step="1" inputMode="numeric" value={customImageHeight} onChange={(event) => setCustomImageHeight(event.target.value)} disabled={loading} /></label></div>}
              <button className="button button-primary generate-button" onClick={handleGenerate} disabled={loading}>
                {loading ? <><LoaderCircle className="spin" /> {usesImageModel ? <>生成中 <span className="button-timer">{formatElapsedTime(elapsedSeconds)}</span></> : '正在分析'}</> : <>生成专业结果 <WandSparkles /></>}
              </button>
            </div>
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
        {loading && <OutputSkeleton feature={feature} elapsedSeconds={elapsedSeconds} imageMode={activeImageMode} />}
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

function FilePreviewList({ files, onRemove }) {
  const [previews, setPreviews] = useState([])

  useEffect(() => {
    const next = files.map((file) => ({
      name: file.name,
      imageUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }))
    setPreviews(next)
    return () => next.forEach((item) => item.imageUrl && URL.revokeObjectURL(item.imageUrl))
  }, [files])

  return (
    <div className="file-preview-strip" aria-label="本次临时附件">
      {previews.map((item, index) => (
        <div className="file-preview-item" key={`${item.name}-${index}`}>
          {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span><FileArchive /></span>}
          <p><strong>{item.name}</strong><small>仅本次会话</small></p>
          <button type="button" onClick={() => onRemove(index)} aria-label={`移除${item.name}`}><X /></button>
        </div>
      ))}
    </div>
  )
}

function OutputSkeleton({ feature, elapsedSeconds = 0, imageMode = null }) {
  const usesImageModel = ['beautify', 'render'].includes(feature.id)
  return (
    <div className="output-panel glass-panel loading-panel" aria-live="polite" aria-busy="true">
      <div className="loading-head">
        <span className="loading-orbit"><feature.icon /></span>
        <div><strong>正在生成 {feature.nav.replace('AI ', '')}</strong><small>{usesImageModel ? `正在调用 ${imageMode?.label || '生图服务'} · ${imageMode?.model || '等待模型响应'}` : '识别输入 · 匹配专业策略 · 组织交付结构'}</small></div>
        {usesImageModel && <time className="loading-elapsed" dateTime={`PT${elapsedSeconds}S`} aria-live="off"><span>已等待</span><b>{formatElapsedTime(elapsedSeconds)}</b></time>}
      </div>
      <div className="skeleton-grid"><i /><i /><i /></div>
    </div>
  )
}

function OutputPanel({ feature, result, selectedScheme, setSelectedScheme, onSave, onDialog, onToast }) {
  const isLiveResult = /^(external|managed)-/.test(result.mode)
  const isManagedResult = result.mode.startsWith('managed-')
  const liveLabel = result.mode.endsWith('image-api') ? 'REAL IMAGE API' : 'REAL LANGUAGE API'
  return (
    <div className="output-panel glass-panel">
      <div className="output-head">
        <div><span className="eyebrow"><Check /> GENERATION COMPLETE</span><h2>{feature.nav} · 第一版结果</h2><p>{outputMeta[feature.id].label}，所有内容均可继续调整。</p></div>
        <span className="confidence"><strong>92%</strong><small>信息完整度</small></span>
      </div>

      {isLiveResult && (
        <div className="api-result-note">
          <span>{result.mode === 'external-image-api' ? <ImagePlus /> : <BrainCircuit />} {liveLabel}</span>
          <p>由 ArchFlow 预设的 <strong>{result.model}</strong> 实时生成；{isManagedResult ? '本次生成记录已同步，原始上传资料关闭后删除。' : '本次输入与结果未写入 ArchFlow 数据库。'}</p>
        </div>
      )}

      {feature.id === 'inspiration' && <InspirationOutput data={result.structured} />}
      {feature.id === 'design' && <DesignOutput data={result.structured} selected={selectedScheme} onSelect={setSelectedScheme} />}
      {feature.id === 'beautify' && <BeautifyOutput images={result.images} originalImageUrl={result.originalImageUrl} />}
      {feature.id === 'model' && <ModelOutput onToast={onToast} />}
      {feature.id === 'render' && <RenderOutput images={result.images} originalImageUrl={result.originalImageUrl} onDialog={onDialog} />}
      {feature.id === 'report' && <ReportOutput onToast={onToast} />}

      <div className="output-actions">
        <p><Clock3 /> 生成于刚刚 · {isManagedResult ? '内部账户真实结果' : isLiveResult ? '用户 API 真实结果' : '本地演示数据'}</p>
        <div>
          <button className="button button-secondary" onClick={() => onToast({ title: '已创建调整版本', detail: '保留当前结果，并建立 V2 迭代分支。' })}>继续调整 <SlidersHorizontal /></button>
          <button className="button button-primary" onClick={onSave}>保存到资产 <FileArchive /></button>
        </div>
      </div>
    </div>
  )
}

function InspirationOutput({ data }) {
  const fallbackDirections = [
    { code: 'A', title: '水巷织补', subtitle: 'Water Alley Weaving', strategy: '延续江南巷道尺度，以三条可漫游的“水巷”切分体量，让公共活动自然渗入建筑内部。', keywords: ['在地肌理', '慢行渗透', '灰空间'], tone: 'aqua' },
    { code: 'B', title: '工业浮岛', subtitle: 'Industrial Archipelago', strategy: '保留原有结构网格，将展览、教育与商业拆分为漂浮盒体，用连桥建立可变化的公共环路。', keywords: ['遗存转译', '盒体叠置', '弹性运营'], tone: 'blue' },
    { code: 'C', title: '潮汐剧场', subtitle: 'Tidal Commons', strategy: '以高差回应滨水防洪，在临水界面形成阶梯式公共剧场，让建筑日常与节庆状态自由切换。', keywords: ['滨水台阶', '事件空间', '昼夜切换'], tone: 'mist' },
  ]
  const directions = (data?.directions || fallbackDirections).map((item, index) => ({ ...item, code: ['A', 'B', 'C'][index], tone: ['aqua', 'blue', 'mist'][index] }))
  const verifiedCases = {
    panlong: { title: '上海蟠龙天地 / BWSS', location: '上海 · 2023', href: 'https://www.archdaily.com/1039351/shanghai-panlong-tiandi-bwss', image: `${import.meta.env.BASE_URL}case-thumbnails/panlong-tiandi.jpg`, credit: '© Xia Wen', tag: '水乡更新' },
    tank: { title: '上海油罐艺术中心 / OPEN', location: '上海西岸 · 2019', href: 'https://www.archdaily.com/935196/tank-shanghai-open-architecture', image: `${import.meta.env.BASE_URL}case-thumbnails/tank-shanghai.jpg`, credit: '© Qingshan Wu', tag: '工业遗存' },
    longmuseum: { title: '龙美术馆西岸馆 / 大舍', location: '上海西岸 · 2014', href: 'https://www.archdaily.com/554661/long-museum-west-bund-atelier-deshaus', image: `${import.meta.env.BASE_URL}case-thumbnails/long-museum-west-bund.jpg`, credit: '© Shengliang Su', tag: '结构原型' },
  }
  const selectedCaseIds = data?.caseIds?.length ? data.caseIds : Object.keys(verifiedCases)
  const cases = selectedCaseIds.map((id) => verifiedCases[id]).filter(Boolean)
  const sharedStrategies = data?.sharedStrategies || ['将首层 42% 面积开放给城市，建立全天候公共通廊。', '保留两跨工业结构作为时间证据，新增体量与旧结构脱开。', '用连续檐下空间连接广场、水岸与展厅，改善雨热环境体验。']
  return (
    <div className="result-stack">
      <div className="result-section-head"><div><span>01</span><h3>设计方向</h3></div><p>三条路径拥有不同空间逻辑，可作为方案前期讨论起点。</p></div>
      <div className="direction-grid">
        {directions.map((item) => (
          <article className={`direction-card tone-${item.tone}`} key={item.code}>
            <div className="direction-body">
              <div className="direction-card-head"><span>{item.code}</span><small>{item.subtitle}</small></div>
              <h4>{item.title}</h4><p>{item.strategy}</p>
              <div className="direction-keywords">{item.keywords.map((tag) => <span key={tag}>#{tag}</span>)}</div>
            </div>
          </article>
        ))}
      </div>
      <div className="strategy-board">
        <div className="strategy-copy">
          <div className="strategy-copy-head"><div><span className="eyebrow">SPACE STRATEGY</span><h3>共同空间策略</h3></div><p>{data?.coreConcept || '滨水文化公共客厅'}</p></div>
          <ol>{sharedStrategies.map((strategy, index) => <li key={strategy}><span>{String(index + 1).padStart(2, '0')}</span><p>{strategy}</p></li>)}</ol>
        </div>
      </div>
      <div className="result-section-head"><div><span>02</span><h3>相关案例</h3></div><p>点击卡片直接进入原案例，面试演示时可说明检索依据。</p></div>
      <div className="case-grid">
        {cases.map((item, index) => (
          <a className={`case-card case-${index + 1}`} href={item.href} target="_blank" rel="noreferrer" key={item.title}>
            <span className="case-art"><img src={item.image} alt={`${item.title} 项目实景`} loading="lazy" /><small>项目实景 · {item.credit}</small></span>
            <span className="case-copy"><small>{item.location}</small><strong>{item.title}</strong><em>{item.tag}</em></span><ExternalLink />
          </a>
        ))}
      </div>
    </div>
  )
}

function DesignOutput({ data, selected, onSelect }) {
  const fallbackSchemes = [
    { id: 'A', name: '环院聚合', far: 'FAR 2.42', description: '围绕共享中庭组织研发、办公与展示，内部协作效率最高。', pros: '动线清晰 / 分期友好', metrics: { openRate: '46%', efficiency: '81%', complexity: '中', recommendation: '综合最优' } },
    { id: 'B', name: '双塔连桥', far: 'FAR 2.48', description: '以空中连桥串联两座塔楼，形成鲜明的企业识别度与立体公共层。', pros: '地标性强 / 景观面大', metrics: { openRate: '38%', efficiency: '84%', complexity: '高', recommendation: '形象优先' } },
    { id: 'C', name: '城市梯田', far: 'FAR 2.36', description: '体量逐层退台形成可达屋顶，强化低碳形象和开放式办公体验。', pros: '绿色屋面 / 采光优', metrics: { openRate: '52%', efficiency: '77%', complexity: '中高', recommendation: '低碳优先' } },
  ]
  const schemes = data?.schemes || fallbackSchemes
  return (
    <div className="result-stack">
      <div className="result-section-head"><div><span>01</span><h3>概念方案比选</h3></div><p>请选择一套主方案后保存，选择不会覆盖其他候选。</p></div>
      <div className="scheme-grid">
        {schemes.map((scheme, index) => (
          <button className={`scheme-card ${selected === scheme.id ? 'is-selected' : ''}`} onClick={() => onSelect(scheme.id)} key={scheme.id}>
            <span className={`massing massing-${index + 1}`}><i /><i /><i /><i /></span>
            <span className="scheme-heading"><em>OPTION {scheme.id}</em>{selected === scheme.id && <span><Check /> 已选择</span>}</span>
            <strong>{scheme.name}</strong><p>{scheme.description}</p>
            <span className="scheme-stats"><small>{scheme.far}</small><small>{scheme.pros}</small></span>
          </button>
        ))}
      </div>
      <div className="comparison-table" role="table" aria-label="三套方案专业指标对比">
        <div className="comparison-row is-head" role="row"><span>专业指标</span><strong>方案 A</strong><strong>方案 B</strong><strong>方案 C</strong></div>
        <div className="comparison-row" role="row"><span>首层开放率</span>{schemes.map((scheme) => <strong key={`${scheme.id}-open`}>{scheme.metrics.openRate}</strong>)}</div>
        <div className="comparison-row" role="row"><span>标准层效率</span>{schemes.map((scheme) => <strong key={`${scheme.id}-efficiency`}>{scheme.metrics.efficiency}</strong>)}</div>
        <div className="comparison-row" role="row"><span>建造复杂度</span>{schemes.map((scheme) => <strong key={`${scheme.id}-complexity`}>{scheme.metrics.complexity}</strong>)}</div>
        <div className="comparison-row" role="row"><span>推荐结论</span>{schemes.map((scheme) => <strong key={`${scheme.id}-recommendation`}>{scheme.metrics.recommendation}</strong>)}</div>
      </div>
    </div>
  )
}

function BeautifyOutput({ images, originalImageUrl }) {
  const [position, setPosition] = useState(54)
  const beautified = images?.[0]
  const drawing = <><span className="river"/><span className="building b1"/><span className="building b2"/><span className="building b3"/><span className="green g1"/><span className="green g2"/><span className="road"/></>
  return (
    <div className="result-stack">
      <div className="result-section-head"><div><span>01</span><h3>图纸前后对比</h3></div><p>拖动中线查看增强效果；原图线稿、文字和尺寸关系保持不变。</p></div>
      <article className="render-compare-card beautify-compare-card">
        <div className="render-compare beautify-compare" style={{ '--compare-position': `${position}%` }}>
          <div className={`render-compare-layer drawing is-generated ${beautified?.imageUrl ? 'has-real-image' : ''}`}>{beautified?.imageUrl ? <img src={beautified.imageUrl} alt="AI 图纸美化后" /> : drawing}<span className="compare-label is-after">美化后</span></div>
          <div className={`render-compare-layer drawing is-original ${originalImageUrl ? 'has-real-image' : ''}`}>{originalImageUrl ? <img src={originalImageUrl} alt="上传的原始图纸" /> : drawing}<span className="compare-label is-before">原图</span></div>
          <span className="compare-line" aria-hidden="true"><i><MousePointer2 /></i></span>
          <input aria-label="拖动查看原图和图纸美化效果" type="range" min="0" max="100" value={position} onInput={(event) => setPosition(Number(event.currentTarget.value))} onChange={(event) => setPosition(Number(event.currentTarget.value))} />
        </div>
        <div className="render-compare-meta"><span><strong>{beautified?.title || '总平面图 · 层次美化'}</strong><small>{beautified?.meta ? `${beautified.meta} · ` : ''}原图 / 美化后 · 拖动滑杆对比</small></span><button className="button button-secondary" onClick={() => beautified?.imageUrl ? downloadGeneratedAsset(beautified.imageUrl, `ArchFlow-beautified-${beautified.id}.png`) : downloadDemo('ArchFlow-beautified-plan.png')}><Download /> 下载美化图</button></div>
      </article>
      <div className="drawing-stats"><div><strong>100%</strong><span>几何保留目标</span></div><div><strong>5</strong><span>表达层级</span></div><div><strong>MAX</strong><span>模型最高画质</span></div><div><strong>01</strong><span>单张成果</span></div></div>
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

function RenderOutput({ images, originalImageUrl, onDialog }) {
  const [position, setPosition] = useState(52)
  const render = images?.[0] || { id: 1, title: '蓝调时刻 · 滨水入口', meta: '16:9 · 单张对比预览', className: 'render-one' }
  const mockBuilding = <><span className="render-building"><i/><i/><i/></span><span className="render-water"/><span className="render-people"><i/><i/><i/></span></>
  return (
    <div className="result-stack">
      <div className="result-section-head"><div><span>01</span><h3>AI 渲染效果图</h3></div><p>保留原主体、体块、视角与构图，仅强化材质、景观和氛围。</p></div>
      <article className="render-compare-card">
        <div className="render-compare" style={{ '--compare-position': `${position}%` }}>
          <div className={`render-compare-layer is-generated ${render.className || ''} ${render.imageUrl ? 'has-real-image' : ''}`}>
            {render.imageUrl ? <img src={render.imageUrl} alt="AI 渲染生成后" /> : mockBuilding}
            <span className="compare-label is-after">生成后</span>
          </div>
          <div className={`render-compare-layer is-original ${originalImageUrl ? 'has-real-image' : ''}`}>
            {originalImageUrl ? <img src={originalImageUrl} alt="上传的原始参考图" /> : mockBuilding}
            <span className="compare-label is-before">原图</span>
          </div>
          <span className="compare-line" aria-hidden="true"><i><MousePointer2 /></i></span>
          <input aria-label="拖动查看原图和生成后效果" type="range" min="0" max="100" value={position} onInput={(event) => setPosition(Number(event.currentTarget.value))} onChange={(event) => setPosition(Number(event.currentTarget.value))} />
        </div>
        <div className="render-compare-meta">
          <span><strong>{render.title}</strong><small>{render.meta} · 拖动滑杆对比</small></span>
          <div><button className="button button-secondary" onClick={() => onDialog({ type: 'render', item: render })}><Eye /> 查看生成大图</button><button className="icon-button" onClick={() => render.imageUrl ? downloadGeneratedAsset(render.imageUrl, `ArchFlow-render-${render.id}.png`) : downloadDemo(`ArchFlow-render-${render.id}.jpg`)} aria-label={`下载${render.title}`}><Download /></button></div>
        </div>
      </article>
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

function AssetPreviewVisual({ asset }) {
  const previews = (asset.artifacts || []).filter((item) => item.imageUrl).slice(0, 3)
  if (!previews.length) return <span className="asset-folder" aria-hidden="true"><i/><i/><i/></span>
  return (
    <span className={`asset-thumbnail-stack is-${previews.length}`} aria-hidden="true">
      {previews.map((item) => <img src={item.imageUrl} alt="" decoding="async" draggable="false" key={item.id} />)}
    </span>
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
              <button className={`asset-preview tone-${asset.tone} ${asset.artifacts?.length ? 'has-generated-preview' : ''}`} onClick={() => onDialog({ type: 'asset', asset })} aria-label={`查看${asset.title}详情`}><AssetPreviewVisual asset={asset} /><span className="asset-type">{asset.type}</span><span className="asset-count">{asset.files}<small>FILES</small></span></button>
              <div className="asset-body"><div><small>{asset.source}</small><h2>{asset.title}</h2></div><div className="asset-meta"><span>{asset.time}</span><span>{asset.persistent ? 'Cloud Asset' : asset.sessionOnly ? 'Session Asset' : 'Local POC'}</span></div><div className="asset-actions"><button className="button button-quiet" onClick={() => onDialog({ type: 'asset', asset })}>查看详情 <Eye /></button><button className="icon-button delete-icon" onClick={() => onDialog({ type: 'delete', asset })} aria-label={`删除${asset.title}`}><Trash2 /></button></div></div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state"><span><Search /></span><h2>没有找到匹配资产</h2><p>试试调整关键词或筛选条件。</p><button className="button button-secondary" onClick={() => { setSearch(''); setFilter('全部') }}>清除筛选</button></div>
      )}
    </div>
  )
}

function Dialog({ data, onClose, onDelete, onToast, onApiChanged, session, authReady, syncState, onLogin, onLogout, managedModels }) {
  const closeRef = useRef(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (event) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (data.type === 'profile') {
    return <ProfileDialog closeRef={closeRef} onClose={onClose} onToast={onToast} session={session} authReady={authReady} syncState={syncState} onLogin={onLogin} onLogout={onLogout} />
  }

  if (data.type === 'api-config') {
    if (session) return <ManagedApiDialog closeRef={closeRef} onClose={onClose} managedModels={managedModels} />
    return <ApiConfigDialog closeRef={closeRef} onClose={onClose} onToast={onToast} onApiChanged={onApiChanged} />
  }

  if (data.type === 'memo') {
    return <MemoDetailDialog closeRef={closeRef} data={data} onClose={onClose} onToast={onToast} />
  }

  if (data.type === 'help' || data.type === 'notification') {
    const isHelp = data.type === 'help'
    return (
      <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <section className="dialog-card confirm-dialog utility-dialog" role="dialog" aria-modal="true" aria-labelledby="utility-title">
          <button ref={closeRef} className="icon-button dialog-close" onClick={onClose} aria-label="关闭"><X /></button>
          <span className="dialog-symbol is-info">{isHelp ? <CircleHelp /> : <Bell />}</span>
          <span className="eyebrow">{isHelp ? 'HELP CENTER' : 'NOTIFICATIONS'}</span>
          <h2 id="utility-title">{isHelp ? '帮助中心' : '通知'}</h2>
          <p>{isHelp ? '有任何疑问请发送至邮箱：本次仅演示' : '本次仅演示'}</p>
          <div className="dialog-actions"><button className="button button-primary" onClick={onClose}>我知道了 <Check /></button></div>
        </section>
      </div>
    )
  }

  if (data.type === 'delete') {
    return (
      <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <section className="dialog-card confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <button ref={closeRef} className="icon-button dialog-close" onClick={onClose} aria-label="关闭"><X /></button>
          <span className="dialog-symbol is-danger"><Trash2 /></span><span className="eyebrow">DELETE ASSET</span><h2 id="delete-title">删除资产包？</h2><p>“{data.asset.title}”及其中 {data.asset.files} 个文件将从我的资产移除，{data.asset.persistent ? '云端记录与对应生成图也会一并删除，' : ''}此 POC 不提供恢复。</p>
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
          <div className={`dialog-render-art ${data.item.className || ''} ${data.item.imageUrl ? 'has-real-image' : ''}`}>{data.item.imageUrl ? <img src={data.item.imageUrl} alt={data.item.title} /> : <><span className="render-building"><i/><i/><i/></span><span className="render-water"/><span className="render-people"><i/><i/><i/></span></>}</div>
          <div className="dialog-render-copy"><div><span className="eyebrow">AI RENDER PREVIEW</span><h2>{data.item.title}</h2><p>{data.item.meta} · 主体与构图已锁定</p></div><button className="button button-primary" onClick={() => data.item.imageUrl ? downloadGeneratedAsset(data.item.imageUrl, `ArchFlow-render-${data.item.id}.png`) : downloadDemo(`ArchFlow-render-${data.item.id}.jpg`)}>下载原图 <Download /></button></div>
        </section>
      </div>
    )
  }

  const asset = data.asset
  const generatedArtifacts = (asset.artifacts || []).filter((item) => item.imageUrl).slice(0, 3)
  const generatedArtifact = generatedArtifacts[0]
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card asset-dialog" role="dialog" aria-modal="true" aria-labelledby="asset-title">
        <button ref={closeRef} className="icon-button dialog-close" onClick={onClose} aria-label="关闭"><X /></button>
        <div className={`dialog-asset-preview tone-${asset.tone} ${generatedArtifact ? 'has-generated-asset' : ''}`}>{generatedArtifact ? <img src={generatedArtifact.imageUrl} alt={generatedArtifact.title} decoding="async" draggable="false" /> : <><span className="asset-folder"><i/><i/><i/></span><FileArchive /></>} {generatedArtifact && <span className="session-preview-badge"><Check /> {asset.persistent ? '内部账户云端资产' : '当前会话真实生成'}</span>}</div>
        <div className="dialog-asset-copy"><span className="eyebrow">ASSET PACKAGE</span><h2 id="asset-title">{asset.title}</h2><p>由 {asset.source} 生成，包含可继续编辑的项目成果和过程记录。{asset.resultData && ' 本次真实生成内容已随资产保留。'}</p><dl><div><dt>资产类型</dt><dd>{asset.type}</dd></div><div><dt>文件数量</dt><dd>{asset.files} 个</dd></div><div><dt>更新时间</dt><dd>{asset.time}</dd></div></dl>{generatedArtifact && <div className="session-asset-file"><span><ImagePlus /></span><p><strong>{generatedArtifact.title}</strong><small>{generatedArtifact.meta} · {asset.persistent ? '私有云存储，可跨设备下载' : '当前标签页内存，刷新后清除'}</small></p><button className="icon-button" onClick={() => downloadGeneratedAsset(generatedArtifact.imageUrl, generatedArtifact.name)} aria-label={`下载${generatedArtifact.title}`}><Download /></button></div>}<div className="dialog-actions"><button className="button button-secondary" onClick={() => generatedArtifact ? downloadGeneratedAsset(generatedArtifact.imageUrl, generatedArtifact.name) : asset.resultData ? downloadDemo(`${asset.title}-成果.json`, JSON.stringify(asset.resultData, null, 2)) : downloadDemo(`${asset.title}.zip`)}>{generatedArtifact ? '下载生成图' : asset.resultData ? '下载成果数据' : '下载资产'} <Download /></button><button className="button button-primary" onClick={onClose}>完成 <Check /></button></div></div>
      </section>
    </div>
  )
}

function MemoDetailDialog({ closeRef, data, onClose, onToast }) {
  const [text, setText] = useState(data.memo.text)
  const [saving, setSaving] = useState(false)
  const save = async (event) => {
    event.preventDefault()
    const nextText = text.trim()
    if (!nextText) return
    setSaving(true)
    try {
      await data.onSave(nextText)
      onClose()
      onToast({ title: '备忘录已更新', detail: data.persistent ? '修改已同步到内部账户云端。' : '修改已保留在当前页面会话。' })
    } catch (error) {
      onToast({ title: '备忘录保存失败', detail: error instanceof Error ? error.message : '请稍后再试。' })
      setSaving(false)
    }
  }
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card memo-dialog" role="dialog" aria-modal="true" aria-labelledby="memo-dialog-title">
        <button ref={closeRef} className="icon-button dialog-close" onClick={onClose} aria-label="关闭"><X /></button>
        <span className="dialog-symbol is-info"><WandSparkles /></span>
        <span className="eyebrow">PROJECT MEMO</span>
        <h2 id="memo-dialog-title">备忘录详情</h2>
        <p className="memo-dialog-meta"><Clock3 /> {data.memo.time} · {data.persistent ? '云端同步' : '当前会话'}</p>
        <form onSubmit={save}>
          <label htmlFor="memo-detail-text">备忘录内容</label>
          <textarea id="memo-detail-text" value={text} onChange={(event) => setText(event.target.value)} maxLength="240" autoFocus />
          <div className="memo-editor-count">{text.length} / 240</div>
          <div className="dialog-actions"><button className="button button-secondary" type="button" onClick={onClose}>取消</button><button className="button button-primary" type="submit" disabled={!text.trim() || saving}>{saving ? <LoaderCircle className="spin" /> : <>保存修改 <Check /></>}</button></div>
        </form>
      </section>
    </div>
  )
}

function ProfileDialog({ closeRef, onClose, onToast, session, authReady, syncState, onLogin, onLogout }) {
  const [loginMode, setLoginMode] = useState(false)
  const [username, setUsername] = useState(internalAccountUsername)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const login = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onLogin(username, password)
      onClose()
      onToast({ title: `欢迎，${internalAccountUsername}`, detail: '正在加载你的云端备忘录、资产与生成记录。' })
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '登录失败，请稍后再试。')
      setLoading(false)
    }
  }

  const logout = async () => {
    setLoading(true)
    try {
      await onLogout()
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : '退出失败，请稍后再试。')
      setLoading(false)
    }
  }

  if (session) {
    return (
      <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <section className="dialog-card profile-dialog account-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title">
          <button ref={closeRef} className="icon-button dialog-close" onClick={onClose} aria-label="关闭"><X /></button>
          <div className="profile-dialog-head"><span className="large-avatar is-authenticated"><UserRound /></span><div><span className="eyebrow">INTERNAL ACCOUNT</span><h2 id="profile-title">{internalAccountUsername}</h2><p>企业内部演示 · 真实数据工作区</p></div></div>
          <div className="privacy-note is-connected"><BadgeCheck /><p><strong>{syncState === 'ready' ? '云端数据已同步' : syncState === 'error' ? '云端同步异常' : '正在同步云端数据'}</strong><small>备忘录、生成记录及保存到资产库的内容会跨设备保留；原始上传资料仍仅用于本次生成。</small></p></div>
          <div className="account-capability-grid"><article><span>01</span><div><strong>私有数据</strong><small>数据库与存储均启用用户级 RLS，仅当前账号可访问。</small></div></article><article><span>02</span><div><strong>内置模型</strong><small>模型密钥保存在服务端，不会下发到浏览器。</small></div></article></div>
          {error && <p className="login-error" role="alert"><Info /> {error}</p>}
          <div className="dialog-actions"><button className="button button-secondary" onClick={logout} disabled={loading}>{loading ? <LoaderCircle className="spin" /> : <><UserRound /> 退出账户</>}</button><button className="button button-primary" onClick={onClose}>进入工作区 <ArrowRight /></button></div>
        </section>
      </div>
    )
  }

  if (loginMode) {
    return (
      <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <section className="dialog-card profile-dialog login-dialog" role="dialog" aria-modal="true" aria-labelledby="login-title">
          <button ref={closeRef} className="icon-button dialog-close" onClick={onClose} aria-label="关闭"><X /></button>
          <span className="dialog-symbol is-info"><UserRound /></span><span className="eyebrow">SECURE SIGN IN</span><h2 id="login-title">登录内部工作区</h2><p>登录后切换到真实、可持久化的数据空间。</p>
          <form className="login-form" onSubmit={login}>
            <label htmlFor="internal-username"><span>账号</span><input id="internal-username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" disabled={loading} /></label>
            <label htmlFor="internal-password"><span>密码</span><input id="internal-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="请输入内部账户密码" autoFocus disabled={loading} /></label>
            {error && <p className="login-error" role="alert"><Info /> {error}</p>}
            {!isSupabaseConfigured && <p className="login-error" role="alert"><Info /> 部署变量尚未配置，当前环境暂时不能登录。</p>}
            <div className="dialog-actions"><button className="button button-secondary" type="button" onClick={() => setLoginMode(false)} disabled={loading}>返回演示身份</button><button className="button button-primary" type="submit" disabled={loading || !authReady || !username.trim() || !password}>{loading ? <><LoaderCircle className="spin" /> 正在登录</> : <>安全登录 <ArrowRight /></>}</button></div>
          </form>
        </section>
      </div>
    )
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card profile-dialog account-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-title">
        <button ref={closeRef} className="icon-button dialog-close" onClick={onClose} aria-label="关闭"><X /></button>
        <div className="profile-dialog-head">
          <span className="large-avatar"><UserRound /></span>
          <div><span className="eyebrow">DEMO IDENTITY</span><h2 id="profile-title">方案一组</h2><p>企业专业版 · 面试演示账号</p></div>
        </div>
        <div className="privacy-note"><BadgeCheck /><p><strong>用户信息已脱敏</strong><small>本站不展示真实姓名、邮箱或企业名称；当前统一以“方案一组”作为演示身份。</small></p></div>
        <div className="account-capability-grid">
          <article><span>01</span><div><strong>当前状态</strong><small>访客演示模式，无真实登录态与用户数据。</small></div></article>
          <article><span>02</span><div><strong>后续接入</strong><small>登录认证、企业组织、角色权限与项目归属。</small></div></article>
        </div>
        <div className="future-auth-note"><UserRound /><p><strong>账户功能已独立预留</strong><small>后续可接入手机号、邮箱或企业 SSO；模型密钥配置已移至独立入口。</small></p></div>
        <div className="dialog-actions"><button className="button button-secondary" onClick={onClose}>继续访客演示</button><button className="button button-primary" onClick={() => setLoginMode(true)}>登录内部账户 <ArrowRight /></button></div>
      </section>
    </div>
  )
}

function ManagedApiDialog({ closeRef, onClose, managedModels }) {
  const modelCount = (managedModels.languageReady ? 1 : 0) + managedModels.imageModes.length
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card profile-dialog managed-api-dialog" role="dialog" aria-modal="true" aria-labelledby="managed-api-title">
        <button ref={closeRef} className="icon-button dialog-close" onClick={onClose} aria-label="关闭"><X /></button>
        <span className="dialog-symbol is-info"><BrainCircuit /></span><span className="eyebrow">SERVER MANAGED MODELS</span><h2 id="managed-api-title">内部账号模型配置</h2><p>密钥只保存在 Supabase Edge Function Secrets，不会显示或写入浏览器。</p>
        <div className="managed-model-list">
          <article className={managedModels.languageReady ? 'is-ready' : 'is-missing'}><span><BrainCircuit /></span><p><strong>语言大模型</strong><small>{managedModels.languageReady ? managedModels.languageModel : '等待管理员配置'}</small></p><em>{managedModels.languageReady ? <><Check /> 已连接</> : <><Info /> 未配置</>}</em></article>
          {managedModels.imageModes.map((mode, index) => {
            const connection = imageModeConnection(mode)
            return <article className={connection.className} key={mode.id}><span><ImagePlus /></span><p><strong>生图大模型 {index + 1}</strong><small>{mode.label} · {mode.model}{mode.maxSize ? ` · 最高 ${mode.maxSize}` : ''}</small><small>{connection.message}</small></p><em>{connection.status === 'connected' ? <Check /> : <Info />} {connection.label}</em></article>
          })}
          {!managedModels.imageModes.length && <article className="is-missing"><span><ImagePlus /></span><p><strong>生图大模型</strong><small>等待管理员配置</small></p><em><Info /> 未配置</em></article>}
        </div>
        <div className="privacy-note"><BadgeCheck /><p><strong>{modelCount} 个服务端模型已注册</strong><small>内部账号无需自行填写 API Key；每路生图 API 的实时连接检测结果见上方。</small></p></div>
        <div className="dialog-actions"><button className="button button-primary" onClick={onClose}>完成 <Check /></button></div>
      </section>
    </div>
  )
}

function ImageApiSection({ slotNumber, slot, check, onChange, onProviderChange, onApply }) {
  const providerConfig = modelProviders.image[slot.provider]
  const fieldId = `image-api-key-${slotNumber}`
  return (
    <section className={`api-group image-api-group ${slotNumber === 2 ? 'is-optional' : ''}`} aria-labelledby={`image-api-title-${slotNumber}`}>
      <div className="api-group-title"><span><ImagePlus /></span><div><h4 id={`image-api-title-${slotNumber}`}>生图 API {slotNumber}{slotNumber === 2 ? '（可选）' : ''}</h4><p>独立服务来源、模型与 Key，可在 AI 渲染页切换。</p></div><em className="preset-state">IMAGE 0{slotNumber}</em></div>
      <div className="api-fields">
        <label><span>服务来源</span><select value={slot.provider} onChange={(event) => onProviderChange(event.target.value)}>{Object.entries(modelProviders.image).map(([id, provider]) => <option value={id} key={id}>{provider.label}</option>)}</select></label>
        {providerConfig.customBase
          ? <label><span>Base URL</span><input value={slot.baseUrl} onChange={(event) => onChange({ baseUrl: event.target.value })} placeholder="https://provider.example/v1" /></label>
          : <div className="preset-connection"><span>内置地址</span><strong>{providerConfig.baseUrl}</strong></div>}
        {providerConfig.customModel && <label className="full-field"><span>模型 ID</span><input value={slot.model} onChange={(event) => onChange({ model: event.target.value })} placeholder="例如 gpt-image-2 或服务商提供的 Gemini 模型 ID" /></label>}
        <div className="api-key-field full-field">
          <label htmlFor={fieldId}>生图 API {slotNumber} Key</label>
          <div className="api-key-control"><input id={fieldId} type="password" value={slot.apiKey} onChange={(event) => onChange({ apiKey: event.target.value })} placeholder={`请输入生图 API ${slotNumber} Key`} autoComplete="off" /><button type="button" onClick={onApply} disabled={check.status === 'checking'}>{check.status === 'checking' ? <LoaderCircle className="spin" /> : <Link2 />} 应用 Key</button></div>
          <p className={`connection-feedback is-${check.status}`} role="status">{check.status === 'success' ? <Check /> : check.status === 'checking' ? <LoaderCircle className="spin" /> : <Info />}<span>{check.message}</span></p>
        </div>
      </div>
    </section>
  )
}

function ApiConfigDialog({ closeRef, onClose, onToast, onApiChanged }) {
  const stored = window.sessionStorage.getItem('archflow-api-config')
  let initial = {}
  try { initial = stored ? JSON.parse(stored) : {} } catch { initial = {} }
  const isCurrentConfig = initial.version >= 4
  const isLegacyBailianModel = (initial.llmProvider || 'bailian') === 'bailian' && /^\d+$/.test(String(initial.llmModel || ''))
  const [llmProvider, setLlmProvider] = useState(isCurrentConfig ? initial.llmProvider || 'bailian' : 'bailian')
  const [llmBaseUrl, setLlmBaseUrl] = useState(isCurrentConfig ? initial.llmBaseUrl || modelProviders.language.bailian.baseUrl : modelProviders.language.bailian.baseUrl)
  const [llmModel, setLlmModel] = useState(isCurrentConfig && !isLegacyBailianModel ? initial.llmModel || modelProviders.language.bailian.model : modelProviders.language.bailian.model)
  const [llmApiKey, setLlmApiKey] = useState(initial.llmApiKey || initial.apiKey || '')
  const makeInitialImageSlot = (prefix, fallbackProvider) => {
    const provider = isCurrentConfig ? initial[`${prefix}Provider`] || fallbackProvider : fallbackProvider
    const preset = modelProviders.image[provider]
    return {
      provider,
      baseUrl: isCurrentConfig ? initial[`${prefix}BaseUrl`] || preset.baseUrl : preset.baseUrl,
      model: isCurrentConfig ? initial[`${prefix}Model`] || preset.model : preset.model,
      apiKey: initial[`${prefix}ApiKey`] || (prefix === 'image' ? initial.apiKey || '' : ''),
    }
  }
  const [imageSlots, setImageSlots] = useState(() => [makeInitialImageSlot('image', 'yunfei'), makeInitialImageSlot('image2', 'compatible')])
  const [llmCheck, setLlmCheck] = useState(isCurrentConfig && initial.llmVerified && !isLegacyBailianModel
    ? { status: 'success', message: `已连接 · ${initial.llmModel || modelProviders.language.bailian.model}` }
    : { status: 'idle', message: '填写后点击“应用 Key”进行检查' })
  const [imageChecks, setImageChecks] = useState(() => [
    isCurrentConfig && initial.imageVerified
      ? { status: 'success', message: `已连接 · ${initial.imageModel || modelProviders.image.yunfei.model}` }
      : { status: 'idle', message: '填写后点击“应用 Key”进行检查' },
    isCurrentConfig && initial.image2Verified
      ? { status: 'success', message: `已连接 · ${initial.image2Model}` }
      : { status: 'idle', message: '可选：填写第二个生图服务后应用检查' },
  ])

  const llmProviderConfig = modelProviders.language[llmProvider]

  const resetImageCheck = (index) => {
    setImageChecks((current) => current.map((item, itemIndex) => itemIndex === index ? { status: 'idle', message: '配置已修改，请重新应用检查' } : item))
  }

  const changeLanguageProvider = (provider) => {
    const config = modelProviders.language[provider]
    setLlmProvider(provider)
    setLlmBaseUrl(config.baseUrl)
    setLlmModel(config.model)
    setLlmCheck({ status: 'idle', message: '配置已修改，请重新应用检查' })
  }

  const updateImageSlot = (index, patch) => {
    setImageSlots((current) => current.map((slot, slotIndex) => slotIndex === index ? { ...slot, ...patch } : slot))
    resetImageCheck(index)
  }

  const changeImageProvider = (index, provider) => {
    const preset = modelProviders.image[provider]
    setImageSlots((current) => current.map((slot, slotIndex) => slotIndex === index ? { ...slot, provider, baseUrl: preset.baseUrl, model: preset.model } : slot))
    resetImageCheck(index)
  }

  const applyLanguageKey = async () => {
    setLlmCheck({ status: 'checking', message: '正在检查鉴权与模型可见性…' })
    try {
      const connection = await checkModelConnection('language', { provider: llmProvider, baseUrl: llmBaseUrl, model: llmModel, apiKey: llmApiKey })
      if (connection.model !== llmModel) setLlmModel(connection.model)
      setLlmCheck({ status: 'success', message: connection.message })
      onToast({ title: '语言大模型已连接', detail: `${connection.providerLabel} · ${connection.model}` })
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接检查失败。'
      setLlmCheck({ status: 'error', message })
      onToast({ title: '语言大模型连接失败', detail: message })
    }
  }

  const applyImageKey = async (index) => {
    const slot = imageSlots[index]
    setImageChecks((current) => current.map((item, itemIndex) => itemIndex === index ? { status: 'checking', message: '正在检查鉴权与模型可见性…' } : item))
    try {
      const connection = await checkModelConnection('image', slot)
      if (connection.model !== slot.model) {
        setImageSlots((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, model: connection.model } : item))
      }
      setImageChecks((current) => current.map((item, itemIndex) => itemIndex === index ? { status: 'success', message: connection.message } : item))
      onToast({ title: `生图 API ${index + 1} 已连接`, detail: `${connection.providerLabel} · ${connection.model}` })
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接检查失败。'
      setImageChecks((current) => current.map((item, itemIndex) => itemIndex === index ? { status: 'error', message } : item))
      onToast({ title: `生图 API ${index + 1} 连接失败`, detail: message })
    }
  }

  const save = (event) => {
    event.preventDefault()
    const hasLanguageKey = Boolean(llmApiKey.trim())
    const hasImageKeys = imageSlots.map((slot) => Boolean(slot.apiKey.trim()))
    const imageKeyCount = hasImageKeys.filter(Boolean).length
    if (hasLanguageKey !== Boolean(imageKeyCount)) {
      onToast({ title: '模型配置还不完整', detail: '语言大模型与至少一个生图 API 需要分别填写并应用。第二个生图 API 可以留空。' })
      return
    }
    if (hasLanguageKey && llmCheck.status !== 'success') {
      onToast({ title: '请先应用语言模型 Key', detail: '语言大模型显示“已连接”后才能完成配置。' })
      return
    }
    const uncheckedImageIndex = hasImageKeys.findIndex((hasKey, index) => hasKey && imageChecks[index].status !== 'success')
    if (uncheckedImageIndex >= 0) {
      onToast({ title: `请先应用生图 API ${uncheckedImageIndex + 1}`, detail: '已填写 Key 的生图服务必须通过连接检查；未使用的第二个槽位可以留空。' })
      return
    }
    const enabled = hasLanguageKey && imageKeyCount > 0
    const [primaryImage, secondaryImage] = imageSlots
    window.sessionStorage.setItem('archflow-api-config', JSON.stringify({
      enabled,
      version: 6,
      llmProvider,
      llmBaseUrl: resolveModelConnection('language', { provider: llmProvider, baseUrl: llmBaseUrl, model: llmModel }).baseUrl,
      llmModel,
      llmApiKey: llmApiKey.trim(),
      llmVerified: hasLanguageKey && llmCheck.status === 'success',
      imageProvider: primaryImage.provider,
      imageBaseUrl: resolveModelConnection('image', primaryImage).baseUrl,
      imageModel: primaryImage.model,
      imageApiKey: primaryImage.apiKey.trim(),
      imageVerified: hasImageKeys[0] && imageChecks[0].status === 'success',
      image2Provider: secondaryImage.provider,
      image2BaseUrl: resolveModelConnection('image', secondaryImage).baseUrl,
      image2Model: secondaryImage.model,
      image2ApiKey: secondaryImage.apiKey.trim(),
      image2Verified: hasImageKeys[1] && imageChecks[1].status === 'success',
    }))
    onApiChanged(enabled)
    onClose()
    onToast({
      title: enabled ? '真实模型配置已启用' : '已切回本地演示',
      detail: enabled ? `语言模型与 ${imageKeyCount} 个生图 API 已就绪，AI 渲染页可选择可用模式。` : '密钥已清空，所有模块将继续使用本地演示数据。',
    })
  }

  const clearKeys = () => {
    setLlmApiKey('')
    setLlmCheck({ status: 'idle', message: '密钥已清空' })
    setImageSlots((current) => current.map((slot) => ({ ...slot, apiKey: '' })))
    setImageChecks([
      { status: 'idle', message: '密钥已清空' },
      { status: 'idle', message: '可选：填写第二个生图服务后应用检查' },
    ])
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="dialog-card profile-dialog api-config-dialog" role="dialog" aria-modal="true" aria-labelledby="api-config-title">
        <button ref={closeRef} className="icon-button dialog-close" onClick={onClose} aria-label="关闭"><X /></button>
        <div className="profile-dialog-head">
          <span className="large-avatar"><Link2 /></span>
          <div><span className="eyebrow">MODEL CONNECTIONS</span><h2 id="api-config-title">模型密钥配置</h2><p>语言模型与两个独立生图 API 槽位</p></div>
        </div>
        <form className="api-form" onSubmit={save}>
          <div className="api-form-head"><div><span className="eyebrow">BUILT-IN MODEL ACCESS</span><h3>配置真实生成能力</h3></div><span className="model-preset-badge"><BadgeCheck /> 独立连接</span></div>
          <p className="api-description">生图 API 1 与 API 2 完全独立；只配置一个时渲染页模式会锁定，两个都通过检查后才可切换。</p>
          <div className="live-module-row"><span><BrainCircuit /> 方案灵感</span><span><BrainCircuit /> 方案设计</span><span><ImagePlus /> AI 渲染</span></div>

          <section className="api-group" aria-labelledby="llm-api-title">
            <div className="api-group-title"><span><BrainCircuit /></span><div><h4 id="llm-api-title">语言大模型</h4><p>平台已内置百炼 OpenAI-compatible 链路，用于方案灵感与方案设计。</p></div><em className="preset-state">LANGUAGE</em></div>
            <div className="api-fields">
              <label><span>服务来源</span><select value={llmProvider} onChange={(event) => changeLanguageProvider(event.target.value)}>{Object.entries(modelProviders.language).map(([id, provider]) => <option value={id} key={id}>{provider.label}</option>)}</select></label>
              {llmProviderConfig.customBase
                ? <label><span>Base URL</span><input value={llmBaseUrl} onChange={(event) => { setLlmBaseUrl(event.target.value); setLlmCheck({ status: 'idle', message: '配置已修改，请重新应用检查' }) }} placeholder="https://provider.example/v1" /></label>
                : <div className="preset-connection"><span>内置地址</span><strong>{llmProviderConfig.baseUrl}</strong></div>}
              {llmProviderConfig.customModel && <label className="full-field"><span>模型名称</span><input value={llmModel} onChange={(event) => { setLlmModel(event.target.value); setLlmCheck({ status: 'idle', message: '配置已修改，请重新应用检查' }) }} placeholder="例如 qwen-plus（不是数字资源 ID）" /></label>}
              <div className="api-key-field full-field">
                <label htmlFor="llm-api-key">语言大模型 API Key</label>
                <div className="api-key-control"><input id="llm-api-key" type="password" value={llmApiKey} onChange={(event) => { setLlmApiKey(event.target.value); setLlmCheck({ status: 'idle', message: '配置已修改，请重新应用检查' }) }} placeholder="请输入语言大模型 API Key" autoComplete="off" /><button type="button" onClick={applyLanguageKey} disabled={llmCheck.status === 'checking'}>{llmCheck.status === 'checking' ? <LoaderCircle className="spin" /> : <Link2 />} 应用 Key</button></div>
                <p className={`connection-feedback is-${llmCheck.status}`} role="status">{llmCheck.status === 'success' ? <Check /> : llmCheck.status === 'checking' ? <LoaderCircle className="spin" /> : <Info />}<span>{llmCheck.message}</span></p>
              </div>
            </div>
          </section>

          {imageSlots.map((slot, index) => <ImageApiSection slotNumber={index + 1} slot={slot} check={imageChecks[index]} onChange={(patch) => updateImageSlot(index, patch)} onProviderChange={(provider) => changeImageProvider(index, provider)} onApply={() => applyImageKey(index)} key={index + 1} />)}

          <div className="session-storage-note"><Cloud /><p><strong>会话级隐私策略</strong><small>API Key 和上传文件不会写入 ArchFlow 数据库；切换栏目不会清除，关闭标签页后释放。</small></p></div>
          <div className="security-hint"><Info /><span>当前公开演示采用访问者自己的 Key。不要把项目所有者的密钥写入源码或 Git；若要让访问者免填 Key，必须增加服务端代理。</span></div>
          <div className="dialog-actions"><button className="button button-secondary" type="button" onClick={clearKeys}>清空密钥</button><button className="button button-primary" type="submit">完成配置 <Check /></button></div>
        </form>
      </section>
    </div>
  )
}

function Toast({ toast, onClose }) {
  return <div className="toast" role="status"><span><Check /></span><p><strong>{toast.title}</strong><small>{toast.detail}</small></p><button onClick={onClose} aria-label="关闭提示"><X /></button></div>
}
