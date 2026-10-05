import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { JSDOM } from "jsdom";

const javaRoot = "android/app/src/main/java/com/daralhikayat/app/";
const android = "http://schemas.android.com/apk/res/android";
const attr = (el: Element, key: string) => el.getAttributeNS(android, key);

describe("launcher task isolation", () => {
  it("keeps existing alias names/icons/defaults but targets an isolated invisible entry", () => {
    const doc = new JSDOM(readFileSync("android/app/src/main/AndroidManifest.xml", "utf8"), { contentType: "text/xml" }).window.document;
    const aliases = [...doc.querySelectorAll("activity-alias")];
    expect(aliases.map(a => attr(a, "name"))).toEqual([".RoyalClassicLauncher", ".NightWhisperLauncher", ".AppleDarkLauncher"]);
    expect(aliases.map(a => attr(a, "enabled"))).toEqual(["true", "false", "false"]);
    expect(aliases.map(a => attr(a, "icon"))).toEqual(["@mipmap/ic_launcher_royal_classic", "@mipmap/ic_launcher_night_whisper", "@mipmap/ic_launcher_apple_dark"]);
    for (const a of aliases) expect(attr(a, "targetActivity")).toBe(".LauncherEntryActivity");
    const entry = [...doc.querySelectorAll("activity")].find(a => attr(a,"name") === ".LauncherEntryActivity")!;
    expect(attr(entry,"taskAffinity")).toBe("");
    expect(attr(entry,"theme")).toBe("@android:style/Theme.NoDisplay");
    expect(attr(entry,"noHistory")).toBe("true");
    expect(attr(entry,"excludeFromRecents")).toBe("true");
    const main = [...doc.querySelectorAll("activity")].find(a => attr(a,"name")?.endsWith(".MainActivity"))!;
    expect(attr(main,"launchMode")).toBe("singleTask");
    expect(main.querySelector("intent-filter")).toBeNull();
  });

  it("executes the production Java policy against a recording PackageManager, including both API paths", () => {
    // JVM contract tests, NOT an emulator: validate exact native code/order/state
    // transitions. Device-specific launcher/task behavior still needs device QA.
    const dir = mkdtempSync(join(tmpdir(), "dar-launcher-test-"));
    const files: string[] = [];
    const add = (name: string, code: string) => { const path = join(dir,name); mkdirSync(join(path,".."),{recursive:true}); writeFileSync(path,code); files.push(path); };
    try {
      add("android/content/ComponentName.java", `package android.content; public class ComponentName { private String name; public ComponentName(String p,String n){name=n;} public String getClassName(){return name;} }`);
      add("android/content/SharedPreferences.java", `package android.content; public class SharedPreferences { java.util.Map<String,String> data=new java.util.HashMap<>(); public String getString(String k,String d){return data.getOrDefault(k,d);} public Editor edit(){return new Editor();} public class Editor { public Editor putString(String k,String v){data.put(k,v);return this;} public void apply(){} } }`);
      add("android/content/Context.java", `package android.content; import android.content.pm.PackageManager; public class Context { public static final int MODE_PRIVATE=0; public PackageManager pm=new PackageManager(); private SharedPreferences prefs=new SharedPreferences(); public String getPackageName(){return "com.daralhikayat.app";} public PackageManager getPackageManager(){return pm;} public SharedPreferences getSharedPreferences(String p,int m){return prefs;} }`);
      add("android/os/Build.java", `package android.os; public class Build { public static class VERSION {public static int SDK_INT=33;} public static class VERSION_CODES {public static final int TIRAMISU=33;} }`);
      add("android/os/Bundle.java", `package android.os; public class Bundle {}`);
      add("android/util/Log.java", `package android.util; public class Log { public static int e(String t,String m,Exception e){return 0;} }`);
      add("android/content/Intent.java", `package android.content; public class Intent { public static final String ACTION_MAIN="main",CATEGORY_LAUNCHER="launcher"; public static final int FLAG_ACTIVITY_NEW_TASK=0x10000000; public Class<?> target; public int flags; public String action,category; public Intent(Context c,Class<?> t){target=t;} public Intent setAction(String s){action=s;return this;} public Intent addCategory(String s){category=s;return this;} public Intent addFlags(int f){flags|=f;return this;} }`);
      add("android/app/Activity.java", `package android.app; import android.content.*; public class Activity extends Context { public Intent started; public String events=""; protected void onCreate(android.os.Bundle b){} public void startActivity(Intent i){started=i;events+="start;";} public void finish(){events+="finish;";} }`);
      add("android/content/pm/PackageManager.java", `package android.content.pm;
        import android.content.ComponentName; import java.util.*;
        public class PackageManager {
          public static final int COMPONENT_ENABLED_STATE_DEFAULT=0,COMPONENT_ENABLED_STATE_ENABLED=1,COMPONENT_ENABLED_STATE_DISABLED=2,DONT_KILL_APP=1;
          public Map<String,Integer> states=new HashMap<>(); public int writes=0,batches=0; public boolean fail=false;
          public static class ComponentEnabledSetting { public ComponentName c; public int s,f; public ComponentEnabledSetting(ComponentName c,int s,int f){this.c=c;this.s=s;this.f=f;} }
          public int getComponentEnabledSetting(ComponentName c){return states.getOrDefault(c.getClassName(),0);}
          public boolean enabled(String n){return states.getOrDefault(n,0)==1 || (states.getOrDefault(n,0)==0 && n.endsWith("RoyalClassicLauncher"));}
          private void change(ComponentName c,int s,int f){if(f!=DONT_KILL_APP || !c.getClassName().endsWith("Launcher"))throw new AssertionError("unsafe component/flag"); states.put(c.getClassName(),s);writes++;}
          public void setComponentEnabledSetting(ComponentName c,int s,int f){if(fail)throw new IllegalStateException("test failure");change(c,s,f);checkLauncher();}
          public void setComponentEnabledSettings(List<ComponentEnabledSetting> list){if(fail)throw new IllegalStateException("test failure");batches++;for(ComponentEnabledSetting s:list)change(s.c,s.s,s.f);checkLauncher();}
          private void checkLauncher(){if(!enabled("com.daralhikayat.app.RoyalClassicLauncher")&&!enabled("com.daralhikayat.app.NightWhisperLauncher")&&!enabled("com.daralhikayat.app.AppleDarkLauncher"))throw new AssertionError("no launcher");}
        }`);
      add("com/getcapacitor/JSObject.java", `package com.getcapacitor; public class JSObject extends java.util.HashMap<String,Object> {}`);
      add("com/getcapacitor/Plugin.java", `package com.getcapacitor; public class Plugin { public android.content.Context context=new android.content.Context(); public android.content.Context getContext(){return context;} public void load(){} }`);
      add("com/getcapacitor/PluginCall.java", `package com.getcapacitor; public class PluginCall { String theme; public boolean resolved,rejected; public PluginCall(String s){theme=s;} public String getString(String k,String d){return theme==null?d:theme;} public void resolve(JSObject o){resolved=true;} public void reject(String s,Exception e){rejected=true;} }`);
      add("com/getcapacitor/PluginMethod.java", `package com.getcapacitor; public @interface PluginMethod {}`);
      add("com/getcapacitor/annotation/CapacitorPlugin.java", `package com.getcapacitor.annotation; public @interface CapacitorPlugin {String name();}`);
      add("com/daralhikayat/app/PrayerAlarmReceiver.java", `package com.daralhikayat.app; public class PrayerAlarmReceiver {public static android.content.Context getSafeContext(android.content.Context c){return c;} }`);
      add("com/daralhikayat/app/R.java", `package com.daralhikayat.app; public class R {public static class drawable {public static int ic_stat_prayer_apple_dark=1,ic_stat_prayer_night_whisper=2,ic_stat_prayer_royal_classic=3;} }`);
      add("com/daralhikayat/app/MainActivity.java", `package com.daralhikayat.app; public class MainActivity extends android.app.Activity {}`);
      for (const name of ["LogoManagerPlugin.java", "LauncherEntryActivity.java"]) add("com/daralhikayat/app/"+name, readFileSync(javaRoot+name,"utf8"));
      add("com/daralhikayat/app/LauncherTest.java", `package com.daralhikayat.app;
        import android.os.Build; import android.content.Intent; import com.getcapacitor.PluginCall;
        public class LauncherTest {
          static void check(boolean b){if(!b)throw new AssertionError();}
          public static void main(String[] args){
            String[] themes={"royal_classic","night_whisper","apple_dark"};
            String[] aliases={"RoyalClassicLauncher","NightWhisperLauncher","AppleDarkLauncher"};
            for(int sdk:new int[]{24,32,33,36}) {
              Build.VERSION.SDK_INT=sdk; LogoManagerPlugin p=new LogoManagerPlugin(); p.load(); check(p.context.pm.writes==0);
              p.setTheme(new PluginCall("royal_classic")); check(p.context.pm.writes==0);
              for(int round=0;round<6;round++)for(int a=0;a<3;a++)for(int b=0;b<3;b++) {
                p.setTheme(new PluginCall(themes[a])); PluginCall call=new PluginCall(themes[b]); p.setTheme(call); check(call.resolved&&!call.rejected);
                for(int i=0;i<3;i++)check(p.context.pm.enabled("com.daralhikayat.app."+aliases[i])==(i==b));
                int writes=p.context.pm.writes; p.setTheme(new PluginCall(themes[b]));check(p.context.pm.writes==writes);
              }
              check((p.context.pm.batches>0)==(sdk>=33));
              // Repair partial/duplicate package state left by a prior failed update.
              for(String alias:aliases)p.context.pm.states.put("com.daralhikayat.app."+alias,1);
              p.setTheme(new PluginCall("apple_dark"));
              for(int i=0;i<3;i++)check(p.context.pm.enabled("com.daralhikayat.app."+aliases[i])==(i==2));
              p.context.pm.fail=true; PluginCall failure=new PluginCall("night_whisper");p.setTheme(failure);check(failure.rejected&&!failure.resolved);
              p.context.pm.fail=false; p.setTheme(new PluginCall("unsupported"));check(p.context.pm.enabled("com.daralhikayat.app.RoyalClassicLauncher"));
            }
            LauncherEntryActivity entry=new LauncherEntryActivity();entry.onCreate(null);
            check(entry.started.target==MainActivity.class);check(entry.started.flags==Intent.FLAG_ACTIVITY_NEW_TASK);
            check(Intent.ACTION_MAIN.equals(entry.started.action));check(Intent.CATEGORY_LAUNCHER.equals(entry.started.category));check("start;finish;".equals(entry.events));
            System.out.println("native policy PASS: 4 API levels, 216 transitions, repeat no-op, error reporting, stable entry");
          }
        }`);
      execFileSync("javac", ["-d", join(dir,"classes"), ...files], { timeout: 30000, stdio:"pipe" });
      const output = execFileSync("java", ["-cp", join(dir,"classes"), "com.daralhikayat.app.LauncherTest"], { timeout: 15000, encoding:"utf8" });
      expect(output).toContain("native policy PASS");
    } finally { rmSync(dir,{recursive:true,force:true}); }
  }, 60000);
});
