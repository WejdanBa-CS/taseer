import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const NEEDED = 3;
export const RATE_LIMIT = 120;
export const RATE_LIMIT_WRITE = 40;
export const RATE_WINDOW_MS = 600_000;

export type Json = Record<string, unknown>;

const recentHits = new Map<string, number[]>();
const recentWrites = new Map<string, number[]>();

function corsOrigins(): Set<string> {
  return new Set(
    (Deno.env.get("TASEER_CORS_ORIGINS") ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

/** قائمة origins أو * عبر TASEER_CORS_ORIGINS؛ فارغ = عكس Origin إن وُجد (للويب مع API عام محدود). */
export function corsHeaders(req: Request): HeadersInit {
  const origins = corsOrigins();
  const requestOrigin = req.headers.get("Origin")?.trim() ?? "";
  const headers: Record<string, string> = {
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "authorization, apikey, content-type",
    vary: "Origin",
  };
  if (origins.has("*")) {
    headers["access-control-allow-origin"] = "*";
    return headers;
  }
  if (origins.size > 0) {
    if (requestOrigin && origins.has(requestOrigin)) {
      headers["access-control-allow-origin"] = requestOrigin;
    }
    return headers;
  }
  if (requestOrigin) {
    headers["access-control-allow-origin"] = requestOrigin;
  }
  return headers;
}

export function json(status: number, payload: Json, req?: Request): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      ...(req ? corsHeaders(req) : {}),
    },
  });
}

export function optionsResponse(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(req),
  });
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded.slice(0, 64);
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  return "unknown";
}

export function allowRequest(ip: string, write: boolean): boolean {
  const now = Date.now();
  const bucket = write ? recentWrites : recentHits;
  const limit = write ? RATE_LIMIT_WRITE : RATE_LIMIT;
  const hits = (bucket.get(ip) ?? []).filter((stamp) =>
    now - stamp < RATE_WINDOW_MS
  );
  if (hits.length >= limit) {
    bucket.set(ip, hits);
    return false;
  }
  hits.push(now);
  bucket.set(ip, hits);
  return true;
}

export function admin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("missing supabase env");
  return createClient(url, key, { auth: { persistSession: false } });
}

export function cleanToken(
  value: unknown,
  ok: (text: string) => boolean,
  limit: number,
): string | null {
  const text = String(value ?? "").trim();
  if (!text || text.length > limit || !ok(text)) return null;
  return text;
}

export const validKey = (text: string) =>
  [...text].every((c) => /[a-zA-Z0-9-]/.test(c));
export const validModel = (text: string) =>
  !text.includes("  ") && [...text].every((c) => /[a-zA-Z0-9\- ]/.test(c));
export const validYear = (text: string) => {
  const chunks = text.replace("–", "-").split("-");
  return chunks.length >= 1 && chunks.length <= 2 &&
    chunks.every((c) => /^\d{4}$/.test(c));
};
export const validCity = (text: string) =>
  [...text].every((c) => c.charCodeAt(0) >= 32 && c !== "<" && c !== ">");
export const validDevice = (text: string) =>
  text.length >= 16 && [...text].every((c) => /[a-zA-Z0-9-]/.test(c));

export function number(value: unknown): number | null {
  if (typeof value === "boolean" || typeof value !== "number") return null;
  if (!Number.isFinite(value)) return null;
  return value;
}

export function roundMoney(value: number): number {
  return Math.round((value + 1e-9) * 100) / 100;
}

export async function crowdSummary(
  brand: string,
  model: string,
  yearLabel: string,
  part: string,
  city: string,
) {
  const sb = admin();
  const { data: rows, error } = await sb
    .from("quotes")
    .select("quote,city")
    .eq("brand", brand)
    .eq("model", model)
    .eq("year_label", yearLabel)
    .eq("part", part);
  if (error) throw error;
  const list = rows ?? [];
  const count = list.length;
  const average = count
    ? roundMoney(list.reduce((s, r) => s + Number(r.quote), 0) / count)
    : null;
  const cityRows = list.filter((r) => r.city === city);
  const cityCount = cityRows.length;
  const cityAverage = cityCount
    ? roundMoney(cityRows.reduce((s, r) => s + Number(r.quote), 0) / cityCount)
    : null;
  return {
    ok: true,
    count,
    average,
    ready: count >= NEEDED,
    needed: NEEDED,
    city,
    cityCount,
    cityAverage,
    cityReady: cityCount >= NEEDED,
  };
}

export async function listCarNotes(brand: string, device: string | null) {
  const sb = admin();
  const { data, error } = await sb
    .from("car_notes")
    .select("device,model,city,price,includes_fuel,body,updated_at")
    .eq("brand", brand)
    .order("updated_at", { ascending: false })
    .limit(400);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    model: row.model,
    city: row.city,
    price: row.price == null ? null : roundMoney(Number(row.price)),
    includesFuel: Boolean(row.includes_fuel),
    text: row.body,
    at: Number(row.updated_at),
    mine: Boolean(device) && row.device === device,
  }));
}

function fields(source: Record<string, unknown>, quoteRequired: boolean) {
  const brand = cleanToken(source.brand, validKey, 40);
  const model = cleanToken(source.model, validKey, 40);
  const yearLabel = cleanToken(source.yearLabel, validYear, 12);
  const part = cleanToken(source.part, validKey, 40);
  const city = cleanToken(source.city, validCity, 40);
  if (!brand || !model || !yearLabel || !part || !city) {
    throw new Error("fields");
  }
  let quote: number | null = null;
  if (quoteRequired || "quote" in source) {
    quote = number(source.quote);
    if (quote == null || quote < 1 || quote > 20000) quote = null;
  }
  return { brand, model, yearLabel, part, city, quote };
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return optionsResponse(req);
    const ip = clientIp(req);
    if (req.method === "GET") {
      if (!allowRequest(ip, false)) return json(429, { ok: false }, req);
      const url = new URL(req.url);
      const q = Object.fromEntries(url.searchParams.entries());
      const f = fields(q, false);
      return json(
        200,
        await crowdSummary(f.brand, f.model, f.yearLabel, f.part, f.city),
        req,
      );
    }
    if (req.method !== "POST") return json(405, { ok: false }, req);
    if (!allowRequest(ip, true)) return json(429, { ok: false }, req);
    const payload = await req.json();
    if (!payload || typeof payload !== "object") {
      return json(400, { ok: false }, req);
    }
    const device = cleanToken(
      (payload as Record<string, unknown>).device,
      validDevice,
      64,
    );
    if (!device) return json(400, { ok: false }, req);
    const f = fields(payload as Record<string, unknown>, true);
    const accepted = f.quote != null;
    if (accepted) {
      const sb = admin();
      const { error } = await sb.from("quotes").upsert({
        device,
        brand: f.brand,
        model: f.model,
        year_label: f.yearLabel,
        part: f.part,
        city: f.city,
        quote: f.quote,
        updated_at: Math.floor(Date.now() / 1000),
      });
      if (error) throw error;
    }
    const result = await crowdSummary(
      f.brand,
      f.model,
      f.yearLabel,
      f.part,
      f.city,
    );
    return json(200, { ...result, accepted }, req);
  } catch (error) {
    console.error(error);
    return json(400, { ok: false }, req);
  }
});
