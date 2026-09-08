package com.daralhikayat.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import com.aparajita.capacitor.biometricauth.BiometricAuthNative;


public class TimezoneChangedReceiver extends BroadcastReceiver {
    private static final String PREFS_NAME = "dar_prayer_alarms";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if ("android.intent.action.TIMEZONE_CHANGED".equals(action) || "android.intent.action.TIME_SET".equals(action) || "android.intent.action.DATE_CHANGED".equals(action)) {
            context.getSharedPreferences(PREFS_NAME, 0).edit().putBoolean("needs_reschedule", true).apply();
            PrayerAlarmReceiver prayerAlarmReceiver = new PrayerAlarmReceiver();
            Intent intent2 = new Intent("com.daralhikayat.app.PRAYER_ALARM");
            intent2.putExtra(BiometricAuthNative.RESULT_TYPE, "reschedule");
            intent2.setClass(context, PrayerAlarmReceiver.class);
            prayerAlarmReceiver.onReceive(context, intent2);
        }
    }
}
