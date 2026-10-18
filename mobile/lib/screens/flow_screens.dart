import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../app_state.dart';
import '../data/catalog.dart';
import '../data/models.dart';
import '../services/advice.dart';
import '../services/garage_store.dart';
import '../theme.dart';
import '../widgets/common.dart';

class CityScreen extends StatefulWidget {
  const CityScreen({super.key, required this.state});
  final AppState state;

  @override
  State<CityScreen> createState() => _CityScreenState();
}

class _CityScreenState extends State<CityScreen> {
  String query = '';

  @override
  Widget build(BuildContext context) {
    final cities = Catalog.instance.cities.where((city) {
      final q = norm(query);
      if (q.isEmpty) return true;
      return norm(city.name).contains(q) || norm(city.region).contains(q);
    }).toList();
    final regions = <String>{};
    for (final city in cities) {
      regions.add(city.region);
    }

    return ShellCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('في أي مدينة الصيانة؟', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          const SectionLead('السعر الأصلي موحّد في المملكة. المدينة تبقى مع الطلب لأن أجرة الورشة غير داخلة.'),
          TextField(
            decoration: const InputDecoration(
              hintText: 'ابحث عن المدينة',
              prefixIcon: Icon(Icons.search),
            ),
            onChanged: (value) => setState(() => query = value),
          ),
          const SizedBox(height: 8),
          if (cities.isEmpty)
            const SoftNote('ما لقينا هذه المدينة. اختار مدينة أخرى في المنطقة إذا مدينتك مو بالقائمة.')
          else
            ...regions.map((region) {
              final group = cities.where((city) => city.region == region);
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 10, bottom: 6),
                    child: Text(region, style: const TextStyle(fontWeight: FontWeight.w700)),
                  ),
                  ...group.map(
                    (city) => ChoiceTile(
                      title: city.name,
                      onTap: () => widget.state.selectCity(city),
                    ),
                  ),
                ],
              );
            }),
        ],
      ),
    );
  }
}

class CarScreen extends StatefulWidget {
  const CarScreen({super.key, required this.state});
  final AppState state;

  @override
  State<CarScreen> createState() => _CarScreenState();
}

