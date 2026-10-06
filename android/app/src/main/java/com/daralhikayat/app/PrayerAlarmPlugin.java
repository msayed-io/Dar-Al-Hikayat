package com.daralhikayat.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import androidx.core.app.NotificationManagerCompat;
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
    public static final String TAG = "PrayerAlarm";
    private static final String PREFS_NAME = PrayerAlarmReceiver.PREFS_NAME;
    private static final String KEY_ALARMS = PrayerAlarmReceiver.KEY_ALARMS;
    private static final String KEY_NEEDS_RESCHEDULE = "needs_reschedule";

    @Override
    public void load() {
        super.load();
        PrayerAlarmReceiver.ensureNotificationChannel(getContext());
    }

    @PluginMethod
    public void scheduleAlarms(PluginCall pluginCall) {
        JSArray array = pluginCall.getArray("alarms");
        if (array == null) {
            pluginCall.reject("alarms array is required");
            return;
        }
        try {
            AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) {
                pluginCall.reject("AlarmManager not available");
                return;
            }

            // Check if exact alarms can be scheduled
            boolean canExact = true;
            if (Build.VERSION.SDK_INT >= 31) {
                canExact = alarmManager.canScheduleExactAlarms();
            }

            cancelAllAlarmsInternal();

            Context safeContext = PrayerAlarmReceiver.getSafeContext(getContext());
            SharedPreferences.Editor edit = safeContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit();
            edit.putString(KEY_ALARMS, array.toString());
            edit.putBoolean(KEY_NEEDS_RESCHEDULE, false);

            JSObject locObj = pluginCall.getObject("location");
            if (locObj != null) {
                edit.putFloat("latitude", (float) locObj.optDouble("latitude", 0.0));
                edit.putFloat("longitude", (float) locObj.optDouble("longitude", 0.0));
                edit.putString("timezoneId", locObj.optString("timezoneId", "Africa/Cairo"));
            }
            String method = pluginCall.getString("method");
            if (method != null) {
                edit.putString("calculationMethod", method);
            }
            edit.apply();

            // Prime and schedule next alarm via setAlarmClock + rolling window
            PrayerAlarmReceiver.scheduleNextAlarmsFromCache(getContext());

            JSObject res = new JSObject();
            res.put("scheduled", array.length());
            res.put("exact", canExact);
            pluginCall.resolve(res);
        } catch (Exception e) {
            pluginCall.reject("Failed to schedule alarms: " + e.getMessage());
        }
    }

    @PluginMethod
    public void sendImmediateTestNotification(PluginCall pluginCall) {
        try {
            String title = pluginCall.getString("title", "حان الآن وقت صلاة الظهر");
            String body = pluginCall.getString("body", "إنَّ هَذَا وقتٌ تُفْتَحُ فِيهِ أَبْوَابُ السَّمَاءِ.");
            String prayerId = pluginCall.getString("prayerId", "dhuhr");

            Intent intent = new Intent(getContext(), PrayerAlarmReceiver.class);
            intent.setAction(PrayerAlarmReceiver.ACTION_PRAYER_ALARM);
            intent.setData(Uri.parse("prayer://test/" + System.currentTimeMillis()));
            intent.putExtra("id", 88888);
            intent.putExtra("title", title);
            intent.putExtra("body", body);
            intent.putExtra("prayerId", "test_" + prayerId);
            intent.putExtra("type", "exact");

            getContext().sendBroadcast(intent);

            JSObject res = new JSObject();
            res.put("success", true);
            pluginCall.resolve(res);
        } catch (Exception e) {
            pluginCall.reject("Failed to send test notification: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelAllAlarms(PluginCall pluginCall) {
        cancelAllAlarmsInternal();
        Context safeContext = PrayerAlarmReceiver.getSafeContext(getContext());
        safeContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().remove(KEY_ALARMS).apply();
        pluginCall.resolve();
    }

    private void cancelAllAlarmsInternal() {
        try {
            Context safeContext = PrayerAlarmReceiver.getSafeContext(getContext());
            SharedPreferences prefs = safeContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            JSArray array = new JSArray(prefs.getString(KEY_ALARMS, "[]"));
            AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            for (int i = 0; i < array.length(); i++) {
                int id = array.getJSONObject(i).getInt("id");
                Intent intent = new Intent(getContext(), PrayerAlarmReceiver.class);
                intent.setAction(PrayerAlarmReceiver.ACTION_PRAYER_ALARM);
                intent.setData(Uri.parse("prayer://alarm/" + id));

                int pendingFlags = PendingIntent.FLAG_NO_CREATE;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
                }
                PendingIntent broadcast = PendingIntent.getBroadcast(getContext(), id, intent, pendingFlags);
                if (broadcast != null) {
                    alarmManager.cancel(broadcast);
                    broadcast.cancel();
                }
            }
        } catch (Exception ignored) {}
    }

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        boolean isIgnoring = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                isIgnoring = pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
            }
        }
        JSObject ret = new JSObject();
        ret.put("isIgnoring", isIgnoring);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(getContext().getPackageName())) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                }
            } catch (Exception e) {
                try {
                    Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                    fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(fallback);
                } catch (Exception ignored) {}
            }
        }
        call.resolve();
    }

    private boolean notificationsEnabled() {
        boolean runtimeGranted = Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(getContext(), "android.permission.POST_NOTIFICATIONS") == PackageManager.PERMISSION_GRANTED;
        return runtimeGranted && NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
    }

    @PluginMethod
    public void checkNotificationPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", notificationsEnabled());
        // A blocked app toggle (including Android <13) or permanent denial
        // requires Settings; another runtime request cannot display a prompt.
        boolean runtimeMissing = Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(getContext(), "android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED;
        result.put("canRequest", runtimeMissing && getPermissionState("notifications") != PermissionState.DENIED);
        call.resolve(result);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(getContext(), "android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED &&
            getPermissionState("notifications") != PermissionState.DENIED) {
            requestPermissionForAlias("notifications", call, "notificationPermissionCallback");
            return;
        }
        JSObject result = new JSObject();
        result.put("granted", notificationsEnabled());
        call.resolve(result);
    }

    @PermissionCallback
    private void notificationPermissionCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", notificationsEnabled());
        call.resolve(result);
    }

    @PluginMethod
    public void requestExactAlarmPermission(PluginCall pluginCall) {
        if (Build.VERSION.SDK_INT >= 31) {
            AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null && alarmManager.canScheduleExactAlarms()) {
                JSObject jSObject = new JSObject();
                jSObject.put("granted", true);
                pluginCall.resolve(jSObject);
                return;
            }
            try {
                Intent intent = new Intent("android.settings.REQUEST_SCHEDULE_EXACT_ALARM");
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
            } catch (Exception error) {
                pluginCall.reject("Failed to open exact alarm settings: " + error.getMessage());
                return;
            }
            JSObject jSObject2 = new JSObject();
            jSObject2.put("granted", false);
            jSObject2.put("openedSettings", true);
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
        boolean canSchedule = true;
        if (Build.VERSION.SDK_INT >= 31 && ((alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE)) == null || !alarmManager.canScheduleExactAlarms())) {
            canSchedule = false;
        }
        JSObject jSObject = new JSObject();
        jSObject.put("canSchedule", canSchedule);
        pluginCall.resolve(jSObject);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall pluginCall) {
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                intent.setAction("android.settings.APP_NOTIFICATION_SETTINGS");
                intent.putExtra("app_package", getContext().getPackageName());
                intent.putExtra("app_uid", getContext().getApplicationInfo().uid);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            pluginCall.resolve();
        } catch (Exception e) {
            pluginCall.reject("Failed to open notification settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openAppSettings(PluginCall pluginCall) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            pluginCall.resolve();
        } catch (Exception e) {
            pluginCall.reject("Failed to open app settings: " + e.getMessage());
        }
    }
}
