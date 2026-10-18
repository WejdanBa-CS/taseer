import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class TaseerColors {
  static const ink = Color(0xFF162B3F);
  static const muted = Color(0xFF6D7E8C);
  static const line = Color(0xFFDCE5E9);
  static const surface = Color(0xFFFFFFFF);
  static const soft = Color(0xFFF3F6F7);
  static const brand = Color(0xFF075B68);
  static const brandDark = Color(0xFF064853);
  static const brandSoft = Color(0xFFE8F4F3);
  static const accent = Color(0xFFF4A62A);
  static const accentSoft = Color(0xFFFFF5DF);
  static const ok = Color(0xFF1F7A4D);
  static const warn = Color(0xFFA65B16);
  static const bad = Color(0xFFA12323);

  // توافق مع الأسماء القديمة في الشاشات
  static const green = brand;
  static const green2 = brandDark;
  static const copper = accent;
  static const copperDeep = Color(0xFFB86B3C);
  static const cream = soft;
  static const card = surface;
}

ThemeData buildTaseerTheme() {
  final text = GoogleFonts.tajawalTextTheme().apply(
    bodyColor: TaseerColors.ink,
    displayColor: TaseerColors.ink,
  );
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    textTheme: text,
    colorScheme: const ColorScheme.light(
      primary: TaseerColors.brand,
      onPrimary: Colors.white,
      secondary: TaseerColors.accent,
      onSecondary: TaseerColors.ink,
      surface: TaseerColors.surface,
      onSurface: TaseerColors.ink,
      error: TaseerColors.bad,
    ),
    scaffoldBackgroundColor: TaseerColors.soft,
    appBarTheme: AppBarTheme(
      backgroundColor: TaseerColors.surface,
      foregroundColor: TaseerColors.ink,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: GoogleFonts.tajawal(
        fontSize: 20,
        fontWeight: FontWeight.w800,
        color: TaseerColors.ink,
      ),
    ),
    cardTheme: CardThemeData(
      color: TaseerColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: const BorderSide(color: TaseerColors.line),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: TaseerColors.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      hintStyle: GoogleFonts.tajawal(color: TaseerColors.muted, fontSize: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: TaseerColors.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: TaseerColors.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: TaseerColors.brand, width: 1.4),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: TaseerColors.brand,
        foregroundColor: Colors.white,
        elevation: 0,
        shadowColor: TaseerColors.brand.withValues(alpha: 0.2),
        minimumSize: const Size.fromHeight(56),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: GoogleFonts.tajawal(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: TaseerColors.brand,
        backgroundColor: TaseerColors.surface,
        minimumSize: const Size.fromHeight(56),
        side: const BorderSide(color: TaseerColors.line),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: GoogleFonts.tajawal(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: TaseerColors.brand,
        textStyle: GoogleFonts.tajawal(fontWeight: FontWeight.w700, fontSize: 13),
      ),
    ),
    checkboxTheme: CheckboxThemeData(
      fillColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected) ? TaseerColors.brand : null,
      ),
    ),
  );
}