class _CarScreenState extends State<CarScreen> {
  final budgetCtrl = TextEditingController();
  final queryCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    budgetCtrl.text = widget.state.budget;
    queryCtrl.text = widget.state.modelQuery;
    widget.state.ensureCarNotes(force: true);
  }

  @override
  void dispose() {
    budgetCtrl.dispose();
    queryCtrl.dispose();
    super.dispose();
  }

  double budgetAmount() {
    final value = parseQuote(widget.state.budget);
    return value != null && value > 0 ? value : 0;
  }

  bool filterActive() => budgetAmount() > 0 || widget.state.fuelMode != 'all';

  bool noteMatches(CarNote note) {
    if (note.price == null) return false;
    final budget = budgetAmount();
    if (budget > 0 && note.price! > budget) return false;
    if (widget.state.fuelMode == 'yes' && !note.includesFuel) return false;
    if (widget.state.fuelMode == 'no' && note.includesFuel) return false;
    return true;
  }

  String priceLine(List<CarNote> notes) {
    if (notes.isEmpty) return '';
    if (!widget.state.loggedIn) {
      return notes.any((n) => n.price != null)
          ? 'أسعار وتعليقات — سجّل دخولك'
          : 'تعليقات — سجّل دخولك';
    }
    final priced = notes.where((n) => n.price != null).toList();
    if (priced.isEmpty) {
      if (notes.length == 1) return 'تعليق';
      if (notes.length == 2) return 'تعليقان';
      return '${notes.length} تعليقات';
    }
    final prices = priced.map((n) => n.price!).toList()..sort();
    final low = prices.first;
    final high = prices.last;
    final amount = low == high ? '${money(low)} ريال' : 'من ${money(low)} إلى ${money(high)} ريال';
    final withFuel = priced.where((n) => n.includesFuel).length;
    var fuel = ' · بدون بنزين';
    if (withFuel == priced.length) {
      fuel = ' · يشمل البنزين';
    } else if (withFuel > 0) {
      fuel = ' · فيه مع بنزين وبدون';
    }
    return amount + fuel;
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    if (state.carStage == CarStage.brand) {
      return ShellCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _bar('وش الوكالة؟', state),
            ...Catalog.instance.brands.map(
              (brand) => ChoiceTile(
                title: brand.name,
                subtitle: 'أسعار قطع منشورة',
                onTap: () => state.selectBrand(brand.id),
              ),
            ),
            SoftNote('تويوتا أسعارها في متجر الوكيل وما دخلت الجدول.'),
            TextButton(
              onPressed: () => openUrl(Catalog.instance.sources['toyota']!.url),
              child: const Text('فتح متجر تويوتا'),
            ),
          ],
        ),
      );
    }

    if (state.carStage == CarStage.model) {
      final q = norm(state.modelQuery);
      final models = Catalog.instance.modelsForBrand(state.brand!).where((model) {
        if (q.isEmpty) return true;
        return norm(model.name).contains(q) || norm(model.id).contains(q);
      }).toList();
      final active = filterActive() && state.carNotesStatus == 'ready';
      final matched = <({CarModel model, List<CarNote> notes})>[];
      final rest = <({CarModel model, List<CarNote> notes})>[];
      for (final model in models) {
        final notes = state.carNotes.where((n) => n.model == model.id).toList();
        final shown = active ? notes.where(noteMatches).toList() : notes;
        if (!active || shown.isNotEmpty) {
          matched.add((model: model, notes: shown));
        } else {
          rest.add((model: model, notes: notes));
        }
      }

      String status;
      if (state.carNotesStatus == 'loading') {
        status = 'نجيب تعليقات المستخدمين...';
      } else if (state.carNotesStatus == 'unavailable') {
        status = 'فلتر الميزانية والتعليقات يحتاجان اتصال بخادم التقارير.';
      } else if (state.carNotesStatus == 'offline') {
        status = 'ما قدرنا نجيب التعليقات. ارجع وحاول مرة ثانية.';
      } else if (!state.loggedIn) {
        status = 'الفلتر يشتغل، لكن أسعار وتعليقات المستخدمين تظهر بعد تسجيل الدخول.';
      } else {
        status = 'الفلتر على أسعار كتبها المستخدمون، مو سعر الوكيل.';
      }

      return ShellCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _bar('نوع سيارة ${Catalog.instance.brandById(state.brand!).name}', state),
            TextField(
              controller: queryCtrl,
              decoration: const InputDecoration(hintText: 'ابحث عن الموديل'),
              onChanged: (value) {
                state.modelQuery = value;
                setState(() {});
              },
            ),
            const SizedBox(height: 8),
            TextField(
              controller: budgetCtrl,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9٠-٩.,٬٫]'))],
              decoration: const InputDecoration(hintText: 'الميزانية: أقصى سعر بالريال'),
              onChanged: (value) {
                state.budget = value;
                state.showRest = false;
                setState(() {});
              },
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                for (final item in const [
                  ('all', 'الكل'),
                  ('yes', 'تشمل البنزين'),
                  ('no', 'بدون بنزين'),
                ])
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 3),
                      child: ChoiceTile(
                        title: item.$2,
                        selected: state.fuelMode == item.$1,
                        onTap: () {
                          state.fuelMode = item.$1;
                          state.showRest = false;
                          setState(() {});
                        },
                      ),
                    ),
                  ),
              ],
            ),
            SoftNote(status),
            const SizedBox(height: 4),
            if (models.isEmpty)
              const SoftNote('ما لقينا هذا الموديل في القوائم المنشورة')
            else if (active && matched.isEmpty)
              const SoftNote('ما فيه سيارة تناسب هالميزانية في تعليقات المستخدمين.'),
            ...matched.map(
              (item) => ChoiceTile(
                title: item.model.name,
                subtitle: priceLine(item.notes),
                onTap: () => state.selectModel(item.model.id),
              ),
            ),
            if (active && rest.isNotEmpty) ...[
              OutlinedButton(
                onPressed: () => setState(() => state.showRest = !state.showRest),
                child: Text(state.showRest ? 'أخفِ باقي السيارات' : 'أظهر باقي السيارات (${rest.length})'),
              ),
              if (state.showRest)
                ...rest.map(
                  (item) => ChoiceTile(
                    title: item.model.name,
                    subtitle: priceLine(item.notes),
                    onTap: () => state.selectModel(item.model.id),
                  ),
                ),
            ],
          ],
        ),
      );
    }

    final model = Catalog.instance.modelsForBrand(state.brand!).firstWhere((m) => m.id == state.model);
    final years = Catalog.instance.yearsFor(state.brand!, state.model!);
    final notes = state.carNotes.where((n) => n.model == state.model).toList();

    return ShellCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _bar('سنة ${model.name}', state),
          ...years.map((year) => ChoiceTile(title: year, onTap: () => state.selectYear(year))),
          const SizedBox(height: 12),
          Text('تعليقات على ${model.name}', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          SectionLead(
            state.loggedIn
                ? 'هنا سعر السيارة من المستخدم، وإذا كان يشمل البنزين. سعر قطعة الوكيل يبقى في الخطوة الجاية.'
                : 'تعليقات المستخدمين وأسعارهم تظهر بعد تسجيل الدخول. سعر قطعة الوكيل يبقى ظاهر في الخطوة الجاية.',
          ),
          if (!state.loggedIn)
            LockedGate(
              message: notes.isEmpty
                  ? 'سجّل دخولك عشان تكتب أو تشوف تعليقات المستخدمين'
                  : 'سجّل دخولك عشان تشوف تعليقات المستخدمين وأسعارهم',
              onLogin: state.openLogin,
            )
          else ...[
            if (notes.isEmpty) const SoftNote('كن أول من يعلق على هالسيارة.'),
            ...notes.map(_commentCard),
            _CommentForm(state: state),
          ],
        ],
      ),
    );
  }

  Widget _bar(String title, AppState state) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Expanded(child: Text(title, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700))),
          TextButton(onPressed: state.goBack, child: const Text('رجوع')),
        ],
      ),
    );
  }

  Widget _commentCard(CarNote note) {
    final bits = <String>[];
    if (note.price != null) {
      bits.add('${money(note.price!)} ريال');
      bits.add(note.includesFuel ? 'يشمل البنزين' : 'بدون بنزين');
    }
    if (note.city.isNotEmpty) bits.add(note.city);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFAF6EF),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (bits.isNotEmpty)
            Text(bits.join(' · '), style: const TextStyle(color: TaseerColors.green, fontWeight: FontWeight.w700)),
          Text(note.text),
          if (note.mine) const Text('تعليقك', style: TextStyle(color: TaseerColors.muted, fontSize: 12)),
        ],
      ),
    );
  }
}

