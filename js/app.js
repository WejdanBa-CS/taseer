const data = window.TASEER_PARTS;
const state = {
  step: 0,
  carStage: "brand",
  city: null,
  brand: null,
  model: null,
  yearLabel: null,
  part: null,
  quote: "",
  unlockedKey: "",
  payError: "",
  screen: "prices",
  budget: "",
  fuelMode: "all",
  modelQuery: "",
  showRest: false,
  carNotes: [],
  carNotesStatus: "idle",
  carNotesBrand: "",
};

const STEP_LABELS = ["المدينة", "السيارة", "المشكلة", "السعر"];
const STORAGE_KEY = "taseer-flow";
const panel = document.querySelector("#panel");
const steps = document.querySelector("#steps");
let booted = false;

function money(value) {
  const digits = Number.isInteger(value) ? 0 : 2;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: 2,
  }).format(value);
}

function amountNode(low, high) {
  const node = document.createElement("bdi");
  node.dir = "ltr";
  node.textContent = low === high ? money(low) : `${money(low)} – ${money(high)}`;
  return node;
}

function norm(value) {
  return String(value || "")
    .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function parseQuote(raw) {
  const mapped = String(raw || "")
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[٬،,\s]/g, "")
    .replace("٫", ".")
    .trim();
  if (!mapped) return NaN;
  return Number(mapped);
}

function brandName(id) {
  return data.brands.find((brand) => brand.id === id).name;
}

function partName(id) {
  return data.parts.find((part) => part.id === id).name;
}

function lineLabel(line) {
  const detail = line.detail.toUpperCase();
  if (detail.includes("PASSENGER")) return "مساحة الراكب";
  if (detail.includes("DRIVER")) return "مساحة السائق";
  if (/[ء-ي]/.test(line.detail)) return line.detail;
  return partName(line.part);
}

function selectedRows() {
  return data.rows.filter(
    (row) =>
      row.brand === state.brand &&
      row.model === state.model &&
      row.yearLabel === state.yearLabel
  );
}

function modelsForBrand(brand) {
  const seen = new Map();
  data.rows
    .filter((row) => row.brand === brand)
    .forEach((row) => seen.set(row.model, row.modelAr));
  return [...seen.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

function yearsForModel() {
  const labels = new Set(
    data.rows
      .filter((row) => row.brand === state.brand && row.model === state.model)
      .map((row) => row.yearLabel)
  );
  return [...labels].sort((a, b) => b.localeCompare(a, "ar", { numeric: true }));
}

function partsForSelection() {
  const ids = new Set(selectedRows().map((row) => row.part));
  return data.parts.filter((part) => ids.has(part.id));
}

function currentModel() {
  return modelsForBrand(state.brand).find((item) => item.id === state.model);
}

function groupedLines(lines) {
  const groups = new Map();
  lines.forEach((line) => {
    const label = lineLabel(line);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(line.price);
  });
  return [...groups.entries()]
    .map(([label, prices]) => {
      const sorted = prices.slice().sort((a, b) => a - b);
      return { label, low: sorted[0], high: sorted[sorted.length - 1] };
    })
    .sort((a, b) => {
      const rank = (label) => (label.includes("السائق") ? 0 : label.includes("الراكب") ? 1 : 2);
      return rank(a.label) - rank(b.label) || a.label.localeCompare(b.label, "ar");
    });
}

function persist() {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        step: state.step,
        carStage: state.carStage,
        city: state.city ? { region: state.city.region, name: state.city.name } : null,
        brand: state.brand,
        model: state.model,
        yearLabel: state.yearLabel,
        part: state.part,
        quote: state.quote,
        unlockedKey: state.unlockedKey,
        budget: state.budget,
        fuelMode: state.fuelMode,
        modelQuery: state.modelQuery,
      })
    );
  } catch (error) {
    /* الجلسة قد تكون مغلقة في بعض أوضاع الخصوصية */
  }
}

function restore() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.city) {
      state.city =
        window.TASEER_CITIES.find(
          (city) => city.name === saved.city.name && city.region === saved.city.region
        ) || null;
    }
    state.brand = saved.brand || null;
    state.model = saved.model || null;
    state.yearLabel = saved.yearLabel || null;
    state.part = saved.part || null;
    state.quote = typeof saved.quote === "string" ? saved.quote : "";
    state.unlockedKey = typeof saved.unlockedKey === "string" ? saved.unlockedKey : "";
    state.budget = typeof saved.budget === "string" ? saved.budget : "";
    state.fuelMode = saved.fuelMode === "yes" || saved.fuelMode === "no" ? saved.fuelMode : "all";
    state.modelQuery = typeof saved.modelQuery === "string" ? saved.modelQuery : "";
    state.carStage = saved.carStage || "brand";
    state.step = Number.isInteger(saved.step) ? saved.step : 0;
    if (!state.city) state.step = 0;
    else if (!state.brand) {
      state.step = Math.min(state.step, 1);
      state.carStage = "brand";
    } else if (state.step >= 2 && (!state.model || !state.yearLabel)) {
      state.step = 1;
      state.carStage = state.model ? "year" : "model";
    } else if (state.step >= 3 && !state.part) {
      state.step = 2;
    }
    if (state.step < 0 || state.step > 3) state.step = 0;
  } catch (error) {
    /* ابدأ من المدينة إذا كانت الجلسة تالفة */
  }
}

function renderSteps() {
  steps.replaceChildren();
  STEP_LABELS.forEach((label, index) => {
    const item = document.createElement("li");
    if (index === state.step) {
      item.className = "on";
      item.setAttribute("aria-current", "step");
    } else if (index < state.step) {
      item.className = "done";
    }
    const number = document.createElement("span");
    number.className = "n";
    number.textContent = String(index + 1);
    const name = document.createElement("span");
    name.textContent = label;
    item.append(number, name);
    steps.append(item);
  });
}

function renderSources() {
  const list = document.querySelector("#source-list");
  list.replaceChildren();
  Object.values(window.TASEER_SOURCES).forEach((source) => {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.href = source.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = source.name;
    item.append(link, document.createTextNode(`. ${source.note}`));
    list.append(item);
  });
}

function choice(label, detail, onPick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "choice";
  const labelNode = document.createElement("span");
  if (/[0-9A-Za-z]/.test(label) && !/[ء-ي]/.test(label)) labelNode.dir = "ltr";
  labelNode.textContent = label;
  button.append(labelNode);
  if (detail) {
    const small = document.createElement("small");
    small.textContent = detail;
    button.append(small);
  }
  button.addEventListener("click", onPick);
  return button;
}

function backBar(title) {
  const bar = document.createElement("div");
  bar.className = "bar";
  const heading = document.createElement("h1");
  heading.textContent = title;
  bar.append(heading);
  if (state.step > 0 || state.screen === "garage" || state.screen === "costs") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "linkish";
    button.textContent = "رجوع";
    button.addEventListener("click", () => window.taseerGoBack());
    bar.append(button);
  }
  return bar;
}

function emptyNote(text) {
  const note = document.createElement("p");
  note.className = "empty";
  note.setAttribute("role", "status");
  note.textContent = text;
  return note;
}

function selectBrand(id) {
  if (state.brand !== id) {
    state.brand = id;
    state.model = null;
    state.yearLabel = null;
    state.part = null;
    state.quote = "";
  }
  state.modelQuery = "";
  state.showRest = false;
  state.carStage = "model";
  render();
}

function selectModel(id) {
  if (state.model !== id) {
    state.model = id;
    state.yearLabel = null;
    state.part = null;
    state.quote = "";
  }
  state.carStage = "year";
  render();
}

