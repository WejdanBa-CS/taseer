import 'package:flutter_test/flutter_test.dart';
import 'package:taseer/services/advice.dart';

void main() {
  test('toneOf يميز low / close / high / extreme', () {
    expect(AdviceEngine.toneOf(50, 100, 200), 'low');
    expect(AdviceEngine.toneOf(150, 100, 200), 'close');
    expect(AdviceEngine.toneOf(250, 100, 200), 'high');
    expect(AdviceEngine.toneOf(400, 100, 200), 'extreme');
  });

  test('matchSymptom يلتقط كلمات عربية شائعة', () {
    final ids = AdviceEngine.symptoms.keys;
    expect(AdviceEngine.matchSymptom('صرير فرامل', ids), 'front-pads');
    expect(AdviceEngine.matchSymptom('فلتر زيت', ids), 'oil-filter');
    expect(AdviceEngine.matchSymptom('تايمن', ids), 'timing');
    expect(AdviceEngine.matchSymptom('س', ids), isNull);
  });

  test('localAdvice يعيد نغمة قريبة وبعيدة', () {
    final close = AdviceEngine.localAdvice(
      part: 'oil-filter',
      partName: 'فلتر الزيت',
      quote: 40,
      low: 30,
      high: 90,
    );
    expect(close.tone, 'close');
    expect(close.headline, isNotEmpty);

    final high = AdviceEngine.localAdvice(
      part: 'oil-filter',
      partName: 'فلتر الزيت',
      quote: 120,
      low: 30,
      high: 90,
      marketEstimate: true,
    );
    expect(high.tone, 'high');
    expect(high.script.toLowerCase(), contains('تقدير'));
  });
}