class _CommentForm extends StatefulWidget {
  const _CommentForm({required this.state});
  final AppState state;

  @override
  State<_CommentForm> createState() => _CommentFormState();
}

class _CommentFormState extends State<_CommentForm> {
  final price = TextEditingController();
  final text = TextEditingController();
  bool fuel = false;
  String status = '';
  bool busy = false;

  @override
  void initState() {
    super.initState();
    final mine = widget.state.carNotes.where((n) => n.model == widget.state.model && n.mine).toList();
    if (mine.isNotEmpty) {
      final note = mine.first;
      if (note.price != null) price.text = '${note.price}';
      fuel = note.includesFuel;
      text.text = note.text;
    }
  }

  @override
  void dispose() {
    price.dispose();
    text.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    final raw = price.text.trim();
    final hasPrice = raw.isNotEmpty;
    final amount = parseQuote(raw);
    final comment = text.text.trim();
    if (hasPrice && (amount == null || amount < 1000 || amount > 5000000)) {
      setState(() => status = 'اكتب سعر السيارة بين 1,000 و 5,000,000 ريال، أو اتركه فاضي.');
      return;
    }
    if (fuel && !hasPrice) {
      setState(() => status = 'اكتب السعر إذا كان يشمل البنزين.');
      return;
    }
    if (comment.length < 2 || comment.length > 240) {
      setState(() => status = 'اكتب تعليقاً من حرفين إلى 240 حرف.');
      return;
    }
    setState(() {
      busy = true;
      status = 'ننشر تعليقك...';
    });
    try {
      await widget.state.publishCarNote(
        text: comment,
        price: hasPrice ? amount : null,
        includesFuel: fuel,
      );
      setState(() => status = 'اننشر تعليقك. يقدر غيرك يشوفه مع الفلتر.');
    } catch (error) {
      setState(() => status = '$error');
    } finally {
      setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 8),
        const Text('سعر السيارة بالريال، إذا تبيه', style: TextStyle(fontWeight: FontWeight.w600)),
        TextField(controller: price, keyboardType: TextInputType.number, decoration: const InputDecoration(hintText: 'اختياري')),
        CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          value: fuel,
          onChanged: (value) => setState(() => fuel = value ?? false),
          title: const Text('السعر يشمل البنزين'),
          controlAffinity: ListTileControlAffinity.leading,
        ),
        const Text('تعليقك على السيارة', style: TextStyle(fontWeight: FontWeight.w600)),
        TextField(
          controller: text,
          maxLength: 240,
          minLines: 2,
          maxLines: 4,
          decoration: const InputDecoration(hintText: 'وش رأيك بالسيارة أو بالسعر؟'),
        ),
        ElevatedButton(
          onPressed: busy ? null : submit,
          child: Text(text.text.isEmpty ? 'انشر تعليقك' : 'حدّث تعليقك'),
        ),
        if (status.isNotEmpty) SoftNote(status),
      ],
    );
  }
}

