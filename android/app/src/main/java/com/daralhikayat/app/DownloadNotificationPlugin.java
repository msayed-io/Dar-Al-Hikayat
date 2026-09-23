package com.daralhikayat.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "DownloadNotification")
public class DownloadNotificationPlugin extends Plugin {

    private static final String CHANNEL_ID = "download_channel";
    private static final int NOTIFICATION_ID = 4001;

    @PluginMethod
    public void startDownload(PluginCall call) {
        String filename = call.getString("filename", "document.pdf");
        String base64Data = call.getString("base64", "");

        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("Base64 data is empty");
            return;
        }

        // Run the download and notification update on a background thread
        new Thread(() -> {
            try {
                Context context = getContext();
                NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

                // Create Notification Channel for Android O+
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    NotificationChannel channel = new NotificationChannel(
                        CHANNEL_ID,
                        "تحميل الملفات",
                        NotificationManager.IMPORTANCE_LOW
                    );
                    channel.setDescription("إشعارات تنزيل ملفات الروايات والحكايات");
                    if (notificationManager != null) {
                        notificationManager.createNotificationChannel(channel);
                    }
                }

                // Decode base64 data
                byte[] decodedBytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);

                // Save file to Downloads folder
                boolean saveSuccess = false;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
                    String mimeType = filename.endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                    values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                    ContentResolver resolver = context.getContentResolver();
                    Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        try (OutputStream os = resolver.openOutputStream(uri)) {
                            if (os != null) {
                                os.write(decodedBytes);
                                saveSuccess = true;
                            }
                        }
                    }
                } else {
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!downloadsDir.exists()) {
                        downloadsDir.mkdirs();
                    }
                    File file = new File(downloadsDir, filename);
                    try (FileOutputStream fos = new FileOutputStream(file)) {
                        fos.write(decodedBytes);
                        saveSuccess = true;
                    }
                }

                if (!saveSuccess) {
                    call.reject("Failed to save file to Downloads directory");
                    return;
                }

                // Setup notification builder with native download progress
                NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                    .setSmallIcon(android.R.drawable.stat_sys_download)
                    .setContentTitle("جاري تنزيل ملف " + filename)
                    .setContentText("التقدم: 0%")
                    .setOngoing(true)
                    .setPriority(NotificationCompat.PRIORITY_LOW)
                    .setProgress(100, 0, false);

                // Start simulating/updating smooth progress bar updates
                for (int progress = 0; progress <= 100; progress += 10) {
                    builder.setProgress(100, progress, false)
                           .setContentText("التقدم: " + progress + "%");
                    if (notificationManager != null) {
                        notificationManager.notify(NOTIFICATION_ID, builder.build());
                    }
                    try {
                        Thread.sleep(150); // Updates over 1.5 seconds for visible elegant feel
                    } catch (InterruptedException ignored) {}
                }

                // Download completed, update notification with "تم" and dismiss it after a brief delay
                builder.setSmallIcon(android.R.drawable.stat_sys_download_done)
                       .setContentTitle("تم تنزيل " + filename)
                       .setContentText("تم")
                       .setProgress(0, 0, false)
                       .setOngoing(false);
                
                if (notificationManager != null) {
                    notificationManager.notify(NOTIFICATION_ID, builder.build());
                }

                try {
                    Thread.sleep(1500); // Wait 1.5 seconds so user can see "تم" in the notification drawer
                } catch (InterruptedException ignored) {}

                if (notificationManager != null) {
                    notificationManager.cancel(NOTIFICATION_ID);
                }

                JSObject result = new JSObject();
                result.put("success", true);
                result.put("filename", filename);
                call.resolve(result);

            } catch (Exception e) {
                call.reject("Error in downloading with notifications", e);
            }
        }).start();
    }
}
