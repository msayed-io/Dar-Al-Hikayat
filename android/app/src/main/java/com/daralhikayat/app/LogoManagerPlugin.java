package com.daralhikayat.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LogoManager")
public class LogoManagerPlugin extends Plugin {
    public static final String PREFS = "dar_logo_preferences";
    public static final String KEY_THEME = "theme";
    private static final String ROYAL = "com.daralhikayat.app.RoyalClassicLauncher";
    private static final String NIGHT = "com.daralhikayat.app.NightWhisperLauncher";
    private static final String APPLE = "com.daralhikayat.app.AppleDarkLauncher";

    @Override
    public void load() {
        super.load();
        applyTheme(getContext(), getStoredTheme(getContext()), false);
    }

    @PluginMethod
    public void setTheme(PluginCall call) {
        String theme = call.getString("theme", "royal_classic");
        if (!isSupported(theme)) theme = "royal_classic";
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_THEME, theme).apply();
        applyTheme(getContext(), theme, true);
        JSObject result = new JSObject();
        result.put("theme", theme);
        call.resolve(result);
    }

    public static String getStoredTheme(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_THEME, "royal_classic");
    }

    public static int notificationIcon(Context context) {
        String theme = getStoredTheme(context);
        if ("apple_dark".equals(theme)) return com.daralhikayat.app.R.drawable.ic_stat_prayer_apple_dark;
        if ("night_whisper".equals(theme)) return com.daralhikayat.app.R.drawable.ic_stat_prayer_night_whisper;
        return com.daralhikayat.app.R.drawable.ic_stat_prayer_royal_classic;
    }

    private static boolean isSupported(String theme) {
        return "royal_classic".equals(theme) || "night_whisper".equals(theme) || "apple_dark".equals(theme);
    }

    private static void applyTheme(Context context, String theme, boolean replace) {
        PackageManager pm = context.getPackageManager();
        set(context, pm, ROYAL, "royal_classic".equals(theme));
        set(context, pm, NIGHT, "night_whisper".equals(theme));
        set(context, pm, APPLE, "apple_dark".equals(theme));
    }

    private static void set(Context context, PackageManager pm, String name, boolean enabled) {
        pm.setComponentEnabledSetting(new ComponentName(context.getPackageName(), name),
            enabled ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED : PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
            PackageManager.DONT_KILL_APP);
    }
}
