import 'package:flutter/material.dart';

import '../app_state.dart';
import '../data/catalog.dart';
import '../data/models.dart';
import '../services/auth_store.dart';
import '../services/garage_store.dart';
import '../theme.dart';
import '../widgets/common.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.state});
  final AppState state;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final name = TextEditingController();
  final phone = TextEditingController();
  String status = '';

  @override
  void dispose() {
    name.dispose();
    phone.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    final error = await AuthStore.login(name.text, phone.text);
    if (error != null) {
      setState(() => status = error);
      return;
    }
    await widget.state.refreshSession();
    widget.state.completeLogin();
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.state.session;
    return ShellCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  session == null ? 'تسجيل الدخول' : 'حسابك',
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                ),
              ),
              TextButton(onPressed: widget.state.goBack, child: const Text('رجوع')),
            ],
          ),
          SectionLead(
            session == null
                ? 'سجّل دخولك عشان تشوف تعليقات السيارات ومتوسط أسعار المستخدمين. سعر قطعة الوكيل يبقى ظاهر ومجاني.'
                : 'أنت داخل. تقدر تشوف تعليقات المستخدمين ومتوسط أسعار الورشة. سعر قطعة الوكيل يبقى مجاني للكل.',
          ),
          if (session != null) ...[
            SoftNote('${session.name} · ${session.phone}'),
            TextButton(
              onPressed: widget.state.restorePurchases,
              child: const Text('استعادة المشتريات'),
            ),
            if (widget.state.payError.isNotEmpty)
              SoftNote(widget.state.payError, color: TaseerColors.warn),
            OutlinedButton(
              onPressed: () async {
                await AuthStore.logout();
                await widget.state.refreshSession();
                widget.state.goBack();
              },
              child: const Text('تسجيل الخروج'),
            ),
          ] else ...[
            const Text('الاسم', style: TextStyle(fontWeight: FontWeight.w600)),
            TextField(controller: name, decoration: const InputDecoration(hintText: 'اسمك')),
            const SizedBox(height: 8),
            const Text('رقم الجوال', style: TextStyle(fontWeight: FontWeight.w600)),
            TextField(
              controller: phone,
              keyboardType: TextInputType.phone,
              textDirection: TextDirection.ltr,
              decoration: const InputDecoration(hintText: '05xxxxxxxx'),
            ),
            const SizedBox(height: 12),
            ElevatedButton(onPressed: submit, child: const Text('دخول')),
            if (status.isNotEmpty) SoftNote(status, color: TaseerColors.warn),
          ],
        ],
      ),
    );
  }
}

class CostsScreen extends StatefulWidget {
  const CostsScreen({super.key, required this.state});
  final AppState state;

  @override
  State<CostsScreen> createState() => _CostsScreenState();
}

class _CostsScreenState extends State<CostsScreen> {
  late final TextEditingController carPrice;
  late final TextEditingController liters;
  late final TextEditingController insurance;
  String fuelGrade = '91';
  String? pickBrand;
  String? pickModel;
  String? pickYear;
  String modelSearch = '';

  static const upkeepMonths = {
    'oil-filter': 6,
    'ac-filter': 6,
    'air-filter': 12,
    'front-pads': 12,
    'coolant': 12,
  };

  @override
  void initState() {
    super.initState();
    final state = widget.state;
    state.applyGarageCar();
    final g = state.garage;
    carPrice = TextEditingController(text: g.carPrice > 0 ? '${g.carPrice}' : '');
    liters = TextEditingController(text: g.litersPerMonth > 0 ? '${g.litersPerMonth}' : '');
    insurance = TextEditingController(text: g.insuranceSar > 0 ? '${g.insuranceSar}' : '');
    fuelGrade = g.fuelGrade;
    pickBrand = state.brand ?? g.car?.brand;
    pickModel = state.model ?? g.car?.model;
    pickYear = state.yearLabel ?? g.car?.yearLabel;
  }

  Future<void> _pickBrand(String? id) async {
    setState(() {
      pickBrand = id;
      pickModel = null;
      pickYear = null;
      modelSearch = '';
    });
  }

