package com.daralhikayat.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(SystemTimePlugin.class);
        registerPlugin(PrayerAlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
