package sa.taseer.app

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var billing: BillingGate
    private lateinit var ads: AdBanner
    private var handlingBack = false
    private var pageReady = false
    private val pendingPayloads = mutableListOf<String>()

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        if ((applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true)
        }

        webView = findViewById(R.id.web)
        webView.setBackgroundColor(Color.parseColor("#F4EFE6"))
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            // نحمّل الأصول من android_asset فقط — لا نفتح ملفات الجهاز.
            allowFileAccess = false
            allowContentAccess = false
            @Suppress("DEPRECATION")
            allowFileAccessFromFileURLs = false
            @Suppress("DEPRECATION")
            allowUniversalAccessFromFileURLs = false
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            textZoom = (resources.configuration.fontScale * 100).toInt().coerceIn(80, 160)
        }
        billing = BillingGate(this, ::deliverPurchase)
        ads = createAdBanner(this, findViewById<FrameLayout>(R.id.ad_holder))
        webView.addJavascriptInterface(Bridge(this), "TaseerAndroid")
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (!request.isForMainFrame) return false
                val scheme = request.url.scheme ?: return false
                if (scheme == "http" || scheme == "https") {
                    openExternal(request.url)
                    return true
                }
                return false
            }

            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                pageReady = false
            }

            override fun onPageFinished(view: WebView, url: String) {
                flushPayloads()
            }
        }

        val restored = savedInstanceState?.let { webView.restoreState(it) } != null
        if (!restored) {
            webView.loadUrl(ASSET_URL)
        }
        billing.start()

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (handlingBack) return
                    handlingBack = true
                    webView.evaluateJavascript(
                        "(function(){return !!(window.taseerGoBack && window.taseerGoBack());})()"
                    ) { raw ->
                        handlingBack = false
                        if (raw != "true") {
                            isEnabled = false
                            onBackPressedDispatcher.onBackPressed()
                        }
                    }
                }
            }
        )
    }

    override fun onResume() {
        super.onResume()
        if (::billing.isInitialized) billing.refreshOwned()
    }

    override fun onDestroy() {
        if (::ads.isInitialized) ads.destroy()
        if (::billing.isInitialized) billing.end()
        super.onDestroy()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    private fun openExternal(uri: Uri) {
        val scheme = uri.scheme ?: return
        if (scheme != "http" && scheme != "https") return
        try {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: ActivityNotFoundException) {
            // الجهاز ما فيه متصفح يستقبل الرابط
        }
    }

    private fun deliverPurchase(json: String) {
        webView.post {
            if (!pageReady) {
                pendingPayloads.add(json)
                return@post
            }
            dispatchPurchase(json)
        }
    }

    private fun flushPayloads() {
        pageReady = true
        val queued = pendingPayloads.toList()
        pendingPayloads.clear()
        queued.forEach(::dispatchPurchase)
    }

    private fun dispatchPurchase(json: String) {
        val quoted = JSONObject.quote(json)
        webView.evaluateJavascript("window.taseerOnPurchase && window.taseerOnPurchase($quoted)", null)
    }

    private class Bridge(private val activity: MainActivity) {
        @JavascriptInterface
        fun open(url: String) {
            val uri = Uri.parse(url.trim())
            val scheme = uri.scheme?.lowercase() ?: return
            if (scheme != "http" && scheme != "https") return
            activity.runOnUiThread { activity.openExternal(uri) }
        }

        @JavascriptInterface
        fun purchase(productId: String) {
            val id = productId.trim()
            if (id != BillingGate.ONCE && id != BillingGate.MONTH) return
            activity.runOnUiThread { activity.billing.purchase(id) }
        }

        @JavascriptInterface
        fun setAdsVisible(show: Boolean): Boolean = activity.ads.setVisible(show)
    }

    companion object {
        private const val ASSET_URL = "file:///android_asset/www/index.html"
    }
}
