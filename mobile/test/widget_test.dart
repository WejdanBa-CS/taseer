import 'package:flutter_test/flutter_test.dart';
import 'package:taseer/data/catalog.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('يحمّل كتالوج القطع', () async {
    final catalog = await Catalog.load();
    expect(catalog.rows.length, greaterThan(100));
    expect(catalog.brands.length, 2);
    expect(catalog.cities, isNotEmpty);
    expect(catalog.modelsForBrand('kia'), isNotEmpty);
  });
}
