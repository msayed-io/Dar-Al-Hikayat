package com.daralhikayat.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootCompletedReceiver extends BroadcastReceiver {
    private static final String PREFS_NAME = "dar_prayer_alarms";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if ("android.intent.action.BOOT_COMPLETED".equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            "com.htc.intent.action.QUICKBOOT_POWERON".equals(action) ||
            "android.intent.action.LOCKED_BOOT_COMPLETED".equals(action)) {
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().putBoolean("needs_reschedule", true).apply();
            PrayerAlarmReceiver prayerAlarmReceiver = new PrayerAlarmReceiver();
            Intent intent2 = new Intent("com.daralhikayat.app.PRAYER_ALARM");
            intent2.putExtra("type", "reschedule");
            intent2.setClass(context, PrayerAlarmReceiver.class);
            prayerAlarmReceiver.onReceive(context, intent2);
        }
    }
}
