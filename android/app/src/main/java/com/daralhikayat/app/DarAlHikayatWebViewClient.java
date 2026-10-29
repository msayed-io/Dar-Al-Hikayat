package com.daralhikayat.app;

import android.net.Uri;
import android.util.Log;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Privacy-preserving WebView diagnostics for Android devices whose vendor logcat
 * obscures Chromium request URLs. No host path, query string, or request body is logged.
 */
final class DarAlHikayatWebViewClient extends BridgeWebViewClient {
    private static final String TAG = "DarAlHikayat-WebView";
    private final MainActivity activity;

    DarAlHikayatWebViewClient(Bridge bridge, MainActivity activity) {
        super(bridge);
        this.activity = activity;
    }

    @Override
    public void onReceivedHttpError(
        WebView view,
        WebResourceRequest request,
        WebResourceResponse errorResponse
    ) {
        if (errorResponse != null && errorResponse.getStatusCode() >= 400) {
            Log.w(
                TAG,
                "http_error status=" + errorResponse.getStatusCode()
                    + " method=" + (request == null ? "unknown" : request.getMethod())
                    + " mainFrame=" + (request != null && request.isForMainFrame())
                    + " endpoint=" + endpointCategory(request)
            );
        }
        super.onReceivedHttpError(view, request, errorResponse);
    }

    @Override
    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        if (error != null) {
            Log.w(
                TAG,
                "network_error code=" + error.getErrorCode()
                    + " mainFrame=" + (request != null && request.isForMainFrame())
                    + " endpoint=" + endpointCategory(request)
            );
        }
        super.onReceivedError(view, request, error);
    }

    @Override
    public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
        boolean handledByCapacitorListener = super.onRenderProcessGone(view, detail);
        boolean didCrash = detail != null && detail.didCrash();
        int priorityAtExit = detail == null ? -1 : detail.rendererPriorityAtExit();
        Log.e(
            TAG,
            "renderer_gone didCrash=" + didCrash + " priorityAtExit=" + priorityAtExit
        );

        if (!handledByCapacitorListener) {
            activity.recoverFromRendererExit();
        }
        // The dead renderer cannot be reused. Keep the host Activity alive and let it
        // recreate Capacitor's Bridge/WebView rather than leaving an unexplained black screen.
        return true;
    }

    private static String endpointCategory(WebResourceRequest request) {
        if (request == null || request.getUrl() == null) return "unknown";
        Uri uri = request.getUrl();
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
        String path = uri.getPath() == null ? "" : uri.getPath();

        if ("generativelanguage.googleapis.com".equals(host)) {
            if (path.endsWith(":streamGenerateContent")) return "gemini_stream";
            if (path.endsWith(":generateContent")) return "gemini_generate";
            return "google_api";
        }
        if (path.endsWith("/api/gemini/stream")) return "assistant_stream_proxy";
        if (path.endsWith("/api/gemini/generate")) return "assistant_generate_proxy";
        return "other";
    }
}
