/* تعليقات المستخدمين على السيارة: سعر كتبه المستخدم، وهل يشمل البنزين. */
(function () {
  function origin() {
    const configured = window.TASEER_CROWD_ENDPOINT;
    if (typeof configured === "string" && /^https?:\/\//i.test(configured.trim())) {
      return configured.trim().replace(/\/$/, "");
    }
    if (location.protocol === "http:" || location.protocol === "https:") return location.origin;
    return "";
  }

  function device() {
    return window.TASEER_CROWD.deviceId();
  }

  async function list(brand) {
    const base = origin();
    if (!base) return { unavailable: true, notes: [] };
    try {
      const response = await fetch(
        `${base}/api/cars?${new URLSearchParams({ brand, device: device() })}`
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
    const base = origin();
    if (!base) return { unavailable: true };
    try {
      const response = await fetch(`${base}/api/cars`, {
        method: "POST",
        headers: { "content-type": "application/json" },
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
