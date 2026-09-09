package com.daralhikayat.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;
import org.json.JSONArray;
import org.json.JSONObject;

public class PrayerAlarmReceiver extends BroadcastReceiver {
    public static final String CHANNEL_ID = "prayer_reminders";
    public static final String CHANNEL_NAME = "تذكيرات الصلاة";
    private static final String KEY_ALARMS = "scheduled_alarms";
    private static final String PREFS_NAME = "dar_prayer_alarms";

    @Override
    public void onReceive(Context context, Intent intent) {
        if ("com.daralhikayat.app.PRAYER_ALARM".equals(intent.getAction())) {
            String type = intent.getStringExtra("type");
            String title = intent.getStringExtra("title");
            String body = intent.getStringExtra("body");
            String prayerId = intent.getStringExtra("prayerId");
            int id = intent.getIntExtra("id", 0);

            if ("reschedule".equals(type)) {
                rescheduleAlarmsFromCache(context);
            } else {
                triggerVibration(context);
                showNotification(context, id, title, body, prayerId);
            }
        }
    }

    public static void ensureNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager != null) {
                NotificationChannel channel = notificationManager.getNotificationChannel(CHANNEL_ID);
                if (channel == null) {
                    channel = new NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH);
                    channel.setDescription("تذكيرات مواقيت الصلاة والأذان");
                    channel.enableVibration(true);
                    channel.setVibrationPattern(new long[]{0, 400, 200, 600});
                    channel.enableLights(true);
                    channel.setLightColor(0xFFA7AA63);
                    channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
                    notificationManager.createNotificationChannel(channel);
                }
            }
        }
    }

    private void showNotification(Context context, int id, String title, String body, String prayerId) {
        try {
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (notificationManager == null) {
                return;
            }

            ensureNotificationChannel(context);

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

            int smallIconRes = R.drawable.ic_stat_prayer;
            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(smallIconRes)
                    .setContentTitle(title != null ? title : "تذكير بموعد الصلاة")
                    .setContentText(body != null ? body : "")
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(body != null ? body : ""))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_REMINDER)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent)
                    .setSound(soundUri)
                    .setVibrate(new long[]{0, 400, 200, 600});

            notificationManager.notify(id, builder.build());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void triggerVibration(Context context) {
        try {
            Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = {0, 400, 200, 600};
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

                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent);
                        } else {
                            alarmManager.setExact(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent);
                        }
                    } catch (SecurityException se) {
                        alarmManager.set(AlarmManager.RTC_WAKEUP, timestamp, pendingIntent);
                    }
                }
            }
            sharedPreferences.edit().putBoolean("needs_reschedule", false).apply();
        } catch (Exception ignored) {
        }
    }
}
