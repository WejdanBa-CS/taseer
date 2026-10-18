import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class AuthSession {
  const AuthSession({required this.name, required this.phone, required this.at});
  final String name;
  final String phone;
  final int at;

  Map<String, dynamic> toJson() => {'name': name, 'phone': phone, 'at': at};

  factory AuthSession.fromJson(Map<String, dynamic> json) => AuthSession(
        name: json['name'] as String,
        phone: json['phone'] as String,
        at: (json['at'] as num?)?.toInt() ?? 0,
      );
}

class AuthStore {
  static const _key = 'taseer-session';

  static String digits(String raw) {
    return raw.replaceAllMapped(
      RegExp('[٠-٩]'),
      (m) => '٠١٢٣٤٥٦٧٨٩'.indexOf(m[0]!).toString(),
    ).replaceAll(RegExp(r'\D'), '');
  }

  static String normalizePhone(String raw) {
    var phone = digits(raw);
    if (phone.startsWith('966') && phone.length == 12) {
      phone = '0${phone.substring(3)}';
    }
    if (phone.startsWith('5') && phone.length == 9) {
      phone = '0$phone';
    }
    if (!RegExp(r'^05\d{8}$').hasMatch(phone)) return '';
    return phone;
  }

  static String cleanName(String raw) {
    final name = raw.replaceAll(RegExp(r'\s+'), ' ').trim();
    if (name.length < 2 || name.length > 40) return '';
    if (name.contains('<') || name.contains('>')) return '';
    return name;
  }

  static Future<AuthSession?> read() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null || raw.isEmpty) return null;
    try {
      final parsed = jsonDecode(raw) as Map<String, dynamic>;
      final phone = normalizePhone('${parsed['phone'] ?? ''}');
      final name = cleanName('${parsed['name'] ?? ''}');
      if (phone.isEmpty || name.isEmpty) return null;
      return AuthSession(name: name, phone: phone, at: (parsed['at'] as num?)?.toInt() ?? 0);
    } catch (_) {
      return null;
    }
  }

  static Future<bool> isLoggedIn() async => (await read()) != null;

  static Future<String?> login(String name, String phone) async {
    final clean = cleanName(name);
    final mobile = normalizePhone(phone);
    if (clean.isEmpty) return 'اكتب اسمك من حرفين إلى 40 حرف.';
    if (mobile.isEmpty) return 'اكتب رقم جوال سعودي يبدأ بـ 05.';
    final prefs = await SharedPreferences.getInstance();
    final session = AuthSession(name: clean, phone: mobile, at: DateTime.now().millisecondsSinceEpoch);
    await prefs.setString(_key, jsonEncode(session.toJson()));
    return null;
  }

  static Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }
}
