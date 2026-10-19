import 'dart:convert';

import 'package:http/http.dart' as http;

import '../data/models.dart';
import 'config.dart';
import 'device_id.dart';

class Api {
  static String? _resolvedBase;
  static const _timeout = Duration(seconds: 12);

  static bool _isLocalHost(String host) =>
      host == '127.0.0.1' || host == 'localhost' || host == '10.0.2.2';

  /// يسمح بـ HTTPS دائماً، وHTTP فقط لخادم التطوير المحلي.
  static bool _endpointAllowed(Uri uri) {
    if (uri.scheme == 'https') return true;
    if (uri.scheme == 'http' && _isLocalHost(uri.host)) return true;
    return false;
  }

  /// مسار دوال Supabase (`/functions/v1`) مقابل خادم Python (`/api/...`).
  static bool _usesFunctionsV1(String root) => root.contains('/functions/v1');

  static String _crowdUrl(String root) =>
      _usesFunctionsV1(root) ? '$root/crowd' : '$root/api/crowd';

  static String _carsUrl(String root) =>
      _usesFunctionsV1(root) ? '$root/cars' : '$root/api/cars';

  static Map<String, String> _headers(String root, {bool jsonBody = false}) {
    final headers = <String, String>{};
    if (jsonBody) {
      headers['content-type'] = 'application/json; charset=utf-8';
    }
    if (_usesFunctionsV1(root) && crowdAnonKey.isNotEmpty) {
      headers['apikey'] = crowdAnonKey;
      headers['Authorization'] = 'Bearer $crowdAnonKey';
    }
    return headers;
  }

  static Future<String> base() async {
    if (_resolvedBase != null) return _resolvedBase!;
    final configured = crowdEndpoint.trim().replaceAll(RegExp(r'/$'), '');
    if (configured.isNotEmpty) {
      final uri = Uri.tryParse(configured);
      if (uri != null &&
          uri.hasScheme &&
          uri.host.isNotEmpty &&
          _endpointAllowed(uri)) {
        _resolvedBase = configured;
        return configured;
      }
      _resolvedBase = '';
      return '';
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
        response = await http
            .post(
              Uri.parse(_crowdUrl(root)),
              headers: _headers(root, jsonBody: true),
              body: jsonEncode({
                'device': await DeviceId.get(),
                'brand': brand,
                'model': model,
                'yearLabel': yearLabel,
                'part': part,
                'city': city,
                'quote': quote,
              }),
            )
            .timeout(_timeout);
      } else {
        response = await http
            .get(
              Uri.parse(_crowdUrl(root)).replace(
                queryParameters: {
                  'brand': brand,
                  'model': model,
                  'yearLabel': yearLabel,
                  'part': part,
                  'city': city,
                },
              ),
              headers: _headers(root),
            )
            .timeout(_timeout);
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
      final response = await http
          .get(
            Uri.parse(_carsUrl(root)).replace(
              queryParameters: {
                'brand': brand,
                'device': await DeviceId.get(),
              },
            ),
            headers: _headers(root),
          )
          .timeout(_timeout);
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
      final response = await http
          .post(
            Uri.parse(_carsUrl(root)),
            headers: _headers(root, jsonBody: true),
            body: jsonEncode({
              'device': await DeviceId.get(),
              'brand': brand,
              'model': model,
              'city': city,
              'price': price,
              'includesFuel': includesFuel,
              'text': text,
            }),
          )
          .timeout(_timeout);
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
