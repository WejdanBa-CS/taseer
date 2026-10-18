import 'package:flutter/foundation.dart';

import 'data/catalog.dart';
import 'data/models.dart';
import 'services/access_store.dart';
import 'services/api.dart';
import 'services/auth_store.dart';
import 'services/billing.dart';
import 'services/garage_store.dart';

enum AppScreen { home, flow, login, costs, garage }

enum NavTab { home, cars, parts }

enum CarStage { brand, model, year }

class AppState extends ChangeNotifier {
  AppState(this.billing);

  final BillingService billing;

  AppScreen screen = AppScreen.home;
  NavTab tab = NavTab.home;
  int step = 0;
  CarStage carStage = CarStage.brand;

  City? city;
  String? brand;
  String? model;
  String? yearLabel;
  String? part;
  String quote = '';
  String unlockedKey = '';
  String payError = '';

  String budget = '';
  String fuelMode = 'all';
  String modelQuery = '';
  bool showRest = false;

  AuthSession? session;
  AccessState access = AccessState();
  GarageData garage = GarageData();

  List<CarNote> carNotes = [];
  String carNotesStatus = 'idle';
  String carNotesBrand = '';

  CrowdStats? crowd;

  bool get loggedIn => session != null;
  bool get subscribed => access.monthActive;

  Future<void> boot() async {
    session = await AuthStore.read();
    access = await AccessStore.read();
    garage = await GarageStore.read();
    await billing.start(_onPurchase);
    notifyListeners();
  }

  void _onPurchase(PurchaseEvent event) async {
    if (!event.ok) {
      payError = event.message.isEmpty ? 'ما اكتمل الدفع. النصيحة لسا مقفلة.' : event.message;
    } else {
      payError = '';
      await AccessStore.grant(kind: event.kind, token: event.token);
      access = await AccessStore.read();
    }
    notifyListeners();
  }

  Future<void> refreshAccess() async {
    access = await AccessStore.read();
    notifyListeners();
  }

  Future<void> refreshSession() async {
    session = await AuthStore.read();
    notifyListeners();
  }

  Future<void> refreshGarage() async {
    garage = await GarageStore.read();
    notifyListeners();
  }

  void goHome() {
    tab = NavTab.home;
    screen = AppScreen.home;
    notifyListeners();
  }

  void goFlow() {
    tab = NavTab.parts;
    screen = AppScreen.flow;
    notifyListeners();
  }

  void openLogin() {
    screen = AppScreen.login;
    notifyListeners();
  }

  void openCosts() {
    tab = NavTab.cars;
    screen = AppScreen.costs;
    notifyListeners();
  }

  void openGarage() {
    tab = NavTab.cars;
    screen = AppScreen.garage;
    notifyListeners();
  }

  void openTab(NavTab next) {
    tab = next;
    switch (next) {
      case NavTab.home:
        screen = AppScreen.home;
      case NavTab.cars:
        screen = subscribed ? AppScreen.garage : AppScreen.costs;
      case NavTab.parts:
        screen = AppScreen.flow;
    }
    notifyListeners();
  }

  bool goBack() {
    if (screen == AppScreen.login) {
      screen = tab == NavTab.home
          ? AppScreen.home
          : tab == NavTab.cars
              ? (subscribed ? AppScreen.garage : AppScreen.costs)
              : AppScreen.flow;
      notifyListeners();
      return true;
    }
    if (screen == AppScreen.costs || screen == AppScreen.garage) {
      if (tab == NavTab.cars && screen == AppScreen.garage && !subscribed) {
        screen = AppScreen.costs;
        notifyListeners();
        return true;
      }
      goHome();
      return true;
    }
    if (screen != AppScreen.flow) {
      goHome();
      return true;
    }
    if (step == 0) {
      goHome();
      return true;
    }
    if (step == 1) {
      if (carStage == CarStage.year) {
        carStage = CarStage.model;
      } else if (carStage == CarStage.model) {
        carStage = CarStage.brand;
      } else {
        step = 0;
      }
    } else if (step == 2) {
      step = 1;
      carStage = CarStage.year;
    } else {
      step = 2;
    }
    notifyListeners();
    return true;
  }

  void selectCity(City value) {
    city = value;
    tab = NavTab.parts;
    step = 1;
    carStage = CarStage.brand;
    notifyListeners();
  }

  void selectBrand(String id) {
    if (brand != id) {
      brand = id;
      model = null;
      yearLabel = null;
      part = null;
      quote = '';
    }
    modelQuery = '';
    showRest = false;
    carStage = CarStage.model;
    ensureCarNotes(force: true);
    notifyListeners();
  }

