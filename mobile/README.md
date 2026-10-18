# تسعير — تطبيق Flutter / Dart

واجهة أصلية بـ Flutter وفق تصميم تسعير المعتمد:
شعار السيارة وعلامة الدولار، ألوان التيل والبرتقالي، خط Tajawal، وشريط تنقل سفلي (الرئيسية / السيارات / قطع الغيار).

## التشغيل

```bash
cd mobile
flutter pub get
flutter run
```

خادم التقارير المحلي:

```bash
TASEER_CROWD_DB=/tmp/taseer-crowd.sqlite3 PORT=8771 python3 ../server/crowd.py
```

أو:

```bash
flutter run --dart-define=TASEER_CROWD_ENDPOINT=https://your-host
```

معرف التطبيق: `sa.taseer.app`
