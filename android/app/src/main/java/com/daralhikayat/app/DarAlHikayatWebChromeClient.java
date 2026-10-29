package com.daralhikayat.app;

import android.net.Uri;
import android.util.Log;
import android.webkit.ConsoleMessage;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebChromeClient;

/** Logs JavaScript error category and location without message text or user content. */
final class DarAlHikayatWebChromeClient extends BridgeWebChromeClient {
    private static final String TAG = "DarAlHikayat-WebView";

    DarAlHikayatWebChromeClient(Bridge bridge) {
        super(bridge);
    }

    @Override
    public boolean onConsoleMessage(ConsoleMessage message) {
        if (message != null && message.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
            Log.e(
                TAG,
                "js_console_error type=" + errorType(message.message())
                    + " source=" + safeSourceCategory(message.sourceId())
                    + " line=" + message.lineNumber()
            );
        }
        // Do not call the superclass here: Capacitor logs full console text/source URLs,
        // which could contain user data or query parameters in non-release builds.
        return true;
    }

    private static String errorType(String text) {
        if (text == null || text.isEmpty()) return "unknown";
        String[] types = {
            "TypeError", "ReferenceError", "SyntaxError", "RangeError", "URIError", "EvalError"
        };
        for (String type : types) {
            if (text.contains(type)) return type;
        }
        return text.contains("Error") ? "Error" : "console_error";
    }

    private static String safeSourceCategory(String source) {
        if (source == null || source.isEmpty()) return "unknown";
        try {
            String path = Uri.parse(source).getPath();
            return path != null && path.contains("/assets/") ? "app_bundle" : "other";
        } catch (Exception ignored) {
            return "other";
        }
    }
}
