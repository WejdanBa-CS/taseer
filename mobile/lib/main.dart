import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';
import 'package:webview_flutter_wkwebview/webview_flutter_wkwebview.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const TaseerApp());
}

class TaseerApp extends StatelessWidget {
  const TaseerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      debugShowCheckedModeBanner: false,
      home: TaseerShell(),
    );
  }
}

class TaseerShell extends StatefulWidget {
  const TaseerShell({super.key});

  @override
  State<TaseerShell> createState() => _TaseerShellState();
}

class _TaseerShellState extends State<TaseerShell> {
  static const _onceId = 'advice_once';
  static const _monthId = 'advice_month';
  static const _productIds = {_onceId, _monthId};

  WebViewController? _controller;
  String? _error;
  bool _pageReady = false;
  final _pendingPurchases = <String>[];
  StreamSubscription<List<PurchaseDetails>>? _purchases;
  final _iap = InAppPurchase.instance;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  @override
  void dispose() {
    _purchases?.cancel();
    super.dispose();
  }

  Future<void> _boot() async {
    try {
      final www = await _materializeWww();
      final params = WebViewPlatform.instance is WebKitWebViewPlatform
          ? WebKitWebViewControllerCreationParams(
              allowsInlineMediaPlayback: true,
              mediaTypesRequiringUserAction: const {},
            )
          : const PlatformWebViewControllerCreationParams();
      final controller = WebViewController.fromPlatformCreationParams(params)
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(const Color(0xFFF4EFE6))
        ..addJavaScriptChannel(
          'TaseerChannel',
          onMessageReceived: (message) => _onNativeMessage(message.message),
        )
        ..setNavigationDelegate(
          NavigationDelegate(
            onNavigationRequest: (request) {
              final uri = Uri.tryParse(request.url);
              if (uri == null) return NavigationDecision.prevent;
              if (uri.scheme == 'file') return NavigationDecision.navigate;
              if (uri.scheme == 'http' || uri.scheme == 'https') {
                _openExternal(uri);
                return NavigationDecision.prevent;
              }
              return NavigationDecision.prevent;
            },
            onPageFinished: (_) => _onPageFinished(),
          ),
        );

      if (controller.platform is AndroidWebViewController) {
        AndroidWebViewController.enableDebugging(true);
        final android = controller.platform as AndroidWebViewController;
        await android.setMediaPlaybackRequiresUserGesture(false);
      }

      await controller.loadFile('${www.path}/index.html');
      _purchases = _iap.purchaseStream.listen(
        _onPurchases,
        onError: (_) {},
      );
      if (mounted) {
        setState(() {
          _controller = controller;
          _error = null;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() => _error = 'ما قدرنا نفتح التطبيق: $error');
      }
    }
  }

  Future<Directory> _materializeWww() async {
    final root = await getApplicationSupportDirectory();
    final www = Directory('${root.path}/www');
    if (await www.exists()) {
      await www.delete(recursive: true);
    }
    await www.create(recursive: true);

    final manifest = await AssetManifest.loadFromAssetBundle(rootBundle);
    final keys = manifest.listAssets().where((key) => key.startsWith('assets/www/'));
    for (final key in keys) {
      final relative = key.substring('assets/www/'.length);
      if (relative.isEmpty) continue;
      final out = File('${www.path}/$relative');
      await out.parent.create(recursive: true);
      final data = await rootBundle.load(key);
      await out.writeAsBytes(
        data.buffer.asUint8List(data.offsetInBytes, data.lengthInBytes),
        flush: true,
      );
    }
    final index = File('${www.path}/index.html');
    if (!await index.exists()) {
      throw StateError('ما لقيت index.html داخل أصول Flutter.');
    }
    return www;
  }

  Future<void> _onPageFinished() async {
    _pageReady = true;
    final bridge = '''
(function () {
  if (window.TaseerNative) return;
  function send(payload) {
    if (window.TaseerChannel && window.TaseerChannel.postMessage) {
      window.TaseerChannel.postMessage(JSON.stringify(payload));
    }
  }
  window.TaseerNative = {
    open: function (url) { send({ action: 'open', url: String(url || '') }); },
    purchase: function (productId) { send({ action: 'purchase', productId: String(productId || '') }); },
    setAdsVisible: function () { return false; }
  };
  window.TaseerAndroid = window.TaseerNative;
})();
''';
    await _controller?.runJavaScript(bridge);
    final queued = List<String>.from(_pendingPurchases);
    _pendingPurchases.clear();
    for (final payload in queued) {
      await _deliverPurchase(payload);
    }
  }

  Future<void> _onNativeMessage(String raw) async {
    Map<String, dynamic> payload;
    try {
      payload = jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return;
    }
    final action = payload['action'];
    if (action == 'open') {
      final url = payload['url'];
      if (url is String) await _openExternal(Uri.tryParse(url));
      return;
    }
    if (action == 'purchase') {
      final productId = payload['productId'];
      if (productId is String) await _purchase(productId);
    }
  }

  Future<void> _openExternal(Uri? uri) async {
    if (uri == null) return;
    if (uri.scheme != 'http' && uri.scheme != 'https') return;
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _purchase(String productId) async {
    if (!_productIds.contains(productId)) {
      await _failPurchase(productId, 'المنتج غير معروف.');
      return;
    }
    final available = await _iap.isAvailable();
    if (!available) {
      await _grantDebug(productId);
      return;
    }
    final response = await _iap.queryProductDetails(_productIds);
    if (response.error != null || response.productDetails.isEmpty) {
      await _grantDebug(productId);
      return;
    }
    ProductDetails? product;
    for (final item in response.productDetails) {
      if (item.id == productId) product = item;
    }
    if (product == null) {
      await _failPurchase(productId, 'المنتج مو متاح في المتجر الآن.');
      return;
    }
    final param = PurchaseParam(productDetails: product);
    final ok = productId == _onceId
        ? await _iap.buyConsumable(purchaseParam: param)
        : await _iap.buyNonConsumable(purchaseParam: param);
    if (!ok) {
      await _failPurchase(productId, 'ما بدينا عملية الشراء.');
    }
  }

  Future<void> _grantDebug(String productId) async {
    // في التطوير بدون متجر: نفس فكرة أندرويد السابق لمنح تجربة شراء.
    final kind = productId == _monthId ? 'month' : 'once';
    await _deliverPurchase(
      jsonEncode({
        'ok': true,
        'productId': productId,
        'token': 'debug-flutter-${DateTime.now().millisecondsSinceEpoch}',
        'kind': kind,
        'message': '',
      }),
    );
  }

  Future<void> _failPurchase(String productId, String message) async {
    await _deliverPurchase(
      jsonEncode({
        'ok': false,
        'productId': productId,
        'token': '',
        'kind': productId == _monthId ? 'month' : 'once',
        'message': message,
      }),
    );
  }

  Future<void> _onPurchases(List<PurchaseDetails> purchases) async {
    for (final purchase in purchases) {
      if (purchase.status == PurchaseStatus.pending) continue;
      final productId = purchase.productID;
      final kind = productId == _monthId ? 'month' : 'once';
      if (purchase.status == PurchaseStatus.error) {
        await _failPurchase(
          productId,
          purchase.error?.message ?? 'لا يمكن إتمام الدفع الآن.',
        );
      } else if (purchase.status == PurchaseStatus.purchased ||
          purchase.status == PurchaseStatus.restored) {
        await _deliverPurchase(
          jsonEncode({
            'ok': true,
            'productId': productId,
            'token': purchase.purchaseID ??
                'store-${DateTime.now().millisecondsSinceEpoch}',
            'kind': kind,
            'message': '',
          }),
        );
      }
      if (purchase.pendingCompletePurchase) {
        await _iap.completePurchase(purchase);
      }
    }
  }

  Future<void> _deliverPurchase(String json) async {
    if (!_pageReady || _controller == null) {
      _pendingPurchases.add(json);
      return;
    }
    final quoted = jsonEncode(json);
    await _controller!.runJavaScript(
      'window.taseerOnPurchase && window.taseerOnPurchase($quoted);',
    );
  }

  Future<bool> _handleBack() async {
    final controller = _controller;
    if (controller == null) return false;
    final raw = await controller.runJavaScriptReturningResult(
      '(function(){return !!(window.taseerGoBack && window.taseerGoBack());})()',
    );
    final text = '$raw'.replaceAll('"', '');
    return text == 'true' || text == '1';
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Scaffold(
        backgroundColor: const Color(0xFFF4EFE6),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              _error!,
              textAlign: TextAlign.center,
              textDirection: TextDirection.rtl,
              style: const TextStyle(fontSize: 16, color: Color(0xFF1B3A32)),
            ),
          ),
        ),
      );
    }
    final controller = _controller;
    if (controller == null) {
      return const Scaffold(
        backgroundColor: Color(0xFFF4EFE6),
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFF1B3A32)),
        ),
      );
    }
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        final handled = await _handleBack();
        if (!handled && context.mounted) {
          SystemNavigator.pop();
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF4EFE6),
        body: SafeArea(
          top: false,
          child: WebViewWidget(controller: controller),
        ),
      ),
    );
  }
}
