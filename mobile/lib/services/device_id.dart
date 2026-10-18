import 'dart:math';

import 'package:shared_preferences/shared_preferences.dart';

class DeviceId {
  static const _key = 'taseer-device';

  static Future<String> get() async {
    final prefs = await SharedPreferences.getInstance();
    var id = prefs.getString(_key) ?? '';
    if (!RegExp(r'^[a-zA-Z0-9-]{16,64}$').hasMatch(id)) {
      final random = Random.secure();
      final raw = List.generate(24, (_) => random.nextInt(36))
          .map((n) => n.toRadixString(36))
          .join();
      id = 'd$raw'.padRight(16, '0').substring(0, 32);
      await prefs.setString(_key, id);
    }
    return id;
  }
}
