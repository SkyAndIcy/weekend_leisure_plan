/**
 * 本地开发：把 /functions/v1/recommend|chat 代理到 Friday One-API，
 * 无需 supabase login / deploy。AppId 从 .env 的 FRIDAY_APP_ID 读取（勿加 VITE_ 前缀）。
 */
import type { Plugin, ViteDevServer } from "vite";
import { loadEnv } from "vite";
import type { IncomingMessage, ServerResponse } from "http";

const FRIDAY_BASE = "https://aigc.sankuai.com/v1/openai/native/chat/completions";

const RECOMMEND_SYSTEM = `你是美团周末本地活动规划的「语义理解」模块。根据用户自然语言与出发点，抽取结构化约束，**不要**选择具体 POI、不要编造店名。

**输出仅一段合法 JSON**，无 Markdown。字段说明：
- scenario: "family" | "friends" | "unknown"
- departureHour: 0-23，默认 14
- maxDistanceKm: 正数，默认 8；"别太远/附近"可设为 5
- durationHours: [最短小时, 最长小时]，周末半日通常 [4,6]
- childAge: 儿童年龄或 null
- partyTotal: 人数或 null
- lowCalPreferred: 是否低脂/减脂诉求
- locationBlocks: 用户提到的商圈/区域关键词数组，如 ["三里屯","望京"]
- wantExtra: 是否需要加项（citywalk/展览等），默认 true
- intentSummary: 一句话概括用户诉求

参考【规则预解析】但可修正其错误理解。`;

const CHAT_SYSTEM = `你是"小团"，美团本地周末短时活动规划助手（4–6小时，下午出发）。

**重要**：用户消息前会附带已由规则引擎+Mock工具生成的【结构化方案 planContext】。你必须：
1. **不得编造** planContext 之外的 POI/店名；
2. 用杂志风 Markdown 润色该方案，突出「玩→吃→加项」与订座/排队状态；
3. 结尾用一句话复述 notify 文案风格（搞定了，X点出发…）。

**输出结构**（不要代码块包裹）：

# 周末半日 · {主题一句话}

{2句导语：场景+取舍}

### 下午｜{玩·小标题}
{自然段，**加粗**时间与店名}

### 傍晚｜{吃·小标题}
{餐厅、订座/排队、饮食诉求如减脂}

### 收尾｜{加项小标题}
{Citywalk/展览等}

### 一键安排
- 订座/排队：{来自 planContext}
- 发给同行：{notify 摘要}

非规划类闲聊可简短回答，不必套模板。`;

function parseJsonBlock(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function fridayErrorMessage(status: number, body?: string): string {
  if (status === 450) return "输入内容未通过安全审核，请调整表述后重试";
  if (status === 451) return "模型输出未通过安全审核，请调整表述后重试";
  if (status === 401) return "Friday 鉴权失败，请检查 AppId 配置";
  if (status === 403) return "Friday 请求被拒绝或额度不足";
  if (status === 429) return "Friday 请求过于频繁，请稍后再试";
  if (body && body.length < 200) return body;
  return "Friday AI 服务暂时不可用";
}

async function fridayChat(
  appId: string,
  model: string,
  body: Record<string, unknown>,
  traceId: string,
): Promise<Response> {
  return fetch(FRIDAY_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appId}`,
      "Content-Type": "application/json",
      "M-TraceId": traceId,
    },
    body: JSON.stringify({
      model,
      user: traceId,
      ...body,
    }),
  });
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(data));
}

function createLocalFridayMiddleware(
  appId: string,
  model: string,
): (req: IncomingMessage, res: ServerResponse, next: () => void) => void {
  return (req, res, next) => {
    if (!req.url || req.method === "OPTIONS") return next();
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname;

    if (path !== "/functions/v1/recommend" && path !== "/functions/v1/chat") {
      return next();
    }

    void (async () => {
      const traceId = crypto.randomUUID();
      const raw = req.method === "POST" ? await readBody(req) : "{}";
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        sendJson(res, 400, { ok: false, error: "Invalid JSON" });
        return;
      }

      if (path === "/functions/v1/recommend") {
        const userText = String(body.userText ?? "");
        const location = (body.location as Record<string, unknown>) || {};
        const ruleHints = body.ruleHints;
        const userPayload = [
          `【用户】${userText}`,
          `【出发点】${location.label || ""} ${location.address || ""}`,
          ruleHints ? `【规则预解析】${JSON.stringify(ruleHints)}` : "",
        ]
          .filter(Boolean)
          .join("\n\n");

        const fr = await fridayChat(
          appId,
          model,
          {
            messages: [
              { role: "system", content: RECOMMEND_SYSTEM },
              {
                role: "user",
                content: `${userPayload}\n\n请输出合法 json 对象，包含上述语义字段。`,
              },
            ],
            temperature: 0.1,
            stream: false,
            max_tokens: 1024,
            response_format: { type: "json_object" },
          },
          traceId,
        );

        if (!fr.ok) {
          const t = await fr.text();
          sendJson(res, fr.status === 450 || fr.status === 451 ? 422 : 502, {
            ok: false,
            error: fridayErrorMessage(fr.status, t),
          });
          return;
        }

        const data = (await fr.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = data.choices?.[0]?.message?.content;
        const parsed = content ? parseJsonBlock(content) : null;
        if (!parsed) {
          sendJson(res, 422, { ok: false, error: "Invalid AI JSON" });
          return;
        }
        sendJson(res, 200, { ok: true, semantics: parsed });
        return;
      }

      // chat — 流式转发
      const messages = (body.messages as { role: string; content: string }[]) || [];
      const fr = await fridayChat(
        appId,
        model,
        {
          messages: [{ role: "system", content: CHAT_SYSTEM }, ...messages],
          stream: true,
          max_tokens: 4096,
          temperature: 0.7,
        },
        traceId,
      );

      if (!fr.ok || !fr.body) {
        const t = await fr.text();
        sendJson(res, 502, { ok: false, error: fridayErrorMessage(fr.status, t) });
        return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", "*");

      const reader = fr.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      res.end();
    })().catch((e) => {
      console.error("[local-friday-edge]", e);
      sendJson(res, 500, {
        ok: false,
        error: e instanceof Error ? e.message : "Unknown",
      });
    });
  };
}

export function localFridayEdgePlugin(mode: string): Plugin {
  return {
    name: "local-friday-edge",
    configureServer(server: ViteDevServer) {
      const env = loadEnv(mode, process.cwd(), "");
      const appId = env.FRIDAY_APP_ID?.trim();
      if (!appId) {
        console.warn(
          "[local-friday-edge] 未配置 FRIDAY_APP_ID，/functions/v1/recommend 将走远程 Supabase（需已 deploy）",
        );
        return;
      }
      const model = env.FRIDAY_MODEL?.trim() || "gpt-4o-mini";
      console.log(
        `[local-friday-edge] 本地代理 recommend/chat → Friday（${model}），无需 supabase login`,
      );
      server.middlewares.use(createLocalFridayMiddleware(appId, model));
    },
  };
}
