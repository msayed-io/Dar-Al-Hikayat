package com.daralhikayat.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class TimezoneChangedReceiver extends BroadcastReceiver {
    private static final String TAG = "TimezoneChangedReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        Log.i(TAG, "Timezone or clock change action received: " + action);

        if ("android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED".equals(action) ||
            "android.intent.action.TIMEZONE_CHANGED".equals(action) ||
            "android.intent.action.TIME_SET".equals(action) ||
            "android.intent.action.DATE_CHANGED".equals(action)) {

            // Asynchronously prime and restore all prayer alarms safely
            PrayerAlarmReceiver.scheduleNextAlarmsFromCache(context);
        }
    }
}
