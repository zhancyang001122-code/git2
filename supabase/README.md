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

# 第二个生图服务可选
ARCHFLOW_IMAGE_2_LABEL
ARCHFLOW_IMAGE_2_BASE_URL
ARCHFLOW_IMAGE_2_MODEL
ARCHFLOW_IMAGE_2_API_KEY
ARCHFLOW_IMAGE_2_PROTOCOL=auto
ARCHFLOW_IMAGE_2_SIZE=4K
```

第二路 Gemini 也兼容 `GOOGLE_GEMINI_BASE_URL`、`GEMINI_MODEL`、`GEMINI_IMAGE_MODEL`、`GEMINI_API_KEY` 和 `GOOGLE_API_KEY`；现有部署中的旧 Key 名称 `gemini香蕉` 也会被读取。当前网关使用 `gemini-3-pro-image-preview`；旧的 `gemini-3-pro-preview` 不支持图片输出，且已停用。

`ARCHFLOW_IMAGE_*_PROTOCOL` 可设为 `openai`、`gemini` 或 `auto`。`auto` 通过 `/v1/models` 检查第三方服务，再根据模型名中是否包含 `gemini` 选择生成协议；`gemini` 则使用原生 `/v1beta/models` 列表。`ARCHFLOW_IMAGE_*_SIZE` 是没有传入本次输出图幅时的默认值；前端可为 OpenAI 兼容服务按次传入 64–4096 像素范围内的自定义宽高，Gemini 类服务则按次传入图幅比例并使用最高 `4K` 等级。

这些 Key 只能放在 Supabase Secrets 中，不能使用 `VITE_` 前缀，也不能提交到 Git。
