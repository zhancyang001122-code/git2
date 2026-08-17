# ArchFlow

面向建筑设计企业与专业设计团队的 AI 提效工作台视觉 POC。它把方案灵感、概念设计、图纸美化、建模、渲染、汇报和项目资产沉淀组织为一条可演示的端到端工作流。

## 快速预览

直接打开 [`poc/index.html`](poc/index.html)。页面不依赖构建工具或外部资源，可离线运行。

当前 POC 包含：

- Daylight Editorial、Blueprint Atelier、Night Studio 三套可切换主题；
- 六个固定 AI 功能模块；
- 对话式任务输入、快捷条件标签、参考文件入口和右侧专业填写提示；
- 本地模拟生成、结果保存和“我的资产”项目包闭环；
- 桌面端与移动端响应式布局；
- 预留 `generateWithApi()` 适配层，后续可替换为真实文本、图片、模型或导出服务。

## 90 秒面试演示路径

1. 首页用 20 秒说明企业设计团队定位和六个能力模块。
2. 进入“AI 方案设计”，点击“填入完整示例”，展示必填 / 建议 / 可选输入约束。
3. 生成 A/B/C 演示结果并保存到“我的资产”。
4. 在资产库展示项目包、来源、更新时间、搜索与筛选。
5. 切换三套主题，说明视觉探索与系统化设计能力。

## 当前边界

这是 7 天面试项目的前端视觉与交互 POC。当前不调用真实 API，不上传文件，也不实现登录、数据库、多人审批、企业权限、企业知识库或 CAD/BIM 生产能力。界面中的生成结果为本地演示样本。

产品与交互定义见 [`docs/ArchFlow_AI_PRD_v1.1.docx`](docs/ArchFlow_AI_PRD_v1.1.docx)，视觉设计说明见 [`docs/superpowers/specs/2026-08-17-archflow-visual-poc-design.md`](docs/superpowers/specs/2026-08-17-archflow-visual-poc-design.md)。
