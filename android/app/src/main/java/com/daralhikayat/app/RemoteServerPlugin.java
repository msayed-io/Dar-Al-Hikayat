package com.daralhikayat.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

@CapacitorPlugin(name = "RemoteServer")
public class RemoteServerPlugin extends Plugin {

    private LocalHttpServer httpServer;

    private void ensureServer() {
        if (httpServer != null) {
            return;
        }
        httpServer = new LocalHttpServer(8080);
        httpServer.setOnCommandReceivedListener((action, params) -> {
            JSObject ret = new JSObject();
            ret.put("action", action);
            for (Map.Entry<String, String> entry : params.entrySet()) {
                ret.put(entry.getKey(), entry.getValue());
            }
            notifyListeners("remoteCommand", ret, true);
            return kotlin.Unit.INSTANCE;
        });
    }

    @Override
    public void load() {
        super.load();
        try {
            ensureServer();
            httpServer.start();
        } catch (Exception e) {
            android.util.Log.e("RemoteServerPlugin", "Native server failed to start", e);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (httpServer != null) {
            httpServer.stop();
        }
        super.handleOnDestroy();
    }

    @PluginMethod
    public void getLocalIpAddress(PluginCall call) {
        try {
            ensureServer();
            if (!httpServer.isServerRunning()) {
                httpServer.start();
            }

            String primaryIp = httpServer.getLocalIpAddress();
            JSArray ipsArray = new JSArray();
            ipsArray.put(primaryIp);

            JSObject result = new JSObject();
            result.put("ips", ipsArray);
            result.put("primaryIp", primaryIp);
            result.put("port", 8080);
            result.put("connectionUrl", "http://" + primaryIp + ":8080/");
            result.put("isNativeServerRunning", httpServer.isServerRunning());
            if (!httpServer.isServerRunning()) {
                call.reject("Native LocalHttpServer is not ready");
                return;
            }
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to get local IPv4 address", e);
        }
    }

    /** Prepare the sender session directly in the native server memory. */
    @PluginMethod
    public void prepareTransfer(PluginCall call) {
        try {
            ensureServer();
            if (!httpServer.isServerRunning()) {
                httpServer.start();
            }
            String pin = call.getString("pin", "");
            String storiesJson = call.getString("storiesJson", "");
            int count = httpServer.prepareTransferSession(pin, storiesJson);

            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("count", count);
            result.put("port", 8080);
            result.put("ip", httpServer.getLocalIpAddress());
            call.resolve(result);
        } catch (Exception e) {
            android.util.Log.e("RemoteServerPlugin", "Native transfer preparation failed", e);
            call.reject("Failed to prepare native transfer session", e);
        }
    }

    /** Fetch the sender payload natively; WebView fetch is not reliable for LAN HTTP. */
    @PluginMethod
    public void fetchTransfer(PluginCall call) {
        String url = call.getString("url", "");
        try {
            HttpURLConnection connection = openTransferConnection(url, "GET");
            int status = connection.getResponseCode();
            String body = readConnectionBody(connection, status);
            connection.disconnect();
            if (status < 200 || status >= 300) {
                call.reject("تعذر الاتصال بالجهاز المرسل (HTTP " + status + ")");
                return;
            }
            org.json.JSONArray stories = new org.json.JSONArray(body);
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("storiesJson", stories.toString());
            result.put("count", stories.length());
            call.resolve(result);
        } catch (Exception e) {
            android.util.Log.e("RemoteServerPlugin", "Native transfer fetch failed for " + url, e);
            call.reject("تعذر الوصول إلى الجهاز المرسل عبر الشبكة المحلية: " + e.getMessage(), e);
        }
    }

    /** Confirm completion natively so the receiver has no WebView LAN dependency. */
    @PluginMethod
    public void completeTransfer(PluginCall call) {
        String url = call.getString("url", "");
        String pin = call.getString("pin", "");
        try {
            HttpURLConnection connection = openTransferConnection(url, "POST");
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setDoOutput(true);
            byte[] payload = ("{\"pin\":\"" + pin.replace("\\", "\\\\").replace("\"", "\\\"") + "\"}").getBytes(java.nio.charset.StandardCharsets.UTF_8);
            try (OutputStream output = connection.getOutputStream()) {
                output.write(payload);
            }
            int status = connection.getResponseCode();
            String body = readConnectionBody(connection, status);
            connection.disconnect();
            if (status < 200 || status >= 300) {
                call.reject("تعذر تأكيد اكتمال النقل (HTTP " + status + ")");
                return;
            }
            JSObject result = new JSObject(body);
            if (!result.optBoolean("ok", false)) {
                call.reject("رفض الجهاز المرسل تأكيد اكتمال النقل");
                return;
            }
            call.resolve(result);
        } catch (Exception e) {
            android.util.Log.e("RemoteServerPlugin", "Native transfer completion failed for " + url, e);
            call.reject("تعذر تأكيد النقل عبر الشبكة المحلية: " + e.getMessage(), e);
        }
    }

    /** Read sender transfer status natively so the export UI can change state on Android. */
    @PluginMethod
    public void getTransferStatus(PluginCall call) {
        String url = call.getString("url", "");
        try {
            HttpURLConnection connection = openTransferConnection(url, "GET");
            int status = connection.getResponseCode();
            String body = readConnectionBody(connection, status);
            connection.disconnect();
            if (status < 200 || status >= 300) {
                call.reject("تعذر قراءة حالة النقل (HTTP " + status + ")");
                return;
            }
            call.resolve(new JSObject(body));
        } catch (Exception e) {
            android.util.Log.d("RemoteServerPlugin", "Transfer status check unavailable: " + e.getMessage());
            call.reject("تعذر قراءة حالة النقل: " + e.getMessage(), e);
        }
    }

    private HttpURLConnection openTransferConnection(String targetUrl, String method) throws Exception {
        if (targetUrl == null || !(targetUrl.startsWith("http://") || targetUrl.startsWith("https://"))) {
            throw new IllegalArgumentException("عنوان النقل غير صالح");
        }
        HttpURLConnection connection = (HttpURLConnection) new URL(targetUrl).openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(20000);
        connection.setUseCaches(false);
        connection.setRequestProperty("Accept", "application/json");
        return connection;
    }

    private String readConnectionBody(HttpURLConnection connection, int status) throws Exception {
        InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
        if (stream == null) return "";
        StringBuilder body = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, java.nio.charset.StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) body.append(line);
        }
        return body.toString();
    }

    @PluginMethod
    public void startServer(PluginCall call) {
        try {
            ensureServer();
            if (!httpServer.isServerRunning()) {
                httpServer.start();
            }
            JSObject ret = new JSObject();
            ret.put("running", true);
            ret.put("port", 8080);
            ret.put("ip", httpServer.getLocalIpAddress());
            if (!httpServer.isServerRunning()) {
                call.reject("Native LocalHttpServer is not ready");
                return;
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to start native LocalHttpServer", e);
        }
    }

    @PluginMethod
    public void stopServer(PluginCall call) {
        try {
            if (httpServer != null) {
                httpServer.stop();
            }
            JSObject ret = new JSObject();
            ret.put("running", false);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to stop native LocalHttpServer", e);
        }
    }

    /**
     * Hides the tablet's own soft keyboard. Called by the web layer while the
     * wireless Story Keyboard is paired, so typing from the phone never summons
     * the tablet IME. It is a no-op when nothing is focused.
     */
    @PluginMethod
    public void hideKeyboard(PluginCall call) {
        try {
            android.app.Activity activity = getActivity();
            if (activity != null) {
                activity.runOnUiThread(() -> {
                    try {
                        android.view.View webView = getBridge().getWebView();
                        android.view.inputmethod.InputMethodManager imm =
                                (android.view.inputmethod.InputMethodManager)
                                        activity.getSystemService(android.content.Context.INPUT_METHOD_SERVICE);
                        if (imm != null && webView != null) {
                            imm.hideSoftInputFromWindow(webView.getWindowToken(), 0);
                        }
                    } catch (Exception inner) {
                        android.util.Log.w("RemoteServerPlugin", "hideKeyboard failed: " + inner.getMessage());
                    }
                });
            }
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to hide soft keyboard", e);
        }
    }

    /**
     * Writes to the tablet's clipboard from the NATIVE layer.
     *
     * While the writer drives the tablet from the phone, the tablet WebView has
     * no focus and no user activation, so `navigator.clipboard.writeText()` is
     * rejected and `document.execCommand("copy")` is blocked for synthetic
     * events — that is exactly why the remote «نسخ» did nothing on the device.
     * The Android clipboard has no such restriction.
     */
    @PluginMethod
    public void setClipboard(PluginCall call) {
        final String text = call.getString("text", "");
        try {
            android.app.Activity activity = getActivity();
            if (activity == null) {
                call.reject("No activity to write the clipboard from");
                return;
            }
            activity.runOnUiThread(() -> {
                try {
                    android.content.ClipboardManager manager =
                            (android.content.ClipboardManager) activity.getSystemService(
                                    android.content.Context.CLIPBOARD_SERVICE);
                    if (manager != null) {
                        manager.setPrimaryClip(
                                android.content.ClipData.newPlainText("دار الحكايات", text));
                    }
                } catch (Exception inner) {
                    android.util.Log.w("RemoteServerPlugin", "setClipboard failed: " + inner.getMessage());
                }
            });
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to write the clipboard", e);
        }
    }

    /** Reads the tablet's clipboard natively (used by "محفظة التابلت" paste). */
    @PluginMethod
    public void getClipboard(PluginCall call) {
        try {
            android.app.Activity activity = getActivity();
            if (activity == null) {
                call.reject("No activity to read the clipboard from");
                return;
            }
            activity.runOnUiThread(() -> {
                String text = "";
                try {
                    android.content.ClipboardManager manager =
                            (android.content.ClipboardManager) activity.getSystemService(
                                    android.content.Context.CLIPBOARD_SERVICE);
                    if (manager != null && manager.hasPrimaryClip()
                            && manager.getPrimaryClip() != null
                            && manager.getPrimaryClip().getItemCount() > 0) {
                        CharSequence value =
                                manager.getPrimaryClip().getItemAt(0).coerceToText(activity);
                        text = value != null ? value.toString() : "";
                    }
                } catch (Exception inner) {
                    android.util.Log.w("RemoteServerPlugin", "getClipboard failed: " + inner.getMessage());
                }
                JSObject ret = new JSObject();
                ret.put("text", text);
                call.resolve(ret);
            });
        } catch (Exception e) {
            call.reject("Failed to read the clipboard", e);
        }
    }

    @PluginMethod
    public void updateSession(PluginCall call) {
        try {
            String pin = call.getString("pin", "");
            boolean connected = Boolean.TRUE.equals(call.getBoolean("connected", false));
            if (httpServer != null) {
                httpServer.setActiveSessionPin(pin);
                httpServer.setSessionConnected(connected);
            }
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to update session pin", e);
        }
    }
}