  Future<void> _pickModel(String? id) async {
    setState(() {
      pickModel = id;
      pickYear = null;
    });
  }

  Future<void> _pickYear(String? label) async {
    if (label == null || pickBrand == null || pickModel == null) return;
    setState(() => pickYear = label);
    await widget.state.setCostCar(
      brandId: pickBrand!,
      modelId: pickModel!,
      year: label,
    );
    setState(() {});
  }

  @override
  void dispose() {
    carPrice.dispose();
    liters.dispose();
    insurance.dispose();
    super.dispose();
  }

  Future<void> persist() async {
    final garage = widget.state.garage;
    garage.carPrice = parseQuote(carPrice.text) ?? 0;
    if (garage.carPrice > 5000000) garage.carPrice = 0;
    garage.litersPerMonth = parseQuote(liters.text) ?? 0;
    if (garage.litersPerMonth > 2000) garage.litersPerMonth = 0;
    garage.insuranceSar = parseQuote(insurance.text) ?? 0;
    garage.fuelGrade = fuelGrade;
    await widget.state.saveGarage(garage);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final fuels = Catalog.instance.fuels;
    final fuel = fuels.firstWhere((f) => f.id == fuelGrade, orElse: () => fuels.first);
    final price = parseQuote(carPrice.text) ?? 0;
    final literCount = parseQuote(liters.text) ?? 0;
    final cover = parseQuote(insurance.text) ?? 0;
    final fromPump = literCount > 0 ? (literCount * fuel.perLiter * 100).round() / 100 : 0.0;
    final fuelMonth = fromPump > 0 ? fromPump : widget.state.garage.fuelSar;
    final carMonth = price > 0 ? (price / 60 * 100).round() / 100 : 0.0;
    final insuranceMonth = (cover / 12 * 100).round() / 100;

    final costBrand = pickBrand ?? widget.state.brand;
    final costModel = pickModel ?? widget.state.model;
    final costYear = pickYear ?? widget.state.yearLabel;
    double upkeep = 0;
    double partsOnce = 0;
    final hasCar =
        costBrand != null && costModel != null && costYear != null;
    if (hasCar) {
      final selected = Catalog.instance.partsFor(costBrand, costModel, costYear);
      for (final part in selected) {
        final prices = Catalog.instance
            .selectedRows(costBrand, costModel, costYear)
            .where((r) => r.part == part.id)
            .map((r) => r.price)
            .toList()
          ..sort();
        if (prices.isEmpty) continue;
        partsOnce += prices.first;
        final months = upkeepMonths[part.id];
        if (months != null) upkeep += prices.first / months;
      }
    }
    upkeep = (upkeep * 100).round() / 100;
    partsOnce = (partsOnce * 100).round() / 100;
    final total = ((carMonth + fuelMonth + insuranceMonth + upkeep) * 100).round() / 100;
    final aramco = Catalog.instance.sources['aramco'];
    final models = costBrand == null
        ? const <CarModel>[]
        : Catalog.instance.modelsForBrand(costBrand).where((m) {
            if (Catalog.instance.yearsFor(costBrand, m.id).isEmpty) return false;
            final q = modelSearch.trim();
            if (q.isEmpty) return true;
            final n = q.toLowerCase();
            return m.name.toLowerCase().contains(n) ||
                m.id.toLowerCase().contains(n);
          }).toList();
    final years = costBrand == null || costModel == null
        ? const <String>[]
        : Catalog.instance.yearsFor(costBrand, costModel);
    final carLabel = hasCar
        ? '${widget.state.modelName() ?? costModel} $costYear'
        : null;

    return ShellCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Expanded(
                child: Text('قائمة التكلفة', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
              ),
              TextButton(onPressed: widget.state.goBack, child: const Text('رجوع')),
            ],
          ),
          const SectionLead(
            'اختر السيارة عشان تدخل صيانة القطع المنشورة، ثم اكتب سعر المعرض والبنزين والتأمين. قائمة التكلفة مجانية؛ سجل التذكير في «سيارتي» يحتاج اشتراك.',
          ),
          const Text('السيارة', style: TextStyle(fontWeight: FontWeight.w700)),
          DropdownButtonFormField<String>(
            key: ValueKey('cost-brand-$pickBrand'),
            initialValue: pickBrand,
            decoration: const InputDecoration(hintText: 'الوكالة'),
            items: Catalog.instance.brands
                .map(
                  (b) => DropdownMenuItem(
                    value: b.id,
                    child: Text(
                      '${b.name} · ${Catalog.instance.modelsForBrand(b.id).length} موديل',
                    ),
                  ),
                )
                .toList(),
            onChanged: _pickBrand,
          ),
          if (pickBrand != null) ...[
            TextField(
              decoration: const InputDecoration(
                hintText: 'ابحث عن الموديل',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: (value) => setState(() => modelSearch = value),
            ),
            DropdownButtonFormField<String>(
              key: ValueKey('cost-model-$pickBrand-$pickModel-$modelSearch'),
              initialValue: models.any((m) => m.id == pickModel) ? pickModel : null,
              decoration: const InputDecoration(hintText: 'الموديل'),
              items: models
                  .map(
                    (m) => DropdownMenuItem(
                      value: m.id,
                      child: Text(
                        '${m.name} · ${Catalog.instance.yearSpanLabel(pickBrand!, m.id)}',
                      ),
                    ),
                  )
                  .toList(),
              onChanged: _pickModel,
            ),
          ],
          if (pickBrand != null && pickModel != null)
            DropdownButtonFormField<String>(
              key: ValueKey('cost-year-$pickModel-$pickYear'),
              initialValue: pickYear,
              decoration: const InputDecoration(hintText: 'السنة'),
              items: years
                  .map((y) => DropdownMenuItem(value: y, child: Text(y)))
                  .toList(),
              onChanged: _pickYear,
            ),
          SoftNote(
            hasCar
                ? 'صيانة القطع محسوبة على: $carLabel'
                : 'اختار الوكالة والموديل والسنة عشان تطلع صيانة القطع.',
          ),
          if (hasCar)
            TextButton(
              onPressed: () async {
                await widget.state.setCostCar(
                  brandId: costBrand,
                  modelId: costModel,
                  year: costYear,
                );
                widget.state.goFlowWithCar();
              },
              child: const Text('اعرف سعر قطعة لهذه السيارة'),
            ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: TaseerColors.brandSoft,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text(
              'تقدير الشهر: ${money(total)} ريال',
              style: const TextStyle(color: TaseerColors.green, fontWeight: FontWeight.w700, fontSize: 18),
            ),
          ),
          const SizedBox(height: 12),
          const Text('سعر السيارة من المعرض', style: TextStyle(fontWeight: FontWeight.w700)),
          TextField(
            controller: carPrice,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(hintText: 'سعر المعرض بالريال'),
            onChanged: (_) => persist(),
          ),
          SoftNote(carMonth > 0 ? 'تقسيط تقريبي على 5 سنوات بدون فوائد: ${money(carMonth)} ريال/شهر' : 'اكتب سعر المعرض.'),
          const SizedBox(height: 8),
          const Text('صرف البنزين', style: TextStyle(fontWeight: FontWeight.w700)),
          DropdownButtonFormField<String>(
            initialValue: fuelGrade,
            items: fuels
                .map((f) => DropdownMenuItem(value: f.id, child: Text('${f.name} · ${money(f.perLiter)} ر.س/لتر')))
                .toList(),
            onChanged: (value) {
              if (value == null) return;
              setState(() => fuelGrade = value);
              persist();
            },
          ),
          TextField(
            controller: liters,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(hintText: 'لترات في الشهر'),
            onChanged: (_) => persist(),
          ),
          SoftNote(
            [
              if (fuelMonth > 0) 'وقود الشهر: ${money(fuelMonth)} ريال',
              if (aramco != null) 'المصدر: ${aramco.name}. ${aramco.note}',
            ].where((s) => s.isNotEmpty).join(' · '),
          ),
          const Text('التأمين السنوي', style: TextStyle(fontWeight: FontWeight.w700)),
          TextField(
            controller: insurance,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(hintText: 'مبلغ التأمين السنوي'),
            onChanged: (_) => persist(),
          ),
          SoftNote(insuranceMonth > 0 ? 'شهرياً تقريباً: ${money(insuranceMonth)} ريال' : 'اكتب مبلغ التأمين.'),
          SoftNote('صيانة دورية تقديرية من أسعار القطع المنشورة: ${money(upkeep)} ريال/شهر'),
          SoftNote('قطع عند الحاجة مرة واحدة (مجموع الأدنى): ${money(partsOnce)} ريال'),
        ],
      ),
    );
  }
}

