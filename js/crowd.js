/* يرسل سعر الورشة مرة واحدة لكل جهاز وقطعة، ويجيب متوسط تقارير المستخدمين. */
(function () {
  function baseUrl() {
    const configured = window.TASEER_CROWD_ENDPOINT;
    if (typeof configured === "string" && /^https?:\/\//i.test(configured.trim())) {
      return configured.trim().replace(/\/$/, "");
    }
    if (location.protocol === "http:" || location.protocol === "https:") {
      return location.origin;
    }
    return "";
  }

  function usesFunctionsV1(root) {
    return root.indexOf("/functions/v1") !== -1;
  }

  function crowdPath(root) {
    return usesFunctionsV1(root) ? root + "/crowd" : root + "/api/crowd";
  }

  function headers(root, jsonBody) {
    const out = {};
    if (jsonBody) out["content-type"] = "application/json";
    if (usesFunctionsV1(root)) {
      const key = window.TASEER_SUPABASE_ANON_KEY;
      if (typeof key === "string" && key.trim()) {
        out.apikey = key.trim();
        out.Authorization = "Bearer " + key.trim();
      }
    }
    return out;
  }

  function deviceId() {
    const key = "taseer-device";
    let id = localStorage.getItem(key) || "";
    if (!/^[a-zA-Z0-9-]{16,64}$/.test(id)) {
      const random =
        window.crypto && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
      id = `d${String(random).replace(/[^a-zA-Z0-9-]/g, "")}`.slice(0, 64);
      if (id.length < 16) id = `${id}0000000000000000`.slice(0, 16);
      localStorage.setItem(key, id);
    }
    return id;
  }

  async function sync(input) {
    const root = baseUrl();
    if (!root) return { unavailable: true };
    const quote = Number(input.quote);
    const hasQuote = Number.isFinite(quote) && quote > 0;
    try {
      const response = hasQuote
        ? await fetch(crowdPath(root), {
            method: "POST",
            headers: headers(root, true),
            body: JSON.stringify({
              device: deviceId(),
              brand: input.brand,
              model: input.model,
              yearLabel: input.yearLabel,
              part: input.part,
              city: input.city,
              quote,
            }),
          })
        : await fetch(
            crowdPath(root) +
              "?" +
              new URLSearchParams({
                brand: input.brand,
                model: input.model,
                yearLabel: input.yearLabel,
                part: input.part,
                city: input.city,
              }),
            { headers: headers(root, false) },
          );
      if (!response.ok) return { offline: true };
      const data = await response.json();
      if (!data || data.ok === false) return { offline: true };
      return data;
    } catch (error) {
      return { offline: true };
    }
  }

  window.TASEER_CROWD = { sync, needed: 3, deviceId };
})();
