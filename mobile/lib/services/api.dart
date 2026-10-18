import 'dart:convert';

import 'package:http/http.dart' as http;

import '../data/models.dart';
import 'config.dart';
import 'device_id.dart';

class Api {
  static String? _resolvedBase;

  static Future<String> base() async {
    if (_resolvedBase != null) return _resolvedBase!;
    final configured = crowdEndpoint.trim().replaceAll(RegExp(r'/$'), '');
    if (configured.startsWith('http://') || configured.startsWith('https://')) {
      _resolvedBase = configured;
      return configured;
    }
    // تطوير محلي: جرّب خادم التقارير على 8771 ثم 8765.
    for (final candidate in ['http://127.0.0.1:8771', 'http://127.0.0.1:8765']) {
      try {
        final response = await http
            .get(Uri.parse('$candidate/health'))
            .timeout(const Duration(milliseconds: 600));
        if (response.statusCode == 200) {
          _resolvedBase = candidate;
          return candidate;
        }
      } catch (_) {}
    }
    _resolvedBase = '';
    return '';
  }

  static Future<CrowdStats> syncCrowd({
    required String brand,
    required String model,
    required String yearLabel,
    required String part,
    required String city,
    double? quote,
  }) async {
    final root = await base();
    if (root.isEmpty) return CrowdStats.unavailable();
    try {
      http.Response response;
      if (quote != null && quote > 0) {
        response = await http.post(
          Uri.parse('$root/api/crowd'),
          headers: {'content-type': 'application/json'},
          body: jsonEncode({
            'device': await DeviceId.get(),
            'brand': brand,
            'model': model,
            'yearLabel': yearLabel,
            'part': part,
            'city': city,
            'quote': quote,
          }),
        );
      } else {
        response = await http.get(
          Uri.parse('$root/api/crowd').replace(
            queryParameters: {
              'brand': brand,
              'model': model,
              'yearLabel': yearLabel,
              'part': part,
              'city': city,
            },
          ),
        );
      }
      if (response.statusCode != 200) return CrowdStats.offline();
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (data['ok'] == false) return CrowdStats.offline();
      return CrowdStats.fromJson(data);
    } catch (_) {
      return CrowdStats.offline();
    }
  }

  static Future<({bool ok, bool unavailable, bool offline, List<CarNote> notes})> listCars(
    String brand,
  ) async {
    final root = await base();
    if (root.isEmpty) {
      return (ok: false, unavailable: true, offline: false, notes: <CarNote>[]);
    }
    try {
      final response = await http.get(
        Uri.parse('$root/api/cars').replace(
          queryParameters: {
            'brand': brand,
            'device': await DeviceId.get(),
          },
        ),
      );
      if (response.statusCode != 200) {
        return (ok: false, unavailable: false, offline: true, notes: <CarNote>[]);
      }
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      if (data['ok'] == false) {
        return (ok: false, unavailable: false, offline: true, notes: <CarNote>[]);
      }
      final notes = ((data['notes'] as List?) ?? [])
          .map((item) => CarNote.fromJson(item as Map<String, dynamic>))
          .toList();
      return (ok: true, unavailable: false, offline: false, notes: notes);
    } catch (_) {
      return (ok: false, unavailable: false, offline: true, notes: <CarNote>[]);
    }
  }

  static Future<
      ({
        bool unavailable,
        bool offline,
        bool accepted,
        String message,
        List<CarNote> notes,
      })> publishCar({
    required String brand,
    required String model,
    required String city,
    required double? price,
    required bool includesFuel,
    required String text,
  }) async {
    final root = await base();
    if (root.isEmpty) {
      return (
        unavailable: true,
        offline: false,
        accepted: false,
        message: '',
        notes: <CarNote>[],
      );
    }
    try {
      final response = await http.post(
        Uri.parse('$root/api/cars'),
        headers: {'content-type': 'application/json'},
        body: jsonEncode({
          'device': await DeviceId.get(),
          'brand': brand,
          'model': model,
          'city': city,
          'price': price,
          'includesFuel': includesFuel,
          'text': text,
        }),
      );
      if (response.statusCode != 200) {
        return (
          unavailable: false,
          offline: true,
          accepted: false,
          message: '',
          notes: <CarNote>[],
        );
      }
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final notes = ((data['notes'] as List?) ?? [])
          .map((item) => CarNote.fromJson(item as Map<String, dynamic>))
          .toList();
      return (
        unavailable: false,
        offline: false,
        accepted: data['accepted'] == true,
        message: '${data['message'] ?? ''}',
        notes: notes,
      );
    } catch (_) {
      return (
        unavailable: false,
        offline: true,
        accepted: false,
        message: '',
        notes: <CarNote>[],
      );
    }
  }
}