class GarageScreen extends StatefulWidget {
  const GarageScreen({super.key, required this.state});
  final AppState state;

  @override
  State<GarageScreen> createState() => _GarageScreenState();
}

class _GarageScreenState extends State<GarageScreen> {
  late TextEditingController fuel;
  late TextEditingController insurance;
  late TextEditingController renew;
  late TextEditingController expenseLabel;
  late TextEditingController expenseAmount;
  final serviceCtrls = <String, TextEditingController>{};

  @override
  void initState() {
    super.initState();
    final g = widget.state.garage;
    fuel = TextEditingController(text: g.fuelSar > 0 ? '${g.fuelSar}' : '');
    insurance = TextEditingController(text: g.insuranceSar > 0 ? '${g.insuranceSar}' : '');
    renew = TextEditingController(text: g.insuranceRenew);
    expenseLabel = TextEditingController();
    expenseAmount = TextEditingController();
    for (final service in GarageStore.services) {
      serviceCtrls[service.$1] = TextEditingController(text: g.services[service.$1] ?? '');
    }
  }

  @override
  void dispose() {
    fuel.dispose();
    insurance.dispose();
    renew.dispose();
    expenseLabel.dispose();
    expenseAmount.dispose();
    for (final ctrl in serviceCtrls.values) {
      ctrl.dispose();
    }
    super.dispose();
  }