function selectYear(year) {
  if (state.yearLabel !== year) {
    state.yearLabel = year;
    state.part = null;
    state.quote = "";
  }
  state.step = 2;
  render();
}

function renderCity() {
  panel.replaceChildren();
  panel.append(backBar("في أي مدينة الصيانة؟"));
  const lead = document.createElement("p");
  lead.className = "lead";
  lead.textContent =
    "السعر الأصلي موحّد في المملكة. المدينة تبقى مع الطلب لأن أجرة الورشة غير داخلة.";
  const input = document.createElement("input");
  input.className = "search";
  input.type = "search";
  input.placeholder = "ابحث عن المدينة";
  input.setAttribute("aria-label", "البحث عن المدينة");
  input.autocomplete = "off";
  const host = document.createElement("div");
  const draw = () => {
    host.replaceChildren();
    const query = norm(input.value);
    const regions = [...new Set(window.TASEER_CITIES.map((city) => city.region))];
    let shown = 0;
    regions.forEach((region) => {
      const cities = window.TASEER_CITIES.filter(
        (city) =>
          city.region === region &&
          (!query || norm(city.name).includes(query) || norm(region).includes(query))
      );
      if (!cities.length) return;
      shown += cities.length;
      const group = document.createElement("div");
      group.className = "group";
      const title = document.createElement("h2");
      title.textContent = region;
      const choices = document.createElement("div");
      choices.className = "choices";
      cities.forEach((city) => {
        choices.append(
          choice(city.name, "", () => {
            state.city = city;
            state.step = 1;
            state.carStage = "brand";
            render();
          })
        );
      });
      group.append(title, choices);
      host.append(group);
    });
    if (!shown) {
      host.append(emptyNote("ما لقينا هذه المدينة. اختار مدينة أخرى في المنطقة إذا مدينتك مو بالقائمة."));
    }
  };
  input.addEventListener("input", draw);
  panel.append(lead, input, host);
  draw();
}

function budgetAmount() {
  const budget = parseQuote(state.budget);
  return Number.isFinite(budget) && budget > 0 ? budget : 0;
}

function filterActive() {
  return budgetAmount() > 0 || state.fuelMode !== "all";
}

function noteMatches(note) {
  if (note.price == null) return false;
  const budget = budgetAmount();
  if (budget && note.price > budget) return false;
  if (state.fuelMode === "yes" && !note.includesFuel) return false;
  if (state.fuelMode === "no" && note.includesFuel) return false;
  return true;
}

function notesForModel(modelId) {
  return state.carNotes.filter((note) => note.model === modelId);
}

function arabicCount(count, one, dual, plural) {
  if (count === 1) return one;
  if (count === 2) return dual;
  return `${count} ${plural}`;
}

function priceLine(notes) {
  const priced = notes.filter((note) => note.price != null);
  if (!priced.length) {
    if (!notes.length) return "";
    return arabicCount(notes.length, "تعليق", "تعليقان", "تعليقات");
  }
  const prices = priced.map((note) => note.price).sort((a, b) => a - b);
  const low = prices[0];
  const high = prices[prices.length - 1];
  const amount = low === high ? `${money(low)} ريال` : `من ${money(low)} إلى ${money(high)} ريال`;
  const withFuel = priced.filter((note) => note.includesFuel).length;
  let fuel = " · بدون بنزين";
  if (withFuel === priced.length) fuel = " · يشمل البنزين";
  else if (withFuel > 0) fuel = " · فيه مع بنزين وبدون";
  return amount + fuel;
}

function filteredModels() {
  const query = norm(state.modelQuery);
  return modelsForBrand(state.brand).filter(
    (model) => !query || norm(model.name).includes(query) || norm(model.id).includes(query)
  );
}

function modelButton(model, notes) {
  return choice(model.name, priceLine(notes), () => selectModel(model.id));
}

function paintModelLists() {
  const choices = document.querySelector("#model-choices");
  const restWrap = document.querySelector("#model-rest");
  const status = document.querySelector("#car-filter-status");
  if (!choices || !restWrap || !status) return;
  const models = filteredModels();
  const active = filterActive() && state.carNotesStatus === "ready";
  const matched = [];
  const rest = [];
  models.forEach((model) => {
    const notes = notesForModel(model.id);
    const shown = active ? notes.filter(noteMatches) : notes;
    if (!active || shown.length) matched.push({ model, notes: shown });
    else rest.push({ model, notes });
  });
  choices.replaceChildren();
  if (!models.length) {
    choices.append(emptyNote("ما لقينا هذا الموديل في القوائم المنشورة"));
  } else if (active && !matched.length) {
    choices.append(emptyNote("ما فيه سيارة تناسب هالميزانية في تعليقات المستخدمين."));
  }
  matched.forEach((item) => choices.append(modelButton(item.model, item.notes)));
  restWrap.replaceChildren();
  if (active && rest.length) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.textContent = state.showRest ? "أخفِ باقي السيارات" : `أظهر باقي السيارات (${rest.length})`;
    button.addEventListener("click", () => {
      state.showRest = !state.showRest;
      paintModelLists();
    });
    restWrap.append(button);
    if (state.showRest) {
      const box = document.createElement("div");
      box.className = "choices";
      rest.forEach((item) => box.append(modelButton(item.model, item.notes)));
      restWrap.append(box);
    }
  }
  if (state.carNotesStatus === "loading") status.textContent = "نجيب تعليقات المستخدمين...";
  else if (state.carNotesStatus === "unavailable") {
    status.textContent = "فلتر الميزانية والتعليقات يحتاجان اتصال بخادم التقارير.";
  } else if (state.carNotesStatus === "offline") status.textContent = "ما قدرنا نجيب التعليقات. ارجع وحاول مرة ثانية.";
  else status.textContent = "الفلتر على أسعار كتبها المستخدمون، مو سعر الوكيل.";
}

let carNotesRequest = 0;

function applyCarResult(brand, request, result) {
  if (request !== carNotesRequest || state.carNotesBrand !== brand) return;
  if (result.unavailable) {
    state.carNotesStatus = "unavailable";
    state.carNotes = [];
  } else if (result.offline || result.ok === false) {
    if (!state.carNotes.length) state.carNotesStatus = "offline";
  } else {
    state.carNotesStatus = "ready";
    state.carNotes = Array.isArray(result.notes) ? result.notes : [];
  }
  refreshCarNotesUi();
}

function ensureCarNotes(force) {
  if (!state.brand) return;
  const same = state.carNotesBrand === state.brand;
  if (same && state.carNotesStatus === "loading") return;
  if (same && state.carNotesStatus === "ready" && !force) return;
  const brand = state.brand;
  if (!same || state.carNotesStatus !== "ready") {
    state.carNotes = [];
    state.carNotesStatus = "loading";
  }
  state.carNotesBrand = brand;
  const request = ++carNotesRequest;
  window.TASEER_CARS.list(brand).then((result) => applyCarResult(brand, request, result));
}

function refreshCarNotesUi() {
  if (document.querySelector("#model-choices")) paintModelLists();
  const list = document.querySelector("#comment-list");
  if (list) paintCommentList(list);
  prefillCommentForm();
}

function commentWhen(at) {
  if (!at) return "";
  try {
    return new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(at * 1000));
  } catch (error) {
    return "";
  }
}

