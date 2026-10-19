package com.daralhikayat.app;

import android.content.pm.PackageManager;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = CameraPermissionPlugin.TAG,
    permissions = {
        @Permission(alias = "camera", strings = { "android.permission.CAMERA" })
    }
)
public class CameraPermissionPlugin extends Plugin {
    public static final String TAG = "CameraPermission";

    private boolean isCameraGranted() {
        return ContextCompat.checkSelfPermission(
            getContext(),
            "android.permission.CAMERA"
        ) == PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod
    public void checkCameraPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", isCameraGranted());
        result.put("canRequest", !isCameraGranted() && getPermissionState("camera") != PermissionState.DENIED);
        call.resolve(result);
    }

    @PluginMethod
    public void requestCameraPermission(PluginCall call) {
        if (isCameraGranted()) {
            resolvePermission(call);
            return;
        }

        if (getPermissionState("camera") == PermissionState.DENIED) {
            resolvePermission(call);
            return;
        }

        requestPermissionForAlias("camera", call, "cameraPermissionCallback");
    }

    @PermissionCallback
    private void cameraPermissionCallback(PluginCall call) {
        resolvePermission(call);
    }

    private void resolvePermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", isCameraGranted());
        call.resolve(result);
    }
}
