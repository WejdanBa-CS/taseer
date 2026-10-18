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
  if (state.step > 0) {
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
    panel.append(backBar(`نوع سيارة ${brandName(state.brand)}`));
    const input = document.createElement("input");
    input.className = "search";
    input.type = "search";
    input.placeholder = "ابحث عن الموديل";
    input.setAttribute("aria-label", "البحث عن الموديل");
    input.autocomplete = "off";
    const choices = document.createElement("div");
    choices.className = "choices";
    const draw = () => {
      choices.replaceChildren();
      const query = norm(input.value);
      const models = modelsForBrand(state.brand).filter(
        (model) => !query || norm(model.name).includes(query) || norm(model.id).includes(query)
      );
      if (!models.length) {
        choices.append(emptyNote("ما لقينا هذا الموديل في القوائم المنشورة"));
        return;
      }
      models.forEach((model) => {
        choices.append(choice(model.name, "", () => selectModel(model.id)));
      });
    };
    input.addEventListener("input", draw);
    panel.append(input, choices);
    draw();
    return;
  }

  const model = currentModel();
  panel.append(backBar(`سنة ${model.name}`));
  const choices = document.createElement("div");
  choices.className = "choices";
  yearsForModel().forEach((year) => {
    choices.append(choice(year, "", () => selectYear(year)));
  });
  panel.append(choices);
}

function renderProblem() {
  panel.replaceChildren();
  const model = currentModel();
  panel.append(backBar("وش القطعة؟"));
  const lead = document.createElement("p");
  lead.className = "lead";
  lead.textContent = `${model.name} ${state.yearLabel}. القطع الظاهرة هي اللي لها سعر في قائمة الوكيل.`;
  const choices = document.createElement("div");
  choices.className = "choices";
  const parts = partsForSelection();
  if (!parts.length) {
    panel.append(lead, emptyNote("ما فيه سعر منشور لهالسيارة في القوائم الحالية."));
    return;
  }
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
  panel.append(lead, choices);
}

function verdict(quote, low, high) {
  if (quote < low * 0.7) {
    return ["ok", "غالباً قطعة تجارية، واسأل عن الضمان."];
  }
  if (quote <= high) {
    return ["ok", "قريب من سعر القطعة الأصلية. هذا قبل الأجرة."];
  }
  if (quote <= high * 1.5) {
    return ["warn", "أعلى من السعر المنشور. اطلب تفصيل القطعة والأجرة كل واحدة بسعرها."];
  }
  return ["bad", "أعلى بكثير. لا توافق قبل ما تشوف الفاتورة مفصّلة."];
}

function renderResult() {
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
  const verdictBox = document.createElement("p");
  verdictBox.hidden = true;
  const paintVerdict = () => {
    const quote = parseQuote(input.value);
    state.quote = input.value;
    persist();
    if (!Number.isFinite(quote) || quote <= 0) {
      verdictBox.hidden = false;
      verdictBox.className = "verdict warn";
      verdictBox.textContent = "اكتب السعر رقماً.";
      return;
    }
    const [tone, text] = verdict(quote, low, high);
    verdictBox.hidden = false;
    verdictBox.className = `verdict ${tone}`;
    verdictBox.textContent = text;
  };
  quoteForm.append(input, button);
  quoteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    paintVerdict();
  });
  quoteBox.append(quoteTitle, quoteForm, verdictBox);
  if (state.quote) paintVerdict();

  panel.append(context, price, list, note, sourceLine, quoteBox);
}

function taseerGoBack() {
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
restore();
renderSources();
render();
