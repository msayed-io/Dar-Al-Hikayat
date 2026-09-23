package com.daralhikayat.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Date;
import java.util.TimeZone;

@CapacitorPlugin(name = "SystemTime")

public class SystemTimePlugin extends Plugin {
    @PluginMethod
    public void getTimeInfo(PluginCall pluginCall) {
        try {
            TimeZone timeZone = TimeZone.getDefault();
            long currentTimeMillis = System.currentTimeMillis();
            int i = -(timeZone.getOffset(currentTimeMillis) / 60000);
            JSObject jSObject = new JSObject();
            jSObject.put("timestamp", currentTimeMillis);
            jSObject.put("timezoneOffset", i);
            jSObject.put("timezoneId", timeZone.getID());
            jSObject.put("dst", timeZone.inDaylightTime(new Date(currentTimeMillis)));
            pluginCall.resolve(jSObject);
        } catch (Exception e) {
            pluginCall.reject("Failed to get system time info", e);
        }
    }
}