class PartScreen extends StatefulWidget {
  const PartScreen({super.key, required this.state});
  final AppState state;

  @override
  State<PartScreen> createState() => _PartScreenState();
}

class _PartScreenState extends State<PartScreen> {
  String symptom = '';

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final modelName = state.modelName() ?? '';
    final parts = Catalog.instance.partsFor(state.brand!, state.model!, state.yearLabel!);
    final matchId = AdviceEngine.matchSymptom(symptom, parts.map((p) => p.id));
    final match = matchId == null ? null : parts.where((p) => p.id == matchId).toList();

    return ShellCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'وش القطعة؟',
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                ),
              ),
              TextButton(onPressed: state.goBack, child: const Text('رجوع')),
            ],
          ),
          SectionLead('$modelName ${state.yearLabel}. القطع الظاهرة هي اللي لها سعر في قائمة الوكيل.'),
          TextField(
            decoration: const InputDecoration(hintText: 'صف المشكلة، مثل صرير فرامل'),
            onChanged: (value) => setState(() => symptom = value),
          ),
          if (match != null && match.isNotEmpty)
            SoftNote('يبدو إنك تقصد: ${match.first.name}'),
          const SizedBox(height: 8),
          ...parts.map(
            (part) => ChoiceTile(
              title: part.name,
              selected: matchId == part.id,
              onTap: () => state.selectPart(part.id),
            ),
          ),
        ],
      ),
    );
  }
}

class ResultScreen extends StatefulWidget {
  const ResultScreen({super.key, required this.state});
  final AppState state;

  @override
  State<ResultScreen> createState() => _ResultScreenState();
}

class _ResultScreenState extends State<ResultScreen> {
  final quoteCtrl = TextEditingController();
  AdviceResult? advice;
  bool showPaywall = false;
  String tone = '';

  @override
  void initState() {
    super.initState();
    quoteCtrl.text = widget.state.quote;
    widget.state.refreshCrowd();
    _rememberCar();
  }

