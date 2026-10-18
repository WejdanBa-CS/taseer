"""Build js/parts.js from the published Kia list and the Victory price table."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KIA_FILE = ROOT / "data" / "sources" / "kia-spare-parts-2509.md"

MODELS_AR = {
    "CARENS": "كارينز",
    "CARNIVAL": "كرنفال",
    "CARNIVAL HEV": "كرنفال هايبرد",
    "CERATO": "سيراتو",
    "EV5": "إي في 5",
    "EV9": "إي في 9",
    "K3": "كي 3",
    "K4": "كي 4",
    "K5 DL3": "كي 5",
    "K8 GL3": "كي 8",
    "K4000": "K4000",
    "Niro": "نيرو",
    "PEGAS": "بيجاس",
    "PICANTO": "بيكانتو",
    "SELTOS": "سيلتوس",
    "SONET": "سونيت",
    "SORENTO": "سورينتو",
    "SPORTAGE": "سبورتاج",
    "STINGER": "ستينجر",
    "TASMAN": "تاسمان",
    "TELLURIDE": "تيلورايد",
}

PARTS = [
    ("oil-filter", "فلتر الزيت", ("ENGINE OIL FILTER",)),
    ("air-filter", "فلتر الهواء", ("AIR FILTER",)),
    ("ac-filter", "فلتر المكيف", ("AC FILTER", "FILTER ASSY-AIR")),
    ("fuel-filter", "فلتر الوقود", ("FUEL FILTER",)),
    ("front-pads", "فحمات أمامية", ("FRONT BRAKE", "FRONT DISC BRAKE")),
    ("rear-pads", "فحمات خلفية", ("REAR BRAKE",)),
    ("plugs", "بواجي", ("SPARK PLUG",)),
    ("glow-plug", "بواجي تسخين", ("PLUG-GLOW", "GLOW")),
    ("coolant", "ماء رديتر للجالون", ("COOLANT",)),
    ("wiper", "مساحات", ("WIPER",)),
    ("timing", "سير أو جنزير التايمن", ("TIMING",)),
    ("belt", "سير المحرك", ("DRIVE BELT", "HSB BELT")),
]


def part_of(description):
    text = description.upper().replace("FILT ER", "FILTER")
    text = re.sub(r"^\d+\s+", "", text).strip()
    if "FUEL TANK AIR FILTER" in text:
        return None
    for part_id, _label, keys in PARTS:
        if any(key in text for key in keys):
            return part_id, text
    return None


def year_of(code):
    compact = re.sub(r"\s+", "", code)
    match = re.search(r"(20\d{2}|19\d{2})", compact)
    return int(match.group(1)) if match else None


def kia_rows():
    rows = []
    for line in KIA_FILE.read_text().splitlines():
        match = re.match(
            r"\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([0-9]+(?:\.[0-9]+)?)\s*\|",
            line,
        )
        if not match:
            continue
        model, code, description, price = [item.strip() for item in match.groups()]
        if model.lower() == "model":
            continue
        year = year_of(code)
        parsed = part_of(description)
        if year is None or parsed is None or model not in MODELS_AR:
            continue
        part_id, detail = parsed
        rows.append(
            {
                "brand": "kia",
                "model": model,
                "modelAr": MODELS_AR[model],
                "year": year,
                "yearLabel": str(year),
                "part": part_id,
                "detail": detail,
                "price": float(price),
                "source": "kia",
            }
        )
    return rows


def victory_rows():
    groups = [
        ("2020–2025", "2020-2025", {
            "V1-V2": [
                ("oil-filter", "فلتر زيت", 37.95),
                ("air-filter", "فلتر هواء", 57.50),
                ("fuel-filter", "فلتر الوقود", 40.00),
                ("plugs", "بواجي (طقم 4)", 101.20),
                ("belt", "سير الكمبروسر", 79.35),
                ("belt", "سير المكينة", 56.35),
                ("front-pads", "فحمات أمامية (يمين + يسار)", 239.20),
                ("rear-pads", "أقمشة خلفية (يمين + يسار)", 322.00),
            ],
            "K1-K2": [
                ("oil-filter", "فلتر زيت", 37.95),
                ("air-filter", "فلتر هواء", 57.50),
                ("fuel-filter", "فلتر الوقود", 40.00),
                ("plugs", "بواجي (طقم 4)", 101.20),
                ("belt", "سير الكمبروسر", 79.35),
                ("belt", "سير المكينة", 56.35),
                ("front-pads", "فحمات أمامية (يمين + يسار)", 239.20),
                ("rear-pads", "أقمشة خلفية K1/K2", 391.00),
            ],
        }),
        ("2017", "2017", {
            "V1-V2": [
                ("oil-filter", "فلتر زيت", 25.00),
                ("air-filter", "فلتر هواء", 28.75),
                ("fuel-filter", "فلتر الوقود", 40.79),
                ("plugs", "بواجي (طقم 4)", 80.00),
                ("belt", "سير الكمبروسر", 45.00),
                ("belt", "سير المكينة", 40.00),
                ("front-pads", "فحمات أمامية (يمين + يسار)", 239.20),
                ("rear-pads", "أقمشة خلفية (يمين + يسار)", 322.00),
            ],
            "K1-K2": [
                ("oil-filter", "فلتر زيت", 25.00),
                ("air-filter", "فلتر هواء", 28.75),
                ("fuel-filter", "فلتر الوقود", 40.79),
                ("plugs", "بواجي (طقم 4)", 80.00),
                ("belt", "سير الكمبروسر", 45.00),
                ("belt", "سير المكينة", 40.00),
                ("front-pads", "فحمات أمامية (يمين + يسار)", 239.20),
                ("rear-pads", "أقمشة خلفية K1/K2", 391.00),
            ],
        }),
    ]
    names = {"V1-V2": "V1 – V2", "K1-K2": "K1 – K2"}
    rows = []
    for year_label, year_key, models in groups:
        for model, items in models.items():
            for part_id, detail, price in items:
                rows.append(
                    {
                        "brand": "victory",
                        "model": model,
                        "modelAr": names[model],
                        "year": int(year_label[:4]) if year_label != "2017" else 2017,
                        "yearLabel": year_label,
                        "part": part_id,
                        "detail": detail,
                        "price": price,
                        "source": "victory",
                    }
                )
    return rows


def main():
    parts = [{"id": part_id, "name": name} for part_id, name, _keys in PARTS]
    rows = kia_rows() + victory_rows()
    payload = {
        "parts": parts,
        "brands": [
            {"id": "kia", "name": "كيا"},
            {"id": "victory", "name": "فيكتوري"},
        ],
        "rows": rows,
    }
    target = ROOT / "js" / "parts.js"
    target.write_text(
        "window.MIZAN_PARTS = " + json.dumps(payload, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )
    print(f"wrote {len(rows)} rows to {target}")


if __name__ == "__main__":
    main()
