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
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;

public class PrayerAlarmReceiver extends BroadcastReceiver {
    public static final String CHANNEL_ID = "prayer_reminders_v2";
    public static final String CHANNEL_NAME = "تذكيرات الصلاة والأذان";
    private static final String KEY_ALARMS = "scheduled_alarms";
    private static final String PREFS_NAME = "dar_prayer_alarms";

    @Override
    public void onReceive(Context context, Intent intent) {
        if ("com.daralhikayat.app.PRAYER_ALARM".equals(intent.getAction())) {
            PowerManager powerManager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            PowerManager.WakeLock wakeLock = null;
            if (powerManager != null) {
                try {
                    wakeLock = powerManager.newWakeLock(
                        PowerManager.PARTIAL_WAKE_LOCK,
                        "daralhikayat:PrayerAlarmWakeLock"
                    );
                    wakeLock.acquire(5000); // 5 seconds safety timeout
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
                    rescheduleAlarmsFromCache(context);
                } else {
                    triggerVibration(context);
                    showNotification(context, id, title, body, prayerId, type);
                }
            } finally {
                if (wakeLock != null && wakeLock.isHeld()) {
                    try {
                        wakeLock.release();
                    } catch (Exception ignored) {
                    }
                }
            }
        }
    }

    public static void ensureNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                // Delete obsolete legacy channel if exists to ensure pristine sound configuration
                try {
                    NotificationChannel oldChannel = notificationManager.getNotificationChannel("prayer_reminders");
                    if (oldChannel != null) {
                        notificationManager.deleteNotificationChannel("prayer_reminders");
                    }
                } catch (Exception ignored) {
                }

                NotificationChannel channel = notificationManager.getNotificationChannel(CHANNEL_ID);
                if (channel == null) {
                    channel = new NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);
                    channel.setDescription("تنبيهات مواقيت الصلاة والأذان بدقة تامة");
                    channel.enableVibration(true);
                    channel.setVibrationPattern(new long[]{0, 500, 250, 750});
                    channel.enableLights(true);
                    channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);

                    Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                    if (soundUri == null) {
                        soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                    }
                    if (soundUri != null) {
                        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                                .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
                                .build();
                        channel.setSound(soundUri, audioAttributes);
                    }

                    notificationManager.createNotificationChannel(channel);
                }
            }
        }
    }

    private void showNotification(Context context, int id, String title, String body, String prayerId, String type) {
        try {
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager == null) {
                return;
            }

            ensureNotificationChannel(context);

            boolean isPreAlarm = "pre".equals(type);

            // If this is an exact prayer notification (الأذان الفعلي), cancel the 10-minute pre-reminder immediately
            if (!isPreAlarm) {
                try {
                    // In our deterministic ID scheme: preAlarmId = exactAlarmId + 100
                    notificationManager.cancel(id + 100);
                } catch (Exception ignored) {
                }
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
            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            if (soundUri == null) {
                soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
            }

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(smallIconRes)
                    .setContentTitle(title != null ? title : (isPreAlarm ? "اقترب موعد الصلاة" : "حان الآن وقت الصلاة"))
                    .setContentText(body != null ? body : "")
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body != null ? body : ""))
                    .setPriority(isPreAlarm ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_MAX)
                    .setCategory(isPreAlarm ? NotificationCompat.CATEGORY_REMINDER : NotificationCompat.CATEGORY_ALARM)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent)
                    .setSound(soundUri)
                    .setVibrate(new long[]{0, 500, 250, 750});

            // Pre-alarm (فاضل 10 دقائق): Automatically dismisses after 10 minutes (600,000 ms) if not clicked
            // Exact prayer alarm (موعد الأذان الفعلي): Stays in notification tray until user clears or clicks it!
            if (isPreAlarm && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder.setTimeoutAfter(10 * 60 * 1000); // 10 minutes
            }

            notificationManager.notify(id, builder.build());
        } catch (Exception e) {
            e.printStackTrace();
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
        } catch (Exception ignored) {
        }
    }

    private void rescheduleAlarmsFromCache(Context context) {
        try {
            SharedPreferences sharedPreferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            JSONArray array = new JSONArray(sharedPreferences.getString(KEY_ALARMS, "[]"));
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) {
                return;
            }

            long now = System.currentTimeMillis();
            for (int i = 0; i < array.length(); i++) {
                JSONObject obj = array.getJSONObject(i);
                long timestamp = obj.getLong("timestamp");
                if (timestamp > now) {
                    int id = obj.getInt("id");
                    String title = obj.getString("title");
                    String body = obj.getString("body");
                    String prayerId = obj.getString("prayerId");
                    String type = obj.optString("type", "exact");

                    Intent intent = new Intent(context, PrayerAlarmReceiver.class);
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
                    PendingIntent pendingIntent = PendingIntent.getBroadcast(context, id, intent, pendingFlags);

                    if (Build.VERSION.SDK_INT >= 31 && !alarmManager.canScheduleExactAlarms()) {
                        sharedPreferences.edit().putBoolean("needs_reschedule", true).apply();
                        continue;
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent);
                    } else {
                        alarmManager.setExact(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent);
                    }
                }
            }
            sharedPreferences.edit().putBoolean("needs_reschedule", false).apply();
        } catch (Exception ignored) {
        }
    }
}
