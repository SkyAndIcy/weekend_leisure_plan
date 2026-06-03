# 周末喵 · 小团本地半日规划

将自然语言 + 出发点转为可执行周末行程（玩 → 吃 → 可选加项），含 Mock 订座/排队/分享与 Friday 文案润色。

## 文档

- **[设计说明（≤2 页）](docs/DESIGN.md)**：Planning 策略、工具调用链路、异常处理

## 快速启动

```bash
cd /Users/zhoushunyuan/Downloads/weekendmiao-catpaw
npm install && cp -n .env.example .env   # 首次：编辑 .env 填入 Supabase
npm start   # http://localhost:8081
```

### 本地开发（推荐，无需 supabase login）

在 `.env` 中配置（**不要**加 `VITE_` 前缀，避免 AppId 打进前端包）：

```bash
FRIDAY_APP_ID=<你的AppId>
FRIDAY_MODEL=gpt-4o-mini
```

然后 `npm start`。开发模式下 `recommend` / `chat` 由 Vite 本地代理直连 [Friday One-API](https://aigc.sankuai.com/v1/openai/native/chat/completions)，鉴权方式为 `Authorization: Bearer {AppId}`，**不需要登录 Friday**。

### 上线部署（Supabase Edge）

```bash
brew install supabase/tap/supabase   # 未安装时
supabase login
supabase link --project-ref <project-ref>
supabase secrets set FRIDAY_APP_ID=<你的AppId> FRIDAY_MODEL=gpt-4o-mini
supabase functions deploy recommend && supabase functions deploy chat
```

勿将 AppId 提交 Git。
