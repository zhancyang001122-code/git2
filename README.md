# ArchFlow

面向建筑设计企业与专业设计团队的 AI 提效工作台，用于面试演示从需求输入、专业生成到企业资产沉淀的完整工作流。

## 技术栈

- React 18 + Vite 6
- Lucide React 线性图标
- 原生 CSS Blueprint 设计系统
- Hash 路由，无需后端即可直接预览

## 本地运行

```bash
pnpm install
pnpm dev
```

打开 `http://127.0.0.1:4173/`。

生产构建：

```bash
pnpm build
```

## 当前能力

- Blueprint 主色：冰蓝背景、深海军蓝文字、亮青蓝强调色；
- 磨砂玻璃侧边导航与顶部栏；
- 所有主要按钮具备反色 Hover、按下、禁用和键盘焦点状态；
- 工作台首页包含本周项目概况与会话级备忘录：上方显示最近两条，第 3 条起通过“更多”进入完整列表；点击任意备忘录可进入详情并编辑保存；
- 六个独立 AI 工作流，分别包含专属输入提示和差异化输出：
  - AI 方案灵感：三个设计方向、空间策略、关键词和真实案例链接；
  - AI 方案设计：A / B / C 概念方案、体量表达和专业指标比选；
  - AI 图纸美化：可拖动的前后对比；
  - AI 建模：可旋转、缩放的模型预览和格式下载入口；
  - AI 渲染：单张效果图、原图 / 生成图滑杆对比、大图预览与下载；
  - AI 汇报：页面序列、单页预览、PPTX / A3 PDF 导出入口；
- 输入区支持选择附件、鼠标拖拽文件，或在文本框内使用 `Ctrl + V` 粘贴图片，附件预览、数量徽标和单项删除均位于生成前；
- 六个功能工作区在当前标签页内常驻：切换栏目不会中断正在进行的生成，也不会清空输入、附件或结果；刷新或关闭标签页后释放；
- “我的资产”中普通演示资产使用三张文件纸的磨砂玻璃文件夹形式；真实生成资产直接显示 1–3 张图片预览，并支持搜索、筛选、详情、保存和二次确认删除；
- 左下角“方案一组”为独立的脱敏演示身份入口；模型密钥使用单独的“API Key 配置”入口，便于后续接入真实登录系统。

## API 模式

默认使用本地演示数据。ArchFlow 已预设接口地址、模型名称和输出规格。访问者点击左下角“API Key 配置”，填写一把语言大模型 Key，并可配置一至两组彼此独立的生图 API。当前默认连接为：

- 语言大模型：阿里云百炼兼容接口，默认模型名称 `qwen-plus`；业务空间 ID 已包含在预设域名中，不能把控制台数字资源 ID 当作模型名称；
- 生图大模型：生图 API 1 默认使用第三方 NewAPI 与 `gpt-image-2`；生图 API 2 可选，可配置另一套官方或第三方服务；应用 Key 时会读取可用模型并自动识别 OpenAI / Gemini 生图模型；
- 也可切换 OpenAI 官方、Gemini 官方或自定义兼容服务。

每个 Key 都有独立“应用 Key”按钮。语言模型通过一次最小对话验证 Key 与模型名称，生图模型通过模型列表验证鉴权和可见性。AI 渲染页会在“生成专业结果”左侧显示生图模式：只有一个生图 API 已连接时锁定该模式，两个均连接时可切换，并把本次请求路由到所选 API。连接后：

- AI 方案灵感、AI 方案设计请求 `/chat/completions`，校验结构化 JSON 后渲染专业结果；
- AI 渲染要求上传一张白模或原始效果图：OpenAI 系模型请求 `/images/edits`，第三方 Gemini 系模型自动切换到 `/v1beta/models/{model}:generateContent`，并只返回一张图用于前后对比；
- 其余三个模块保持高质量本地演示，不伪装成真实 API 结果。

### 内部账号第二生图 API

`内部账户1` 的模型密钥由 Supabase Edge Function 托管，不需要也不应填写到访客的“API Key 配置”中。进入 Supabase Dashboard 的 **Edge Functions → Secrets**，为第二个生图服务添加以下变量：

```text
ARCHFLOW_IMAGE_2_LABEL=界面显示名称
ARCHFLOW_IMAGE_2_BASE_URL=服务根地址或兼容接口地址
ARCHFLOW_IMAGE_2_MODEL=准确的模型 ID
ARCHFLOW_IMAGE_2_API_KEY=真实 API Key
ARCHFLOW_IMAGE_2_PROTOCOL=auto
ARCHFLOW_IMAGE_2_SIZE=4K
ARCHFLOW_IMAGE_2_QUALITY=high
```

也兼容 Gemini CLI 常用的 Secrets 名称：

```text
GOOGLE_GEMINI_BASE_URL=https://api.uselg.top
GEMINI_MODEL=gemini-3-pro-image-preview
GEMINI_API_KEY=真实 API Key
```

