package sa.taseer.app

import android.app.Activity
import android.widget.FrameLayout

fun createAdBanner(activity: Activity, holder: FrameLayout): AdBanner {
    return object : AdBanner {
        override fun setVisible(show: Boolean): Boolean = false
        override fun destroy() = Unit
    }
}
