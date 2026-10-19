/* تعليقات المستخدمين على السيارة: سعر كتبه المستخدم، وهل يشمل البنزين. */
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

  function carsPath(root) {
    return usesFunctionsV1(root) ? root + "/cars" : root + "/api/cars";
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

  function device() {
    return window.TASEER_CROWD.deviceId();
  }

  async function list(brand) {
    const root = baseUrl();
    if (!root) return { unavailable: true, notes: [] };
    try {
      const response = await fetch(
        carsPath(root) +
          "?" +
          new URLSearchParams({ brand, device: device() }),
        { headers: headers(root, false) },
      );
      if (!response.ok) return { offline: true, notes: [] };
      const data = await response.json();
      if (!data || data.ok === false) return { offline: true, notes: [] };
      return data;
    } catch (error) {
      return { offline: true, notes: [] };
    }
  }

  async function publish(input) {
    const root = baseUrl();
    if (!root) return { unavailable: true };
    try {
      const response = await fetch(carsPath(root), {
        method: "POST",
        headers: headers(root, true),
        body: JSON.stringify({
          device: device(),
          brand: input.brand,
          model: input.model,
          city: input.city,
          price: input.price,
          includesFuel: input.includesFuel === true,
          text: input.text,
        }),
      });
      if (!response.ok) return { offline: true };
      const data = await response.json();
      if (!data || data.ok === false) return { offline: true };
      return data;
    } catch (error) {
      return { offline: true };
    }
  }

  window.TASEER_CARS = { list, publish };
})();