  void selectModel(String id) {
    if (model != id) {
      model = id;
      yearLabel = null;
      part = null;
      quote = '';
    }
    carStage = CarStage.year;
    notifyListeners();
  }

  void selectYear(String label) {
    yearLabel = label;
    part = null;
    quote = '';
    step = 2;
    notifyListeners();
  }

  void selectPart(String id) {
    part = id;
    quote = '';
    step = 3;
    crowd = null;
    notifyListeners();
    refreshCrowd();
  }

  Future<void> ensureCarNotes({bool force = false}) async {
    final currentBrand = brand;
    if (currentBrand == null) return;
    final same = carNotesBrand == currentBrand;
    if (same && carNotesStatus == 'loading') return;
    if (same && carNotesStatus == 'ready' && !force) return;
    if (!same || carNotesStatus != 'ready') {
      carNotes = [];
      carNotesStatus = 'loading';
    }
    carNotesBrand = currentBrand;
    notifyListeners();
    final result = await Api.listCars(currentBrand);
    if (carNotesBrand != currentBrand) return;
    if (result.unavailable) {
      carNotesStatus = 'unavailable';
      carNotes = [];
    } else if (result.offline || !result.ok) {
      if (carNotes.isEmpty) carNotesStatus = 'offline';
    } else {
      carNotesStatus = 'ready';
      carNotes = result.notes;
    }
    notifyListeners();
  }

  Future<void> publishCarNote({
    required String text,
    required double? price,
    required bool includesFuel,
  }) async {
    if (brand == null || model == null || city == null) return;
    final result = await Api.publishCar(
      brand: brand!,
      model: model!,
      city: city!.name,
      price: price,
      includesFuel: includesFuel,
      text: text,
    );
    if (result.notes.isNotEmpty || result.accepted) {
      carNotes = result.notes;
      carNotesStatus = 'ready';
      carNotesBrand = brand!;
    }
    notifyListeners();
    if (!result.accepted && result.message.isNotEmpty) {
      throw result.message;
    }
    if (result.unavailable) {
      throw 'التعليق يننشر لما يتصل التطبيق بخادم التقارير.';
    }
    if (result.offline) {
      throw 'ما قدرنا ننشر التعليق. جرّب مرة ثانية.';
    }
  }

  Future<void> refreshCrowd([double? quoteValue]) async {
    if (brand == null || model == null || yearLabel == null || part == null || city == null) {
      return;
    }
    final stats = await Api.syncCrowd(
      brand: brand!,
      model: model!,
      yearLabel: yearLabel!,
      part: part!,
      city: city!.name,
      quote: quoteValue,
    );
    crowd = stats;
    notifyListeners();
  }

  Future<bool> unlockAdvice(String key) async {
    final ok = await AccessStore.takeCredit(
      unlockKey: key,
      currentUnlocked: unlockedKey,
    );
    if (ok) {
      unlockedKey = key;
      access = await AccessStore.read();
      notifyListeners();
    }
    return ok;
  }

  Future<void> buy(String productId) async {
    payError = '';
    notifyListeners();
    await billing.purchase(productId);
  }

  Future<void> saveGarage(GarageData data) async {
    garage = data;
    await GarageStore.write(data);
    notifyListeners();
  }

  String? modelName() {
    if (brand == null || model == null) return null;
    for (final item in Catalog.instance.modelsForBrand(brand!)) {
      if (item.id == model) return item.name;
    }
    return model;
  }

  List<PartRow> currentRows() {
    if (brand == null || model == null || yearLabel == null) return const [];
    return Catalog.instance.selectedRows(brand!, model!, yearLabel!);
  }

  List<PartRow> rowsForPart() {
    return currentRows().where((row) => row.part == part).toList();
  }

  ({double low, double high}) priceRange() {
    final lines = Catalog.instance.groupedLines(rowsForPart());
    if (lines.isEmpty) return (low: 0, high: 0);
    final lows = lines.map((l) => l.low).toList()..sort();
    final highs = lines.map((l) => l.high).toList()..sort();
    return (low: lows.first, high: highs.last);
  }

  String updateLabel() {
    final sources = Catalog.instance.sources;
    final kia = sources['kia']?.updated ?? 'سبتمبر 2025';
    final fuel = sources['aramco']?.updated ?? 'أكتوبر 2026';
    if (screen == AppScreen.costs) {
      if (brand == 'victory') return 'آخر تحديث للوقود: $fuel. قطع فيكتوري من صفحة الوكيل.';
      return 'آخر تحديث: قطع الغيار $kia · الوقود $fuel';
    }
    if (brand == 'victory') return 'أسعار فيكتوري كما نشرها الوكيل على صفحته.';
    return 'آخر تحديث لأسعار القطع: $kia';
  }
}