  Future<void> _rememberCar() async {
    final state = widget.state;
    if (!state.subscribed || state.city == null || state.brand == null || state.model == null || state.yearLabel == null) {
      return;
    }
    final garage = state.garage;
    garage.car = GarageCar(
      region: state.city!.region,
      city: state.city!.name,
      brand: state.brand!,
      model: state.model!,
      yearLabel: state.yearLabel!,
      modelName: state.modelName() ?? state.model!,
    );
    await state.saveGarage(garage);
  }

  @override
  void dispose() {
    quoteCtrl.dispose();
    super.dispose();
  }

  Future<void> compare() async {
    final state = widget.state;
    final quote = parseQuote(quoteCtrl.text);
    state.quote = quoteCtrl.text;
    if (quote == null || quote <= 0) {
      setState(() {
        advice = null;
        showPaywall = false;
      });
      return;
    }
    final range = state.priceRange();
    final nextTone = AdviceEngine.toneOf(quote, range.low, range.high);
    await state.refreshCrowd(quote);
    final key = '${state.part}|$quote';
    if (nextTone == 'close') {
      setState(() {
        tone = nextTone;
        showPaywall = false;
        advice = AdviceEngine.localAdvice(
          part: state.part!,
          partName: Catalog.instance.partById(state.part!)!.name,
          quote: quote,
          low: range.low,
          high: range.high,
          crowdReady: state.loggedIn && (state.crowd?.ready ?? false),
          crowdAverage: state.crowd?.average,
          crowdCount: state.crowd?.count ?? 0,
        );
      });
      return;
    }
    final unlocked = await state.unlockAdvice(key);
    if (unlocked) {
      setState(() {
        tone = nextTone;
        showPaywall = false;
        advice = AdviceEngine.localAdvice(
          part: state.part!,
          partName: Catalog.instance.partById(state.part!)!.name,
          quote: quote,
          low: range.low,
          high: range.high,
          crowdReady: state.loggedIn && (state.crowd?.ready ?? false),
          crowdAverage: state.crowd?.average,
          crowdCount: state.crowd?.count ?? 0,
        );
      });
    } else {
      setState(() {
        tone = nextTone;
        showPaywall = true;
        advice = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = widget.state;
    final partName = Catalog.instance.partById(state.part!)!.name;
    final lines = Catalog.instance.groupedLines(state.rowsForPart());
    final range = state.priceRange();
    final sourceId = state.rowsForPart().isNotEmpty ? state.rowsForPart().first.source : 'kia';
    final source = Catalog.instance.sources[sourceId];
    final crowd = state.crowd;

    return ShellCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(partName, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
              ),
              TextButton(onPressed: state.goBack, child: const Text('رجوع')),
            ],
          ),
          Text(
            '${state.city!.name} · ${Catalog.instance.brandById(state.brand!).name} ${state.modelName()} ${state.yearLabel}',
            style: const TextStyle(color: TaseerColors.muted),
          ),
          const SizedBox(height: 8),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: money(range.low == range.high ? range.low : range.low),
                  style: const TextStyle(
                    fontSize: 42,
                    fontWeight: FontWeight.w700,
                    color: TaseerColors.copperDeep,
                    height: 1.1,
                  ),
                ),
                if (range.low != range.high)
                  TextSpan(
                    text: ' – ${money(range.high)}',
                    style: const TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w700,
                      color: TaseerColors.copperDeep,
                    ),
                  ),
                const TextSpan(
                  text: ' ريال',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: TaseerColors.copperDeep),
                ),
              ],
            ),
          ),
          ...lines.map(
            (line) => Container(
              margin: const EdgeInsets.only(top: 8),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFFAF6EF),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  Expanded(child: Text(line.label, style: const TextStyle(fontWeight: FontWeight.w600))),
                  Text(
                    line.low == line.high ? '${money(line.low)} ريال' : '${money(line.low)} – ${money(line.high)} ريال',
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ],
              ),
            ),
          ),
          const SoftNote('هذا سعر القطعة الأصلية عند الوكيل لحاله، مو إجمالي الورشة. الأجرة غير داخلة، والسعر موحّد في كل المدن.'),
          if (source != null)
            SoftNote('${source.name}. ${source.note}'),
          const SizedBox(height: 8),
          _crowdBlock(state, crowd),
          const SizedBox(height: 12),
          const Text('كم طلبوا منك على القطعة؟', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          const SizedBox(height: 8),
          TextField(
            controller: quoteCtrl,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(hintText: 'سعر الورشة بالريال'),
          ),
          const SizedBox(height: 8),
          ElevatedButton(onPressed: compare, child: const Text('قارني')),
          if (tone == 'close' && advice != null) ...[
            SoftNote(advice!.headline, color: TaseerColors.ok),
            SoftNote('الفرق على القطعة صغير، فما يحتاج تدفع'),
          ],
          if (showPaywall) _paywall(state, range),
          if (advice != null && tone != 'close') _adviceCard(advice!),
          if (state.payError.isNotEmpty) SoftNote(state.payError, color: TaseerColors.warn),
        ],
      ),
    );
  }

  Widget _crowdBlock(AppState state, CrowdStats? crowd) {
    if (crowd == null || crowd.unavailable) {
      return const SoftNote('متوسط المستخدمين يبين لما يتصل التطبيق.');
    }
    if (crowd.offline) return const SoftNote('متوسط المستخدمين يبين لما يتصل التطبيق.');
    if (crowd.accepted == false) {
      return const SoftNote('هذا الرقم بعيد، فما دخل في متوسط المستخدمين.');
    }
    if (crowd.ready && crowd.average != null) {
      if (!state.loggedIn) {
        return LockedGate(
          message: 'سجّل دخولك عشان تشوف متوسط أسعار المستخدمين',
          onLogin: state.openLogin,
        );
      }
      return Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFEEF3F1),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text(
              'متوسط المستخدمين ${money(crowd.average!)} ريال من ${crowd.count} تقارير. هذا مو سعر الوكيل.',
              style: const TextStyle(color: TaseerColors.green, fontWeight: FontWeight.w700),
            ),
          ),
          if (crowd.cityReady && crowd.cityAverage != null)
            SoftNote('في ${state.city!.name}: ${money(crowd.cityAverage!)} ريال من ${crowd.cityCount} تقارير.'),
        ],
      );
    }
    if (crowd.count > 0) {
      return SoftNote(
        state.loggedIn
            ? 'تقارير المستخدمين لهالقطعة: ${crowd.count} من ${crowd.needed}. بعدها يطلع المتوسط.'
            : 'فيه تقارير للمستخدمين. لما يكتمل العدد سجّل دخولك عشان تشوف المتوسط.',
      );
    }
    return SoftNote('اكتب سعر الورشة. متوسط المستخدمين يطلع بعد ${crowd.needed} تقارير لنفس القطعة.');
  }

  Widget _paywall(AppState state, ({double low, double high}) range) {
    final quote = parseQuote(quoteCtrl.text) ?? 0;
    final gap = quote > range.high ? quote - range.high : range.low - quote;
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFAF6EF),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('المستشار', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          SoftNote('الفرق على القطعة حوالي ${money(gap)} ريال. افتح النصيحة عشان تعرف وش تقول للورشة.'),
          ElevatedButton(
            onPressed: () => state.buy('advice_once'),
            child: const Text('افتح النصيحة بـ 9 ريال'),
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () => state.buy('advice_month'),
            child: const Text('اشتراك 29 ريال: بدون إعلان وسجل السيارة'),
          ),
          const SoftNote(
            '9 ريال تفتح نصيحة واحدة وما تشيل الإعلان. الاشتراك بـ 29 ريال يشيل الإعلان ويحفظ السيارة والتذكير والوقود والتأمين والتكاليف. سعر القطعة الأصلية يبقى مجاني.',
          ),
        ],
      ),
    );
  }

  Widget _adviceCard(AdviceResult advice) {
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF3F8F5),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('المستشار', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          SoftNote(advice.headline, color: advice.tone == 'extreme' ? TaseerColors.bad : TaseerColors.warn),
          SoftNote(advice.script),
          ...advice.questions.map((q) => SoftNote('• $q')),
        ],
      ),
    );
  }
}
