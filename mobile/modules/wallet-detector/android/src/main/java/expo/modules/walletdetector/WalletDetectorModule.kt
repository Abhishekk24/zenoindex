package expo.modules.walletdetector

import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.Drawable
import android.net.Uri
import android.os.Build
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream

/**
 * Finds the wallet apps on this phone: every app that opens WalletConnect
 * (`wc:`) links, with its name, icon, and whether it is the phone's default
 * for them. Visible because the manifest declares the `wc` scheme in
 * <queries> (plugins/withWalletQueries.js). Also opens a link in one
 * specific app, and brings an app to the front.
 */
class WalletDetectorModule : Module() {
  private val packageManager: PackageManager
    get() = requireNotNull(appContext.reactContext) { "React context unavailable" }
      .packageManager

  override fun definition() = ModuleDefinition {
    Name("WalletDetector")

    AsyncFunction("walletApps") {
      val pm = packageManager
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(SAMPLE_WC_LINK))
      val handlers: List<ResolveInfo> =
        if (Build.VERSION.SDK_INT >= 33) {
          pm.queryIntentActivities(
            intent,
            PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_ALL.toLong()),
          )
        } else {
          @Suppress("DEPRECATION")
          pm.queryIntentActivities(intent, PackageManager.MATCH_ALL)
        }
      // With no default chosen, Android resolves to its own chooser ("android").
      @Suppress("DEPRECATION")
      val preferred = pm.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
        ?.activityInfo?.packageName
      val ownPackage = appContext.reactContext?.packageName

      handlers
        .map { it.activityInfo.packageName to it }
        .filter { (pkg, _) -> pkg != ownPackage }
        .distinctBy { (pkg, _) -> pkg }
        .map { (pkg, info) ->
          mapOf(
            "packageName" to pkg,
            "label" to info.loadLabel(pm).toString(),
            "icon" to iconDataUri(info.loadIcon(pm)),
            "isDefault" to (pkg == preferred),
          )
        }
    }

    // Opens `url` in that app only (no chooser).
    AsyncFunction("openIn") { url: String, packageName: String ->
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        .setPackage(packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      requireNotNull(appContext.reactContext).startActivity(intent)
    }

    // Brings the app to the front (its launcher activity).
    AsyncFunction("launch") { packageName: String ->
      val intent = packageManager.getLaunchIntentForPackage(packageName)
        ?: throw IllegalStateException("$packageName can't be opened")
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      requireNotNull(appContext.reactContext).startActivity(intent)
    }
  }

  /** A launcher icon as a PNG data URI, small enough to pass to JS. */
  private fun iconDataUri(drawable: Drawable): String {
    val size = ICON_SIZE_PX
    val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    drawable.setBounds(0, 0, size, size)
    drawable.draw(canvas)
    val bytes = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.PNG, 100, bytes)
    bitmap.recycle()
    return "data:image/png;base64," +
      Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP)
  }

  companion object {
    /** Any well-formed WalletConnect link; only its scheme matters here. */
    private const val SAMPLE_WC_LINK = "wc:00@2?relay-protocol=irn&symKey=00"
    private const val ICON_SIZE_PX = 96
  }
}
