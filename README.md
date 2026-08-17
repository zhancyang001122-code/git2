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
- 六个独立 AI 工作流，分别包含专属输入提示和差异化输出：
  - AI 方案灵感：三个设计方向、空间策略、关键词和真实案例链接；
  - AI 方案设计：A / B / C 概念方案、体量表达和专业指标比选；
  - AI 图纸美化：可拖动的前后对比；
  - AI 建模：可旋转、缩放的模型预览和格式下载入口；
  - AI 渲染：两张候选效果图、大图预览与下载；
  - AI 汇报：页面序列、单页预览、PPTX / A3 PDF 导出入口；
- “我的资产”使用叠放文件夹形式，支持搜索、筛选、详情、保存和二次确认删除；
- 左下角“方案一组”为脱敏演示身份，点击可查看隐私说明并配置用户自己的 API。

## API 模式

默认使用本地演示数据。用户可点击左下角“方案一组”或“API 配置入口”，填写兼容 OpenAI `chat/completions` 的接口地址、模型名和 API Key。启用后，`generateWithApi()` 会真实请求该接口，并把响应展示在专业结果上方。

API Key 仅写入 `sessionStorage`，关闭标签页后清除。浏览器直连接口需要允许 CORS；正式产品必须改为服务端代理，不能依赖前端保存企业密钥。

当前文件选择器只展示文件名，不上传文件；图纸解析、生图、建模、文件存储和真实导出仍属于后端能力边界。完整建议见 [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md)。

## 面试演示路线

1. 用工作台首页说明“六个工具 + 一个企业资产库”的产品定位。
2. 进入“AI 方案灵感”，输入场地需求，展示三条方向、空间策略和案例链接。
3. 进入“AI 方案设计”，说明 A / B / C 可比较、可选择，而非重复输出同一种卡片。
4. 保存结果到“我的资产”，展示文件夹组织、搜索、筛选、详情和删除闭环。
5. 点击左下角“方案一组”，说明脱敏策略、演示数据边界和真实 API 接入方案。

## 项目文件

- React 入口：[`src/main.jsx`](src/main.jsx)
- 页面与交互：[`src/App.jsx`](src/App.jsx)
- 功能配置与 API 适配器：[`src/data.js`](src/data.js)
- Blueprint 视觉系统：[`src/styles.css`](src/styles.css)
- PRD：[`docs/ArchFlow_AI_PRD_v1.1.docx`](docs/ArchFlow_AI_PRD_v1.1.docx)
- 早期单文件 POC：[`poc/index.html`](poc/index.html)
