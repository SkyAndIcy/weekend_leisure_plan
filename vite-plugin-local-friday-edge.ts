/**
 * 本地开发：把 /functions/v1/recommend|chat|plan 代理到 Friday + 规则 DAG，
 * 无需 supabase login / deploy。AppId 从 .env 的 FRIDAY_APP_ID 读取（勿加 VITE_ 前缀）。
 */
import type { Plugin, ViteDevServer } from "vite";
import { loadEnv } from "vite";
import type { IncomingMessage, ServerResponse } from "http";
import { RECOMMEND_SYSTEM, CHAT_SYSTEM } from "./supabase/functions/_shared/prompts";
import { augmentChatMessages } from "./supabase/functions/_shared/chat_augment";
import { buildWeekendPlanCore } from "./shared/planning/build-plan";
import { parseAiSemantic } from "./shared/planning/semantic-merge";
import { extractConstraints } from "./shared/planning/constraints";

const FRIDAY_BASE = "https://aigc.sankuai.com/v1/openai/native/chat/completions";

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

async function localSemanticExtract(
  appId: string,
  model: string,
  body: Record<string, unknown>,
  traceId: string,
): Promise<{ ok: true; semantics: Record<string, unknown> } | { ok: false; error: string; status: number }> {
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
    return {
      ok: false,
      error: fridayErrorMessage(fr.status, t),
      status: fr.status === 450 || fr.status === 451 ? 422 : 502,
    };
  }

  const data = (await fr.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  const parsed = content ? parseJsonBlock(content) : null;
  if (!parsed) {
    return { ok: false, error: "Invalid AI JSON", status: 422 };
  }
  return { ok: true, semantics: parsed };
}

function createLocalFridayMiddleware(
  appId: string,
  model: string,
): (req: IncomingMessage, res: ServerResponse, next: () => void) => void {
  return (req, res, next) => {
    if (!req.url || req.method === "OPTIONS") return next();
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname;

    if (
      path !== "/functions/v1/recommend" &&
      path !== "/functions/v1/chat" &&
      path !== "/functions/v1/plan"
    ) {
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
        const result = await localSemanticExtract(appId, model, body, traceId);
        if (!result.ok) {
          sendJson(res, result.status, { ok: false, error: result.error });
          return;
        }
        sendJson(res, 200, { ok: true, semantics: result.semantics });
        return;
      }

      if (path === "/functions/v1/plan") {
        const userText = String(body.userText ?? "");
        const location = (body.location as Record<string, unknown>) || {};
        const ruleHints = extractConstraints(userText);

        try {
          const plan = await buildWeekendPlanCore(
            userText,
            {
              fullAddress: String(location.address ?? location.fullAddress ?? ""),
              displayName: String(location.label ?? location.displayName ?? ""),
              coords: location.coords as { lat: number; lng: number } | undefined,
            },
            async (text, loc) => {
              const result = await localSemanticExtract(
                appId,
                model,
                {
                  userText: text,
                  location: loc,
                  ruleHints: {
                    scenario: ruleHints.scenario,
                    childAge: ruleHints.childAge,
                    partyTotal: ruleHints.partyTotal,
                    maxDistanceKm: ruleHints.maxDistanceKm,
                    lowCalPreferred: ruleHints.lowCalPreferred,
                    locationBlocks: ruleHints.locationBlocks,
                    durationHours: ruleHints.durationHours,
                  },
                },
                traceId,
              );
              if (!result.ok) throw new Error(result.error);
              const semantic = parseAiSemantic(result.semantics);
              if (!semantic) throw new Error("AI 语义 JSON 无效，请重试。");
              return {
                semantic,
                trace: {
                  tool: "ai_semantic_extract",
                  input: { userText: text, location: loc, ruleHints },
                  output: { semantic },
                },
              };
            },
          );
          sendJson(res, 200, { ok: true, plan });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Unknown";
          sendJson(res, /语义|Friday|AI|JSON|审核/.test(msg) ? 422 : 500, {
            ok: false,
            error: msg,
          });
        }
        return;
      }

      // chat — 流式转发（注入 planContext，与 Edge 一致）
      const messages = (body.messages as { role: string; content: string }[]) || [];
      const planContext = body.planContext as string | undefined;
      const location = body.location as { label?: string; address?: string } | undefined;
      const augmented = augmentChatMessages(messages, planContext, location);

      const fr = await fridayChat(
        appId,
        model,
        {
          messages: [{ role: "system", content: CHAT_SYSTEM }, ...augmented],
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
          "[local-friday-edge] 未配置 FRIDAY_APP_ID，Edge 接口将走远程 Supabase（需已 deploy plan/recommend/chat）",
        );
        return;
      }
      const model = env.FRIDAY_MODEL?.trim() || "gpt-4o-mini";
      console.log(
        `[local-friday-edge] 本地代理 plan/recommend/chat → Friday（${model}），无需 supabase login`,
      );
      server.middlewares.use(createLocalFridayMiddleware(appId, model));
    },
  };
}