function commentCard(note) {
  const card = document.createElement("article");
  card.className = "comment";
  const head = document.createElement("p");
  head.className = "comment-price";
  const bits = [];
  if (note.price != null) {
    bits.push(`${money(note.price)} ريال`);
    bits.push(note.includesFuel ? "يشمل البنزين" : "بدون بنزين");
  }
  if (note.city) bits.push(note.city);
  head.textContent = bits.join(" · ");
  const body = document.createElement("p");
  body.textContent = note.text;
  const meta = document.createElement("p");
  meta.className = "hint";
  meta.textContent = [note.mine ? "تعليقك" : "", commentWhen(note.at)].filter(Boolean).join(" · ");
  card.append(head, body, meta);
  return card;
}

function paintCommentList(list) {
  if (!list || !state.model) return;
  const notes = notesForModel(state.model);
  list.replaceChildren();
  if (state.carNotesStatus === "loading") {
    list.append(emptyNote("نجيب التعليقات..."));
    return;
  }
  if (state.carNotesStatus === "unavailable") {
    list.append(emptyNote("التعليقات تظهر لما يتصل التطبيق بخادم التقارير."));
    return;
  }
  if (state.carNotesStatus === "offline") {
    list.append(emptyNote("ما قدرنا نجيب التعليقات."));
    return;
  }
  if (!notes.length) {
    list.append(emptyNote("كن أول من يعلق على هالسيارة."));
    return;
  }
  notes.forEach((note) => list.append(commentCard(note)));
}

function prefillCommentForm() {
  const form = document.querySelector("#car-comment-form");
  if (!form || form.dataset.touched === "1" || !state.model) return;
  const mine = state.carNotes.find((note) => note.model === state.model && note.mine);
  if (!mine) return;
  form.querySelector("[name=price]").value = mine.price == null ? "" : String(mine.price);
  form.querySelector("[name=fuel]").checked = mine.includesFuel === true;
  form.querySelector("[name=text]").value = mine.text;
  form.querySelector("button.primary").textContent = "حدّث تعليقك";
}

function commentForm(model) {
  const form = document.createElement("form");
  form.id = "car-comment-form";
  form.className = "quote";
  const priceLabel = document.createElement("label");
  priceLabel.textContent = "سعر السيارة بالريال، إذا تبيه";
  priceLabel.htmlFor = "car-price";
  const price = document.createElement("input");
  price.id = "car-price";
  price.name = "price";
  price.inputMode = "decimal";
  price.className = "search";
  price.placeholder = "اختياري";
  price.autocomplete = "off";
  const tick = document.createElement("label");
  tick.className = "tick";
  const fuel = document.createElement("input");
  fuel.type = "checkbox";
  fuel.name = "fuel";
  tick.append(fuel, document.createTextNode("السعر يشمل البنزين"));
  const textLabel = document.createElement("label");
  textLabel.textContent = "تعليقك على السيارة";
  textLabel.htmlFor = "car-comment";
  const text = document.createElement("textarea");
  text.id = "car-comment";
  text.name = "text";
  text.className = "search";
  text.maxLength = 240;
  text.required = true;
  text.placeholder = "وش رأيك بالسيارة أو بالسعر؟";
  const submit = document.createElement("button");
  submit.className = "primary";
  submit.type = "submit";
  submit.textContent = "انشر تعليقك";
  const status = document.createElement("p");
  status.className = "hint";
  status.setAttribute("role", "status");
  form.append(priceLabel, price, tick, textLabel, text, submit, status);
  form.addEventListener("input", () => {
    form.dataset.touched = "1";
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const raw = price.value;
    const hasPrice = raw.trim() !== "";
    const amount = parseQuote(raw);
    const comment = text.value.trim();
    if (hasPrice && (!Number.isFinite(amount) || amount < 1000 || amount > 5000000)) {
      status.textContent = "اكتب سعر السيارة بين 1,000 و 5,000,000 ريال، أو اتركه فاضي.";
      return;
    }
    if (fuel.checked && !hasPrice) {
      status.textContent = "اكتب السعر إذا كان يشمل البنزين.";
      return;
    }
    if (comment.length < 2 || comment.length > 240) {
      status.textContent = "اكتب تعليقاً من حرفين إلى 240 حرف.";
      return;
    }
    submit.disabled = true;
    status.textContent = "ننشر تعليقك...";
    const result = await window.TASEER_CARS.publish({
      brand: state.brand,
      model: model.id,
      city: state.city ? state.city.name : "",
      price: hasPrice ? amount : null,
      includesFuel: fuel.checked,
      text: comment,
    });
    submit.disabled = false;
    if (result.unavailable) {
      status.textContent = "التعليق يننشر لما يتصل التطبيق بخادم التقارير.";
      return;
    }
    if (result.offline) {
      status.textContent = "ما قدرنا ننشر التعليق. جرّب مرة ثانية.";
      return;
    }
    if (Array.isArray(result.notes)) {
      carNotesRequest += 1;
      state.carNotes = result.notes;
      state.carNotesStatus = "ready";
      state.carNotesBrand = state.brand;
    }
    if (!result.accepted) {
      status.textContent = result.message || "ما انقبل التعليق.";
      return;
    }
    form.dataset.touched = "1";
    submit.textContent = "حدّث تعليقك";
    status.textContent = "اننشر تعليقك. يقدر غيرك يشوفه مع الفلتر.";
    paintCommentList(document.querySelector("#comment-list"));
  });
  return form;
}

function renderCarComments(model) {
  const wrap = document.createElement("section");
  wrap.className = "comments";
  const title = document.createElement("h2");
  title.textContent = `تعليقات على ${model.name}`;
  const lead = document.createElement("p");
  lead.className = "hint";
  lead.textContent = "هنا سعر السيارة من المستخدم، وإذا كان يشمل البنزين. سعر قطعة الوكيل يبقى في الخطوة الجاية.";
  const list = document.createElement("div");
  list.id = "comment-list";
  wrap.append(title, lead, list, commentForm(model));
  paintCommentList(list);
  prefillCommentForm();
  return wrap;
}

