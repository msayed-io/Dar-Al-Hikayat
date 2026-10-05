package com.daralhikayat.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.util.Log;
import android.os.Build;
import java.util.ArrayList;
import java.util.List;
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
        // The web theme effect reconciles state idempotently when its theme is ready.
        syncStorage(getContext());
    }

    @PluginMethod
    public synchronized void setTheme(PluginCall call) {
        String theme = call.getString("theme", "royal_classic");
        if (!isSupported(theme)) theme = "royal_classic";
        saveTheme(getContext(), theme);

        try {
            // Reconcile actual package state; repeated requests are a no-op.
            applyTheme(getContext(), theme);
            JSObject result = new JSObject();
            result.put("theme", theme);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error applying launcher alias", e);
            call.reject("Unable to update launcher icon", e);
        }
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

    private static boolean isEnabled(PackageManager pm, ComponentName component) {
        int state = pm.getComponentEnabledSetting(component);
        return state == PackageManager.COMPONENT_ENABLED_STATE_ENABLED
            || (state == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT
                && ROYAL.equals(component.getClassName()));
    }

    static void applyTheme(Context context, String theme) {
        PackageManager pm = context.getPackageManager();
        String targetAlias = getAliasForTheme(theme);
        // Target first: older Android versions must never have zero launcher entries.
        List<ComponentName> components = new ArrayList<>();
        List<Integer> states = new ArrayList<>();
        ComponentName target = new ComponentName(context.getPackageName(), targetAlias);
        if (!isEnabled(pm, target)) {
            components.add(target);
            states.add(PackageManager.COMPONENT_ENABLED_STATE_ENABLED);
        }
        for (String alias : ALL_ALIASES) {
            ComponentName component = new ComponentName(context.getPackageName(), alias);
            if (!alias.equals(targetAlias) && isEnabled(pm, component)) {
                components.add(component);
                states.add(PackageManager.COMPONENT_ENABLED_STATE_DISABLED);
            }
        }
        if (components.isEmpty()) return;

        // API 33+: one atomic package update, not intermediate duplicate icons.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            List<PackageManager.ComponentEnabledSetting> changes = new ArrayList<>();
            for (int i = 0; i < components.size(); i++) {
                changes.add(new PackageManager.ComponentEnabledSetting(
                    components.get(i), states.get(i), PackageManager.DONT_KILL_APP));
            }
            pm.setComponentEnabledSettings(changes);
        } else {
            for (int i = 0; i < components.size(); i++) {
                pm.setComponentEnabledSetting(
                    components.get(i), states.get(i), PackageManager.DONT_KILL_APP);
            }
        }
    }
}
