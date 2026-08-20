# ArchFlow Supabase 配置

前端只使用可公开的 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_PUBLISHABLE_KEY`。数据库表和私有存储桶通过 RLS 限制为当前登录用户。

Vercel 的 Production、Preview、Development 环境都必须配置：

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_INTERNAL_ACCOUNT_EMAIL
```

这三项属于浏览器公开配置，不是服务端密钥。`src/lib/supabase.js` 为面试演示保留同项目的公开兜底值，防止部署变量漏配导致跨设备登录入口失效；正式轮换 Supabase 项目或 publishable key 时，需要同时更新部署变量和兜底值。

`generate` Edge Function 已内置当前演示使用的百炼 Base URL、`qwen3.7-plus` 与第三方生图 Base URL、`gpt-image-2`。必须配置以下两个服务端 Key：

```text
ARCHFLOW_LLM_API_KEY
ARCHFLOW_IMAGE_1_API_KEY

# 以下参数只在替换内置服务时需要覆盖
ARCHFLOW_LLM_BASE_URL
ARCHFLOW_LLM_MODEL
ARCHFLOW_IMAGE_1_LABEL
ARCHFLOW_IMAGE_1_BASE_URL
ARCHFLOW_IMAGE_1_MODEL
ARCHFLOW_IMAGE_1_PROTOCOL
ARCHFLOW_IMAGE_1_SIZE=4K

# 第二个及后续生图服务（N 可继续使用 3、4……）
ARCHFLOW_IMAGE_2_LABEL
ARCHFLOW_IMAGE_2_BASE_URL
ARCHFLOW_IMAGE_2_MODEL
ARCHFLOW_IMAGE_2_API_KEY
ARCHFLOW_IMAGE_2_API_KEY_SECRET
ARCHFLOW_IMAGE_2_PROTOCOL=gemini
ARCHFLOW_IMAGE_2_RESPONSE_MODE=url
ARCHFLOW_IMAGE_2_SIZE=4K
```

当前第二路 NewAPI 配置为 `https://img.yunfei.best`、模型 `gemini-3-pro-image-preview`、协议 `gemini`。`git2图gemini` 是存放 API Key 的 Secret 名称，不是模型名；可以直接使用 `ARCHFLOW_IMAGE_2_API_KEY`，也可以设置 `ARCHFLOW_IMAGE_2_API_KEY_SECRET=git2图gemini`，让槽位引用现有的自定义 Secret。第二路使用 `ARCHFLOW_IMAGE_2_RESPONSE_MODE=url`，让服务商返回临时图片 URL，避免 4K base64 图片挤占 Edge Function 的响应内存。Edge Function 会自动发现所有 `ARCHFLOW_IMAGE_N_*` 槽位，后续新增 API 不需要再修改代码。

`url` 模式会先创建 `image_generation_tasks` 后台任务并立即响应，实际 4K 调用通过 `EdgeRuntime.waitUntil` 继续执行，前端每 2 秒查询任务状态。这样浏览器请求不会一直占用同步连接；任务表只允许服务端角色访问，不保存输入图或 API Key，完成后只短期记录服务商图片 URL与任务状态。

`ARCHFLOW_IMAGE_*_PROTOCOL` 可设为 `openai`、`gemini` 或 `auto`，必须与该服务商为具体模型开放的端点一致；不能只根据“NewAPI”这个网关类型推断协议。`ARCHFLOW_IMAGE_*_RESPONSE_MODE` 可设为 `inline` 或 `url`，只有服务商明确支持 URL 响应时才使用 `url`。`ARCHFLOW_IMAGE_*_SIZE` 是没有传入本次输出图幅时的默认值；前端可按次传入 64–4096 像素自定义宽高，或读取参考图比例并将最长边换算为 3840 像素。连接检测结果会随能力接口下发；检测失败的已配置槽位仍会显示，避免把“连接异常”误表现为“没有安装”。

这些 Key 只能放在 Supabase Secrets 中，不能使用 `VITE_` 前缀，也不能提交到 Git。
