import '../data/catalog.dart';

class AdviceResult {
  const AdviceResult({
    required this.tone,
    required this.headline,
    required this.script,
    required this.questions,
  });

  final String tone;
  final String headline;
  final String script;
  final List<String> questions;
}

class AdviceEngine {
  static const symptoms = <String, List<String>>{
    'rear-pads': ['فحمات خلف', 'فرامل خلف', 'اقمشة خلف', 'اقمشه خلف'],
    'front-pads': ['فحمات', 'فرامل', 'بريك', 'صرير', 'سكيك'],
    'timing': ['تايمن', 'جنزير', 'سير التايمن'],
    'wiper': ['مساحة', 'مساحات', 'ماسحة', 'زجاج امام'],
    'ac-filter': ['مكيف', 'تكييف', 'فريون', 'ما يبرد'],
    'oil-filter': ['فلتر زيت', 'تغيير زيت', 'زيت المحرك', 'زيت'],
    'air-filter': ['فلتر هواء', 'فلتر الهواء'],
    'fuel-filter': ['فلتر وقود', 'طرمبة', 'طرمبه'],
    'glow-plug': ['بواجي تسخين', 'تسخين', 'ديزل'],
    'plugs': ['بواجي', 'بوجي', 'تقطيع', 'صرفية', 'صرفيه'],
    'coolant': ['حرارة', 'حراره', 'رديتر', 'ماء الرديتر'],
    'belt': ['صفير', 'سير المحرك', 'سير'],
  };

  static const partNote = <String, String>{
    'front-pads': 'الفحمات أمان للسيارة. لا تقبل قطعة بلا اسم الوكيل إذا الفرق كبير.',
    'rear-pads': 'اسأل هل سعر الفحمات الخلفية للزوج كامل، يمين ويسار.',
    'wiper': 'تأكد إن السعر للجهة المطلوبة. بعض القوائم تفصل مساحة السائق عن الراكب.',
    'oil-filter': 'فلتر الزيت غالباً ينحط مع أجرة تغيير الزيت. اطلب سعر الفلتر لحاله.',
    'air-filter': 'فلتر الهواء قطعة صغيرة. إذا السعر عالي، الأجرة غالباً هي الزيادة.',
    'ac-filter': 'فلتر المكيف سهل يتبدل. اسأل هل الأجرة داخلة في الرقم.',
    'fuel-filter': 'اسأل هل فلتر الوقود الخارجي ولا اللي داخل التانكي، لأن السعر يختلف.',
    'plugs': 'البواجي غالباً طقم. تأكد إن السعر للطقم كامل مو للحبة.',
    'glow-plug': 'اسأل هل سعر بواجي التسخين للحبة أو للطقم.',
    'coolant': 'السعر المنشور للجالون. اسأل كم جالون مكتوب في الفاتورة.',
    'timing': 'شغلة التايمن كبيرة. الأجرة قد تكون أعلى من القطعة، واطلبها بسعر مستقل.',
    'belt': 'اسأل أي سير بالضبط، لأن السيارة فيها أكثر من سير.',
  };

  static String? matchSymptom(String text, Iterable<String> availableIds) {
    final query = norm(text);
    if (query.length < 2) return null;
    for (final entry in symptoms.entries) {
      final hit = entry.value.any((word) => query.contains(norm(word)));
      if (!hit) continue;
      if (availableIds.contains(entry.key)) return entry.key;
    }
    return null;
  }

  static String toneOf(double quote, double low, double high) {
    if (quote < low * 0.7) return 'low';
    if (quote <= high) return 'close';
    if (quote <= high * 1.5) return 'high';
    return 'extreme';
  }

  static String rangeText(double low, double high) {
    if (low == high) return '${money(low)} ريال';
    return '${money(low)} إلى ${money(high)} ريال';
  }

  static AdviceResult localAdvice({
    required String part,
    required String partName,
    required double quote,
    required double low,
    required double high,
    bool crowdReady = false,
    double? crowdAverage,
    int crowdCount = 0,
    bool marketEstimate = false,
  }) {
    final tone = toneOf(quote, low, high);
    final band = rangeText(low, high);
    final asked = '${money(quote)} ريال';
    final note = partNote[part] ?? 'اسأل عن اسم القطعة كما هي في فاتورة الوكيل.';
    final learned = crowdReady && crowdAverage != null && crowdCount > 0
        ? ' متوسط تقارير المستخدمين ${money(crowdAverage)} ريال من $crowdCount تقارير.'
        : '';
    final gap = quote > high ? quote - high : low - quote;
    final basis = marketEstimate ? 'تقدير سوقي تقريبي' : 'سعر منشور عند الوكيل';
    final basisVerb = marketEstimate ? 'تقديرها السوقي' : 'منشورة';

    if (tone == 'close') {
      final edge = quote > high ? high : low;
      return AdviceResult(
        tone: tone,
        headline: marketEstimate
            ? 'قريب من التقدير السوقي للقطعة الأصلية. هذا قبل الأجرة.'
            : 'قريب من سعر القطعة الأصلية. هذا قبل الأجرة.',
        script:
            '$partName $basisVerb بـ $band. الرقم اللي كتبته $asked، والفرق حوالي ${money((quote - edge).abs())} ريال. هذا مو سعر الورشة كامل. $note$learned',
        questions: const [],
      );
    }

    if (tone == 'low') {
      return AdviceResult(
        tone: tone,
        headline: 'الرقم أقل بكثير من $basis.',
        script:
            'طلبوا $asked بينما $partName $basisVerb بـ $band. الفرق حوالي ${money(gap)} ريال تحت النطاق. غالباً القطعة تجارية أو الرقم ناقص. قول لهم: أبي أعرف من وين القطعة، وهل عليها ضمان مكتوب وفاتورة. إذا ما فيه ضمان، الرخص هنا غالي. $note$learned',
        questions: const [
          'القطعة أصلية من الوكيل ولا تجارية؟',
          'وين الضمان المكتوب وكم مدته؟',
          'هل الرقم هذا للقطعة لحاله؟',
        ],
      );
    }

    final strong = tone == 'extreme';
    return AdviceResult(
      tone: tone,
      headline: strong
          ? 'أعلى بكثير. لا توافق قبل ما تشوف الفاتورة مفصّلة.'
          : marketEstimate
              ? 'أعلى من التقدير السوقي. اطلب تفصيل القطعة والأجرة.'
              : 'أعلى من السعر المنشور. اطلب تفصيل القطعة والأجرة.',
      script:
          'طلبوا $asked و$partName $basisVerb بـ $band. الزيادة حوالي ${money(gap)} ريال قبل ما نحسب الأجرة. قول لهم بالحرف: ابغى سعر القطعة لحاله وسعر الأجرة لحاله، والقطعة أصلية بفاتورة. ${strong ? 'إذا رفضوا التفصيل، لا توافق اليوم وخذ السيارة.' : 'إذا فصّلوا والزيادة كلها أجرة معقولة، القرار يرجع لك.'} $note$learned',
      questions: const [
        'كم سعر القطعة لحاله وكم الأجرة لحاله؟',
        'هل القطعة أصلية وعليها فاتورة الوكيل؟',
        'وش المكتوب في الضمان؟',
      ],
    );
  }
}
