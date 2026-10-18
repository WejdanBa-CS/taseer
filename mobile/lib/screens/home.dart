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
    final top = MediaQuery.paddingOf(context).top;
    final bottom = MediaQuery.paddingOf(context).bottom;
    return AnimatedBuilder(
      animation: state,
      builder: (context, _) {
        return Scaffold(
          backgroundColor: TaseerColors.soft,
          body: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Material(
                color: TaseerColors.surface,
                elevation: 10,
                shadowColor: TaseerColors.ink.withValues(alpha: 0.08),
                child: Column(
                  children: [
                    SizedBox(height: top > 0 ? top : 12),
                    _header(),
                    if (state.screen == AppScreen.flow)
                      const Padding(
                        padding: EdgeInsets.fromLTRB(20, 0, 20, 8),
                        child: SizedBox.shrink(),
                      ),
                    if (state.screen == AppScreen.flow)
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 0, 20, 4),
                        child: StepperBar(step: state.step),
                      ),
                    Expanded(
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                        children: [
                          _body(),
                          if (state.screen != AppScreen.home) ...[
                            const SizedBox(height: 22),
                            _sources(),
                          ],
                        ],
                      ),
                    ),
                    _footer(),
                    _bottomNav(bottom),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 12, 10),
      child: Row(
        children: [
          InkWell(
            onTap: state.goHome,
            borderRadius: BorderRadius.circular(12),
            child: Row(
              children: [
                Image.asset(
                  'assets/images/taseer-logo.png',
                  width: 48,
                  height: 48,
                  fit: BoxFit.contain,
                ),
                const SizedBox(width: 10),
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'تسعير',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        height: 1,
                      ),
                    ),
                    SizedBox(height: 6),
                    Text(
                      'قرارك يبدأ بمعرفة',
                      style: TextStyle(
                        color: TaseerColors.muted,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Spacer(),
          TextButton(
            onPressed: state.openLogin,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  state.loggedIn ? Icons.person_outline : Icons.login_rounded,
                  size: 18,
                ),
                const SizedBox(width: 4),
                Text(state.loggedIn ? 'حسابي' : 'دخول'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _body() {
    switch (state.screen) {
      case AppScreen.home:
        return WelcomeScreen(state: state);
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
        const Text(
          'المصادر المعتمدة',
          style: TextStyle(
            color: TaseerColors.muted,
            fontWeight: FontWeight.w700,
            fontSize: 12,
          ),
        ),
        const SizedBox(height: 8),
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
                      style: const TextStyle(
                        color: TaseerColors.brand,
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                    TextSpan(
                      text: '. ${source.note}',
                      style: const TextStyle(color: TaseerColors.muted, fontSize: 12, height: 1.55),
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

  Widget _footer() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 10),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: TaseerColors.line)),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.schedule, size: 13, color: TaseerColors.muted),
              const SizedBox(width: 6),
              Flexible(
                child: Text.rich(
                  TextSpan(
                    style: const TextStyle(fontSize: 10, color: TaseerColors.muted, height: 1.5),
                    children: [
                      const TextSpan(text: 'آخر تحديث لبيانات الأسعار: '),
                      TextSpan(
                        text: state.updateLabel().replaceFirst('آخر تحديث لأسعار القطع: ', '').replaceFirst('آخر تحديث: ', ''),
                        style: const TextStyle(
                          color: TaseerColors.ink,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'الأسعار التوضيحية والتأمين والصرفية تحتاج تأكيدًا قبل الشراء.',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 10, color: TaseerColors.muted, height: 1.5),
          ),
        ],
      ),
    );
  }

  Widget _bottomNav(double safeBottom) {
    final items = <(NavTab, String, IconData)>[
      (NavTab.home, 'الرئيسية', Icons.home_outlined),
      (NavTab.cars, 'السيارات', Icons.directions_car_outlined),
      (NavTab.parts, 'قطع الغيار', Icons.settings_outlined),
    ];
    return Container(
      padding: EdgeInsets.fromLTRB(12, 8, 12, 8 + (safeBottom > 0 ? safeBottom : 4)),
      decoration: BoxDecoration(
        color: TaseerColors.surface.withValues(alpha: 0.97),
        border: const Border(top: BorderSide(color: TaseerColors.line)),
      ),
      child: Row(
        children: items.map((item) {
          final active = state.tab == item.$1;
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Material(
                color: active ? TaseerColors.brandSoft : Colors.transparent,
                borderRadius: BorderRadius.circular(16),
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: () => state.openTab(item.$1),
                  child: SizedBox(
                    height: 52,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          item.$3,
                          size: 21,
                          color: active ? TaseerColors.brand : TaseerColors.muted,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          item.$2,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: active ? TaseerColors.brand : TaseerColors.muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key, required this.state});
  final AppState state;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const SizedBox(height: 12),
        Image.asset(
          'assets/images/taseer-logo.png',
          width: 148,
          height: 148,
          fit: BoxFit.contain,
        ),
        const SizedBox(height: 18),
        const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                color: TaseerColors.accent,
                shape: BoxShape.circle,
              ),
              child: SizedBox(width: 6, height: 6),
            ),
            SizedBox(width: 6),
            Text(
              'معرفة أكثر، قرار أريح',
              style: TextStyle(
                color: TaseerColors.brand,
                fontWeight: FontWeight.w700,
                fontSize: 12,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        const Text(
          'سعر القطعة الأصلية',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, height: 1.35),
        ),
        const Text(
          'قبل ما توافق',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 30,
            fontWeight: FontWeight.w800,
            height: 1.35,
            color: TaseerColors.brand,
          ),
        ),
        const Text(
          'عند الورشة.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, height: 1.35),
        ),
        const SizedBox(height: 14),
        const Text(
          'ومن سعر القطعة إلى تكلفة السيارة كلها.\nاعرف، قارن، وخذ قرارك على بيّنة.',
          textAlign: TextAlign.center,
          style: TextStyle(color: TaseerColors.muted, height: 1.7, fontSize: 14),
        ),
        const SizedBox(height: 28),
        ElevatedButton(
          onPressed: state.openCosts,
          child: const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.directions_car_outlined, size: 20),
              SizedBox(width: 8),
              Expanded(child: Text('استكشف السيارات وتكلفتها')),
              Icon(Icons.arrow_back_ios_new, size: 16),
            ],
          ),
        ),
        const SizedBox(height: 10),
        OutlinedButton(
          onPressed: state.goFlow,
          child: const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.settings_outlined, size: 20),
              SizedBox(width: 8),
              Expanded(child: Text('اعرف سعر قطعتك')),
              Icon(Icons.arrow_back_ios_new, size: 16),
            ],
          ),
        ),
        const SizedBox(height: 18),
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 14,
          runSpacing: 8,
          children: const [
            _Perk('التصفّح بدون تسجيل'),
            _Perk('بدون حجز'),
            _Perk('بدون إعلانات'),
          ],
        ),
      ],
    );
  }
}

class _Perk extends StatelessWidget {
  const _Perk(this.label);
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Icon(Icons.check, size: 12, color: TaseerColors.brand),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(fontSize: 10, color: TaseerColors.muted),
        ),
      ],
    );
  }
}
