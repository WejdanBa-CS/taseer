import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'app_state.dart';
import 'data/catalog.dart';
import 'screens/home.dart';
import 'services/billing.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Catalog.load();
  final billing = BillingService();
  final state = AppState(billing);
  await state.boot();
  runApp(TaseerApp(state: state));
}

class TaseerApp extends StatelessWidget {
  const TaseerApp({super.key, required this.state});
  final AppState state;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'تسعير',
      debugShowCheckedModeBanner: false,
      theme: buildTaseerTheme(),
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      builder: (context, child) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: child ?? const SizedBox.shrink(),
        );
      },
      home: PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, _) {
          if (didPop) return;
          final handled = state.goBack();
          if (!handled) SystemNavigator.pop();
        },
        child: HomeShell(state: state),
      ),
    );
  }
}
