// Captures real Flutter UI frames for docs/screenshots (GitHub README).
// From mobile/: flutter test tool/capture_screenshots.dart

import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:taseer/app_state.dart';
import 'package:taseer/data/catalog.dart';
import 'package:taseer/main.dart';
import 'package:taseer/services/billing.dart';

const _shotKey = ValueKey('readme-shot');

Future<void> _loadFontFile(String family, File file) async {
  if (!file.existsSync()) return;
  final bytes = await file.readAsBytes();
  final loader = FontLoader(family);
  loader.addFont(Future.value(ByteData.sublistView(Uint8List.fromList(bytes))));
  await loader.load();
}

Future<void> _loadMaterialIcons() async {
  var root = Platform.environment['FLUTTER_ROOT'];
  if (root == null || root.isEmpty) {
    final which = await Process.run('which', ['flutter']);
    if (which.exitCode == 0) {
      final flutterPath = (which.stdout as String).trim();
      root = File(flutterPath).parent.parent.path;
    }
  }
  if (root == null) return;
  final otf = File(
    '$root/bin/cache/artifacts/material_fonts/MaterialIcons-Regular.otf',
  );
  await _loadFontFile('MaterialIcons', otf);
}

Future<void> _warmTajawal() async {
  GoogleFonts.config.allowRuntimeFetching = false;
  // Touch every weight the UI uses so assets under google_fonts/ load.
  for (final weight in [
    FontWeight.w300,
    FontWeight.w400,
    FontWeight.w500,
    FontWeight.w700,
    FontWeight.w800,
    FontWeight.w900,
  ]) {
    GoogleFonts.tajawal(fontWeight: weight);
  }
  GoogleFonts.tajawalTextTheme();
  await GoogleFonts.pendingFonts();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  SharedPreferences.setMockInitialValues({});

  late Catalog catalog;
  late Directory outDir;

  setUpAll(() async {
    await _loadMaterialIcons();
    await _warmTajawal();
    catalog = await Catalog.load();
    outDir = Directory('${Directory.current.path}/../docs/screenshots');
    if (!outDir.existsSync()) outDir.createSync(recursive: true);
  });

  Future<void> shot(
    WidgetTester tester,
    String name,
    void Function(AppState) setup,
  ) async {
    final state = AppState(BillingService());
    setup(state);
    await tester.pumpWidget(
      MediaQuery(
        data: const MediaQueryData(
          size: Size(390, 844),
          padding: EdgeInsets.only(top: 47, bottom: 34),
          devicePixelRatio: 3,
        ),
        child: RepaintBoundary(
          key: _shotKey,
          child: TaseerApp(state: state),
        ),
      ),
    );
    await tester.pump();
    // Decode Image.asset frames.
    await tester.runAsync(() async {
      await Future<void>.delayed(const Duration(milliseconds: 50));
    });
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    await tester.runAsync(() async {
      final boundary =
          tester.renderObject(find.byKey(_shotKey)) as RenderRepaintBoundary;
      final image = await boundary.toImage(pixelRatio: 3);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      final file = File('${outDir.path}/$name.png');
      await file.writeAsBytes(bytes!.buffer.asUint8List());
      // ignore: avoid_print
      print('saved ${file.path} (${file.lengthSync()} bytes)');
    });
  }

  testWidgets('capture readme screenshots', (tester) async {
    final view = tester.view;
    view.physicalSize = const Size(1170, 2532);
    view.devicePixelRatio = 3;
    addTearDown(view.resetPhysicalSize);
    addTearDown(view.resetDevicePixelRatio);

    final oldOnError = FlutterError.onError;
    FlutterError.onError = (details) {
      if (details.exceptionAsString().contains('overflowed')) return;
      oldOnError?.call(details);
    };
    addTearDown(() => FlutterError.onError = oldOnError);

    final city = catalog.cities.firstWhere(
      (c) => c.name.contains('الرياض'),
      orElse: () => catalog.cities.first,
    );

    await shot(tester, '01-home', (s) => s.goHome());

    await shot(tester, '02-city', (s) {
      s.tab = NavTab.parts;
      s.screen = AppScreen.flow;
      s.step = 0;
    });

    await shot(tester, '03-brands', (s) {
      s.tab = NavTab.parts;
      s.screen = AppScreen.flow;
      s.step = 1;
      s.city = city;
      s.carStage = CarStage.brand;
    });

    await shot(tester, '04-parts', (s) {
      s.tab = NavTab.parts;
      s.screen = AppScreen.flow;
      s.step = 2;
      s.city = city;
      s.brand = 'toyota';
      final models = catalog.modelsForBrand('toyota');
      s.model = models.first.id;
      final years = catalog.yearsFor('toyota', models.first.id);
      s.yearLabel = years.contains('2024') ? '2024' : years.first;
      s.carStage = CarStage.year;
    });

    await shot(tester, '05-kia-parts', (s) {
      final row = catalog.rows.firstWhere(
        (r) => r.brand == 'kia' && r.part == 'oil-filter',
      );
      s.tab = NavTab.parts;
      s.screen = AppScreen.flow;
      s.step = 2;
      s.city = city;
      s.brand = 'kia';
      s.model = row.model;
      s.yearLabel = row.yearLabel;
    });

    await shot(tester, '06-costs', (s) {
      s.tab = NavTab.cars;
      s.screen = AppScreen.costs;
    });
  }, timeout: const Timeout(Duration(minutes: 2)));
}
