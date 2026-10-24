import 'package:flutter_test/flutter_test.dart';
import 'package:taseer/data/catalog.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Catalog catalog;

  setUpAll(() async {
    catalog = await Catalog.load();
  });

  test('كتالوج الوكالات يغطي السوق السعودي', () {
    expect(catalog.brands.length, greaterThanOrEqualTo(40));
    expect(catalog.cities, isNotEmpty);
    expect(catalog.modelsForBrand('kia'), isNotEmpty);
    expect(catalog.modelsForBrand('toyota'), isNotEmpty);
    expect(catalog.modelsForBrand('hyundai'), isNotEmpty);
    expect(catalog.yearsFor('toyota', 'CAMRY'), contains('2024'));
  });

  test('يفصل أسعار الوكيل المنشورة عن التقدير السوقي', () {
    expect(catalog.hasPublishedPrices('kia'), isTrue);
    expect(catalog.hasPublishedPrices('victory'), isTrue);
    expect(catalog.hasPublishedPrices('toyota'), isFalse);

    final toyotaParts = catalog.partsFor('toyota', 'CAMRY', '2024');
    expect(toyotaParts, isNotEmpty);
    expect(catalog.hasPublishedPricesForCar('toyota', 'CAMRY', '2024'), isFalse);

    final range = catalog.marketRangeFor('front-pads');
    expect(range, isNotNull);
    expect(range!.low, lessThan(range.high));
    expect(range.low, greaterThan(0));
  });

  test('كيا لها صفوف أسعار وقطع لسيارة معروفة', () {
    expect(catalog.rows.length, greaterThan(100));
    final models = catalog.modelsForBrand('kia');
    expect(models, isNotEmpty);
    final model = models.first;
    final years = catalog.yearsFor('kia', model.id);
    expect(years, isNotEmpty);
    final parts = catalog.partsFor('kia', model.id, years.first);
    expect(parts, isNotEmpty);
  });
}
