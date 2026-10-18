import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class GarageCar {
  const GarageCar({
    required this.region,
    required this.city,
    required this.brand,
    required this.model,
    required this.yearLabel,
    required this.modelName,
  });

  final String region;
  final String city;
  final String brand;
  final String model;
  final String yearLabel;
  final String modelName;

  Map<String, dynamic> toJson() => {
        'region': region,
        'city': city,
        'brand': brand,
        'model': model,
        'yearLabel': yearLabel,
        'modelName': modelName,
      };

  factory GarageCar.fromJson(Map<String, dynamic> json) => GarageCar(
        region: '${json['region'] ?? ''}',
        city: '${json['city'] ?? ''}',
        brand: '${json['brand'] ?? ''}',
        model: '${json['model'] ?? ''}',
        yearLabel: '${json['yearLabel'] ?? ''}',
        modelName: '${json['modelName'] ?? ''}',
      );
}

class GarageExpense {
  const GarageExpense({
    required this.id,
    required this.label,
    required this.amount,
    required this.month,
  });

  final String id;
  final String label;
  final double amount;
  final String month;

  Map<String, dynamic> toJson() => {
        'id': id,
        'label': label,
        'amount': amount,
        'month': month,
      };

  factory GarageExpense.fromJson(Map<String, dynamic> json) => GarageExpense(
        id: '${json['id']}',
        label: '${json['label']}',
        amount: (json['amount'] as num?)?.toDouble() ?? 0,
        month: '${json['month']}',
      );
}

class GarageData {
  GarageData({
    this.car,
    Map<String, String>? services,
    this.fuelSar = 0,
    this.insuranceSar = 0,
    this.insuranceRenew = '',
    List<GarageExpense>? expenses,
    this.carPrice = 0,
    this.fuelGrade = '91',
    this.litersPerMonth = 0,
  })  : services = services ?? {},
        expenses = expenses ?? [];

  GarageCar? car;
  Map<String, String> services;
  double fuelSar;
  double insuranceSar;
  String insuranceRenew;
  List<GarageExpense> expenses;
  double carPrice;
  String fuelGrade;
  double litersPerMonth;

  Map<String, dynamic> toJson() => {
        'car': car?.toJson(),
        'services': services,
        'fuelSar': fuelSar,
        'insuranceSar': insuranceSar,
        'insuranceRenew': insuranceRenew,
        'expenses': expenses.map((e) => e.toJson()).toList(),
        'carPrice': carPrice,
        'fuelGrade': fuelGrade,
        'litersPerMonth': litersPerMonth,
      };

  factory GarageData.fromJson(Map<String, dynamic> json) {
    final data = GarageData();
    if (json['car'] is Map) {
      final car = GarageCar.fromJson(json['car'] as Map<String, dynamic>);
      if (car.model.isNotEmpty && car.yearLabel.isNotEmpty) data.car = car;
    }
    if (json['services'] is Map) {
      data.services = (json['services'] as Map).map(
        (key, value) => MapEntry('$key', '$value'),
      );
    }
    data.fuelSar = _money(json['fuelSar']);
    data.insuranceSar = _money(json['insuranceSar']);
    data.insuranceRenew = '${json['insuranceRenew'] ?? ''}';
    data.carPrice = _carPrice(json['carPrice']);
    data.fuelGrade = const ['91', '95', '98', 'diesel'].contains(json['fuelGrade'])
        ? '${json['fuelGrade']}'
        : '91';
    data.litersPerMonth = _liters(json['litersPerMonth']);
    if (json['expenses'] is List) {
      data.expenses = (json['expenses'] as List)
          .whereType<Map>()
          .map((item) => GarageExpense.fromJson(Map<String, dynamic>.from(item)))
          .where((item) => item.id.isNotEmpty && item.label.isNotEmpty)
          .take(40)
          .toList();
    }
    return data;
  }

  static double _money(dynamic value) {
    final number = value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
    if (number < 0 || number > 1000000) return 0;
    return (number * 100).round() / 100;
  }

  static double _carPrice(dynamic value) {
    final number = value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
    if (number < 0 || number > 5000000) return 0;
    return (number * 100).round() / 100;
  }

  static double _liters(dynamic value) {
    final number = value is num ? value.toDouble() : double.tryParse('$value') ?? 0;
    if (number < 0 || number > 2000) return 0;
    return (number * 100).round() / 100;
  }
}

class ReminderStatus {
  const ReminderStatus(this.state, this.days);
  final String state;
  final int? days;
}

class GarageStore {
  static const key = 'taseer-garage';
  static const services = [
    ('oil', 'زيت وفلتر', 6),
    ('ac-filter', 'فلتر المكيف', 6),
    ('air-filter', 'فلتر الهواء', 12),
    ('front-pads', 'فحمات', 12),
    ('coolant', 'ماء الرديتر', 12),
  ];

  static Future<GarageData> read() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(key);
    if (raw == null || raw.isEmpty) return GarageData();
    try {
      return GarageData.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return GarageData();
    }
  }

  static Future<void> write(GarageData garage) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, jsonEncode(garage.toJson()));
  }

  static ReminderStatus reminder(DateTime? target, [DateTime? now]) {
    if (target == null) return const ReminderStatus('empty', null);
    final today = now ?? DateTime.now();
    final start = DateTime(today.year, today.month, today.day);
    final end = DateTime(target.year, target.month, target.day);
    final days = end.difference(start).inDays;
    if (days < 0) return ReminderStatus('due', days);
    if (days <= 30) return ReminderStatus('soon', days);
    return ReminderStatus('ok', days);
  }

  static DateTime? parseIso(String iso) {
    final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(iso);
    if (match == null) return null;
    final year = int.parse(match.group(1)!);
    final month = int.parse(match.group(2)!);
    final day = int.parse(match.group(3)!);
    final date = DateTime(year, month, day);
    if (date.year != year || date.month != month || date.day != day) return null;
    return date;
  }

  static ReminderStatus serviceStatus(String? lastIso, int months, [DateTime? now]) {
    final last = parseIso(lastIso ?? '');
    if (last == null) return reminder(null, now);
    final due = DateTime(last.year, last.month + months, last.day);
    return reminder(due, now);
  }

  static String monthKey([DateTime? now]) {
    final date = now ?? DateTime.now();
    return '${date.year}-${date.month.toString().padLeft(2, '0')}';
  }

  static Map<String, double> monthlyTotal(GarageData garage, [DateTime? now]) {
    final fuel = garage.fuelSar;
    final insurance = (garage.insuranceSar / 12 * 100).round() / 100;
    final key = monthKey(now);
    final logged = garage.expenses
        .where((item) => item.month == key)
        .fold<double>(0, (sum, item) => sum + item.amount);
    final loggedRounded = (logged * 100).round() / 100;
    return {
      'fuel': fuel,
      'insurance': insurance,
      'logged': loggedRounded,
      'total': ((fuel + insurance + loggedRounded) * 100).round() / 100,
    };
  }
}
