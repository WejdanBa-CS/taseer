import { json, optionsResponse } from "../_shared/crowd.ts";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  return json(200, { ok: true }, req);
});
