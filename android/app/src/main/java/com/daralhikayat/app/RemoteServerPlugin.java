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
