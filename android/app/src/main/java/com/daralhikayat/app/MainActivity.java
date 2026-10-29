package com.daralhikayat.app;

import android.os.Bundle;
import android.os.SystemClock;
import android.util.Log;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.os.Build;
import android.webkit.WebView;
import androidx.appcompat.app.AlertDialog;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "DarAlHikayat-WebView";
    private static final String RECOVERY_PREFS = "webview_renderer_recovery";
    private static final String LAST_RECOVERY_KEY = "last_recovery_elapsed_ms";
    private static final long RECOVERY_COOLDOWN_MS = 30_000L;
    private boolean rendererRecoveryScheduled;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(SystemTimePlugin.class);
        registerPlugin(LogoManagerPlugin.class);
        registerPlugin(PrayerAlarmPlugin.class);
        registerPlugin(DownloadNotificationPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(RemoteServerPlugin.class);
        registerPlugin(CameraPermissionPlugin.class);
        super.onCreate(savedInstanceState);

        // Eliminate the default white WebView surface completely at root
        try {
            Bridge bridge = getBridge();
            if (bridge != null && bridge.getWebView() != null) {
                bridge.getWebView().setBackgroundColor(0xFF0F1617);
                bridge.getWebView().setVerticalScrollBarEnabled(false);
                bridge.getWebView().setHorizontalScrollBarEnabled(false);
                installWebViewDiagnostics(bridge);
            }
        } catch (Exception error) {
            Log.e(TAG, "webview_diagnostics_install_failed", error);
        }

        hideSystemBars();
    }

    private void installWebViewDiagnostics(Bridge bridge) {
        bridge.setWebViewClient(new DarAlHikayatWebViewClient(bridge, this));
        bridge.getWebView().setWebChromeClient(new DarAlHikayatWebChromeClient(bridge));
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageStarted(WebView webView) {
                Log.i(TAG, "webview_page_started");
            }

            @Override
            public void onPageLoaded(WebView webView) {
                Log.i(TAG, "webview_page_loaded");
            }
        });
        Log.i(TAG, "webview_diagnostics_installed");
    }

    boolean recoverFromRendererExit() {
        if (rendererRecoveryScheduled) return true;

        long now = SystemClock.elapsedRealtime();
        long previous = getSharedPreferences(RECOVERY_PREFS, MODE_PRIVATE)
            .getLong(LAST_RECOVERY_KEY, -1L);

        if (previous >= 0L && now >= previous && now - previous < RECOVERY_COOLDOWN_MS) {
            Log.e(TAG, "renderer_recovery_throttled within=" + (now - previous) + "ms");
            showRendererRecoveryDialog();
            return false;
        }

        getSharedPreferences(RECOVERY_PREFS, MODE_PRIVATE)
            .edit()
            .putLong(LAST_RECOVERY_KEY, now)
            .apply();
        rendererRecoveryScheduled = true;
        Log.w(TAG, "renderer_recovery_recreate_activity");

        getWindow().getDecorView().postDelayed(() -> {
            if (!isFinishing() && !isDestroyed()) {
                recreate();
            }
        }, 100L);
        return true;
    }

    private void showRendererRecoveryDialog() {
        getWindow().getDecorView().post(() -> {
            if (isFinishing() || isDestroyed()) return;
            try {
                new AlertDialog.Builder(this)
                    .setTitle("تعذّر عرض الصفحة")
                    .setMessage("توقفت عملية العرض داخل التطبيق. أعد المحاولة لإعادة فتح الصفحة، وقد لا تُستعاد تغييرات لم تُحفظ.")
                    .setCancelable(false)
                    .setPositiveButton("إعادة المحاولة", (dialog, which) -> {
                        getSharedPreferences(RECOVERY_PREFS, MODE_PRIVATE)
                            .edit()
                            .remove(LAST_RECOVERY_KEY)
                            .apply();
                        recreate();
                    })
                    .setNegativeButton("إغلاق التطبيق", (dialog, which) -> finish())
                    .show();
            } catch (Exception error) {
                Log.e(TAG, "renderer_recovery_dialog_failed", error);
                finish();
            }
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
        }
    }

    private void hideSystemBars() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // Android 11+ (API 30+)
                WindowInsetsController controller = getWindow().getInsetsController();
                if (controller != null) {
                    controller.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                    controller.setSystemBarsBehavior(
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    );
                }
            } else {
                // Android 7-10 (API 24-29)
                WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(
                    getWindow(), getWindow().getDecorView()
                );
                if (controller != null) {
                    controller.hide(WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.navigationBars());
                    controller.setSystemBarsBehavior(
                        WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                    );
                }
                // Legacy system UI flags fallback
                View decorView = getWindow().getDecorView();
                int uiOptions = View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
                decorView.setSystemUiVisibility(uiOptions);
            }
        } catch (Exception e) {
            // silently ignore
        }
    }
}
