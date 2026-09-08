# 🏛️ دَارُ الحِكَايَاتِ — Dar Al-Hikayat (v3.0.0 Restored)

> محرابٌ مقدس لفنانة السرد — مشروع الكاتبة **رحمه السيد موافي**
> React 19 + TypeScript + Vite 6 + Capacitor 8 + Tailwind

## ✨ حالة النسخة 3.0.0 — مكتملة الميزات

هذا المستودع = **الكود المصدري الأصلي الحقيقي** + **ميزات النسخة الإنتاجية مسترجعة بالكامل**:

| الميزة | الحالة | المصدر |
|--------|--------|--------|
| المكتبة + المحرر + الثيمات الثلاثة + القفل البيومتري | ✅ أصلي | المصدر الأصلي (proven) |
| مواقيت الصلاة (58 مدينة، 5 طرق حساب، منبهات أصلية) | ✅ مسترجع | المرجع الذهبي (adhan) |
| تصدير PDF (html2pdf، قالب الإنتاج الحرفي) | ✅ مسترجع | المرجع الذهبي |
| تصدير Word (docx) | ✅ أصلي + محسّن | المصدر + nافذة اختيار |
| خطوط ثمانية الرسمية (Thmanyah + Zain alias) | ✅ مسترجع | المرجع الذهبي |
| PWA (manifest + service worker) | ✅ مسترجع | المرجع الذهبي |
| طبقة أندرويد (PrayerAlarm + SystemTime + أذونات) | ✅ مسترجع | APK المُفكك (منظف) |

## 🚀 التشغيل

```bash
npm install
npm run dev        # وضع التطوير
npm run build      # بناء الإنتاج
npx tsc --noEmit   # فحص الأنواع (نظيف 100%)
```

## 📱 الأندرويد

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

## 🏗️ البنية

```
├── App.tsx / index.tsx / index.html      # الجذر (خطوط ثمانية + PWA مربوطة)
├── components/
│   ├── HomePage.tsx                      # المكتبة
│   ├── DarAlHikayatEditor.tsx            # المحرر (تصدير PDF + Word)
│   ├── SettingsPage.tsx                  # إعدادات المحراب (مواقيت + أمان)
│   └── SplashScreen.tsx
├── contexts/AppContext.tsx               # الحالة + الثيمات + prayerState
├── lib/
│   ├── prayer-config.ts                  # تعريفات الصلوات والطرق والنصوص
│   ├── prayer-cities.ts                  # 58 مدينة (24 دولة)
│   ├── prayer-times.ts                   # حساب adhan + التنسيق الزمني
│   ├── prayer-alarms.ts                  # جدولة المنبهات + GPS + المدن
│   └── pdf-export.ts                     # قالب PDF الحرفي من الإنتاج
├── public/fonts/                         # خطوط ثمانية (6 woff2 + alias)
├── android/                              # Capacitor + 6 ملفات Java أصلية
└── public/ (sw.js, manifest.json)        # PWA
```

## 🎨 الثيمات
`modern_studio` · `royal_classic` · `night_whisper`

## 🔑 مفاتيح البيانات (توافق كامل مع الإنتاج)
`dar_notes` · `dar_theme` · `dar_app_lock_enabled` · `dar_prayer_location` · `dar_prayer_settings` · `dar_scheduled_alarms_data`

---
**appId:** `com.daralhikayat.app` · **سلالة المصدر:** المفكره الخاصه بدار الحكايات (AI Studio)
