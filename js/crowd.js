/* يرسل سعر الورشة مرة واحدة لكل جهاز وقطعة، ويجيب متوسط تقارير المستخدمين. */
(function () {
  function origin() {
    const configured = window.TASEER_CROWD_ENDPOINT;
    if (typeof configured === "string" && /^https?:\/\//i.test(configured.trim())) {
      return configured.trim().replace(/\/$/, "");
    }
    if (location.protocol === "http:" || location.protocol === "https:") return location.origin;
    return "";
  }

  function deviceId() {
    const key = "taseer-device";
    let id = localStorage.getItem(key) || "";
    if (!/^[a-zA-Z0-9-]{16,64}$/.test(id)) {
      const random = window.crypto && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      id = `d${String(random).replace(/[^a-zA-Z0-9-]/g, "")}`.slice(0, 64);
      if (id.length < 16) id = `${id}0000000000000000`.slice(0, 16);
      localStorage.setItem(key, id);
    }
    return id;
  }

  async function sync(input) {
    const base = origin();
    if (!base) return { unavailable: true };
    const quote = Number(input.quote);
    const hasQuote = Number.isFinite(quote) && quote > 0;
    try {
      const response = hasQuote
        ? await fetch(`${base}/api/crowd`, {
            method: "POST",
            headers: { "content-type": "application/json" },
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
            `${base}/api/crowd?${new URLSearchParams({
              brand: input.brand,
              model: input.model,
              yearLabel: input.yearLabel,
              part: input.part,
              city: input.city,
            })}`
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
