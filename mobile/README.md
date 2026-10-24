# تسعير — تطبيق Flutter / Dart

واجهة أصلية بـ Flutter وفق تصميم تسعير المعتمد:
شعار السيارة وعلامة الدولار، ألوان التيل والبرتقالي، خط Tajawal، وشريط تنقل سفلي (الرئيسية / السيارات / قطع الغيار).

## التشغيل

```bash
cd mobile
flutter pub get
flutter run
```

### Harness (اختبارات + أمان + smoke)

من جذر المستودع (مش من داخل `mobile`):

```bash
./harness/run.sh all
```

التفاصيل في [`../harness/README.md`](../harness/README.md).

### iOS

```bash
cd mobile
flutter pub get
open ios/Runner.xcworkspace
```

أو من الطرفية (بعد اختيار Team في Xcode مرة واحدة):

```bash
flutter run -d ios
```

- Bundle ID: `sa.taseer.app`
- الاسم الظاهر: تسعير
- التقارير عبر HTTPS إلى Supabase (ATS الافتراضي يكفي)
- المشتريات داخل التطبيق تحتاج منتجات `advice_once` و`advice_month` في App Store Connect

الإنتاج الافتراضي يتصل بـ Supabase Edge Functions
(`.../functions/v1` لـ `health` / `crowd` / `cars`).

خادم التقارير المحلي (Python / SQLite) — على المحاكي استخدم عنوان Mac:

```bash
TASEER_CROWD_DB=/tmp/taseer-crowd.sqlite3 PORT=8771 python3 ../server/crowd.py
flutter run -d ios --dart-define=TASEER_CROWD_ENDPOINT=http://127.0.0.1:8771
```

Render (احتياطي / اختبار فقط، SQLite مؤقت):

```bash
flutter run --dart-define=TASEER_CROWD_ENDPOINT=https://taseer-crowd.onrender.com
```

معرف التطبيق: `sa.taseer.app`
