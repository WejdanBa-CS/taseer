# تسعير — تطبيق Flutter / Dart

واجهة أصلية بـ Flutter وفق تصميم تسعير المعتمد:
شعار السيارة وعلامة الدولار، ألوان التيل والبرتقالي، خط Tajawal، وشريط تنقل سفلي (الرئيسية / السيارات / قطع الغيار).

## التشغيل

```bash
cd mobile
flutter pub get
flutter run
```

الإنتاج الافتراضي يتصل بـ Supabase Edge Functions
(`.../functions/v1` لـ `health` / `crowd` / `cars`).

خادم التقارير المحلي (Python / SQLite):

```bash
TASEER_CROWD_DB=/tmp/taseer-crowd.sqlite3 PORT=8771 python3 ../server/crowd.py
flutter run --dart-define=TASEER_CROWD_ENDPOINT=http://127.0.0.1:8771
```

أو Render:

```bash
flutter run --dart-define=TASEER_CROWD_ENDPOINT=https://taseer-crowd.onrender.com
```

معرف التطبيق: `sa.taseer.app`
