import 'package:flutter/material.dart';

class TaseerColors {
  static const green = Color(0xFF1B3A32);
  static const green2 = Color(0xFF2F6A56);
  static const copper = Color(0xFFB86B3C);
  static const copperDeep = Color(0xFF8A4B2A);
  static const cream = Color(0xFFF4EFE6);
  static const card = Color(0xFFFFFCF7);
  static const line = Color(0xFFE4D8C6);
  static const muted = Color(0xFF7A7266);
  static const ink = Color(0xFF1C1915);
  static const ok = Color(0xFF1F7A4D);
  static const warn = Color(0xFFA65B16);
  static const bad = Color(0xFFA12323);
}

ThemeData buildTaseerTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    fontFamily: 'Roboto',
    colorScheme: ColorScheme.fromSeed(
      seedColor: TaseerColors.green,
      primary: TaseerColors.green,
      surface: TaseerColors.cream,
    ),
  );
  return base.copyWith(
    scaffoldBackgroundColor: TaseerColors.cream,
    appBarTheme: const AppBarTheme(
      backgroundColor: Color(0xF0F4EFE6),
      foregroundColor: TaseerColors.ink,
      elevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      color: TaseerColors.card,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(22),
        side: const BorderSide(color: TaseerColors.line),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: TaseerColors.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: TaseerColors.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: TaseerColors.green2, width: 1.4),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: TaseerColors.green,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: TaseerColors.green,
        minimumSize: const Size.fromHeight(52),
        side: const BorderSide(color: TaseerColors.green),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: TaseerColors.copperDeep,
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
  );
}
