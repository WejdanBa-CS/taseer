package sa.taseer.app

import android.app.Activity
import android.content.pm.ApplicationInfo
import androidx.appcompat.app.AlertDialog
import com.android.billingclient.api.AcknowledgePurchaseParams
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClient.BillingResponseCode
import com.android.billingclient.api.BillingClient.ProductType
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ConsumeParams
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import org.json.JSONObject

/**
 * يبيع نصيحة المستشار عبر بلاي: advice_once قطعة تُستهلك، و advice_month اشتراك.
 * الإصدار التجريبي فقط يعرض منحة اختبار إذا المتجر غير متصل. الإصدار النهائي لا يفتح النصيحة بدون دفع.
 */
class BillingGate(
    private val activity: Activity,
    private val deliver: (String) -> Unit,
) : PurchasesUpdatedListener {
    private val client: BillingClient = BillingClient.newBuilder(activity)
        .setListener(this)
        .enablePendingPurchases(
            PendingPurchasesParams.newBuilder().enableOneTimeProducts().build()
        )
        .build()

    private var connecting = false
    private var launchInFlight = false
    private var pendingProduct: String? = null

    fun start() {
        if (client.isReady || connecting) return
        connecting = true
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                connecting = false
                val waiting = pendingProduct
                pendingProduct = null
                if (result.responseCode == BillingResponseCode.OK) {
                    refreshOwned()
                    if (waiting != null) queryAndLaunch(waiting)
                } else if (waiting != null) {
                    unavailable(waiting)
                }
            }

            override fun onBillingServiceDisconnected() {
                connecting = false
            }
        })
    }

    fun end() {
        pendingProduct = null
        if (client.isReady) client.endConnection()
    }

    fun purchase(productId: String) {
        if (productId != ONCE && productId != MONTH) {
            fail("المنتج غير معروف.")
            return
        }
        if (launchInFlight) return
        if (client.isReady) {
            queryAndLaunch(productId)
            return
        }
        pendingProduct = productId
        start()
    }

    fun refreshOwned() {
        if (!client.isReady) return
        client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(ProductType.SUBS).build()
        ) { result, purchases ->
            if (result.responseCode != BillingResponseCode.OK) return@queryPurchasesAsync
            purchases.forEach { settle(it, notifyFailure = false) }
        }
        client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(ProductType.INAPP).build()
        ) { result, purchases ->
            if (result.responseCode != BillingResponseCode.OK) return@queryPurchasesAsync
            purchases.forEach { settle(it, notifyFailure = false) }
        }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        when (result.responseCode) {
            BillingResponseCode.OK -> purchases.orEmpty().forEach { settle(it, notifyFailure = true) }
            BillingResponseCode.USER_CANCELED -> fail("أُلغي الدفع. النصيحة بقيت مقفلة.")
            else -> fail("ما اكتمل الدفع.")
        }
    }

    private fun queryAndLaunch(productId: String) {
        launchInFlight = true
        val type = if (productId == MONTH) ProductType.SUBS else ProductType.INAPP
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(
                listOf(
                    QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(productId)
                        .setProductType(type)
                        .build()
                )
            )
            .build()
        client.queryProductDetailsAsync(params) { result, details ->
            activity.runOnUiThread {
                launchInFlight = false
                if (activity.isFinishing) return@runOnUiThread
                val product = details.firstOrNull()
                if (result.responseCode != BillingResponseCode.OK || product == null) {
                    unavailable(productId)
                    return@runOnUiThread
                }
                val detailsParams = BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(product)
                if (type == ProductType.SUBS) {
                    val offerToken = product.subscriptionOfferDetails?.firstOrNull()?.offerToken
                    if (offerToken.isNullOrEmpty()) {
                        unavailable(productId)
                        return@runOnUiThread
                    }
                    detailsParams.setOfferToken(offerToken)
                }
                val flow = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(listOf(detailsParams.build()))
                    .build()
                when (client.launchBillingFlow(activity, flow).responseCode) {
                    BillingResponseCode.OK -> Unit
                    BillingResponseCode.ITEM_ALREADY_OWNED -> refreshOwned()
                    else -> fail("ما انفتح الدفع.")
                }
            }
        }
    }

    private fun settle(purchase: Purchase, notifyFailure: Boolean) {
        if (purchase.purchaseState == Purchase.PurchaseState.PENDING) {
            if (notifyFailure) fail("الدفع قيد التأكيد. النصيحة تفتح بعد اكتماله.")
            return
        }
        if (purchase.purchaseState != Purchase.PurchaseState.PURCHASED) return
        if (purchase.products.contains(MONTH)) acknowledgeMonth(purchase, notifyFailure)
        if (purchase.products.contains(ONCE)) consumeOnce(purchase, notifyFailure)
    }

    private fun acknowledgeMonth(purchase: Purchase, notifyFailure: Boolean) {
        if (purchase.isAcknowledged) {
            grant(MONTH, "month", purchase.purchaseToken)
            return
        }
        val params = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.purchaseToken)
            .build()
        client.acknowledgePurchase(params) { result ->
            if (result.responseCode == BillingResponseCode.OK) {
                grant(MONTH, "month", purchase.purchaseToken)
            } else if (notifyFailure) {
                fail("ما اكتمل تأكيد الاشتراك.")
            }
        }
    }

    private fun consumeOnce(purchase: Purchase, notifyFailure: Boolean) {
        grant(ONCE, "once", purchase.purchaseToken)
        val params = ConsumeParams.newBuilder().setPurchaseToken(purchase.purchaseToken).build()
        client.consumeAsync(params) { result, _ ->
            if (result.responseCode != BillingResponseCode.OK && notifyFailure) {
                fail("ما اكتمل تفعيل النصيحة.")
            }
        }
    }

    private fun unavailable(productId: String) {
        activity.runOnUiThread {
            if (activity.isFinishing) return@runOnUiThread
            if (!debugBuild()) {
                fail("لا يمكن إتمام الدفع الآن.")
                return@runOnUiThread
            }
            AlertDialog.Builder(activity)
                .setTitle("تجربة الشراء")
                .setMessage("متجر بلاي مو متصل على هذا الجهاز. نفعّل النصيحة تجريبياً عشان تكمل الاختبار؟")
                .setPositiveButton("تفعيل تجريبي") { _, _ ->
                    val kind = if (productId == MONTH) "month" else "once"
                    grant(productId, kind, "debug-${System.currentTimeMillis()}")
                }
                .setNegativeButton("إلغاء") { _, _ ->
                    fail("أُلغي الدفع. النصيحة بقيت مقفلة.")
                }
                .show()
        }
    }

    private fun debugBuild(): Boolean {
        return activity.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0
    }

    private fun grant(productId: String, kind: String, token: String) {
        deliver(
            JSONObject()
                .put("ok", true)
                .put("productId", productId)
                .put("kind", kind)
                .put("token", token)
                .toString()
        )
    }

    private fun fail(message: String) {
        deliver(JSONObject().put("ok", false).put("message", message).toString())
    }

    companion object {
        const val ONCE = "advice_once"
        const val MONTH = "advice_month"
    }
}
