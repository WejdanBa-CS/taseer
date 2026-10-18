/* سجل السيارة للاشتراك الشهري: الحفظ، التذكير بالأشهر، الوقود، التأمين، والتكاليف. */
(function () {
  const KEY = "taseer-garage";
  const SERVICES = [
    { id: "oil", name: "زيت وفلتر", months: 6 },
    { id: "ac-filter", name: "فلتر المكيف", months: 6 },
    { id: "air-filter", name: "فلتر الهواء", months: 12 },
    { id: "front-pads", name: "فحمات", months: 12 },
    { id: "coolant", name: "ماء الرديتر", months: 12 },
  ];

  function empty() {
    return {
      car: null,
      services: {},
      fuelSar: 0,
      insuranceSar: 0,
      insuranceRenew: "",
      expenses: [],
      carPrice: 0,
      fuelGrade: "91",
      litersPerMonth: 0,
    };
  }

  function moneyNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 1000000) return 0;
    return Math.round(number * 100) / 100;
  }

  function carPriceNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 5000000) return 0;
    return Math.round(number * 100) / 100;
  }

  function litersNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0 || number > 2000) return 0;
    return Math.round(number * 100) / 100;
  }

  function read() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || "");
      const garage = empty();
      if (parsed.car && parsed.car.model && parsed.car.yearLabel) garage.car = parsed.car;
      if (parsed.services && typeof parsed.services === "object") garage.services = parsed.services;
      garage.fuelSar = moneyNumber(parsed.fuelSar);
      garage.insuranceSar = moneyNumber(parsed.insuranceSar);
      garage.insuranceRenew = typeof parsed.insuranceRenew === "string" ? parsed.insuranceRenew : "";
      garage.carPrice = carPriceNumber(parsed.carPrice);
      garage.fuelGrade = ["91", "95", "98", "diesel"].includes(parsed.fuelGrade) ? parsed.fuelGrade : "91";
      garage.litersPerMonth = litersNumber(parsed.litersPerMonth);
      garage.expenses = Array.isArray(parsed.expenses)
        ? parsed.expenses.filter((item) => item && item.id && item.label).slice(0, 40)
        : [];
      return garage;
    } catch (error) {
      return empty();
    }
  }

  function write(garage) {
    localStorage.setItem(KEY, JSON.stringify(garage));
  }

  function parseIso(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (date.getFullYear() !== Number(match[1]) || date.getMonth() !== Number(match[2]) - 1) return null;
    return date;
  }

  function monthKey(now) {
    const date = now instanceof Date ? now : new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function dayDiff(from, to) {
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((end - start) / 86400000);
  }

  function reminder(target, now) {
    if (!target) return { state: "empty", days: null };
    const today = now instanceof Date ? now : new Date();
    const days = dayDiff(today, target);
    if (days < 0) return { state: "due", days };
    if (days <= 30) return { state: "soon", days };
    return { state: "ok", days };
  }

  function serviceStatus(lastIso, months, now) {
    const last = parseIso(lastIso);
    if (!last) return reminder(null, now);
    const due = new Date(last.getFullYear(), last.getMonth() + months, last.getDate());
    return reminder(due, now);
  }

  function insuranceStatus(renewIso, now) {
    return reminder(parseIso(renewIso), now);
  }

  function monthlyTotal(garage, now) {
    const fuel = moneyNumber(garage.fuelSar);
    const insurance = moneyNumber(garage.insuranceSar) / 12;
    const key = monthKey(now);
    const logged = garage.expenses
      .filter((item) => item.month === key)
      .reduce((sum, item) => sum + moneyNumber(item.amount), 0);
    return {
      fuel,
      insurance: Math.round(insurance * 100) / 100,
      logged: Math.round(logged * 100) / 100,
      total: Math.round((fuel + insurance + logged) * 100) / 100,
      month: key,
    };
  }

  function saveCar(car) {
    const garage = read();
    garage.car = car;
    write(garage);
    return garage;
  }

  function setService(id, iso) {
    const garage = read();
    if (parseIso(iso)) garage.services[id] = iso;
    else delete garage.services[id];
    write(garage);
    return garage;
  }

  function setFuel(amount) {
    const garage = read();
    garage.fuelSar = moneyNumber(amount);
    write(garage);
    return garage;
  }

  function setCostInputs(input) {
    const garage = read();
    if ("carPrice" in input) garage.carPrice = carPriceNumber(input.carPrice);
    if ("litersPerMonth" in input) garage.litersPerMonth = litersNumber(input.litersPerMonth);
    if ("insuranceSar" in input) garage.insuranceSar = moneyNumber(input.insuranceSar);
    if (["91", "95", "98", "diesel"].includes(input.fuelGrade)) garage.fuelGrade = input.fuelGrade;
    write(garage);
    return garage;
  }

  function setInsurance(amount, renew) {
    const garage = read();
    garage.insuranceSar = moneyNumber(amount);
    garage.insuranceRenew = parseIso(renew) ? renew : "";
    write(garage);
    return garage;
  }

  function addExpense(label, amount, now) {
    const clean = String(label || "").trim().slice(0, 40);
    const value = moneyNumber(amount);
    if (!clean || value <= 0) return read();
    const garage = read();
    garage.expenses.unshift({
      id: `c${Date.now()}`,
      label: clean,
      amount: value,
      month: monthKey(now),
    });
    garage.expenses = garage.expenses.slice(0, 40);
    write(garage);
    return garage;
  }

  function removeExpense(id) {
    const garage = read();
    garage.expenses = garage.expenses.filter((item) => item.id !== id);
    write(garage);
    return garage;
  }

  window.TASEER_PLUS = {
    services: SERVICES,
    read,
    saveCar,
    setService,
    setFuel,
    setInsurance,
    setCostInputs,
    addExpense,
    removeExpense,
    serviceStatus,
    insuranceStatus,
    monthlyTotal,
    monthKey,
  };
})();