function renderCar() {
  panel.replaceChildren();
  if (state.carStage === "brand") {
    panel.append(backBar("وش الوكالة؟"));
    const choices = document.createElement("div");
    choices.className = "choices";
    data.brands.forEach((brand) => {
      choices.append(choice(brand.name, "أسعار قطع منشورة", () => selectBrand(brand.id)));
    });
    const toyota = document.createElement("p");
    toyota.className = "note";
    const link = document.createElement("a");
    link.href = window.TASEER_SOURCES.toyota.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "متجر الوكيل";
    toyota.append(document.createTextNode("تويوتا أسعارها في "), link, document.createTextNode(" وما دخلت الجدول."));
    panel.append(choices, toyota);
    return;
  }

  if (state.carStage === "model") {
    ensureCarNotes(true);
    panel.append(backBar(`نوع سيارة ${brandName(state.brand)}`));
    const filters = document.createElement("div");
    filters.className = "filters";
    const input = document.createElement("input");
    input.className = "search";
    input.type = "search";
    input.placeholder = "ابحث عن الموديل";
    input.setAttribute("aria-label", "البحث عن الموديل");
    input.autocomplete = "off";
    input.value = state.modelQuery;
    const budget = document.createElement("input");
    budget.className = "search";
    budget.inputMode = "decimal";
    budget.placeholder = "الميزانية: أقصى سعر بالريال";
    budget.setAttribute("aria-label", "الميزانية");
    budget.autocomplete = "off";
    budget.value = state.budget;
    const fuel = document.createElement("div");
    fuel.className = "fuel-filter";
    fuel.setAttribute("role", "group");
    fuel.setAttribute("aria-label", "هل السعر يشمل البنزين");
    [
      ["all", "الكل"],
      ["yes", "تشمل البنزين"],
      ["no", "بدون بنزين"],
    ].forEach(([id, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = state.fuelMode === id ? "choice on" : "choice";
      button.textContent = label;
      button.addEventListener("click", () => {
        state.fuelMode = id;
        state.showRest = false;
        fuel.querySelectorAll("button").forEach((item) => {
          item.classList.toggle("on", item === button);
        });
        paintModelLists();
        persist();
      });
      fuel.append(button);
    });
    const status = document.createElement("p");
    status.id = "car-filter-status";
    status.className = "hint";
    status.setAttribute("role", "status");
    filters.append(input, budget, fuel, status);
    const choices = document.createElement("div");
    choices.id = "model-choices";
    choices.className = "choices";
    const rest = document.createElement("div");
    rest.id = "model-rest";
    input.addEventListener("input", () => {
      state.modelQuery = input.value;
      paintModelLists();
    });
    budget.addEventListener("input", () => {
      state.budget = budget.value;
      state.showRest = false;
      paintModelLists();
      persist();
    });
    panel.append(filters, choices, rest);
    paintModelLists();
    return;
  }

  ensureCarNotes(true);
  const model = currentModel();
  panel.append(backBar(`سنة ${model.name}`));
  const choices = document.createElement("div");
  choices.className = "choices";
  yearsForModel().forEach((year) => {
    choices.append(choice(year, "", () => selectYear(year)));
  });
  panel.append(choices, renderCarComments(model));
}

function renderProblem() {
  panel.replaceChildren();
  const model = currentModel();
  panel.append(backBar("وش القطعة؟"));
  const lead = document.createElement("p");
  lead.className = "lead";
  lead.textContent = `${model.name} ${state.yearLabel}. القطع الظاهرة هي اللي لها سعر في قائمة الوكيل.`;
  const symptom = document.createElement("input");
  symptom.className = "search";
  symptom.type = "search";
  symptom.placeholder = "أو صف المشكلة: صرير فرامل، حرارة، تقطيع";
  symptom.setAttribute("aria-label", "وصف المشكلة");
  symptom.autocomplete = "off";
  const hint = document.createElement("p");
  hint.className = "note advisor-hint";
  hint.hidden = true;
  const choices = document.createElement("div");
  choices.className = "choices";
  const parts = partsForSelection();
  if (!parts.length) {
    panel.append(lead, emptyNote("ما فيه سعر منشور لهالسيارة في القوائم الحالية."));
    return;
  }
  symptom.addEventListener("input", () => {
    hint.replaceChildren();
    const match = window.TASEER_ADVICE.matchSymptom(symptom.value, parts);
    if (!match) {
      hint.hidden = true;
      return;
    }
    hint.hidden = false;
    if (!match.part) {
      hint.textContent = "المستشار ما لقى لهالقطعة سعر منشور على هالسنة.";
      return;
    }
    hint.append(document.createTextNode(`المستشار يرشّح ${match.part.name}. `));
    const pick = document.createElement("button");
    pick.type = "button";
    pick.className = "linkish";
    pick.textContent = "اختارها";
    pick.addEventListener("click", () => {
      state.part = match.part.id;
      state.quote = "";
      state.step = 3;
      render();
    });
    hint.append(pick);
  });
  parts.forEach((part) => {
    choices.append(
      choice(part.name, "", () => {
        state.part = part.id;
        state.quote = "";
        state.step = 3;
        render();
      })
    );
  });
  panel.append(lead, symptom, hint, choices);
}

const ACCESS_KEY = "taseer-access";
const TOKEN_KEY = "taseer-tokens";

function readAccess() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCESS_KEY) || "");
    return {
      credits: Number(parsed.credits) || 0,
      monthUntil: Number(parsed.monthUntil) || 0,
    };
  } catch (error) {
    return { credits: 0, monthUntil: 0 };
  }
}

function writeAccess(access) {
  localStorage.setItem(ACCESS_KEY, JSON.stringify(access));
}

function monthActive(access) {
  return access.monthUntil > Date.now();
}

function takeAccess(key) {
  if (state.unlockedKey === key) return true;
  const access = readAccess();
  if (monthActive(access)) return true;
  if (access.credits > 0) {
    access.credits -= 1;
    writeAccess(access);
    return true;
  }
  return false;
}

function readTokens() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TOKEN_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((token) => typeof token === "string") : [];
  } catch (error) {
    return [];
  }
}

function grantAccess(event) {
  const tokens = readTokens();
  const access = readAccess();
  if (event.kind === "month") access.monthUntil = Date.now() + 30 * 24 * 60 * 60 * 1000;
  if (event.token && tokens.includes(event.token)) {
    writeAccess(access);
    return;
  }
  if (event.token) {
    tokens.push(event.token);
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens.slice(-40)));
  }
  if (event.kind !== "month") access.credits += 1;
  writeAccess(access);
}

function loadingNote(text) {
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = text;
  return note;
}

function adviceCard(advice) {
  const card = document.createElement("article");
  card.className = "advice";
  const title = document.createElement("h2");
  title.textContent = "المستشار";
  const headline = document.createElement("p");
  headline.className = `verdict ${advice.tone === "low" ? "warn" : advice.tone === "extreme" ? "bad" : "warn"}`;
  headline.textContent = advice.headline;
  const script = document.createElement("p");
  script.textContent = advice.script;
  card.append(title, headline, script);
  if (advice.questions.length) {
    const list = document.createElement("ul");
    advice.questions.forEach((question) => {
      const item = document.createElement("li");
      item.textContent = question;
      list.append(item);
    });
    card.append(list);
  }
  return card;
}

function paywall(tone, quote, low, high) {
  const box = document.createElement("div");
  box.className = "paywall";
  const title = document.createElement("h2");
  title.textContent = "المستشار";
  const headline = document.createElement("p");
  headline.className = tone === "extreme" ? "verdict bad" : "verdict warn";
  headline.textContent =
    tone === "low"
      ? "هذا الرقم أقل من المعتاد لقطعة أصلية."
      : "هذا الرقم يحتاج وقفة قبل ما توافق.";
  const lead = document.createElement("p");
  lead.textContent =
    "سعر القطعة المنشور قدامك. كلام الورشة والأسئلة اللي تسألها قبل الموافقة تنفتح بالدفع.";
  const gap = document.createElement("p");
  gap.className = "note";
  const amount = document.createElement("bdi");
  amount.dir = "ltr";
  amount.textContent = money(tone === "low" ? low - quote : quote - high);
  gap.append(
    document.createTextNode(tone === "low" ? "الفرق حوالي " : "الزيادة حوالي "),
    amount,
    document.createTextNode(
      tone === "low"
        ? " ريال تحت السعر المنشور. المستشار يجهّز الأسئلة قبل ما تقبل القطعة."
        : " ريال فوق السعر المنشور. المستشار يكتب لك الكلام قبل الموافقة."
    )
  );
  box.append(title, headline, lead, gap);
  window.TASEER_OFFERS.forEach((offer, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = index === 0 ? "primary" : "secondary";
    button.textContent = offer.label;
    button.addEventListener("click", () => requestPurchase(offer.id));
    box.append(button);
  });
  const fine = document.createElement("p");
  fine.className = "note";
  fine.textContent =
    "9 ريال تفتح نصيحة واحدة وما تشيل الإعلان. الاشتراك بـ 29 ريال يشيل الإعلان ويحفظ السيارة والتذكير والوقود والتأمين والتكاليف. سعر القطعة الأصلية يبقى مجاني.";
  box.append(fine);
  if (state.payError) {
    const error = document.createElement("p");
    error.className = "verdict warn";
    error.textContent = state.payError;
    box.append(error);
  }
  return box;
}

