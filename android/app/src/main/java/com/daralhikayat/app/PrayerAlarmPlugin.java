package com.daralhikayat.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.ContextCompat;
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
    private static final String KEY_ALARMS = "scheduled_alarms";
    private static final String KEY_NEEDS_RESCHEDULE = "needs_reschedule";
    private static final String PREFS_NAME = "dar_prayer_alarms";

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

            cancelAllAlarmsInternal();

            SharedPreferences.Editor edit = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit();
            edit.putString(KEY_ALARMS, array.toString());
            edit.putBoolean(KEY_NEEDS_RESCHEDULE, false);
            edit.apply();

            long now = System.currentTimeMillis();
            int scheduledCount = 0;

            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                long timestamp = obj.getLong("timestamp");
                int id = obj.getInt("id");
                String title = obj.getString("title");
                String body = obj.getString("body");
                String prayerId = obj.getString("prayerId");
                String type = obj.optString("type", "exact");

                if (timestamp > now) {
                    scheduleSingleAlarm(alarmManager, timestamp, id, title, body, prayerId, type);
                    scheduledCount++;
                }
            }

            JSObject res = new JSObject();
            res.put("scheduled", scheduledCount);
            pluginCall.resolve(res);
        } catch (JSONException e) {
            pluginCall.reject("Failed to parse alarms: " + e.getMessage());
        }
    }

    private void scheduleSingleAlarm(AlarmManager alarmManager, long timestamp, int id, String title, String body, String prayerId, String type) {
        Intent intent = new Intent(getContext(), PrayerAlarmReceiver.class);
        intent.setAction("com.daralhikayat.app.PRAYER_ALARM");
        intent.putExtra("id", id);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        intent.putExtra("prayerId", prayerId);
        intent.putExtra("type", type);
        intent.putExtra("timestamp", timestamp);

        int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent broadcast = PendingIntent.getBroadcast(getContext(), id, intent, pendingFlags);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, broadcast);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, timestamp, broadcast);
            }
        } catch (SecurityException se) {
            alarmManager.set(AlarmManager.RTC_WAKEUP, timestamp, broadcast);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @PluginMethod
    public void sendImmediateTestNotification(PluginCall pluginCall) {
        try {
            String title = pluginCall.getString("title", "حان الآن وقت صلاة الظهر");
            String body = pluginCall.getString("body", "إنَّ هَذَا وقتٌ تُفْتَحُ فِيهِ أَبْوَابُ السَّمَاءِ.");
            String prayerId = pluginCall.getString("prayerId", "dhuhr");

            Intent intent = new Intent(getContext(), PrayerAlarmReceiver.class);
            intent.setAction("com.daralhikayat.app.PRAYER_ALARM");
            intent.putExtra("id", 88888);
            intent.putExtra("title", title);
            intent.putExtra("body", body);
            intent.putExtra("prayerId", prayerId);
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
        getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().remove(KEY_ALARMS).apply();
        pluginCall.resolve();
    }

    private void cancelAllAlarmsInternal() {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            JSArray array = new JSArray(prefs.getString(KEY_ALARMS, "[]"));
            AlarmManager alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) {
                return;
            }
            for (int i = 0; i < array.length(); i++) {
                int id = array.getJSONObject(i).getInt("id");
                Intent intent = new Intent(getContext(), PrayerAlarmReceiver.class);
                intent.setAction("com.daralhikayat.app.PRAYER_ALARM");

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
        } catch (Exception ignored) {
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
        boolean granted = getPermissionState("notifications") == PermissionState.GRANTED;
        JSObject jSObject = new JSObject();
        jSObject.put("granted", granted);
        pluginCall.resolve(jSObject);
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
            } catch (Exception ignored) {
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
        boolean canSchedule = true;
        if (Build.VERSION.SDK_INT >= 31 && ((alarmManager = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE)) == null || !alarmManager.canScheduleExactAlarms())) {
            canSchedule = false;
        }
        JSObject jSObject = new JSObject();
        jSObject.put("canSchedule", canSchedule);
        pluginCall.resolve(jSObject);
    }
}
