import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

class AccessState {
  AccessState({this.credits = 0, this.monthUntil = 0});
  int credits;
  int monthUntil;

  bool get monthActive => monthUntil > DateTime.now().millisecondsSinceEpoch;

  Map<String, dynamic> toJson() => {'credits': credits, 'monthUntil': monthUntil};

  factory AccessState.fromJson(Map<String, dynamic> json) => AccessState(
        credits: (json['credits'] as num?)?.toInt() ?? 0,
        monthUntil: (json['monthUntil'] as num?)?.toInt() ?? 0,
      );
}

class AccessStore {
  static const _accessKey = 'taseer-access';
  static const _tokenKey = 'taseer-tokens';

  static Future<AccessState> read() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_accessKey);
    if (raw == null || raw.isEmpty) return AccessState();
    try {
      return AccessState.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return AccessState();
    }
  }

  static Future<void> write(AccessState access) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_accessKey, jsonEncode(access.toJson()));
  }

  static Future<List<String>> readTokens() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_tokenKey);
    if (raw == null || raw.isEmpty) return [];
    try {
      final parsed = jsonDecode(raw);
      if (parsed is! List) return [];
      return parsed.whereType<String>().toList();
    } catch (_) {
      return [];
    }
  }

  static Future<void> grant({
    required String kind,
    required String token,
  }) async {
    final tokens = await readTokens();
    final access = await read();
    if (kind == 'month') {
      access.monthUntil =
          DateTime.now().millisecondsSinceEpoch + 30 * 24 * 60 * 60 * 1000;
    }
    if (token.isNotEmpty && tokens.contains(token)) {
      await write(access);
      return;
    }
    if (token.isNotEmpty) {
      tokens.add(token);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _tokenKey,
        jsonEncode(tokens.length <= 40 ? tokens : tokens.sublist(tokens.length - 40)),
      );
    }
    if (kind != 'month') access.credits += 1;
    await write(access);
  }

  static Future<bool> takeCredit({
    required String unlockKey,
    required String? currentUnlocked,
  }) async {
    if (currentUnlocked == unlockKey) return true;
    final access = await read();
    if (access.monthActive) return true;
    if (access.credits > 0) {
      access.credits -= 1;
      await write(access);
      return true;
    }
    return false;
  }
}
