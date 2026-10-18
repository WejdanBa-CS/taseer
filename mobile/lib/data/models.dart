class City {
  const City({required this.region, required this.name});
  final String region;
  final String name;

  factory City.fromJson(Map<String, dynamic> json) => City(
        region: json['region'] as String,
        name: json['name'] as String,
      );
}

class Brand {
  const Brand({required this.id, required this.name});
  final String id;
  final String name;

  factory Brand.fromJson(Map<String, dynamic> json) => Brand(
        id: json['id'] as String,
        name: json['name'] as String,
      );
}

class PartDef {
  const PartDef({required this.id, required this.name});
  final String id;
  final String name;

  factory PartDef.fromJson(Map<String, dynamic> json) => PartDef(
        id: json['id'] as String,
        name: json['name'] as String,
      );
}

class PartRow {
  const PartRow({
    required this.brand,
    required this.model,
    required this.modelAr,
    required this.year,
    required this.yearLabel,
    required this.part,
    required this.detail,
    required this.price,
    required this.source,
  });

  final String brand;
  final String model;
  final String modelAr;
  final int? year;
  final String yearLabel;
  final String part;
  final String detail;
  final double price;
  final String source;

  factory PartRow.fromJson(Map<String, dynamic> json) => PartRow(
        brand: json['brand'] as String,
        model: json['model'] as String,
        modelAr: json['modelAr'] as String,
        year: json['year'] is int ? json['year'] as int : int.tryParse('${json['year']}'),
        yearLabel: '${json['yearLabel']}',
        part: json['part'] as String,
        detail: '${json['detail'] ?? ''}',
        price: (json['price'] as num).toDouble(),
        source: json['source'] as String,
      );
}

class SourceInfo {
  const SourceInfo({
    required this.name,
    required this.url,
    required this.note,
    this.updated,
  });

  final String name;
  final String url;
  final String note;
  final String? updated;

  factory SourceInfo.fromJson(Map<String, dynamic> json) => SourceInfo(
        name: json['name'] as String,
        url: json['url'] as String,
        note: json['note'] as String,
        updated: json['updated'] as String?,
      );
}

class FuelGrade {
  const FuelGrade({required this.id, required this.name, required this.perLiter});
  final String id;
  final String name;
  final double perLiter;

  factory FuelGrade.fromJson(Map<String, dynamic> json) => FuelGrade(
        id: json['id'] as String,
        name: json['name'] as String,
        perLiter: (json['perLiter'] as num).toDouble(),
      );
}

class CarModel {
  const CarModel({required this.id, required this.name});
  final String id;
  final String name;
}

class PriceLine {
  const PriceLine({required this.label, required this.low, required this.high});
  final String label;
  final double low;
  final double high;
}

class CarNote {
  const CarNote({
    required this.model,
    required this.city,
    required this.price,
    required this.includesFuel,
    required this.text,
    required this.at,
    required this.mine,
  });

  final String model;
  final String city;
  final double? price;
  final bool includesFuel;
  final String text;
  final int at;
  final bool mine;

  factory CarNote.fromJson(Map<String, dynamic> json) => CarNote(
        model: json['model'] as String,
        city: json['city'] as String? ?? '',
        price: json['price'] == null ? null : (json['price'] as num).toDouble(),
        includesFuel: json['includesFuel'] == true,
        text: json['text'] as String? ?? '',
        at: (json['at'] as num?)?.toInt() ?? 0,
        mine: json['mine'] == true,
      );
}

class CrowdStats {
  const CrowdStats({
    required this.count,
    required this.average,
    required this.ready,
    required this.needed,
    required this.cityCount,
    required this.cityAverage,
    required this.cityReady,
    this.accepted,
    this.offline = false,
    this.unavailable = false,
  });

  final int count;
  final double? average;
  final bool ready;
  final int needed;
  final int cityCount;
  final double? cityAverage;
  final bool cityReady;
  final bool? accepted;
  final bool offline;
  final bool unavailable;

  factory CrowdStats.unavailable() => const CrowdStats(
        count: 0,
        average: null,
        ready: false,
        needed: 3,
        cityCount: 0,
        cityAverage: null,
        cityReady: false,
        unavailable: true,
      );

  factory CrowdStats.offline() => const CrowdStats(
        count: 0,
        average: null,
        ready: false,
        needed: 3,
        cityCount: 0,
        cityAverage: null,
        cityReady: false,
        offline: true,
      );

  factory CrowdStats.fromJson(Map<String, dynamic> json) => CrowdStats(
        count: (json['count'] as num?)?.toInt() ?? 0,
        average: json['average'] == null ? null : (json['average'] as num).toDouble(),
        ready: json['ready'] == true,
        needed: (json['needed'] as num?)?.toInt() ?? 3,
        cityCount: (json['cityCount'] as num?)?.toInt() ?? 0,
        cityAverage:
            json['cityAverage'] == null ? null : (json['cityAverage'] as num).toDouble(),
        cityReady: json['cityReady'] == true,
        accepted: json.containsKey('accepted') ? json['accepted'] == true : null,
      );
}
