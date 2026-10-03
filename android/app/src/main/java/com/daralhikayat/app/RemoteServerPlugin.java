package com.daralhikayat.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Map;

@CapacitorPlugin(name = "RemoteServer")
public class RemoteServerPlugin extends Plugin {

    private LocalHttpServer httpServer;

    @Override
    public void load() {
        super.load();
        try {
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
            httpServer.start();
        } catch (Exception e) {
            e.printStackTrace();
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
            if (httpServer == null) {
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
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to get local IPv4 address", e);
        }
    }

    @PluginMethod
    public void startServer(PluginCall call) {
        try {
            if (httpServer == null) {
                httpServer = new LocalHttpServer(8080);
            }
            if (!httpServer.isServerRunning()) {
                httpServer.start();
            }
            JSObject ret = new JSObject();
            ret.put("running", true);
            ret.put("port", 8080);
            ret.put("ip", httpServer.getLocalIpAddress());
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
