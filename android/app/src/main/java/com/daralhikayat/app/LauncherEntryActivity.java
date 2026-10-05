package com.daralhikayat.app;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

/**
 * Disposable launcher entry. Its aliases may be disabled without disabling the
 * activity/component that owns the user's WebView and editor task.
 * The empty taskAffinity in the manifest keeps this entry out of that task.
 */
public final class LauncherEntryActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent content = new Intent(this, MainActivity.class);
        content.setAction(Intent.ACTION_MAIN);
        content.addCategory(Intent.CATEGORY_LAUNCHER);
        // Explicit stable component + its normal affinity. singleTask reuses the
        // existing MainActivity; never clear/reload the user's editor on a tap.
        content.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(content);
        // Theme.NoDisplay requires finishing before onResume; no visible splash here.
        finish();
    }
}
