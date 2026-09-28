package com.daralhikayat.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class BootCompletedReceiver extends BroadcastReceiver {
    private static final String TAG = "BootCompletedReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Log.i(TAG, "Device boot action received: " + action);

        if ("android.intent.action.BOOT_COMPLETED".equals(action) ||
            "android.intent.action.QUICKBOOT_POWERON".equals(action) ||
            "com.htc.intent.action.QUICKBOOT_POWERON".equals(action) ||
            "android.intent.action.LOCKED_BOOT_COMPLETED".equals(action)) {

            // Asynchronously prime and restore all prayer alarms safely across DirectBoot
            PrayerAlarmReceiver.scheduleNextAlarmsFromCache(context);
        }
    }
}
