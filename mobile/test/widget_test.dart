import 'package:flutter_test/flutter_test.dart';
import 'package:taseer/data/catalog.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('يحمّل كتالوج القطع', () async {
    final catalog = await Catalog.load();
    expect(catalog.rows.length, greaterThan(100));
    expect(catalog.brands.length, greaterThan(40));
    expect(catalog.cities, isNotEmpty);
    expect(catalog.modelsForBrand('kia'), isNotEmpty);
    expect(catalog.modelsForBrand('toyota'), isNotEmpty);
    expect(catalog.hasPublishedPrices('kia'), isTrue);
    expect(catalog.hasPublishedPrices('toyota'), isFalse);
    expect(catalog.partsFor('toyota', 'CAMRY', '2024'), isNotEmpty);
    expect(catalog.marketRangeFor('front-pads'), isNotNull);
    expect(catalog.yearsFor('toyota', 'CAMRY'), contains('2024'));
  });
}
