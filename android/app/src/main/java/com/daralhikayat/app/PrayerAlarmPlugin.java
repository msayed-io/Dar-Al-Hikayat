package com.daralhikayat.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.aparajita.capacitor.biometricauth.BiometricAuthNative;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = PrayerAlarmPlugin.TAG, permissions = {@Permission(alias = "notifications", strings = {"android.permission.POST_NOTIFICATIONS"})})

public class PrayerAlarmPlugin extends Plugin {
    private static final String CHANNEL_ID = "prayer_reminders";
    private static final String CHANNEL_NAME = "تذكيرات الصلاة";
    private static final String KEY_ALARMS = "scheduled_alarms";
    private static final String KEY_NEEDS_RESCHEDULE = "needs_reschedule";
    private static final String PREFS_NAME = "dar_prayer_alarms";
    public static final String TAG = "PrayerAlarm";

    @Override
    public void load() {
        super.load();
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel notificationChannel = new NotificationChannel(CHANNEL_ID, CHANNEL_NAME, 4);
            notificationChannel.setVibrationPattern(new long[]{0, 400, 200, 600});
            notificationChannel.enableVibration(true);
            notificationChannel.setSound(null, null);
            notificationChannel.setLockscreenVisibility(1);
            notificationChannel.enableLights(true);
            notificationChannel.setLightColor(-5789085);
            notificationChannel.setDescription("تذكيرات مواقيت الصلاة مع اهتزاز هادئ");
            NotificationManager notificationManager = (NotificationManager) getContext().getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(notificationChannel);
            }
        }
    }

    @PluginMethod
    public void scheduleAlarms(PluginCall pluginCall) {
        JSArray array = pluginCall.getArray("alarms");
        if (array == null) {
            pluginCall.reject("alarms array is required");
            return;
        }
        try {
            AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(NotificationCompat.CATEGORY_ALARM);
            if (alarmManager == null) {
                pluginCall.reject("AlarmManager not available");
                return;
            }
            SharedPreferences.Editor edit = getContext().getSharedPreferences(PREFS_NAME, 0).edit();
            edit.putString(KEY_ALARMS, array.toString());
            edit.putBoolean(KEY_NEEDS_RESCHEDULE, false);
            edit.apply();
            cancelAllAlarmsInternal();
            int i = 0;
            for (int i2 = 0; i2 < array.length(); i2++) {
                JSONObject jSONObject = array.getJSONObject(i2);
                long j = jSONObject.getLong("timestamp");
                int i3 = jSONObject.getInt("id");
                String string = jSONObject.getString("title");
                String string2 = jSONObject.getString("body");
                String string3 = jSONObject.getString("prayerId");
                String string4 = jSONObject.getString(BiometricAuthNative.RESULT_TYPE);
                if (j > System.currentTimeMillis()) {
                    scheduleSingleAlarm(alarmManager, j, i3, string, string2, string3, string4);
                    i++;
                }
            }
            JSObject jSObject = new JSObject();
            jSObject.put("scheduled", i);
            pluginCall.resolve(jSObject);
        } catch (JSONException e) {
            pluginCall.reject("Failed to parse alarms: " + e.getMessage());
        }
    }

    private void scheduleSingleAlarm(AlarmManager alarmManager, long j, int i, String str, String str2, String str3, String str4) {
        Intent intent = new Intent(getContext(), (Class<?>) PrayerAlarmReceiver.class);
        intent.setAction("com.daralhikayat.app.PRAYER_ALARM");
        intent.putExtra("id", i);
        intent.putExtra("title", str);
        intent.putExtra("body", str2);
        intent.putExtra("prayerId", str3);
        intent.putExtra(BiometricAuthNative.RESULT_TYPE, str4);
        intent.putExtra("timestamp", j);
        PendingIntent broadcast = PendingIntent.getBroadcast(getContext(), i, intent, 201326592);
        try {
            try {
                alarmManager.setExactAndAllowWhileIdle(0, j, broadcast);
            } catch (Exception unused) {
            }
        } catch (SecurityException unused2) {
            alarmManager.set(0, j, broadcast);
        }
    }

    @PluginMethod
    public void cancelAllAlarms(PluginCall pluginCall) {
        cancelAllAlarmsInternal();
        getContext().getSharedPreferences(PREFS_NAME, 0).edit().remove(KEY_ALARMS).apply();
        pluginCall.resolve();
    }

    private void cancelAllAlarmsInternal() {
        try {
            JSArray jSArray = new JSArray(getContext().getSharedPreferences(PREFS_NAME, 0).getString(KEY_ALARMS, "[]"));
            AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(NotificationCompat.CATEGORY_ALARM);
            if (alarmManager == null) {
                return;
            }
            for (int i = 0; i < jSArray.length(); i++) {
                int i2 = jSArray.getJSONObject(i).getInt("id");
                Intent intent = new Intent(getContext(), (Class<?>) PrayerAlarmReceiver.class);
                intent.setAction("com.daralhikayat.app.PRAYER_ALARM");
                PendingIntent broadcast = PendingIntent.getBroadcast(getContext(), i2, intent, 603979776);
                if (broadcast != null) {
                    alarmManager.cancel(broadcast);
                }
            }
        } catch (Exception unused) {
        }
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall pluginCall) {
        if (Build.VERSION.SDK_INT >= 33) {
            if (ContextCompat.checkSelfPermission(getContext(), "android.permission.POST_NOTIFICATIONS") == 0) {
                JSObject jSObject = new JSObject();
                jSObject.put("granted", true);
                pluginCall.resolve(jSObject);
                return;
            }
            requestPermissionForAlias("notifications", pluginCall, "notificationPermissionCallback");
            return;
        }
        JSObject jSObject2 = new JSObject();
        jSObject2.put("granted", true);
        pluginCall.resolve(jSObject2);
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall pluginCall) {
        boolean z = getPermissionState("notifications") == PermissionState.GRANTED;
        JSObject jSObject = new JSObject();
        jSObject.put("granted", z);
        pluginCall.resolve(jSObject);
    }

    @PluginMethod
    public void requestExactAlarmPermission(PluginCall pluginCall) {
        if (Build.VERSION.SDK_INT >= 31) {
            AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(NotificationCompat.CATEGORY_ALARM);
            if (alarmManager != null && alarmManager.canScheduleExactAlarms()) {
                JSObject jSObject = new JSObject();
                jSObject.put("granted", true);
                pluginCall.resolve(jSObject);
                return;
            }
            try {
                Intent intent = new Intent("android.settings.REQUEST_SCHEDULE_EXACT_ALARM");
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(268435456);
                getContext().startActivity(intent);
            } catch (Exception unused) {
            }
            JSObject jSObject2 = new JSObject();
            jSObject2.put("granted", false);
            pluginCall.resolve(jSObject2);
            return;
        }
        JSObject jSObject3 = new JSObject();
        jSObject3.put("granted", true);
        pluginCall.resolve(jSObject3);
    }

    @PluginMethod
    public void canScheduleExactAlarms(PluginCall pluginCall) {
        AlarmManager alarmManager;
        boolean z = true;
        if (Build.VERSION.SDK_INT >= 31 && ((alarmManager = (AlarmManager) getContext().getSystemService(NotificationCompat.CATEGORY_ALARM)) == null || !alarmManager.canScheduleExactAlarms())) {
            z = false;
        }
        JSObject jSObject = new JSObject();
        jSObject.put("canSchedule", z);
        pluginCall.resolve(jSObject);
    }
}
