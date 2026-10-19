import {
  cleanToken,
  crowdSummary,
  json,
  number,
  validCity,
  validDevice,
  validKey,
  validYear,
  admin,
} from "./_shared/crowd.ts";

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
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }
    if (req.method === "GET") {
      const url = new URL(req.url);
      const q = Object.fromEntries(url.searchParams.entries());
      const f = fields(q, false);
      return json(
        200,
        await crowdSummary(f.brand, f.model, f.yearLabel, f.part, f.city),
      );
    }
    if (req.method !== "POST") return json(405, { ok: false });
    const payload = await req.json();
    if (!payload || typeof payload !== "object") return json(400, { ok: false });
    const device = cleanToken(
      (payload as Record<string, unknown>).device,
      validDevice,
      64,
    );
    if (!device) return json(400, { ok: false });
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
    return json(200, { ...result, accepted });
  } catch (error) {
    console.error(error);
    return json(400, { ok: false });
  }
});
