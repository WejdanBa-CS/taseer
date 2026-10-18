import 'package:flutter/material.dart';

import '../app_state.dart';
import '../data/catalog.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'extra_screens.dart';
import 'flow_screens.dart';

class HomeShell extends StatelessWidget {
  const HomeShell({super.key, required this.state});
  final AppState state;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: state,
      builder: (context, _) {
        return Scaffold(
          backgroundColor: TaseerColors.cream,
          body: SafeArea(
            child: Column(
              children: [
                _header(context),
                if (state.screen == AppScreen.flow)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                    child: StepperBar(step: state.step),
                  ),
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                    children: [
                      _body(),
                      const SizedBox(height: 18),
                      _sources(),
                      if (!state.subscribed) ...[
                        const SizedBox(height: 12),
                        SoftNote('مساحة إعلانية للورش والمتاجر. تختفي مع الاشتراك الشهري.'),
                      ],
                    ],
                  ),
                ),
                _updateBar(),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _header(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: TaseerColors.green,
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.handyman, color: Color(0xFFF6E7D4)),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('تسعير', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
                Text(
                  'سعر القطعة الأصلية قبل ما توافق عند الورشة',
                  style: TextStyle(color: TaseerColors.muted, fontSize: 13),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: state.openLogin,
            child: Text(state.loggedIn ? 'حسابي' : 'دخول'),
          ),
          TextButton(onPressed: state.openCosts, child: const Text('التكلفة')),
          TextButton(onPressed: state.openGarage, child: const Text('سيارتي')),
        ],
      ),
    );
  }

  Widget _body() {
    switch (state.screen) {
      case AppScreen.login:
        return LoginScreen(state: state);
      case AppScreen.costs:
        return CostsScreen(state: state);
      case AppScreen.garage:
        return GarageScreen(state: state);
      case AppScreen.flow:
        switch (state.step) {
          case 0:
            return CityScreen(state: state);
          case 1:
            return CarScreen(state: state);
          case 2:
            return PartScreen(state: state);
          default:
            return ResultScreen(state: state);
        }
    }
  }

  Widget _sources() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('المصادر المعتمدة', style: TextStyle(color: TaseerColors.muted, fontWeight: FontWeight.w600)),
        const SizedBox(height: 6),
        ...Catalog.instance.sources.values.map(
          (source) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: InkWell(
              onTap: () => openUrl(source.url),
              child: Text.rich(
                TextSpan(
                  children: [
                    TextSpan(
                      text: source.name,
                      style: const TextStyle(color: TaseerColors.green2, fontWeight: FontWeight.w600),
                    ),
                    TextSpan(
                      text: '. ${source.note}',
                      style: const TextStyle(color: TaseerColors.ink),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _updateBar() {
    return Container(
      width: double.infinity,
      color: TaseerColors.green,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Text(
        state.updateLabel(),
        textAlign: TextAlign.center,
        style: const TextStyle(color: Color(0xFFF6E7D4), fontWeight: FontWeight.w600, fontSize: 13),
      ),
    );
  }
}
