package com.daralhikayat.app;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import androidx.core.content.pm.PackageInfoCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;

@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    @PluginMethod
    public void getAppVersionInfo(PluginCall call) {
        try {
            Context context = getContext();
            PackageManager pm = context.getPackageManager();
            PackageInfo pInfo = pm.getPackageInfo(context.getPackageName(), 0);

            long versionCode = PackageInfoCompat.getLongVersionCode(pInfo);
            String versionName = pInfo.versionName != null ? pInfo.versionName : "1.0";

            JSObject res = new JSObject();
            res.put("versionCode", (int) versionCode);
            res.put("versionName", versionName);
            res.put("packageName", context.getPackageName());
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to get app version info: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void checkInstallPermission(PluginCall call) {
        try {
            boolean canInstall = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Context context = getContext();
                canInstall = context.getPackageManager().canRequestPackageInstalls();
            }
            JSObject res = new JSObject();
            res.put("canInstall", canInstall);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to check install permission: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Context context = getContext();
                Intent intent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + context.getPackageName())
                );
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
            }
            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to open install settings: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void downloadUpdate(PluginCall call) {
        String downloadUrl = call.getString("url");
        String expectedSha256 = call.getString("sha256");
        int targetVersionCode = call.getInt("versionCode", 0);

        if (downloadUrl == null || downloadUrl.trim().isEmpty()) {
            call.reject("Download URL cannot be empty");
            return;
        }

        new Thread(() -> {
            File partFile = null;
            File finalFile = null;
            try {
                Context context = getContext();
                File updatesDir = new File(context.getCacheDir(), "updates");
                if (!updatesDir.exists()) {
                    updatesDir.mkdirs();
                }

                String fileName = "dar-al-hikayat-" + (targetVersionCode > 0 ? targetVersionCode : System.currentTimeMillis()) + ".apk";
                finalFile = new File(updatesDir, fileName);
                partFile = new File(updatesDir, fileName + ".part");

                if (partFile.exists()) {
                    partFile.delete();
                }

                // Handle HTTP redirects up to 5 times (GitHub releases uses AWS S3 redirects)
                URL url = new URL(downloadUrl);
                HttpURLConnection connection = null;
                int redirects = 0;
                boolean redirect = false;

                do {
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setInstanceFollowRedirects(true);
                    connection.setRequestProperty("User-Agent", "DarAlHikayat-AppUpdateClient");
                    connection.setConnectTimeout(20000);
                    connection.setReadTimeout(30000);
                    connection.connect();

                    int status = connection.getResponseCode();
                    if (status == HttpURLConnection.HTTP_MOVED_TEMP
                        || status == HttpURLConnection.HTTP_MOVED_PERM
                        || status == HttpURLConnection.HTTP_SEE_OTHER
                        || status == 307
                        || status == 308) {
                        redirect = true;
                        String newUrl = connection.getHeaderField("Location");
                        url = new URL(newUrl);
                        redirects++;
                    } else {
                        redirect = false;
                    }
                } while (redirect && redirects < 6);

                int responseCode = connection.getResponseCode();
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    call.reject("Server returned HTTP " + responseCode + ": " + connection.getResponseMessage());
                    return;
                }

                long fileLength = connection.getContentLengthLong();
                if (fileLength <= 0) {
                    fileLength = connection.getContentLength();
                }

                InputStream input = connection.getInputStream();
                FileOutputStream output = new FileOutputStream(partFile);
                MessageDigest digest = MessageDigest.getInstance("SHA-256");

                byte[] data = new byte[8192];
                long total = 0;
                int count;
                long lastProgressUpdate = 0;

                while ((count = input.read(data)) != -1) {
                    total += count;
                    output.write(data, 0, count);
                    digest.update(data, 0, count);

                    long now = System.currentTimeMillis();
                    if (now - lastProgressUpdate > 100 || (fileLength > 0 && total >= fileLength)) {
                        lastProgressUpdate = now;
                        int progress = fileLength > 0 ? (int) ((total * 100) / fileLength) : 0;
                        
                        JSObject progressData = new JSObject();
                        progressData.put("progress", progress);
                        progressData.put("bytesDownloaded", total);
                        progressData.put("totalBytes", fileLength > 0 ? fileLength : -1);
                        notifyListeners("downloadProgress", progressData);
                    }
                }

                output.flush();
                output.close();
                input.close();
                connection.disconnect();

                // Compute SHA-256 Hex
                byte[] hashBytes = digest.digest();
                StringBuilder sb = new StringBuilder();
                for (byte b : hashBytes) {
                    sb.append(String.format(Locale.US, "%02x", b));
                }
                String computedSha256 = sb.toString();

                // Check SHA-256 if expected
                if (expectedSha256 != null && !expectedSha256.trim().isEmpty()) {
                    String cleanExpected = expectedSha256.trim().toLowerCase(Locale.US);
                    if (!cleanExpected.equalsIgnoreCase(computedSha256)) {
                        partFile.delete();
                        call.reject("بصمة الحماية للملف غير مطابقة (SHA-256 Mismatch). تم إلغاء التثبيت حمايةً لبياناتك.");
                        return;
                    }
                }

                // Rename .part to final .apk
                if (finalFile.exists()) {
                    finalFile.delete();
                }
                if (!partFile.renameTo(finalFile)) {
                    call.reject("تعذر تجهيز ملف التحديث النهائي");
                    return;
                }

                // Final 100% progress notification
                JSObject progressFinal = new JSObject();
                progressFinal.put("progress", 100);
                progressFinal.put("bytesDownloaded", total);
                progressFinal.put("totalBytes", total);
                notifyListeners("downloadProgress", progressFinal);

                JSObject result = new JSObject();
                result.put("success", true);
                result.put("filePath", finalFile.getAbsolutePath());
                result.put("fileSize", finalFile.length());
                result.put("sha256", computedSha256);
                call.resolve(result);

            } catch (Exception e) {
                if (partFile != null && partFile.exists()) {
                    partFile.delete();
                }
                call.reject("حدث خطأ أثناء تنزيل التحديث: " + e.getMessage(), e);
            }
        }).start();
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        try {
            String filePath = call.getString("filePath");
            if (filePath == null || filePath.trim().isEmpty()) {
                call.reject("مسار ملف APK غير موجود");
                return;
            }

            File apkFile = new File(filePath);
            if (!apkFile.exists() || apkFile.length() == 0) {
                call.reject("ملف APK غير موجود أو تالف");
                return;
            }

            Context context = getContext();
            Uri apkUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                apkFile
            );

            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            context.startActivity(intent);

            JSObject res = new JSObject();
            res.put("success", true);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("تعذر فتح شاشة تثبيت التحديث: " + e.getMessage(), e);
        }
    }
}
