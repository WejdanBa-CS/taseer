import 'dart:convert';

import 'package:flutter/services.dart';

import 'models.dart';

class Catalog {
  Catalog._({
    required this.parts,
    required this.brands,
    required this.rows,
    required this.cities,
    required this.sources,
    required this.fuels,
  });

  final List<PartDef> parts;
  final List<Brand> brands;
  final List<PartRow> rows;
  final List<City> cities;
  final Map<String, SourceInfo> sources;
  final List<FuelGrade> fuels;

  static Catalog? _instance;
  static Catalog get instance {
    final value = _instance;
    if (value == null) {
      throw StateError('Catalog.load() لازم تنادي قبل الاستخدام.');
    }
    return value;
  }

  static Future<Catalog> load() async {
    if (_instance != null) return _instance!;
    final partsJson = jsonDecode(await rootBundle.loadString('assets/data/parts.json'))
        as Map<String, dynamic>;
    final citiesJson =
        jsonDecode(await rootBundle.loadString('assets/data/cities.json')) as List<dynamic>;
    final sourcesJson = jsonDecode(await rootBundle.loadString('assets/data/sources.json'))
        as Map<String, dynamic>;
    final fuelsJson =
        jsonDecode(await rootBundle.loadString('assets/data/fuels.json')) as List<dynamic>;

    final catalog = Catalog._(
      parts: (partsJson['parts'] as List)
          .map((item) => PartDef.fromJson(item as Map<String, dynamic>))
          .toList(),
      brands: (partsJson['brands'] as List)
          .map((item) => Brand.fromJson(item as Map<String, dynamic>))
          .toList(),
      rows: (partsJson['rows'] as List)
          .map((item) => PartRow.fromJson(item as Map<String, dynamic>))
          .toList(),
      cities: citiesJson.map((item) => City.fromJson(item as Map<String, dynamic>)).toList(),
      sources: sourcesJson.map(
        (key, value) => MapEntry(key, SourceInfo.fromJson(value as Map<String, dynamic>)),
      ),
      fuels: fuelsJson.map((item) => FuelGrade.fromJson(item as Map<String, dynamic>)).toList(),
    );
    _instance = catalog;
    return catalog;
  }

  Brand brandById(String id) => brands.firstWhere((item) => item.id == id);

  PartDef? partById(String id) {
    for (final part in parts) {
      if (part.id == id) return part;
    }
    return null;
  }

  List<CarModel> modelsForBrand(String brand) {
    final seen = <String, String>{};
    for (final row in rows) {
      if (row.brand == brand) seen[row.model] = row.modelAr;
    }
    final list = seen.entries.map((e) => CarModel(id: e.key, name: e.value)).toList()
      ..sort((a, b) => a.name.compareTo(b.name));
    return list;
  }

  List<String> yearsFor(String brand, String model) {
    final labels = <String>{};
    for (final row in rows) {
      if (row.brand == brand && row.model == model) labels.add(row.yearLabel);
    }
    final list = labels.toList()
      ..sort((a, b) => b.compareTo(a));
    return list;
  }

  List<PartRow> selectedRows(String brand, String model, String yearLabel) {
    return rows
        .where((row) => row.brand == brand && row.model == model && row.yearLabel == yearLabel)
        .toList();
  }

  List<PartDef> partsFor(String brand, String model, String yearLabel) {
    final ids = selectedRows(brand, model, yearLabel).map((row) => row.part).toSet();
    return parts.where((part) => ids.contains(part.id)).toList();
  }

  String lineLabel(PartRow line) {
    final detail = line.detail.toUpperCase();
    if (detail.contains('PASSENGER')) return 'مساحة الراكب';
    if (detail.contains('DRIVER')) return 'مساحة السائق';
    if (RegExp(r'[ء-ي]').hasMatch(line.detail)) return line.detail;
    return partById(line.part)?.name ?? line.part;
  }

  List<PriceLine> groupedLines(List<PartRow> lines) {
    final groups = <String, List<double>>{};
    for (final line in lines) {
      final label = lineLabel(line);
      groups.putIfAbsent(label, () => []).add(line.price);
    }
    int rank(String label) {
      if (label.contains('السائق')) return 0;
      if (label.contains('الراكب')) return 1;
      return 2;
    }

    final result = groups.entries.map((entry) {
      final prices = [...entry.value]..sort();
      return PriceLine(label: entry.key, low: prices.first, high: prices.last);
    }).toList()
      ..sort((a, b) {
        final byRank = rank(a.label).compareTo(rank(b.label));
        if (byRank != 0) return byRank;
        return a.label.compareTo(b.label);
      });
    return result;
  }
}

String money(num value) {
  final digits = value == value.roundToDouble() ? 0 : 2;
  return value.toStringAsFixed(digits).replaceAllMapped(
        RegExp(r'(\d)(?=(\d{3})+(?!\d))'),
        (match) => '${match[1]},',
      );
}

String norm(String value) {
  return value
      .replaceAll(RegExp(r'[\u064B-\u0652\u0670\u0640]'), '')
      .replaceAll(RegExp('[أإآ]'), 'ا')
      .replaceAll('ة', 'ه')
      .replaceAll('ى', 'ي')
      .replaceAll(RegExp(r'\s+'), '')
      .toLowerCase();
}

double? parseQuote(String raw) {
  final mapped = raw
      .replaceAllMapped(RegExp('[٠-٩]'), (m) => '٠١٢٣٤٥٦٧٨٩'.indexOf(m[0]!).toString())
      .replaceAll(RegExp(r'[٬،,\s]'), '')
      .replaceAll('٫', '.')
      .trim();
  if (mapped.isEmpty) return null;
  return double.tryParse(mapped);
}
