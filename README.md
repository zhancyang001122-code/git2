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
- AI 渲染要求上传一张白模或原始效果图：OpenAI/NewAPI 通道请求 `/images/edits`，只有显式配置为原生 Gemini 协议的模型才请求 `/v1beta/models/{model}:generateContent`，并只返回一张图用于前后对比；
- 其余三个模块保持高质量本地演示，不伪装成真实 API 结果。

### 内部账号生图 API 自动注册

`内部账户1` 的模型密钥由 Supabase Edge Function 托管，不需要也不应填写到访客的“API Key 配置”中。Edge Function 会自动发现 `ARCHFLOW_IMAGE_N_*` 槽位；新增第 3、4 路 API 时只需把下面的 `2` 改成对应编号，无需再改前端或后端代码：

```text
ARCHFLOW_IMAGE_2_LABEL=Git2 图 Gemini
ARCHFLOW_IMAGE_2_BASE_URL=https://img.yunfei.best
ARCHFLOW_IMAGE_2_MODEL=git2图gemini
ARCHFLOW_IMAGE_2_API_KEY_SECRET=git2图gemini
ARCHFLOW_IMAGE_2_PROTOCOL=openai
ARCHFLOW_IMAGE_2_SIZE=4K
ARCHFLOW_IMAGE_2_QUALITY=high
```

`ARCHFLOW_IMAGE_2_API_KEY_SECRET` 的值是另一个 Secret 的名称；当前部署中的真实 Key 继续保存在：

```text
git2图gemini=真实 API Key
```

也可以不使用引用名，直接设置标准的 `ARCHFLOW_IMAGE_2_API_KEY=真实 API Key`。`git2图gemini` 虽然模型名包含 `gemini`，但由 NewAPI 通道提供，因此必须显式使用 `openai` 协议；否则 `auto` 会把它误判为原生 Gemini `generateContent`。

所有内部生图槽位都支持常用横图、竖图、方图、64–4096 像素自定义宽高，以及“跟随原图比例”：浏览器读取参考图宽高后保持比例，并把最长边换算为 3840 像素。`ARCHFLOW_IMAGE_*_SIZE` 只作为未传入本次图幅时的服务端默认值。保存 Secrets 后无需重新部署 Edge Function，刷新 ArchFlow 或重新登录内部账号即可自动读取全部槽位。连接检测不再隐藏 API，而是在模型选择器和“内部账号模型配置”中显示“已连接 / 待实测 / 检测失败 / 配置不完整”；生成期间界面显示所选服务、模型、最高分辨率及从 `00:00` 开始累计的已等待时间。

API Key 仅写入 `sessionStorage`，关闭标签页后清除，不会进入源码、构建产物或 Git。浏览器直连接口仍要求网络可访问服务商并允许 CORS；正式产品必须改为服务端代理。

原始上传文件只存在当前标签页的 React 内存中，切换栏目不会清除，刷新或关闭标签页后释放；启用真实 API 后，参考图会发送给当前选择的第三方模型服务。访客模式生成结果仍只保留在当前标签页；`内部账户1` 点击“保存到资产”后，生成图会写入启用用户级 RLS 的私有 `user-assets` 存储桶，资产记录写入 Postgres，可跨设备预览和下载。对于第三方返回的远程图片 URL，浏览器不会直接跨域读取，而是携带与当前用户绑定的短期签名，请求 `generate` Edge Function 服务端校验文件类型、40 MiB 上限并转存，从而避免供应商 CORS 设置导致“能显示但不能保存”。完整建议见 [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md)。

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
