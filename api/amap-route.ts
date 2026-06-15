/**
 * Vercel Edge Function: /api/amap-route
 * 高德驾车路线代理（防止 AMAP_KEY 暴露到前端）
 */
export const config = { runtime: "edge" };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const amapKey = process.env.AMAP_KEY?.trim();
  if (!amapKey) {
    return new Response(
      JSON.stringify({ ok: false, error: "未配置 AMAP_KEY" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  const url = new URL(req.url);
  const origin = url.searchParams.get("origin");
  const destination = url.searchParams.get("destination");
  const waypoints = url.searchParams.get("waypoints");

  if (!origin || !destination) {
    return new Response(
      JSON.stringify({ ok: false, error: "missing origin or destination" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }

  const amapUrl = new URL("https://restapi.amap.com/v3/direction/driving");
  amapUrl.searchParams.set("key", amapKey);
  amapUrl.searchParams.set("origin", origin);
  amapUrl.searchParams.set("destination", destination);
  if (waypoints) amapUrl.searchParams.set("waypoints", waypoints);
  amapUrl.searchParams.set("output", "json");
  amapUrl.searchParams.set("extensions", "base");

  try {
    const resp = await fetch(amapUrl.toString());
    const data = await resp.json() as {
      status: string;
      info: string;
      route?: { paths?: { steps?: { polyline?: string }[] }[] };
    };

    if (data.status !== "1") {
      return new Response(
        JSON.stringify({ ok: false, error: `Amap: ${data.info}` }),
        { status: 502, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const steps = data.route?.paths?.[0]?.steps ?? [];
    const polyline = steps.map((s) => s.polyline).filter(Boolean).join(";");

    return new Response(
      JSON.stringify({ ok: true, polyline }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unknown" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
}
