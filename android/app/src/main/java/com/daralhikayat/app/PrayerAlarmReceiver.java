package com.daralhikayat.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;
import com.aparajita.capacitor.biometricauth.BiometricAuthNative;
import org.json.JSONArray;
import org.json.JSONObject;


public class PrayerAlarmReceiver extends BroadcastReceiver {
    private static final String CHANNEL_ID = "prayer_reminders";
    private static final String KEY_ALARMS = "scheduled_alarms";
    private static final String PREFS_NAME = "dar_prayer_alarms";

    @Override
    public void onReceive(Context context, Intent intent) {
        if ("com.daralhikayat.app.PRAYER_ALARM".equals(intent.getAction())) {
            String stringExtra = intent.getStringExtra(BiometricAuthNative.RESULT_TYPE);
            String stringExtra2 = intent.getStringExtra("title");
            String stringExtra3 = intent.getStringExtra("body");
            String stringExtra4 = intent.getStringExtra("prayerId");
            int intExtra = intent.getIntExtra("id", 0);
            if ("reschedule".equals(stringExtra)) {
                rescheduleAlarmsFromCache(context);
            } else {
                triggerVibration(context);
                showNotification(context, intExtra, stringExtra2, stringExtra3, stringExtra4);
            }
        }
    }

    private void showNotification(Context context, int i, String str, String str2, String str3) {
        Notification.Builder builder;
        Notification.Builder builder2;
        try {
            try {
                NotificationManager notificationManager = (NotificationManager) context.getSystemService("notification");
                if (notificationManager == null) {
                    return;
                }
                if (Build.VERSION.SDK_INT >= 26) {
                    builder2 = new Notification.Builder(context, CHANNEL_ID);
                } else {
                    builder2 = new Notification.Builder(context);
                    builder2.setVibrate(new long[]{0, 400, 200, 600});
                    builder2.setDefaults(2);
                }
                builder2.setSmallIcon(R.mipmap.ic_launcher).setContentTitle(str).setContentText(str2).setStyle(new Notification.BigTextStyle().bigText(str2)).setAutoCancel(true).setPriority(1).setCategory(NotificationCompat.CATEGORY_ALARM).setVisibility(1).setOnlyAlertOnce(true);
                notificationManager.notify(i, builder2.build());
            } catch (Exception unused) {
                NotificationManager notificationManager2 = (NotificationManager) context.getSystemService("notification");
                if (notificationManager2 == null) {
                    return;
                }
                if (Build.VERSION.SDK_INT >= 26) {
                    builder = new Notification.Builder(context, CHANNEL_ID);
                } else {
                    builder = new Notification.Builder(context);
                }
                builder.setContentTitle(str).setContentText(str2).setAutoCancel(true).setPriority(1);
                notificationManager2.notify(i, builder.build());
            }
        } catch (Exception unused2) {
        }
    }

    private void triggerVibration(Context context) {
        try {
            Vibrator vibrator = (Vibrator) context.getSystemService("vibrator");
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] jArr = {0, 400, 200, 600};
                if (Build.VERSION.SDK_INT >= 26) {
                    vibrator.vibrate(VibrationEffect.createWaveform(jArr, -1));
                } else {
                    vibrator.vibrate(jArr, -1);
                }
            }
        } catch (Exception unused) {
        }
    }

    private void rescheduleAlarmsFromCache(Context context) {
        int i;
        AlarmManager alarmManager;
        try {
            SharedPreferences sharedPreferences = context.getSharedPreferences(PREFS_NAME, 0);
            JSONArray jSONArray = new JSONArray(sharedPreferences.getString(KEY_ALARMS, "[]"));
            AlarmManager alarmManager2 = (AlarmManager) context.getSystemService(NotificationCompat.CATEGORY_ALARM);
            if (alarmManager2 == null) {
                return;
            }
            long currentTimeMillis = System.currentTimeMillis();
            int i2 = 0;
            while (i2 < jSONArray.length()) {
                JSONObject jSONObject = jSONArray.getJSONObject(i2);
                AlarmManager alarmManager3 = alarmManager2;
                long j = jSONObject.getLong("timestamp");
                int i3 = jSONObject.getInt("id");
                SharedPreferences sharedPreferences2 = sharedPreferences;
                String string = jSONObject.getString("title");
                JSONArray jSONArray2 = jSONArray;
                String string2 = jSONObject.getString("body");
                long j2 = currentTimeMillis;
                String string3 = jSONObject.getString("prayerId");
                String string4 = jSONObject.getString(BiometricAuthNative.RESULT_TYPE);
                if (j <= j2) {
                    i = i2;
                    alarmManager = alarmManager3;
                } else {
                    i = i2;
                    Intent intent = new Intent(context, (Class<?>) PrayerAlarmReceiver.class);
                    intent.setAction("com.daralhikayat.app.PRAYER_ALARM");
                    intent.putExtra("id", i3);
                    intent.putExtra("title", string);
                    intent.putExtra("body", string2);
                    intent.putExtra("prayerId", string3);
                    intent.putExtra(BiometricAuthNative.RESULT_TYPE, string4);
                    intent.putExtra("timestamp", j);
                    PendingIntent broadcast = PendingIntent.getBroadcast(context, i3, intent, 201326592);
                    alarmManager = alarmManager3;
                    try {
                        try {
                            alarmManager.setExactAndAllowWhileIdle(0, j, broadcast);
                        } catch (SecurityException unused) {
                            alarmManager.set(0, j, broadcast);
                        }
                    } catch (Exception unused2) {
                    }
                }
                i2 = i + 1;
                alarmManager2 = alarmManager;
                sharedPreferences = sharedPreferences2;
                jSONArray = jSONArray2;
                currentTimeMillis = j2;
            }
            sharedPreferences.edit().putBoolean("needs_reschedule", false).apply();
        } catch (Exception unused3) {
        }
    }
}
