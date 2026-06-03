import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildWeekendPlanCore } from "../_shared/planning/build-plan.ts";
import { extractSemantic, parseAiSemantic } from "../_shared/semantic_extract.ts";
import { extractConstraints } from "../_shared/planning/constraints.ts";
import type { AiSemanticExtract } from "../_shared/planning/semantic-types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userText, location, traceId, sessionId, queryId } = await req.json();

    if (!userText || typeof userText !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "缺少 userText" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ruleHints = extractConstraints(userText);

    const plan = await buildWeekendPlanCore(
      userText,
      {
        fullAddress: location?.address ?? location?.fullAddress,
        displayName: location?.label ?? location?.displayName,
        coords: location?.coords,
      },
      async (text, loc) => {
        const result = await extractSemantic({
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
          traceId,
          sessionId,
          queryId,
        });

        if (!result.ok) {
          throw new Error(result.error);
        }

        const semantic = parseAiSemantic(result.semantics);
        if (!semantic) {
          throw new Error("AI 语义 JSON 无效，请重试。");
        }

        return {
          semantic: semantic as AiSemanticExtract,
          trace: {
            tool: "ai_semantic_extract",
            input: { userText: text, location: loc, ruleHints },
            output: { semantic },
          },
        };
      },
    );

    return new Response(JSON.stringify({ ok: true, plan }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("plan error:", e);
    const msg = e instanceof Error ? e.message : "Unknown";
    const isSemantic = /语义|Friday|AI|JSON|审核|鉴权|配置/.test(msg);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: isSemantic ? 422 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
