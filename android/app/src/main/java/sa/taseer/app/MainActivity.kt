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
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var handlingBack = false

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
            allowFileAccess = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            textZoom = (resources.configuration.fontScale * 100).toInt().coerceIn(80, 160)
        }
        webView.addJavascriptInterface(ExternalLinks(this), "TaseerAndroid")
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
        }

        val restored = savedInstanceState?.let { webView.restoreState(it) } != null
        if (!restored) {
            webView.loadUrl(ASSET_URL)
        }

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

    private class ExternalLinks(private val activity: MainActivity) {
        @JavascriptInterface
        fun open(url: String) {
            val uri = Uri.parse(url)
            activity.runOnUiThread { activity.openExternal(uri) }
        }
    }

    companion object {
        private const val ASSET_URL = "file:///android_asset/www/index.html"
    }
}
