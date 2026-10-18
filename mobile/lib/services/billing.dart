import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

class PurchaseEvent {
  const PurchaseEvent({
    required this.ok,
    required this.productId,
    required this.token,
    required this.kind,
    required this.message,
  });

  final bool ok;
  final String productId;
  final String token;
  final String kind;
  final String message;
}

class BillingService {
  BillingService();

  static const onceId = 'advice_once';
  static const monthId = 'advice_month';
  static const productIds = {onceId, monthId};

  /// Store billing is only wired on Android/iOS. Web/desktop use the debug grant path.
  bool get _storeSupported =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.android ||
          defaultTargetPlatform == TargetPlatform.iOS);

  InAppPurchase? get _iap => _storeSupported ? InAppPurchase.instance : null;
  StreamSubscription<List<PurchaseDetails>>? _sub;
  void Function(PurchaseEvent event)? onEvent;

  Future<void> start(void Function(PurchaseEvent event) handler) async {
    onEvent = handler;
    final iap = _iap;
    if (iap == null) return;
    try {
      _sub = iap.purchaseStream.listen(_onPurchases, onError: (_) {});
    } catch (_) {
      // Platform plugin missing (e.g. unsupported target) — stay on debug grants.
    }
  }

  Future<void> dispose() async {
    await _sub?.cancel();
  }

  Future<void> purchase(String productId) async {
    if (!productIds.contains(productId)) {
      onEvent?.call(
        PurchaseEvent(
          ok: false,
          productId: productId,
          token: '',
          kind: productId == monthId ? 'month' : 'once',
          message: 'المنتج غير معروف.',
        ),
      );
      return;
    }
    final iap = _iap;
    if (iap == null) {
      _grantDebug(productId);
      return;
    }
    final available = await iap.isAvailable();
    if (!available) {
      _grantDebug(productId);
      return;
    }
    final response = await iap.queryProductDetails(productIds);
    if (response.error != null || response.productDetails.isEmpty) {
      _grantDebug(productId);
      return;
    }
    ProductDetails? product;
    for (final item in response.productDetails) {
      if (item.id == productId) product = item;
    }
    if (product == null) {
      onEvent?.call(
        PurchaseEvent(
          ok: false,
          productId: productId,
          token: '',
          kind: productId == monthId ? 'month' : 'once',
          message: 'المنتج مو متاح في المتجر الآن.',
        ),
      );
      return;
    }
    final param = PurchaseParam(productDetails: product);
    final ok = productId == onceId
        ? await iap.buyConsumable(purchaseParam: param)
        : await iap.buyNonConsumable(purchaseParam: param);
    if (!ok) {
      onEvent?.call(
        PurchaseEvent(
          ok: false,
          productId: productId,
          token: '',
          kind: productId == monthId ? 'month' : 'once',
          message: 'ما بدينا عملية الشراء.',
        ),
      );
    }
  }

  void _grantDebug(String productId) {
    onEvent?.call(
      PurchaseEvent(
        ok: true,
        productId: productId,
        token: 'debug-flutter-${DateTime.now().millisecondsSinceEpoch}',
        kind: productId == monthId ? 'month' : 'once',
        message: '',
      ),
    );
  }

  Future<void> _onPurchases(List<PurchaseDetails> purchases) async {
    final iap = _iap;
    if (iap == null) return;
    for (final purchase in purchases) {
      if (purchase.status == PurchaseStatus.pending) continue;
      final productId = purchase.productID;
      final kind = productId == monthId ? 'month' : 'once';
      if (purchase.status == PurchaseStatus.error) {
        onEvent?.call(
          PurchaseEvent(
            ok: false,
            productId: productId,
            token: '',
            kind: kind,
            message: purchase.error?.message ?? 'لا يمكن إتمام الدفع الآن.',
          ),
        );
      } else if (purchase.status == PurchaseStatus.purchased ||
          purchase.status == PurchaseStatus.restored) {
        onEvent?.call(
          PurchaseEvent(
            ok: true,
            productId: productId,
            token: purchase.purchaseID ??
                'store-${DateTime.now().millisecondsSinceEpoch}',
            kind: kind,
            message: '',
          ),
        );
      }
      if (purchase.pendingCompletePurchase) {
        await iap.completePurchase(purchase);
      }
    }
  }
}
