package com.daralhikayat.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

public class PrayerAlarmReceiver extends BroadcastReceiver {
    public static final String TAG = "PrayerAlarmReceiver";
    public static final String ACTION_PRAYER_ALARM = "com.daralhikayat.app.PRAYER_ALARM";
    public static final String CHANNEL_ID = "prayer_reminders_v3";
    public static final String CHANNEL_NAME = "تنبيهات مواقيت الصلاة والأذان";
    public static final String PREFS_NAME = "dar_prayer_alarms";
    public static final String KEY_ALARMS = "scheduled_alarms";

    public static Context getSafeContext(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            return context.isDeviceProtectedStorage() ? context : context.createDeviceProtectedStorageContext();
        }
        return context;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_PRAYER_ALARM.equals(intent.getAction())) {
            return;
        }

        PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        PowerManager.WakeLock wakeLock = null;
        if (powerManager != null) {
            try {
                wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "daralhikayat:PrayerAlarmWakeLock"
                );
                wakeLock.acquire(10000); // 10 seconds safety timeout to ensure completion
            } catch (Exception ignored) {
            }
        }

        try {
            String type = intent.getStringExtra("type");
            String title = intent.getStringExtra("title");
            String body = intent.getStringExtra("body");
            String prayerId = intent.getStringExtra("prayerId");
            int id = intent.getIntExtra("id", 0);

            if ("reschedule".equals(type)) {
                scheduleNextAlarmsFromCache(context);
            } else {
                triggerVibration(context);
                showNotification(context, id, title, body, prayerId, type);

                // Self-sustaining perpetual chain: Immediately arm the next upcoming alarm with highest priority setAlarmClock
                scheduleNextAlarmsFromCache(context);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in onReceive: " + e.getMessage(), e);
        } finally {
            if (wakeLock != null && wakeLock.isHeld()) {
                try {
                    wakeLock.release();
                } catch (Exception ignored) {
                }
            }
        }
    }

    public static void ensureNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager == null) return;

            // Delete obsolete channels to ensure sound and alarm attributes are applied cleanly
            try {
                notificationManager.deleteNotificationChannel("prayer_reminders");
                notificationManager.deleteNotificationChannel("prayer_reminders_v2");
            } catch (Exception ignored) {}

            NotificationChannel channel = notificationManager.getNotificationChannel(CHANNEL_ID);
            if (channel == null) {
                channel = new NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);
                channel.setDescription("تنبيهات مواقيت الصلاة والأذان بدقة تامة وبدون تأخير");
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[]{0, 500, 250, 750});
                channel.enableLights(true);
                channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
                channel.setBypassDnd(true);

                Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                if (soundUri == null) {
                    soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                }

                if (soundUri != null) {
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .setUsage(AudioAttributes.USAGE_ALARM)
                            .build();
                    channel.setSound(soundUri, audioAttributes);
                }

                notificationManager.createNotificationChannel(channel);
            }
        }
    }

    private void showNotification(Context context, int id, String title, String body, String prayerId, String type) {
        try {
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager == null) return;

            ensureNotificationChannel(context);

            boolean isPreAlarm = "pre".equals(type);

            // If this is an exact prayer notification (الأذان الفعلي), cancel the 10-minute pre-reminder immediately
            if (!isPreAlarm) {
                try {
                    notificationManager.cancel(id + 100);
                } catch (Exception ignored) {}
            }

            Intent openIntent = new Intent(context, MainActivity.class);
            openIntent.setAction(Intent.ACTION_MAIN);
            openIntent.addCategory(Intent.CATEGORY_LAUNCHER);
            openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            openIntent.putExtra("prayerId", prayerId);

            int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getActivity(context, id, openIntent, pendingFlags);

            int smallIconRes = LogoManagerPlugin.notificationIcon(context);
            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            if (soundUri == null) {
                soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(smallIconRes)
                    .setContentTitle(title != null ? title : (isPreAlarm ? "اقترب موعد الصلاة" : "حان الآن وقت الصلاة"))
                    .setContentText(body != null ? body : "")
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body != null ? body : ""))
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent)
                    .setSound(soundUri)
                    .setVibrate(new long[]{0, 500, 250, 750});

            // Pre-alarm dismisses after 10 minutes if not clicked
            if (isPreAlarm && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder.setTimeoutAfter(10 * 60 * 1000);
            }

            notificationManager.notify(id, builder.build());
        } catch (Exception e) {
            Log.e(TAG, "Error displaying notification: " + e.getMessage(), e);
        }
    }

    private void triggerVibration(Context context) {
        try {
            Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = {0, 500, 250, 750};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
                } else {
                    vibrator.vibrate(pattern, -1);
                }
            }
        } catch (Exception ignored) {}
    }

    public static void scheduleNextAlarmsFromCache(Context context) {
        try {
            Context safeContext = getSafeContext(context);
            SharedPreferences prefs = safeContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String rawAlarms = prefs.getString(KEY_ALARMS, "[]");
            JSONArray array = new JSONArray(rawAlarms);
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null || array.length() == 0) return;

            long now = System.currentTimeMillis();
            List<JSONObject> futureAlarms = new ArrayList<>();

            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                long timestamp = obj.getLong("timestamp");
                if (timestamp > now) {
                    futureAlarms.add(obj);
                }
            }

            if (futureAlarms.isEmpty()) return;

            // Sort ascending by timestamp
            Collections.sort(futureAlarms, new Comparator<JSONObject>() {
                @Override
                public int compare(JSONObject a, JSONObject b) {
                    try {
                        return Long.compare(a.getLong("timestamp"), b.getLong("timestamp"));
                    } catch (Exception e) {
                        return 0;
                    }
                }
            });

            // 1. Next immediate alarm is scheduled with setAlarmClock() for 100% Doze-exemption
            JSONObject nextAlarm = futureAlarms.get(0);
            long nextTimestamp = nextAlarm.getLong("timestamp");
            int nextId = nextAlarm.getInt("id");
            String nextTitle = nextAlarm.getString("title");
            String nextBody = nextAlarm.getString("body");
            String nextPrayerId = nextAlarm.getString("prayerId");
            String nextType = nextAlarm.optString("type", "exact");

            Intent nextIntent = new Intent(context, PrayerAlarmReceiver.class);
            nextIntent.setAction(ACTION_PRAYER_ALARM);
            nextIntent.setData(Uri.parse("prayer://alarm/" + nextId));
            nextIntent.putExtra("id", nextId);
            nextIntent.putExtra("title", nextTitle);
            nextIntent.putExtra("body", nextBody);
            nextIntent.putExtra("prayerId", nextPrayerId);
            nextIntent.putExtra("type", nextType);
            nextIntent.putExtra("timestamp", nextTimestamp);

            int pendingFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                pendingFlags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent nextPendingIntent = PendingIntent.getBroadcast(context, nextId, nextIntent, pendingFlags);

            Intent showIntent = new Intent(context, MainActivity.class);
            PendingIntent showPendingIntent = PendingIntent.getActivity(context, 0, showIntent, pendingFlags);
            AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(nextTimestamp, showPendingIntent);
            alarmManager.setAlarmClock(clockInfo, nextPendingIntent);

            // 2. Schedule the remaining alarms in a rolling window of up to 30 alarms
            int limit = Math.min(futureAlarms.size(), 30);
            for (int i = 1; i < limit; i++) {
                JSONObject obj = futureAlarms.get(i);
                long ts = obj.getLong("timestamp");
                int id = obj.getInt("id");
                String title = obj.getString("title");
                String body = obj.getString("body");
                String prayerId = obj.getString("prayerId");
                String type = obj.optString("type", "exact");

                Intent intent = new Intent(context, PrayerAlarmReceiver.class);
                intent.setAction(ACTION_PRAYER_ALARM);
                intent.setData(Uri.parse("prayer://alarm/" + id));
                intent.putExtra("id", id);
                intent.putExtra("title", title);
                intent.putExtra("body", body);
                intent.putExtra("prayerId", prayerId);
                intent.putExtra("type", type);
                intent.putExtra("timestamp", ts);

                PendingIntent pi = PendingIntent.getBroadcast(context, id, intent, pendingFlags);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, ts, pi);
                } else {
                    alarmManager.setExact(AlarmManager.RTC_WAKEUP, ts, pi);
                }
            }

            prefs.edit().putBoolean("needs_reschedule", false).apply();
            Log.i(TAG, "Successfully primed next alarm at " + nextTimestamp + " via setAlarmClock and " + (limit - 1) + " rolling alarms");
        } catch (Exception e) {
            Log.e(TAG, "Error in scheduleNextAlarmsFromCache: " + e.getMessage(), e);
        }
    }
}
