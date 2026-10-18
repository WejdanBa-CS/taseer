# تسعير — غلاف Flutter

مشروع Flutter واحد لأندرويد وiOS. الواجهة نفسها من ملفات الويب في جذر المستودع، والغلاف يفتحها داخل WebView ويربط الدفع بروابط المتجر.

## قبل كل بناء

```bash
./scripts/sync_flutter_web.sh
cd mobile
flutter pub get
```

## تشغيل

```bash
cd mobile
flutter run
```

- أندرويد: `flutter build apk`
- iOS (من جهاز ماك): `flutter build ios`

معرف التطبيق: `sa.taseer.app`

مجلد `android/` القديم في الجذر هو الغلاف القديم السابق؛ البناء للمتاجر من `mobile/`.
