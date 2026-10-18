/* حساب تكلفة التملك من أرقام معروفة: سعر المعرض اللي يكتبه المستخدم، لتر أرامكو، قطع منشورة، وتأمينه. */
(function () {
  const FUELS = [
    { id: "91", name: "بنزين 91", perLiter: 2.18 },
    { id: "95", name: "بنزين 95", perLiter: 2.33 },
    { id: "98", name: "بنزين 98", perLiter: 5.33 },
    { id: "diesel", name: "ديزل", perLiter: 1.79 },
  ];
  const UPKEEP_MONTHS = {
    "oil-filter": 6,
    "ac-filter": 6,
    "air-filter": 12,
    "front-pads": 12,
    coolant: 12,
  };
  const OWN_MONTHS = 60;

  function round2(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function fuelById(id) {
    return FUELS.find((item) => item.id === id) || FUELS[0];
  }

  function bill(input) {
    const fuel = fuelById(input.fuelGrade);
    const liters = Number(input.litersPerMonth) || 0;
    const fromPump = liters > 0 ? round2(liters * fuel.perLiter) : 0;
    const recorded = Number(input.fuelSar) || 0;
    const fuelMonth = fromPump || recorded;
    const insuranceMonth = round2((Number(input.insuranceSar) || 0) / 12);
    const carMonth = Number(input.carPrice) > 0 ? round2(Number(input.carPrice) / OWN_MONTHS) : 0;
    const parts = Array.isArray(input.parts) ? input.parts : [];
    const upkeepMonth = round2(
      parts.reduce((sum, part) => {
        const months = UPKEEP_MONTHS[part.id];
        if (!months) return sum;
        return sum + part.low / months;
      }, 0)
    );
    const partsOnce = round2(parts.reduce((sum, part) => sum + part.low, 0));
    return {
      fuel,
      fromPump,
      fuelMonth,
      fuelSource: fromPump ? "pump" : recorded ? "record" : "none",
      insuranceMonth,
      carMonth,
      upkeepMonth,
      partsOnce,
      total: round2(carMonth + fuelMonth + insuranceMonth + upkeepMonth),
      ownMonths: OWN_MONTHS,
    };
  }

  window.TASEER_COSTS = { fuels: FUELS, upkeepMonths: UPKEEP_MONTHS, ownMonths: OWN_MONTHS, bill, fuelById };
})();
