/* مستشار تسعير: يقرأ سعر الوكيل المنشور والرقم اللي طلبته الورشة، ويرشّح القطعة من وصف المشكلة. */
(function () {
  const SYMPTOMS = [
    ["rear-pads", ["فحمات خلف", "فرامل خلف", "اقمشة خلف", "اقمشه خلف"]],
    ["front-pads", ["فحمات", "فرامل", "بريك", "صرير", "سكيك"]],
    ["timing", ["تايمن", "جنزير", "سير التايمن"]],
    ["wiper", ["مساحة", "مساحات", "ماسحة", "زجاج امام"]],
    ["ac-filter", ["مكيف", "تكييف", "فريون", "ما يبرد"]],
    ["oil-filter", ["فلتر زيت", "تغيير زيت", "زيت المحرك", "زيت"]],
    ["air-filter", ["فلتر هواء", "فلتر الهواء"]],
    ["fuel-filter", ["فلتر وقود", "طرمبة", "طرمبه"]],
    ["glow-plug", ["بواجي تسخين", "تسخين", "ديزل"]],
    ["plugs", ["بواجي", "بوجي", "تقطيع", "صرفية", "صرفيه"]],
    ["coolant", ["حرارة", "حراره", "رديتر", "ماء الرديتر"]],
    ["belt", ["صفير", "سير المحرك", "سير"]],
  ];

  const PART_NOTE = {
    "front-pads": "الفحمات أمان للسيارة. لا تقبل قطعة بلا اسم الوكيل إذا الفرق كبير.",
    "rear-pads": "اسأل هل سعر الفحمات الخلفية للزوج كامل، يمين ويسار.",
    "wiper": "تأكد إن السعر للجهة المطلوبة. بعض القوائم تفصل مساحة السائق عن الراكب.",
    "oil-filter": "فلتر الزيت غالباً ينحط مع أجرة تغيير الزيت. اطلب سعر الفلتر لحاله.",
    "air-filter": "فلتر الهواء قطعة صغيرة. إذا السعر عالي، الأجرة غالباً هي الزيادة.",
    "ac-filter": "فلتر المكيف سهل يتبدل. اسأل هل الأجرة داخلة في الرقم.",
    "fuel-filter": "اسأل هل فلتر الوقود الخارجي ولا اللي داخل التانكي، لأن السعر يختلف.",
    "plugs": "البواجي غالباً طقم. تأكد إن السعر للطقم كامل مو للحبة.",
    "glow-plug": "اسأل هل سعر بواجي التسخين للحبة أو للطقم.",
    "coolant": "السعر المنشور للجالون. اسأل كم جالون مكتوب في الفاتورة.",
    "timing": "شغلة التايمن كبيرة. الأجرة قد تكون أعلى من القطعة، واطلبها بسعر مستقل.",
    belt: "اسأل أي سير بالضبط، لأن السيارة فيها أكثر من سير.",
  };

  function norm(value) {
    return String(value || "")
      .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
      .replace(/[أإآ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  function money(value) {
    const digits = Number.isInteger(value) ? 0 : 2;
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function rangeText(low, high) {
    if (low === high) return `${money(low)} ريال`;
    return `${money(low)} إلى ${money(high)} ريال`;
  }

  function toneOf(quote, low, high) {
    if (quote < low * 0.7) return "low";
    if (quote <= high) return "close";
    if (quote <= high * 1.5) return "high";
    return "extreme";
  }

  function matchSymptom(text, available) {
    const query = norm(text);
    if (query.length < 2) return null;
    for (const [partId, words] of SYMPTOMS) {
      if (!words.some((word) => query.includes(norm(word)))) continue;
      const known = available.find((part) => part.id === partId);
      return { id: partId, part: known || null };
    }
    return null;
  }

  function localAdvice(input) {
    const tone = toneOf(input.quote, input.low, input.high);
    const published = rangeText(input.low, input.high);
    const asked = `${money(input.quote)} ريال`;
    const note = PART_NOTE[input.part] || "اسأل عن اسم القطعة كما هي في فاتورة الوكيل.";
    const gap = input.quote > input.high ? input.quote - input.high : input.low - input.quote;

    if (tone === "close") {
      return {
        tone,
        headline: "قريب من سعر القطعة الأصلية. هذا قبل الأجرة.",
        script: `${input.partName} منشورة بـ ${published}. الرقم اللي كتبته ${asked}، والفرق عن حد السعر المنشور حوالي ${money(Math.abs(input.quote - (input.quote > input.high ? input.high : input.low)))} ريال. هذا مو سعر الورشة كامل. ${note}`,
        questions: [],
      };
    }

    if (tone === "low") {
      return {
        tone,
        headline: "الرقم أقل بكثير من سعر القطعة الأصلية.",
        script: `طلبوا ${asked} بينما ${input.partName} منشورة عند الوكيل بـ ${published}. الفرق حوالي ${money(gap)} ريال تحت السعر المنشور. غالباً القطعة تجارية أو الرقم ناقص. قول لهم: أبي أعرف من وين القطعة، وهل عليها ضمان مكتوب وفاتورة. إذا ما فيه ضمان، الرخص هنا غالي. ${note}`,
        questions: [
          "القطعة أصلية من الوكيل ولا تجارية؟",
          "وين الضمان المكتوب وكم مدته؟",
          "هل الرقم هذا للقطعة لحاله؟",
        ],
      };
    }

    const strong = tone === "extreme";
    return {
      tone,
      headline: strong
        ? "أعلى بكثير. لا توافق قبل ما تشوف الفاتورة مفصّلة."
        : "أعلى من السعر المنشور. اطلب تفصيل القطعة والأجرة.",
      script: `طلبوا ${asked} و${input.partName} منشورة بـ ${published}. الزيادة حوالي ${money(gap)} ريال قبل ما نحسب الأجرة. قول لهم بالحرف: ابغى سعر القطعة لحاله وسعر الأجرة لحاله، والقطعة أصلية بفاتورة. ${
        strong ? "إذا رفضوا التفصيل، لا توافق اليوم وخذ السيارة." : "إذا فصّلوا والزيادة كلها أجرة معقولة، القرار يرجع لك."
      } ${note}`,
      questions: [
        "كم سعر القطعة لحاله وكم الأجرة لحاله؟",
        "هل القطعة أصلية وعليها فاتورة الوكيل؟",
        "وش المكتوب في الضمان؟",
      ],
    };
  }

  async function advise(input) {
    const local = localAdvice(input);
    const endpoint = window.TASEER_AI && window.TASEER_AI.endpoint;
    if (!endpoint) return local;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          part: input.partName,
          quote: input.quote,
          low: input.low,
          high: input.high,
          city: input.city,
          car: input.car,
        }),
      });
      if (!response.ok) return local;
      const remote = await response.json();
      if (!remote || !remote.script) return local;
      return {
        tone: local.tone,
        headline: remote.headline || local.headline,
        script: remote.script,
        questions: Array.isArray(remote.questions) ? remote.questions : local.questions,
      };
    } catch (error) {
      return local;
    }
  }

  window.TASEER_OFFERS = [
    { id: "advice_once", kind: "once", price: 9, label: "افتح النصيحة بـ 9 ريال" },
    { id: "advice_month", kind: "month", price: 29, label: "شهر كامل بـ 29 ريال" },
  ];
  window.TASEER_ADVICE = { matchSymptom, toneOf, localAdvice, advise };
})();