function requestPurchase(productId) {
  state.payError = "";
  const bridge = window.TaseerAndroid;
  if (bridge && typeof bridge.purchase === "function") {
    bridge.purchase(productId);
    return;
  }
  state.payError = "الدفع يتم من تطبيق أندرويد بعد ربطه بمتجر بلاي.";
  render();
}

window.taseerOnPurchase = function (payload) {
  let event = payload;
  try {
    if (typeof payload === "string") event = JSON.parse(payload);
  } catch (error) {
    event = null;
  }
  if (!event || event.ok === false) {
    state.payError = (event && event.message) || "ما اكتمل الدفع. النصيحة لسا مقفلة.";
  } else {
    state.payError = "";
    grantAccess(event);
  }
  render();
};

function renderResult() {
  rememberCar();
  panel.replaceChildren();
  const model = currentModel();
  const lines = selectedRows()
    .filter((row) => row.part === state.part)
    .sort((a, b) => a.price - b.price);
  if (!lines.length) {
    panel.append(backBar(partName(state.part)));
    panel.append(emptyNote("ما فيه سعر منشور لهالقطعة."));
    return;
  }
  const groups = groupedLines(lines);
  const low = Math.min(...groups.map((group) => group.low));
  const high = Math.max(...groups.map((group) => group.high));
  const source = window.TASEER_SOURCES[lines[0].source];

  panel.append(backBar(partName(state.part)));

  const context = document.createElement("p");
  context.className = "lead";
  context.textContent = `${state.city.name} · ${brandName(state.brand)} ${model.name} ${state.yearLabel}`;

  const price = document.createElement("p");
  price.className = "price";
  price.append(amountNode(low, high), document.createTextNode(" "));
  const unit = document.createElement("span");
  unit.textContent = "ريال";
  price.append(unit);

  const list = document.createElement("div");
  list.className = "lines";
  groups.forEach((group) => {
    const row = document.createElement("div");
    row.className = "line";
    const name = document.createElement("span");
    name.textContent = group.label;
    const value = document.createElement("strong");
    value.append(amountNode(group.low, group.high), document.createTextNode(" ريال"));
    row.append(name, value);
    list.append(row);
  });

  const note = document.createElement("p");
  note.className = "note";
  note.textContent =
    "هذا سعر القطعة الأصلية عند الوكيل، مو سعر الورشة كاملاً. الأجرة غير مشمولة، والسعر نفسه في كل المدن.";

  const sourceLine = document.createElement("p");
  sourceLine.className = "note";
  const sourceLink = document.createElement("a");
  sourceLink.href = source.url;
  sourceLink.target = "_blank";
  sourceLink.rel = "noreferrer";
  sourceLink.textContent = source.name;
  sourceLine.append(document.createTextNode("المصدر: "), sourceLink, document.createTextNode(`. ${source.note}`));

  const crowdHost = document.createElement("div");
  crowdHost.className = "crowd";
  crowdHost.setAttribute("role", "status");
  crowdHost.setAttribute("aria-live", "polite");

  const quoteBox = document.createElement("div");
  quoteBox.className = "compare";
  const quoteTitle = document.createElement("h2");
  quoteTitle.textContent = "كم طلبوا منك على القطعة؟";
  const quoteForm = document.createElement("form");
  quoteForm.className = "quote";
  const input = document.createElement("input");
  input.inputMode = "decimal";
  input.enterKeyHint = "done";
  input.placeholder = "سعر الورشة بالريال";
  input.setAttribute("aria-label", "سعر الورشة");
  input.autocomplete = "off";
  input.value = state.quote;
  const button = document.createElement("button");
  button.className = "primary";
  button.type = "submit";
  button.textContent = "قارني";
  const resultHost = document.createElement("div");
  let crowdTicket = 0;
  let latestAdviceInput = null;
  const refreshCrowd = (quote) => {
    const ticket = ++crowdTicket;
    window.TASEER_CROWD.sync({
      brand: state.brand,
      model: state.model,
      yearLabel: state.yearLabel,
      part: state.part,
      city: state.city.name,
      quote,
    }).then((stats) => {
      if (ticket !== crowdTicket) return;
      paintCrowd(crowdHost, stats);
      if (!stats || !stats.ready || !latestAdviceInput || latestAdviceInput.quote !== quote) return;
      if (!resultHost.querySelector(".advice")) return;
      if (`${state.part}|${latestAdviceInput.quote}` !== state.unlockedKey) return;
      resultHost.replaceChildren(
        adviceCard(
          window.TASEER_ADVICE.localAdvice({
            ...latestAdviceInput,
            crowdReady: true,
            crowdAverage: stats.average,
            crowdCount: stats.count,
          })
        )
      );
    });
  };
  const paintVerdict = () => {
    const quote = parseQuote(input.value);
    state.quote = input.value;
    resultHost.replaceChildren();
    if (!Number.isFinite(quote) || quote <= 0) {
      latestAdviceInput = null;
      const verdictBox = document.createElement("p");
      verdictBox.className = "verdict warn";
      verdictBox.textContent = "اكتب السعر رقماً.";
      resultHost.append(verdictBox);
      persist();
      refreshCrowd(NaN);
      return;
    }
    const adviceInput = {
      quote,
      low,
      high,
      part: state.part,
      partName: partName(state.part),
      city: state.city.name,
      car: `${brandName(state.brand)} ${model.name} ${state.yearLabel}`,
    };
    latestAdviceInput = adviceInput;
    const tone = window.TASEER_ADVICE.toneOf(quote, low, high);
    if (tone === "close") {
      const advice = window.TASEER_ADVICE.localAdvice(adviceInput);
      const verdictBox = document.createElement("p");
      verdictBox.className = "verdict ok";
      verdictBox.textContent = advice.headline;
      const extra = document.createElement("p");
      extra.className = "note";
      extra.textContent = "الفرق على القطعة صغير، فما يحتاج تدفع. الأجرة غير داخلة.";
      resultHost.append(verdictBox, extra);
      persist();
      refreshCrowd(quote);
      return;
    }
    const key = `${state.part}|${quote}`;
    if (state.unlockedKey === key || takeAccess(key)) {
      state.unlockedKey = key;
      state.payError = "";
      const reveal = (advice) => {
        if (state.unlockedKey !== key) return;
        resultHost.replaceChildren(adviceCard(advice));
      };
      if (window.TASEER_AI && window.TASEER_AI.endpoint) {
        resultHost.append(loadingNote("المستشار يراجع الرقم..."));
        persist();
        window.TASEER_ADVICE.advise(adviceInput).then(reveal);
        refreshCrowd(quote);
        return;
      }
      reveal(window.TASEER_ADVICE.localAdvice(adviceInput));
      persist();
      refreshCrowd(quote);
      return;
    }
    resultHost.append(paywall(tone, quote, low, high));
    persist();
    refreshCrowd(quote);
  };
  quoteForm.append(input, button);
  quoteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    paintVerdict();
  });
  quoteBox.append(quoteTitle, quoteForm, resultHost);
  if (state.quote) paintVerdict();
  else refreshCrowd(NaN);

  panel.append(context, price, list, note, sourceLine, crowdHost, quoteBox);
}

