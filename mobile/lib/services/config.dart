/// ضع رابط خادم التقارير قبل البناء، مثل https://example.com بدون /api/crowd.
/// اتركه فارغاً أثناء التطوير المحلي مع نفس المنفذ.
const String crowdEndpoint = String.fromEnvironment(
  'TASEER_CROWD_ENDPOINT',
  defaultValue: '',
);
