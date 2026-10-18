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
  if (state.step > 0 || state.screen === "garage") {
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
  if (state.screen === "garage") {
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
  if (state.screen === "garage") {
    steps.hidden = true;
    renderGarage();
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
restore();
renderSources();
render();
