import {
  admin,
  cleanToken,
  json,
  listCarNotes,
  number,
  roundMoney,
  validCity,
  validDevice,
  validKey,
  validModel,
} from "./_shared/crowd.ts";

const CAR_BRANDS = new Set(["kia", "victory"]);

function parseComment(value: unknown): string | null {
  const text = String(value ?? "").split(/\s+/).join(" ").trim();
  if (text.length < 2 || text.length > 240 || /[<>]/.test(text)) return null;
  return text;
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204 });
    }
    if (req.method === "GET") {
      const url = new URL(req.url);
      const brand = cleanToken(url.searchParams.get("brand"), validKey, 40);
      if (!brand || !CAR_BRANDS.has(brand)) return json(400, { ok: false });
      let device = cleanToken(url.searchParams.get("device"), validDevice, 64);
      if (!device) device = null;
      const notes = await listCarNotes(brand, device);
      return json(200, { ok: true, brand, notes });
    }
    if (req.method !== "POST") return json(405, { ok: false });
    const payload = await req.json() as Record<string, unknown>;
    const device = cleanToken(payload.device, validDevice, 64);
    const brand = cleanToken(payload.brand, validKey, 40);
    const model = cleanToken(payload.model, validModel, 40);
    const city = cleanToken(payload.city, validCity, 40);
    if (!device || !brand || !CAR_BRANDS.has(brand) || !model || !city) {
      return json(400, { ok: false });
    }
    const includes = payload.includesFuel;
    if (typeof includes !== "boolean") return json(400, { ok: false });
    let storedPrice: number | null = null;
    let message = "";
    if ("price" in payload && payload.price != null && payload.price !== "") {
      const value = number(payload.price);
      if (value == null || value < 1000 || value > 5_000_000) {
        message = "اكتب سعر السيارة بين 1,000 و 5,000,000 ريال، أو اتركه فاضي.";
      } else {
        storedPrice = roundMoney(value);
      }
    }
    if (!message && includes && storedPrice == null) {
      message = "اكتب السعر إذا كان يشمل البنزين.";
    }
    const text = parseComment(payload.text);
    if (!message && text == null) {
      message = "اكتب تعليقاً من حرفين إلى 240 حرف، بدون رموز HTML.";
    }
    if (!message) {
      const sb = admin();
      const { error } = await sb.from("car_notes").upsert({
        device,
        brand,
        model,
        city,
        price: storedPrice,
        includes_fuel: includes,
        body: text,
        updated_at: Math.floor(Date.now() / 1000),
      });
      if (error) throw error;
    }
    const notes = await listCarNotes(brand, device);
    return json(200, {
      ok: true,
      accepted: !message,
      message,
      notes,
    });
  } catch (error) {
    console.error(error);
    return json(400, { ok: false });
  }
});
