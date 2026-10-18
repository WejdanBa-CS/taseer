package sa.taseer.app

import android.app.Activity
import android.view.View
import android.widget.FrameLayout
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.MobileAds

private const val TEST_BANNER = "ca-app-pub-3940256099942544/6300978111"

fun createAdBanner(activity: Activity, holder: FrameLayout): AdBanner {
    return object : AdBanner {
        private var adView: AdView? = null

        override fun setVisible(show: Boolean): Boolean {
            activity.runOnUiThread {
                holder.visibility = if (show) View.VISIBLE else View.GONE
                if (show && adView == null) {
                    MobileAds.initialize(activity)
                    val view = AdView(activity)
                    view.adUnitId = TEST_BANNER
                    view.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(activity, 360))
                    holder.addView(view, FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.WRAP_CONTENT
                    ))
                    view.loadAd(AdRequest.Builder().build())
                    adView = view
                }
            }
            return true
        }

        override fun destroy() {
            adView?.destroy()
            adView = null
        }
    }
}
