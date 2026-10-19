import { json } from "./_shared/crowd.ts";

Deno.serve((_req) => json(200, { ok: true }));
