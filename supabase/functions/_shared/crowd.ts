import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const NEEDED = 3;

export type Json = Record<string, unknown>;

export function json(status: number, payload: Json): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
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