function paintCrowd(host, stats) {
  host.replaceChildren();
  if (!stats || stats.unavailable) return;
  const needed = stats.needed || window.TASEER_CROWD.needed;
  if (stats.offline) {
    host.append(crowdNote("متوسط المستخدمين يبين لما يتصل التطبيق."));
    return;
  }
  if (stats.accepted === false) host.append(crowdNote("هذا الرقم بعيد، فما دخل في متوسط المستخدمين."));
  if (stats.ready && Number.isFinite(stats.average)) {
    host.append(
      crowdAmount(
        "متوسط المستخدمين ",
        stats.average,
        ` ريال من ${stats.count} تقارير. هذا مو سعر الوكيل.`
      )
    );
    if (stats.cityReady && Number.isFinite(stats.cityAverage)) {
      host.append(crowdAmount(`في ${state.city.name}: `, stats.cityAverage, ` ريال من ${stats.cityCount} تقارير.`));
    } else if (stats.cityCount > 0) {
      host.append(crowdNote(`في ${state.city.name}: ${stats.cityCount} من ${needed} تقارير.`));
    }
    return;
  }
  const count = stats.count || 0;
  host.append(
    crowdNote(
      count
        ? `تقارير المستخدمين لهالقطعة: ${count} من ${needed}. بعدها يطلع المتوسط.`
        : `اكتب سعر الورشة. متوسط المستخدمين يطلع بعد ${needed} تقارير لنفس القطعة.`
    )
  );
}

function crowdNote(text) {
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = text;
  return note;
}

function crowdAmount(prefix, value, suffix) {
  const row = document.createElement("p");
  row.className = "crowd-avg";
  row.dir = "rtl";
  row.textContent = `${prefix}${money(value)}${suffix}`;
  return row;
}

function paintAd() {
  const slot = document.querySelector("#ad-slot");
  if (!slot) return;
  const subscribed = monthActive(readAccess());
  let nativeOwns = false;
  const bridge = window.TaseerAndroid;
  if (bridge && typeof bridge.setAdsVisible === "function") {
    try {
      nativeOwns = bridge.setAdsVisible(!subscribed) === true;
    } catch (error) {
      nativeOwns = false;
    }
  }
  const show = !subscribed && !nativeOwns;
  slot.hidden = !show;
  document.body.classList.toggle("has-ad", show);
  const bar = document.querySelector("#price-updated");
  if (bar) bar.textContent = priceUpdatedLabel();
  requestAnimationFrame(() => {
    const adHeight = show ? slot.offsetHeight : 0;
    if (bar) bar.style.bottom = `${adHeight}px`;
    const barHeight = bar ? bar.offsetHeight : 0;
    document.documentElement.style.setProperty("--bottom-ui", `${adHeight + barHeight + 12}px`);
  });
}

function priceUpdatedLabel() {
  const sources = window.TASEER_SOURCES;
  const kia = sources.kia.updated;
  const fuel = sources.aramco.updated;
  const sourceId = listedSource();
  if (state.screen === "costs") {
    if (sourceId === "victory") return `آخر تحديث للوقود: ${fuel}. قطع فيكتوري من صفحة الوكيل.`;
    return `آخر تحديث: قطع الغيار ${kia} · الوقود ${fuel}`;
  }
  if (sourceId === "victory") return "أسعار فيكتوري كما نشرها الوكيل على صفحته.";
  if (sourceId === "kia") return `آخر تحديث لأسعار القطع: ${kia}`;
  return `آخر تحديث لأسعار القطع: ${kia}`;
}

function listedSource() {
  if (state.brand && state.model && state.yearLabel && state.part) {
    const row = selectedRows().find((item) => item.part === state.part);
    if (row) return row.source;
  }
  if (state.brand === "kia" || state.brand === "victory") return state.brand;
  return "";
}

function rememberCar() {
  if (!monthActive(readAccess()) || !state.city || !state.brand || !state.model || !state.yearLabel) return;
  const model = currentModel();
  if (!model) return;
  window.TASEER_PLUS.saveCar({
    region: state.city.region,
    city: state.city.name,
    brand: state.brand,
    model: state.model,
    yearLabel: state.yearLabel,
    brandName: brandName(state.brand),
    modelName: model.name,
  });
}

function currentCarRecord() {
  if (!state.city || !state.brand || !state.model || !state.yearLabel) return null;
  const model = currentModel();
  if (!model) return null;
  return {
    region: state.city.region,
    city: state.city.name,
    brand: state.brand,
    model: state.model,
    yearLabel: state.yearLabel,
    brandName: brandName(state.brand),
    modelName: model.name,
  };
}

function reminderText(status) {
  if (status.state === "empty") return "حدد التاريخ عشان يبدأ التذكير.";
  const days = Math.abs(status.days);
  if (status.state === "due") return `متأخر بـ ${days} يوم.`;
  if (status.state === "soon") return `بعد ${days} يوم. قرّب الموعد.`;
  return `بعد ${days} يوم.`;
}

function publishedParts() {
  if (!state.brand || !state.model || !state.yearLabel) return [];
  const rows = selectedRows();
  const byPart = new Map();
  rows.forEach((row) => {
    if (!byPart.has(row.part)) byPart.set(row.part, []);
    byPart.get(row.part).push(row.price);
  });
  return data.parts
    .filter((part) => byPart.has(part.id))
    .map((part) => {
      const prices = byPart.get(part.id).slice().sort((a, b) => a - b);
      return { id: part.id, name: part.name, low: prices[0], high: prices[prices.length - 1] };
    });
}

