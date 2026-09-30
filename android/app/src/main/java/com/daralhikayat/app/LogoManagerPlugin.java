package com.daralhikayat.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LogoManager")
public class LogoManagerPlugin extends Plugin {
    public static final String TAG = "LogoManager";
    public static final String PREFS = "dar_logo_preferences";
    public static final String KEY_THEME = "theme";
    private static final String ROYAL = "com.daralhikayat.app.RoyalClassicLauncher";
    private static final String NIGHT = "com.daralhikayat.app.NightWhisperLauncher";
    private static final String APPLE = "com.daralhikayat.app.AppleDarkLauncher";
    private static final String[] ALL_ALIASES = { ROYAL, NIGHT, APPLE };

    @Override
    public void load() {
        super.load();
        // Do NOT mutate or re-toggle activity aliases during startup/onCreate.
        // The Android OS already persists the enabled launcher alias in packages.xml.
        // Calling setComponentEnabledSetting on startup is what kills the process.
        syncStorage(getContext());
    }

    @PluginMethod
    public void setTheme(PluginCall call) {
        String theme = call.getString("theme", "royal_classic");
        if (!isSupported(theme)) theme = "royal_classic";

        String previousTheme = getStoredTheme(getContext());
        saveTheme(getContext(), theme);

        // Only touch PackageManager if the theme actually changed or is not in the desired state
        if (!theme.equals(previousTheme) || !isAliasActive(getContext(), theme)) {
            applyTheme(getContext(), theme);
        }

        JSObject result = new JSObject();
        result.put("theme", theme);
        call.resolve(result);
    }

    public static void saveTheme(Context context, String theme) {
        if (!isSupported(theme)) theme = "royal_classic";
        try {
            Context safeContext = PrayerAlarmReceiver.getSafeContext(context);
            safeContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(KEY_THEME, theme).apply();
        } catch (Exception ignored) {}
        try {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putString(KEY_THEME, theme).apply();
        } catch (Exception ignored) {}
    }

    public static String getStoredTheme(Context context) {
        try {
            Context safeContext = PrayerAlarmReceiver.getSafeContext(context);
            String theme = safeContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_THEME, null);
            if (theme != null && isSupported(theme)) {
                return theme;
            }
        } catch (Exception ignored) {}
        try {
            String theme = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_THEME, null);
            if (theme != null && isSupported(theme)) {
                return theme;
            }
        } catch (Exception ignored) {}
        return "royal_classic";
    }

    private static void syncStorage(Context context) {
        try {
            String theme = getStoredTheme(context);
            saveTheme(context, theme);
        } catch (Exception ignored) {}
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

    private static String getAliasForTheme(String theme) {
        if ("night_whisper".equals(theme)) return NIGHT;
        if ("apple_dark".equals(theme)) return APPLE;
        return ROYAL;
    }

    private static boolean isAliasActive(Context context, String theme) {
        try {
            PackageManager pm = context.getPackageManager();
            String targetAlias = getAliasForTheme(theme);
            ComponentName targetComp = new ComponentName(context.getPackageName(), targetAlias);
            int state = pm.getComponentEnabledSetting(targetComp);
            if (targetAlias.equals(ROYAL) && state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT) {
                return true;
            }
            return state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED;
        } catch (Exception e) {
            return false;
        }
    }

    private static void applyTheme(Context context, String theme) {
        try {
            PackageManager pm = context.getPackageManager();
            String targetAlias = getAliasForTheme(theme);

            // Step 1: Enable the target alias FIRST so the app always maintains an active launcher
            ComponentName targetComp = new ComponentName(context.getPackageName(), targetAlias);
            if (pm.getComponentEnabledSetting(targetComp) != PackageManager.COMPONENT_ENABLED_STATE_ENABLED) {
                pm.setComponentEnabledSetting(
                    targetComp,
                    PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                    PackageManager.DONT_KILL_APP
                );
            }

            // Step 2: Disable all other aliases SECOND
            for (String alias : ALL_ALIASES) {
                if (!alias.equals(targetAlias)) {
                    ComponentName comp = new ComponentName(context.getPackageName(), alias);
                    if (pm.getComponentEnabledSetting(comp) != PackageManager.COMPONENT_ENABLED_STATE_DISABLED) {
                        pm.setComponentEnabledSetting(
                            comp,
                            PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                            PackageManager.DONT_KILL_APP
                        );
                    }
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "Error applying launcher alias: " + e.getMessage(), e);
        }
    }
}
