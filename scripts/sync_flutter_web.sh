#!/usr/bin/env bash
# يحدّث أصول بيانات Flutter من ملفات المصدر في جذر المستودع.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/mobile/assets/data"
mkdir -p "$DEST"
node << JS
const fs = require('fs');
const path = require('path');
const root = process.env.ROOT || '$ROOT';
const dest = path.join(root, 'mobile/assets/data');
fs.mkdirSync(dest, { recursive: true });
const parts = fs.readFileSync(path.join(root, 'js/parts.js'), 'utf8');
const partsData = JSON.parse(parts.split('=').slice(1).join('=').trim().replace(/;$/, ''));
fs.writeFileSync(path.join(dest, 'parts.json'), JSON.stringify(partsData));
global.window = {};
eval(fs.readFileSync(path.join(root, 'js/catalog.js'), 'utf8'));
fs.writeFileSync(path.join(dest, 'cities.json'), JSON.stringify(window.TASEER_CITIES));
fs.writeFileSync(path.join(dest, 'sources.json'), JSON.stringify(window.TASEER_SOURCES));
const fuels = [
  { id: '91', name: 'بنزين 91', perLiter: 2.18 },
  { id: '95', name: 'بنزين 95', perLiter: 2.33 },
  { id: '98', name: 'بنزين 98', perLiter: 5.33 },
  { id: 'diesel', name: 'ديزل', perLiter: 1.79 },
];
fs.writeFileSync(path.join(dest, 'fuels.json'), JSON.stringify(fuels));
console.log('تم تحديث mobile/assets/data');
JS