function renderCosts() {
  const garage = window.TASEER_PLUS.read();
  const parts = publishedParts();
  const costs = window.TASEER_COSTS;
  const result = costs.bill({
    carPrice: garage.carPrice,
    litersPerMonth: garage.litersPerMonth,
    fuelGrade: garage.fuelGrade,
    fuelSar: garage.fuelSar,
    insuranceSar: garage.insuranceSar,
    parts,
  });
  panel.replaceChildren();
  panel.append(backBar("قائمة التكلفة"));
  const wrap = document.createElement("div");
  wrap.className = "garage";
  const lead = document.createElement("p");
  lead.className = "lead";
  const model = state.brand && state.model ? currentModel() : null;
  lead.textContent = model
    ? `${brandName(state.brand)} ${model.name} ${state.yearLabel}. القطع من قائمة الوكيل، والبنزين من أرامكو، وسعر السيارة والتأمين من الرقم اللي تكتبه.`
    : "البنزين سعره موحّد من أرامكو. قطع الغيار تظهر بعد اختيار السيارة والسنة.";
  wrap.append(lead);

  const total = document.createElement("p");
  total.className = "crowd-avg";
  total.dir = "rtl";
  total.textContent = `في الشهر تقريباً ${money(result.total)} ريال: السيارة ${money(result.carMonth)}، البنزين ${money(result.fuelMonth)}، الصيانة ${money(result.upkeepMonth)}، والتأمين ${money(result.insuranceMonth)}.`;
  const totalNote = document.createElement("p");
  totalNote.className = "note";
  totalNote.textContent = "تقدير على 5 سنوات لسعر السيارة، وبدون فوائد وبدون أجرة الورشة.";
  wrap.append(total, totalNote);

  const carTitle = document.createElement("h2");
  carTitle.textContent = "سعر السيارة";
  const carNote = document.createElement("p");
  carNote.className = "note";
  carNote.textContent = "اكتب سعر السيارة اللي عرضه المعرض. هذا الرقم يدخل القسط التقديري.";
  wrap.append(carTitle, carNote);

  const fuelTitle = document.createElement("h2");
  fuelTitle.textContent = "صرف البنزين";
  const fuelNote = document.createElement("p");
  fuelNote.className = "note";
  const source = window.TASEER_SOURCES.aramco;
  const sourceLink = document.createElement("a");
  sourceLink.href = source.url;
  sourceLink.target = "_blank";
  sourceLink.rel = "noreferrer";
  sourceLink.textContent = source.name;
  fuelNote.append(sourceLink, document.createTextNode(`. ${source.note}`));
  const grades = document.createElement("div");
  grades.className = "choices";
  costs.fuels.forEach((fuel) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = fuel.id === garage.fuelGrade ? "choice on" : "choice";
    button.textContent = `${fuel.name} · ${money(fuel.perLiter)} للتر`;
    button.addEventListener("click", () => {
      window.TASEER_PLUS.setCostInputs({ fuelGrade: fuel.id });
      render();
    });
    grades.append(button);
  });
  wrap.append(fuelTitle, fuelNote, grades);

  const form = document.createElement("form");
  form.className = "quote";
  const carInput = document.createElement("input");
  carInput.className = "search";
  carInput.inputMode = "decimal";
  carInput.placeholder = "سعر السيارة في المعرض";
  carInput.setAttribute("aria-label", "سعر السيارة");
  carInput.value = garage.carPrice ? String(garage.carPrice) : "";
  const literInput = document.createElement("input");
  literInput.className = "search";
  literInput.inputMode = "decimal";
  literInput.placeholder = "كم لتر في الشهر";
  literInput.setAttribute("aria-label", "لترات الشهر");
  literInput.value = garage.litersPerMonth ? String(garage.litersPerMonth) : "";
  const coverInput = document.createElement("input");
  coverInput.className = "search";
  coverInput.inputMode = "decimal";
  coverInput.placeholder = "التأمين في السنة";
  coverInput.setAttribute("aria-label", "مبلغ التأمين السنوي");
  coverInput.value = garage.insuranceSar ? String(garage.insuranceSar) : "";
  const save = document.createElement("button");
  save.type = "submit";
  save.className = "primary";
  save.textContent = "حدّث القائمة";
  form.append(carInput, literInput, coverInput, save);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    window.TASEER_PLUS.setCostInputs({
      carPrice: parseQuote(carInput.value),
      litersPerMonth: parseQuote(literInput.value),
      insuranceSar: parseQuote(coverInput.value),
    });
    render();
  });
  wrap.append(form);
  if (result.fuelSource === "record") {
    const recorded = document.createElement("p");
    recorded.className = "note";
    recorded.textContent = `البنزين في المجموع من رقم السجل ${money(garage.fuelSar)} ريال، لأن لترات الشهر فاضية.`;
    wrap.append(recorded);
  }

  const partsTitle = document.createElement("h2");
  partsTitle.textContent = "قطع الغيار المنشورة";
  wrap.append(partsTitle);
  if (!parts.length) {
    wrap.append(crowdNote("اختَر السيارة والسنة في التسعير عشان نعرض قطعها."));
  } else {
    const list = document.createElement("div");
    list.className = "choices";
    parts.forEach((part) => {
      const months = costs.upkeepMonths[part.id];
      const priceText = part.low === part.high ? `${money(part.low)} ريال` : `${money(part.low)} إلى ${money(part.high)} ريال`;
      const detail = months ? `${priceText} · كل ${months} شهر` : `${priceText} · عند الحاجة`;
      list.append(
        choice(part.name, detail, () => {
          state.part = part.id;
          state.quote = "";
          state.screen = "prices";
          state.step = 3;
          render();
        })
      );
    });
    wrap.append(list);
    const once = document.createElement("p");
    once.className = "note";
    once.textContent = `وحدة من كل قطعة منشورة: ${money(result.partsOnce)} ريال. الصيانة الشهرية فوق تحسب القطع الدورية بس.`;
    wrap.append(once);
  }

  const coverTitle = document.createElement("h2");
  coverTitle.textContent = "التأمين";
  const coverNote = document.createElement("p");
  coverNote.className = "note";
  coverNote.textContent = garage.insuranceSar
    ? `المبلغ السنوي ${money(garage.insuranceSar)} ريال، وحصته في الشهر ${money(result.insuranceMonth)} ريال.`
    : "اكتب مبلغ التأمين السنوي في الخانة فوق. سعر التأمين يختلف من شخص لشخص.";
  wrap.append(coverTitle, coverNote);
  panel.append(wrap);
}

function renderGarage() {
  panel.replaceChildren();
  const subscribed = monthActive(readAccess());
  const garage = window.TASEER_PLUS.read();
  panel.append(backBar(subscribed ? "سيارتي" : "الاشتراك"));
  if (!subscribed) {
    renderGarageLock(garage);
    return;
  }
  renderGarageOpen(garage, new Date());
}

function renderGarageLock(garage) {
  const lead = document.createElement("p");
  lead.className = "lead";
  lead.textContent = "الاشتراك الشهري بـ 29 ريال يشيل الإعلان ويفتح سجل السيارة. سعر القطعة الأصلية يبقى مجاني، والنصيحة الواحدة بـ 9 ريال ما تشيل الإعلان.";
  const list = document.createElement("ul");
  list.className = "perks";
  ["إزالة الإعلان", "حفظ نوع السيارة", "تذكير الصيانة حسب مرور الأشهر", "صرف الوقود الشهري", "التأمين وموعد تجديده", "حساب تكاليف الشهر"].forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    list.append(li);
  });
  const saved = [];
  if (garage.car) saved.push(`${garage.car.modelName} ${garage.car.yearLabel}`);
  if (garage.fuelSar > 0) saved.push(`وقود ${money(garage.fuelSar)} ريال`);
  if (garage.insuranceSar > 0) saved.push(`تأمين ${money(garage.insuranceSar)} ريال`);
  const keep = document.createElement("p");
  keep.className = "note";
  keep.textContent = saved.length
    ? `بياناتك محفوظة: ${saved.join("، ")}. الاشتراك يفتحها من جديد.`
    : "ما ينحذف شيء إذا وقف الاشتراك. يرجع السجل مع التجديد.";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "primary";
  button.textContent = "اشترك بـ 29 ريال";
  button.addEventListener("click", () => requestPurchase("advice_month"));
  panel.append(lead, list, keep, button);
  if (state.payError) panel.append(crowdNote(state.payError));
}

