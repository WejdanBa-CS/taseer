const data = window.MIZAN_PARTS;
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
const panel = document.querySelector("#panel");
const steps = document.querySelector("#steps");

function money(value) {
  const digits = Number.isInteger(value) ? 0 : 2;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: 2,
  }).format(value);
}

function norm(value) {
  return String(value || "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, "")
    .toLowerCase();
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

function renderSteps() {
  steps.innerHTML = STEP_LABELS.map(
    (label, index) => `<li class="${index === state.step ? "on" : ""}">${index + 1}. ${label}</li>`
  ).join("");
}

function renderSources() {
  const list = document.querySelector("#source-list");
  list.innerHTML = Object.values(window.MIZAN_SOURCES)
    .map(
      (source) =>
        `<li><a href="${source.url}" target="_blank" rel="noreferrer">${source.name}</a>. ${source.note}</li>`
    )
    .join("");
}

function choice(label, detail, onPick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "choice";
  button.innerHTML = detail ? `${label}<small>${detail}</small>` : label;
  button.addEventListener("click", onPick);
  return button;
}

function backBar(title, onBack) {
  const bar = document.createElement("div");
  bar.className = "bar";
  const heading = document.createElement("h1");
  heading.textContent = title;
  bar.append(heading);
  if (onBack) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "linkish";
    button.textContent = "رجوع";
    button.addEventListener("click", onBack);
    bar.append(button);
  }
  return bar;
}

function renderCity() {
  panel.replaceChildren();
  panel.append(backBar("في أي مدينة الصيانة؟"));
  const lead = document.createElement("p");
  lead.className = "lead";
  lead.textContent =
    "كل مناطق المملكة. سعر القطعة الأصلية عند الوكيل موحّد، والمدينة تبقى مع الطلب لأن أجرة الورشة غير داخلة في السعر.";
  const input = document.createElement("input");
  input.className = "search";
  input.placeholder = "ابحثي عن المدينة";
  input.setAttribute("aria-label", "البحث عن المدينة");
  const host = document.createElement("div");
  const draw = () => {
    host.replaceChildren();
    const query = norm(input.value);
    const regions = [...new Set(window.MIZAN_CITIES.map((city) => city.region))];
    regions.forEach((region) => {
      const cities = window.MIZAN_CITIES.filter(
        (city) => city.region === region && (!query || norm(city.name).includes(query) || norm(region).includes(query))
      );
      if (!cities.length) return;
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
  };
  input.addEventListener("input", draw);
  panel.append(lead, input, host);
  draw();
}

function renderCar() {
  panel.replaceChildren();
  if (state.carStage === "brand") {
    panel.append(
      backBar("وش الوكالة؟", () => {
        state.step = 0;
        render();
      })
    );
    const lead = document.createElement("p");
    lead.className = "lead";
    lead.textContent = "القائمة الحالية من جدولي كيا وفيكتوري المنشورين. تويوتا أسعارها في متجر الوكيل وما دخلت الجدول.";
    const choices = document.createElement("div");
    choices.className = "choices";
    data.brands.forEach((brand) => {
      choices.append(
        choice(brand.name, "أسعار قطع منشورة", () => {
          state.brand = brand.id;
          state.model = null;
          state.yearLabel = null;
          state.part = null;
          state.carStage = "model";
          render();
        })
      );
    });
    const toyota = document.createElement("p");
    toyota.className = "note";
    toyota.innerHTML = `تويوتا: <a href="${window.MIZAN_SOURCES.toyota.url}" target="_blank" rel="noreferrer">متجر القطع</a>.`;
    panel.append(lead, choices, toyota);
    return;
  }

  if (state.carStage === "model") {
    panel.append(
      backBar(`نوع سيارة ${brandName(state.brand)}`, () => {
        state.carStage = "brand";
        render();
      })
    );
    const input = document.createElement("input");
    input.className = "search";
    input.placeholder = "ابحثي عن الموديل";
    input.setAttribute("aria-label", "البحث عن الموديل");
    const choices = document.createElement("div");
    choices.className = "choices";
    const draw = () => {
      choices.replaceChildren();
      const query = norm(input.value);
      modelsForBrand(state.brand)
        .filter((model) => !query || norm(model.name).includes(query) || norm(model.id).includes(query))
        .forEach((model) => {
          choices.append(
            choice(model.name, "", () => {
              state.model = model.id;
              state.yearLabel = null;
              state.part = null;
              state.carStage = "year";
              render();
            })
          );
        });
    };
    input.addEventListener("input", draw);
    panel.append(input, choices);
    draw();
    return;
  }

  const model = modelsForBrand(state.brand).find((item) => item.id === state.model);
  panel.append(
    backBar(`سنة ${model.name}`, () => {
      state.carStage = "model";
      render();
    })
  );
  const choices = document.createElement("div");
  choices.className = "choices";
  yearsForModel().forEach((year) => {
    choices.append(
      choice(year, "", () => {
        state.yearLabel = year;
        state.part = null;
        state.step = 2;
        render();
      })
    );
  });
  panel.append(choices);
}

function renderProblem() {
  panel.replaceChildren();
  const model = modelsForBrand(state.brand).find((item) => item.id === state.model);
  panel.append(
    backBar("وش القطعة؟", () => {
      state.step = 1;
      state.carStage = "year";
      render();
    })
  );
  const lead = document.createElement("p");
  lead.className = "lead";
  lead.textContent = `${model.name} ${state.yearLabel}. القطع الظاهرة هي اللي لها سعر في قائمة الوكيل.`;
  const choices = document.createElement("div");
  choices.className = "choices";
  partsForSelection().forEach((part) => {
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
    return ["ok", "أقل بكثير من سعر القطعة الأصلية. غالباً قطعة تجارية، واسألي عن الضمان."];
  }
  if (quote <= high) {
    return ["ok", "قريب من سعر القطعة الأصلية عند الوكيل. هذا قبل أجرة التركيب."];
  }
  if (quote <= high * 1.5) {
    return ["warn", "أعلى من سعر القطعة المنشورة. اطلبي تفصيل القطعة والأجرة كل واحدة بسعرها."];
  }
  return ["bad", "أعلى بكثير من سعر القطعة الأصلية المنشورة. لا توافقين قبل ما تشوفين الفاتورة مفصّلة."];
}

function renderResult() {
  panel.replaceChildren();
  const model = modelsForBrand(state.brand).find((item) => item.id === state.model);
  const lines = selectedRows()
    .filter((row) => row.part === state.part)
    .sort((a, b) => a.price - b.price);
  const low = lines[0].price;
  const high = lines[lines.length - 1].price;
  const source = window.MIZAN_SOURCES[lines[0].source];

  panel.append(
    backBar(partName(state.part), () => {
      state.step = 2;
      render();
    })
  );
  const context = document.createElement("p");
  context.className = "lead";
  context.textContent = `${state.city.name} · ${brandName(state.brand)} ${model.name} ${state.yearLabel}`;

  const price = document.createElement("p");
  price.className = "price";
  price.innerHTML =
    low === high
      ? `${money(low)} <span>ريال</span>`
      : `${money(low)} – ${money(high)} <span>ريال</span>`;

  const list = document.createElement("div");
  list.className = "lines";
  lines.forEach((line) => {
    const row = document.createElement("div");
    row.className = "line";
    row.innerHTML = `<span>${lineLabel(line)}</span><strong>${money(line.price)} ريال</strong>`;
    list.append(row);
  });

  const note = document.createElement("p");
  note.className = "note";
  note.textContent = `${source.note} الأجرة غير مشمولة، والسعر نفسه في كل مدن المملكة.`;

  const sourceLine = document.createElement("p");
  sourceLine.className = "note";
  sourceLine.innerHTML = `المصدر: <a href="${source.url}" target="_blank" rel="noreferrer">${source.name}</a>`;

  const quoteBox = document.createElement("div");
  quoteBox.className = "group";
  const quoteTitle = document.createElement("h2");
  quoteTitle.textContent = "كم طلبوا منك على القطعة؟";
  const quoteForm = document.createElement("form");
  quoteForm.className = "quote";
  const input = document.createElement("input");
  input.inputMode = "decimal";
  input.placeholder = "سعر الورشة بالريال";
  input.setAttribute("aria-label", "سعر الورشة");
  input.value = state.quote;
  const button = document.createElement("button");
  button.className = "primary";
  button.type = "submit";
  button.textContent = "قارني";
  const verdictBox = document.createElement("p");
  verdictBox.hidden = true;
  quoteForm.append(input, button);
  quoteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const quote = Number(String(input.value).replace(/,/g, ""));
    state.quote = input.value;
    if (!Number.isFinite(quote) || quote <= 0) {
      verdictBox.hidden = false;
      verdictBox.className = "verdict warn";
      verdictBox.textContent = "اكتبي السعر رقماً.";
      return;
    }
    const [tone, text] = verdict(quote, low, high);
    verdictBox.hidden = false;
    verdictBox.className = `verdict ${tone}`;
    verdictBox.textContent = text;
  });
  quoteBox.append(quoteTitle, quoteForm, verdictBox);

  panel.append(context, price, list, note, sourceLine, quoteBox);
}

function render() {
  renderSteps();
  [renderCity, renderCar, renderProblem, renderResult][state.step]();
}

renderSources();
render();