本项目需要可输出图片的模型。`gemini-3-pro-preview` 仅输出文本且已停用；如果只通过 `GEMINI_MODEL` 提供这个旧值，服务端会自动改用当前网关提供的 `gemini-3-pro-image-preview`（Nano Banana Pro）。如供应商返回其他准确的生图模型 ID，优先使用 `ARCHFLOW_IMAGE_2_MODEL` 或 `GEMINI_IMAGE_MODEL` 显式覆盖。

OpenAI 兼容的 `/images/edits` 服务使用 `auto`；原生 Gemini `generateContent` 服务可使用 `gemini`。`auto` 模式通过 `/v1/models` 检查第三方服务，再根据模型 ID 自动选择 `/v1/images/edits` 或 `/v1beta/models/{model}:generateContent` 生成。两个内部生图槽位都以 `4K` 作为最高输出等级，但不强制每次固定为 4K：第一 API 可在生成前选择常用横图、竖图、方图，或输入 64–4096 像素范围内的自定义宽高；Gemini 类 API 则按用户选择的图幅比例生成，并显式请求最高 `4K` 等级。`api.uselg.top` 会把参考图 4K 请求转为 `202` 异步任务，前端会按服务端 `poll_after_ms` 持续查询，任务凭据通过 HMAC 绑定当前登录用户，等待计时在完成前不会停止。`ARCHFLOW_IMAGE_*_SIZE` 只作为未传入本次图幅时的服务端默认值。保存 Secrets 后无需重新部署 Edge Function，刷新 ArchFlow 或重新登录内部账号即可重新读取可用模型。只有通过服务端模型连通性检查的 API 才会出现在“生图模型”选择器中；`ARCHFLOW_IMAGE_2_MODEL` 必须填写 `/v1/models` 返回的准确模型 ID，不能只填“Gemini 香蕉”等昵称。生成期间界面显示所选服务、模型、最高分辨率及从 `00:00` 开始累计的已等待时间。

API Key 仅写入 `sessionStorage`，关闭标签页后清除，不会进入源码、构建产物或 Git。浏览器直连接口仍要求网络可访问服务商并允许 CORS；正式产品必须改为服务端代理。

上传文件只存在当前标签页的 React 内存中，切换栏目不会清除，刷新或关闭标签页后释放；启用真实 API 后，图片会发送给用户选择的第三方模型服务，但 ArchFlow POC 不上传到自己的服务器。AI 渲染结果点击“保存到资产”后，会连同真实生成图一起保留在当前标签页内存，可在“我的资产 → 查看详情”中预览和再次下载；刷新或关闭后仍会消失。跨设备资产、图纸解析、建模、长期文件存储和真实导出仍属于后端能力边界。完整建议见 [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md)。

## 公开部署

生产站点已连接 Vercel 与 GitHub。推送 `main` 后会执行自动生产构建，正式地址为：

[`https://archflow.zaneyang.xyz/`](https://archflow.zaneyang.xyz/)

GitHub Pages 同时保留为静态备用地址：

[`https://zhancyang001122-code.github.io/git2/`](https://zhancyang001122-code.github.io/git2/)

`内部账户1` 使用 Supabase Auth，备忘录、生成记录和已保存资产可跨设备同步；模型密钥只保存在 Supabase Edge Function Secrets 中。Vercel 的 Production、Preview、Development 环境均配置公开的 Supabase URL、publishable key 与内部账户映射邮箱。代码还保留同一组公开配置作为构建兜底，避免部署平台漏配变量时静默关闭登录；任何服务端密钥都不得使用 `VITE_` 前缀或进入前端构建。

## 面试演示路线

1. 用工作台首页说明“六个工具 + 一个企业资产库”的产品定位，并现场新增第 3 条备忘录演示“更多”详情。
2. 进入“AI 方案灵感”，输入场地需求，展示三条方向、空间策略和案例链接。
3. 进入“AI 方案设计”，说明 A / B / C 可比较、可选择，而非重复输出同一种卡片。
4. 保存结果到“我的资产”，展示文件夹组织、搜索、筛选、详情和删除闭环。
5. 分别点击左下角“API Key 配置”和“方案一组”，说明双生图切换、脱敏策略，以及模型配置与未来登录体系的职责分离。

## 项目文件

- React 入口：[`src/main.jsx`](src/main.jsx)
- 页面与交互：[`src/App.jsx`](src/App.jsx)
- 功能配置与 API 适配器：[`src/data.js`](src/data.js)
- Blueprint 视觉系统：[`src/styles.css`](src/styles.css)
- PRD：[`docs/ArchFlow_AI_PRD_v1.3.docx`](docs/ArchFlow_AI_PRD_v1.3.docx)
- 早期单文件 POC：[`poc/index.html`](poc/index.html)