function renderGarageOpen(garage, now) {
  const plus = window.TASEER_PLUS;
  const wrap = document.createElement("div");
  wrap.className = "garage";

  const carTitle = document.createElement("h2");
  carTitle.textContent = "السيارة المحفوظة";
  wrap.append(carTitle);
  const carLine = document.createElement("p");
  carLine.className = "note";
  carLine.textContent = garage.car
    ? `${garage.car.brandName} ${garage.car.modelName} ${garage.car.yearLabel} · ${garage.car.city}`
    : "لما تختار السيارة في التسعير وهي محفوظة في الاشتراك، تلقى نوعها هنا.";
  wrap.append(carLine);
  const pending = currentCarRecord();
  if (pending && (!garage.car || garage.car.model !== pending.model || garage.car.yearLabel !== pending.yearLabel)) {
    const save = document.createElement("button");
    save.type = "button";
    save.className = "secondary";
    save.textContent = `احفظ ${pending.modelName} ${pending.yearLabel}`;
    save.addEventListener("click", () => {
      plus.saveCar(pending);
      render();
    });
    wrap.append(save);
  }
  if (garage.car) {
    const open = document.createElement("button");
    open.type = "button";
    open.className = "primary";
    open.textContent = "أسعار قطعها";
    open.addEventListener("click", () => {
      const city = window.TASEER_CITIES.find(
        (item) => item.name === garage.car.city && item.region === garage.car.region
      );
      if (!city) return;
      state.city = city;
      state.brand = garage.car.brand;
      state.model = garage.car.model;
      state.yearLabel = garage.car.yearLabel;
      state.part = null;
      state.quote = "";
      state.carStage = "year";
      state.step = 2;
      state.screen = "prices";
      render();
    });
    wrap.append(open);
  }

  const remindTitle = document.createElement("h2");
  remindTitle.textContent = "تذكير الصيانة";
  wrap.append(remindTitle);
  const remindNote = document.createElement("p");
  remindNote.className = "note";
  remindNote.textContent = "تذكير تقريبي يحسب الأشهر من آخر موعد كتبته.";
  wrap.append(remindNote);
  plus.services.forEach((service) => {
    const block = document.createElement("div");
    const name = document.createElement("h2");
    name.textContent = `${service.name} · كل ${service.months} أشهر`;
    const status = plus.serviceStatus(garage.services[service.id], service.months, now);
    const line = document.createElement("p");
    line.className = status.state === "due" ? "due" : status.state === "soon" ? "soon" : "note";
    line.textContent = reminderText(status);
    const date = document.createElement("input");
    date.type = "date";
    date.dir = "ltr";
    date.className = "search";
    date.value = garage.services[service.id] || "";
    date.setAttribute("aria-label", `آخر موعد ${service.name}`);
    date.addEventListener("change", () => {
      plus.setService(service.id, date.value);
      render();
    });
    block.append(name, line, date);
    wrap.append(block);
  });

  const fuelTitle = document.createElement("h2");
  fuelTitle.textContent = "صرف الوقود الشهري";
  const fuelForm = document.createElement("form");
  const fuelInput = document.createElement("input");
  fuelInput.className = "search";
  fuelInput.inputMode = "decimal";
  fuelInput.placeholder = "كم ريال في الشهر";
  fuelInput.setAttribute("aria-label", "صرف الوقود الشهري");
  fuelInput.value = garage.fuelSar ? String(garage.fuelSar) : "";
  const fuelButton = document.createElement("button");
  fuelButton.className = "primary";
  fuelButton.type = "submit";
  fuelButton.textContent = "احفظ الوقود";
  fuelForm.append(fuelInput, fuelButton);
  fuelForm.addEventListener("submit", (event) => {
    event.preventDefault();
    plus.setFuel(parseQuote(fuelInput.value));
    render();
  });
  wrap.append(fuelTitle, fuelForm);

  const coverTitle = document.createElement("h2");
  coverTitle.textContent = "التأمين";
  const coverStatus = plus.insuranceStatus(garage.insuranceRenew, now);
  const coverLine = document.createElement("p");
  coverLine.className = coverStatus.state === "due" ? "due" : coverStatus.state === "soon" ? "soon" : "note";
  coverLine.textContent =
    coverStatus.state === "empty" ? "اكتب المبلغ وموعد التجديد." : `تجديد التأمين ${reminderText(coverStatus)}`;
  const coverForm = document.createElement("form");
  const coverAmount = document.createElement("input");
  coverAmount.className = "search";
  coverAmount.inputMode = "decimal";
  coverAmount.placeholder = "مبلغ التأمين السنوي";
  coverAmount.setAttribute("aria-label", "مبلغ التأمين");
  coverAmount.value = garage.insuranceSar ? String(garage.insuranceSar) : "";
  const coverDate = document.createElement("input");
  coverDate.type = "date";
  coverDate.dir = "ltr";
  coverDate.className = "search";
  coverDate.setAttribute("aria-label", "تاريخ تجديد التأمين");
  coverDate.value = garage.insuranceRenew || "";
  const coverButton = document.createElement("button");
  coverButton.className = "primary";
  coverButton.type = "submit";
  coverButton.textContent = "احفظ التأمين";
  coverForm.append(coverAmount, coverDate, coverButton);
  coverForm.addEventListener("submit", (event) => {
    event.preventDefault();
    plus.setInsurance(parseQuote(coverAmount.value), coverDate.value);
    render();
  });
  wrap.append(coverTitle, coverLine, coverForm);

  const costTitle = document.createElement("h2");
  costTitle.textContent = "تكاليف هذا الشهر";
  const total = plus.monthlyTotal(garage, now);
  const totalLine = document.createElement("p");
  totalLine.className = "crowd-avg";
  totalLine.dir = "rtl";
  totalLine.textContent = `المجموع ${money(total.total)} ريال. الوقود ${money(total.fuel)}، وحصة التأمين ${money(total.insurance)}، والمسجّل ${money(total.logged)}.`;
  wrap.append(costTitle, totalLine);
  garage.expenses
    .filter((item) => item.month === total.month)
    .forEach((item) => {
      const row = document.createElement("div");
      row.className = "row";
      const label = document.createElement("span");
      label.textContent = `${item.label} · ${money(item.amount)} ريال`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "linkish";
      remove.textContent = "حذف";
      remove.addEventListener("click", () => {
        plus.removeExpense(item.id);
        render();
      });
      row.append(label, remove);
      wrap.append(row);
    });
  const costForm = document.createElement("form");
  const costLabel = document.createElement("input");
  costLabel.className = "search";
  costLabel.placeholder = "وصف المصروف";
  costLabel.setAttribute("aria-label", "وصف المصروف");
  const costAmount = document.createElement("input");
  costAmount.className = "search";
  costAmount.inputMode = "decimal";
  costAmount.placeholder = "المبلغ";
  costAmount.setAttribute("aria-label", "مبلغ المصروف");
  const costButton = document.createElement("button");
  costButton.className = "secondary";
  costButton.type = "submit";
  costButton.textContent = "أضف للتكلفة";
  costForm.append(costLabel, costAmount, costButton);
  costForm.addEventListener("submit", (event) => {
    event.preventDefault();
    plus.addExpense(costLabel.value, parseQuote(costAmount.value), now);
    render();
  });
  wrap.append(costForm);
  panel.append(wrap);
}

function taseerGoBack() {
  if (state.screen === "garage" || state.screen === "costs") {
    state.screen = "prices";
    render();
    return true;
  }
  if (state.step === 0) return false;
  if (state.step === 1) {
    if (state.carStage === "year") state.carStage = "model";
    else if (state.carStage === "model") state.carStage = "brand";
    else state.step = 0;
  } else if (state.step === 2) {
    state.step = 1;
    state.carStage = "year";
  } else {
    state.step = 2;
  }
  render();
  return true;
}

function render() {
  paintAd();
  if (state.screen === "garage" || state.screen === "costs") {
    steps.hidden = true;
    if (state.screen === "garage") renderGarage();
    else renderCosts();
    if (booted) {
      const heading = panel.querySelector("h1");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
    booted = true;
    return;
  }
  steps.hidden = false;
  renderSteps();
  [renderCity, renderCar, renderProblem, renderResult][state.step]();
  persist();
  if (booted) {
    const heading = panel.querySelector("h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }
  booted = true;
}

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  const bridge = window.TaseerAndroid;
  if (!link || !bridge || typeof bridge.open !== "function") return;
  if (!/^https?:/i.test(link.href)) return;
  event.preventDefault();
  bridge.open(link.href);
});

window.taseerGoBack = taseerGoBack;
document.querySelector("#my-car").addEventListener("click", () => {
  state.screen = "garage";
  render();
});
document.querySelector("#cost-list").addEventListener("click", () => {
  state.screen = "costs";
  render();
});
restore();
renderSources();
render();
