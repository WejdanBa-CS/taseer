# Harness تسعير

مزيج ثلاث طبقات لفحص المشروع محلياً:

1. **unit** — اختبارات Flutter (كتالوج + نصائح)
2. **security** — فحوصات ثابتة على المصدر (بدون استغلال)
3. **smoke** — health/crowd إذا وُجد خادم حي

## التشغيل

من جذر المستودع:

```bash
./harness/run.sh all
./harness/run.sh unit
./harness/run.sh security
./harness/run.sh smoke
```

يتطلب `flutter` في `PATH` لطبقة unit، و`python3` للطبقتين الأخريين.

### Smoke مع خادم حي

```bash
# محلي
TASEER_CROWD_DB=/tmp/taseer-crowd.sqlite3 PORT=8771 python3 server/crowd.py

# في طرفية ثانية
./harness/run.sh smoke
# أو
TASEER_CROWD_ENDPOINT=http://127.0.0.1:8771 ./harness/run.sh smoke
```

بدون خادم: smoke يخرج `SKIP` ولا يفشل `all` إلا مع:

```bash
./harness/run.sh smoke --require-live
```

## خارج النطاق

- محاكي iOS/Android آلياً
- pentest أو PoC استغلال
- تقييم وكيل AI
