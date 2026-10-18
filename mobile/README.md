# تسعير — تطبيق Flutter / Dart

واجهة أصلية بـ Flutter لأندرويد وiOS. مو WebView.

## التشغيل

```bash
cd mobile
flutter pub get
flutter run
```

خادم التقارير المحلي (تعليقات ومتوسط الورشة):

```bash
TASEER_CROWD_DB=/tmp/taseer-crowd.sqlite3 PORT=8771 python3 server/crowd.py
```

أو مرّر الرابط وقت البناء:

```bash
flutter run --dart-define=TASEER_CROWD_ENDPOINT=https://your-host
```

## البناء

```bash
flutter build apk
# على ماك:
flutter build ios
```

معرف التطبيق: `sa.taseer.app`
