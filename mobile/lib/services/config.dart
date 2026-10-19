/// رابط خادم التقارير.
/// الإنتاج الافتراضي: دوال Supabase (`.../functions/v1`).
/// محلياً: `--dart-define=TASEER_CROWD_ENDPOINT=http://127.0.0.1:8771`
/// أو Render: `https://taseer-crowd.onrender.com`
const String crowdEndpoint = String.fromEnvironment(
  'TASEER_CROWD_ENDPOINT',
  defaultValue: 'https://vwfpudqrvjjedxtpxcps.supabase.co/functions/v1',
);

/// مفتاح anon العام لـ Supabase (يُرسل مع طلبات functions/v1 فقط).
const String crowdAnonKey = String.fromEnvironment(
  'TASEER_SUPABASE_ANON_KEY',
  defaultValue:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3ZnB1ZHFydmpqZWR4dHB4Y3BzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIzNTg2MzEsImV4cCI6MjEwNzkzNDYzMX0.JwwuvRGRE4qkvuaOOomWGzXAIxXPVNcuDGEM4Iqmtfs',
);