  Future<void> persistBasics() async {
    final garage = widget.state.garage;
    garage.fuelSar = parseQuote(fuel.text) ?? 0;
    garage.insuranceSar = parseQuote(insurance.text) ?? 0;
    garage.insuranceRenew = renew.text.trim();
    for (final service in GarageStore.services) {
      final value = serviceCtrls[service.$1]!.text.trim();
      if (value.isEmpty) {
        garage.services.remove(service.$1);
      } else {
        garage.services[service.$1] = value;
      }
    }
    await widget.state.saveGarage(garage);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final subscribed = state.subscribed;
    final totals = GarageStore.monthlyTotal(state.garage);

    return ShellCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  subscribed ? 'سيارتي' : 'الاشتراك',
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                ),
              ),
              TextButton(onPressed: state.goBack, child: const Text('رجوع')),
            ],
          ),
          if (!subscribed) ...[
            const SectionLead(
              'الاشتراك الشهري بـ 29 ريال يفتح سجل السيارة والتذكير والتكاليف. قائمة التكلفة وأسعار الوكيل تبقى مجانية، والنصيحة الواحدة بـ 9 ريال.',
            ),
            ...[
              'حفظ نوع السيارة في سيارتي',
              'تذكير الصيانة حسب مرور الأشهر',
              'صرف الوقود الشهري',
              'التأمين وموعد تجديده',
              'ملخص تكاليف الشهر',
            ].map((item) => SoftNote('• $item')),
            ElevatedButton(
              onPressed: () => state.buy('advice_month'),
              child: const Text('اشترك بـ 29 ريال'),
            ),
            TextButton(
              onPressed: state.restorePurchases,
              child: const Text('استعادة المشتريات'),
            ),
            if (state.payError.isNotEmpty)
              SoftNote(state.payError, color: TaseerColors.warn),
            if (state.garage.car != null)
              SoftNote(
                'بياناتك محفوظة: ${state.garage.car!.modelName} ${state.garage.car!.yearLabel}. الاشتراك يفتحها من جديد.',
              ),
          ] else ...[
            if (state.garage.car != null)
              SoftNote(
                '${state.garage.car!.modelName} ${state.garage.car!.yearLabel} · ${state.garage.car!.city}',
              )
            else
              const SoftNote('لما تختار السيارة في التسعير وهي محفوظة في الاشتراك، تلقى نوعها هنا.'),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: TaseerColors.brandSoft,
                borderRadius: BorderRadius.circular(14),
              ),
              child: Text(
                'تكلفة هذا الشهر: ${money(totals['total']!)} ريال',
                style: const TextStyle(color: TaseerColors.green, fontWeight: FontWeight.w700),
              ),
            ),
            const SizedBox(height: 12),
            const Text('تذكير الصيانة', style: TextStyle(fontWeight: FontWeight.w700)),
            const SoftNote('تذكير تقريبي يحسب الأشهر من آخر موعد كتبته.'),
            ...GarageStore.services.map((service) {
              final status = GarageStore.serviceStatus(
                state.garage.services[service.$1],
                service.$3,
              );
              String label = 'حدد التاريخ عشان يبدأ التذكير.';
              if (status.state == 'due') label = 'متأخر بـ ${status.days!.abs()} يوم.';
              if (status.state == 'soon') label = 'بعد ${status.days} يوم. قرّب الموعد.';
              if (status.state == 'ok') label = 'بعد ${status.days} يوم.';
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(service.$2, style: const TextStyle(fontWeight: FontWeight.w600)),
                  TextField(
                    controller: serviceCtrls[service.$1],
                    decoration: const InputDecoration(hintText: 'YYYY-MM-DD'),
                    textDirection: TextDirection.ltr,
                    onChanged: (_) => persistBasics(),
                  ),
                  SoftNote(
                    label,
                    color: status.state == 'due'
                        ? TaseerColors.bad
                        : status.state == 'soon'
                            ? TaseerColors.warn
                            : null,
                  ),
                ],
              );
            }),
            const Text('الوقود الشهري', style: TextStyle(fontWeight: FontWeight.w700)),
            TextField(
              controller: fuel,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(hintText: 'صرف الوقود بالريال'),
              onChanged: (_) => persistBasics(),
            ),
            const Text('التأمين', style: TextStyle(fontWeight: FontWeight.w700)),
            TextField(
              controller: insurance,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(hintText: 'مبلغ التأمين السنوي'),
              onChanged: (_) => persistBasics(),
            ),
            TextField(
              controller: renew,
              decoration: const InputDecoration(hintText: 'موعد التجديد YYYY-MM-DD'),
              textDirection: TextDirection.ltr,
              onChanged: (_) => persistBasics(),
            ),
            const SizedBox(height: 8),
            const Text('مصروف هذا الشهر', style: TextStyle(fontWeight: FontWeight.w700)),
            TextField(controller: expenseLabel, decoration: const InputDecoration(hintText: 'وصف المصروف')),
            TextField(
              controller: expenseAmount,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(hintText: 'المبلغ'),
            ),
            OutlinedButton(
              onPressed: () async {
                final amount = parseQuote(expenseAmount.text);
                final label = expenseLabel.text.trim();
                if (label.isEmpty || amount == null || amount <= 0) return;
                final garage = state.garage;
                garage.expenses.insert(
                  0,
                  GarageExpense(
                    id: 'e${DateTime.now().millisecondsSinceEpoch}',
                    label: label,
                    amount: amount,
                    month: GarageStore.monthKey(),
                  ),
                );
                await state.saveGarage(garage);
                expenseLabel.clear();
                expenseAmount.clear();
                setState(() {});
              },
              child: const Text('أضف للتكلفة'),
            ),
            ...state.garage.expenses
                .where((e) => e.month == GarageStore.monthKey())
                .map((e) => SoftNote('${e.label}: ${money(e.amount)} ريال')),
          ],
          if (state.payError.isNotEmpty) SoftNote(state.payError, color: TaseerColors.warn),
        ],
      ),
    );
  }
}
