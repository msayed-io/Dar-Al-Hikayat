const fs = require('fs');
const filePath = 'components/SettingsPage.tsx';
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

const headerStart = lines.findIndex(l => l.includes('className="max-w-md mx-auto flex items-center justify-between pointer-events-none w-full"'));

if (headerStart !== -1) {
  lines[headerStart] = '        <div className="w-full max-w-5xl lg:max-w-7xl mx-auto flex items-center justify-between pointer-events-none px-2 sm:px-4 lg:px-6">';
}

const contentStart = lines.findIndex(l => l.includes('{/* Content */}'));
const footerStart = lines.findIndex(l => l.includes('{/* ─── الفوتر الرقيق ─── */}'));

if (contentStart === -1 || footerStart === -1) {
  console.log("Error finding bounds");
  process.exit(1);
}

const beforeContent = lines.slice(0, contentStart + 1).join('\n');
const afterFooter = lines.slice(footerStart).join('\n');

const newContentJSX = `      <div
        className="px-4 sm:px-6 lg:px-8 flex-1 z-10 relative w-full max-w-5xl lg:max-w-7xl mx-auto flex flex-col"
        style={{ paddingTop: "74px", paddingBottom: "48px" }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 w-full">
          {/* ─── 1. أجواء وثيمات الدار ─── */}
          <div
            className="border transition-all md:col-span-2 flex flex-col justify-center"
            style={{
              backgroundColor: currentTheme.glass,
              borderColor: currentTheme.border,
              borderRadius: "32px",
              padding: "20px 24px",
              boxShadow: \`0 8px 32px -8px \${currentTheme.shadow}\`,
            }}
          >
            <div className="flex items-center justify-between mb-4 px-1">
              <span
                className="font-zain-bold text-sm"
                style={{ color: currentTheme.accent }}
              >
                أجواء الدار
              </span>
              <span
                className="text-xs font-zain-reg opacity-60"
                style={{ color: currentTheme.text }}
              >
                {currentTheme.mode === "royal_classic"
                  ? "كلاسيكي ملكي"
                  : "همس الليالي"}
              </span>
            </div>

            <div
              className="flex p-1 border shadow-inner items-center gap-1.5"
              style={{
                backgroundColor: \`\${currentTheme.bg}90\`,
                borderColor: currentTheme.border,
                borderRadius: "9999px",
              }}
            >
              {themesCapsuleList.map((t) => {
                const isActive = currentTheme.mode === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTheme(t.id)}
                    className="flex-1 py-2 px-3 rounded-full font-zain-bold text-xs transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    style={{
                      backgroundColor: isActive ? currentTheme.accent : "transparent",
                      color: isActive ? "#FFFFFF" : currentTheme.text,
                      opacity: isActive ? 1 : 0.75,
                      boxShadow: isActive ? \`0 4px 12px -2px \${currentTheme.shadow}\` : "none",
                    }}
                  >
                    <span
                      className="w-3 h-3 rounded-full border flex-shrink-0 transition-transform"
                      style={{
                        backgroundColor: t.dotColor,
                        borderColor: isActive ? "rgba(255,255,255,0.8)" : currentTheme.border,
                        transform: isActive ? "scale(1.15)" : "scale(1)",
                      }}
                    />
                    <span className="leading-none pt-0.5">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── 2. قفل الدار بالبصمة ─── */}
          <div
            className="border transition-all flex flex-col justify-center"
            style={{
              backgroundColor: currentTheme.glass,
              borderColor: currentTheme.border,
              borderRadius: "32px",
              padding: "20px 24px",
              boxShadow: \`0 8px 32px -8px \${currentTheme.shadow}\`,
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className="w-12 h-12 flex items-center justify-center border flex-shrink-0 transition-colors"
                  style={{
                    backgroundColor: isLocked ? \`\${currentTheme.accent}15\` : \`\${currentTheme.accent}05\`,
                    borderColor: isLocked ? \`\${currentTheme.accent}30\` : currentTheme.border,
                    borderRadius: "50%",
                  }}
                >
                  {isLocked ? (
                    <Lock className="w-5 h-5" style={{ color: currentTheme.accent }} />
                  ) : (
                    <Unlock className="w-5 h-5 opacity-40" style={{ color: currentTheme.text }} />
                  )}
                </div>
                <div className="flex flex-col text-right min-w-0">
                  <span
                    className="font-zain-bold text-sm leading-tight"
                    style={{ color: currentTheme.text }}
                  >
                    قفل الدار
                  </span>
                  <span
                    className="font-zain-reg text-xs opacity-60 mt-1 leading-tight"
                    style={{ color: currentTheme.text }}
                  >
                    تأمين الحكايات بالبصمة
                  </span>
                </div>
              </div>

              <button
                onClick={toggleLock}
                className="w-12 h-6 relative transition-colors duration-300 cursor-pointer flex-shrink-0 border p-0.5"
                style={{
                  backgroundColor: isLocked ? currentTheme.accent : \`\${currentTheme.border}\`,
                  borderColor: isLocked ? currentTheme.accent : currentTheme.border,
                  borderRadius: "9999px",
                }}
                aria-label="تبديل قفل التطبيق"
              >
                <div
                  className={\`w-5 h-5 bg-white transition-all duration-300 shadow-md flex items-center justify-center \${
                    isLocked ? "mr-auto ml-0" : "ml-auto mr-0"
                  }\`}
                  style={{ borderRadius: "50%" }}
                >
                  {isLocked && <Check className="w-3 h-3 text-[#2C3E30] stroke-[3]" />}
                </div>
              </button>
            </div>
          </div>

          {/* ─── 3. محراب المواقيت (الموقع) ─── */}
          <div
            className="border transition-all flex flex-col justify-center"
            style={{
              backgroundColor: currentTheme.glass,
              borderColor: currentTheme.border,
              borderRadius: "32px",
              padding: "20px 24px",
              boxShadow: \`0 8px 32px -8px \${currentTheme.shadow}\`,
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className="w-12 h-12 flex items-center justify-center border flex-shrink-0"
                  style={{
                    backgroundColor: \`\${currentTheme.accent}10\`,
                    borderColor: \`\${currentTheme.accent}20\`,
                    borderRadius: "50%",
                  }}
                >
                  <MapPin className="w-5 h-5" style={{ color: currentTheme.accent }} />
                </div>
                <div className="flex flex-col text-right min-w-0">
                  <span
                    className="font-zain-bold text-sm leading-tight"
                    style={{ color: currentTheme.text }}
                  >
                    موقع الصلاة
                  </span>
                  <span
                    className="font-zain-reg text-xs opacity-60 mt-1 leading-tight truncate"
                    style={{ color: currentTheme.text }}
                  >
                    {prayerState.location
                      ? \`\${prayerState.location.cityNameAr || prayerState.location.cityName}\`
                      : "تحديد الموقع..."}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={openLocationSheet}
                  className="h-8 px-3.5 rounded-full border text-xs font-zain-bold transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                  style={{
                    backgroundColor: \`\${currentTheme.accent}10\`,
                    borderColor: \`\${currentTheme.accent}30\`,
                    color: currentTheme.accent,
                    whiteSpace: "nowrap",
                  }}
                >
                  تغيير
                </button>
                <button
                  onClick={handleAutoDetect}
                  disabled={isDetecting}
                  className="w-8 h-8 rounded-full border transition-all active:scale-95 flex items-center justify-center cursor-pointer"
                  style={{
                    backgroundColor: \`\${currentTheme.bg}80\`,
                    borderColor: currentTheme.border,
                    color: currentTheme.accent,
                  }}
                >
                  {isDetecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Compass className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* ─── 4. أرشيف المخطوطات والنسخ الاحتياطي ─── */}
          <div
            className="border transition-all flex flex-col gap-4 justify-center"
            style={{
              backgroundColor: currentTheme.glass,
              borderColor: currentTheme.border,
              borderRadius: "32px",
              padding: "20px 24px",
              boxShadow: \`0 8px 32px -8px \${currentTheme.shadow}\`,
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className="w-12 h-12 flex items-center justify-center border flex-shrink-0"
                  style={{
                    backgroundColor: \`\${currentTheme.accent}10\`,
                    borderColor: \`\${currentTheme.accent}20\`,
                    borderRadius: "50%",
                  }}
                >
                  <Download className="w-5 h-5" style={{ color: currentTheme.accent }} />
                </div>
                <div className="flex flex-col text-right min-w-0">
                  <span
                    className="font-zain-bold text-sm leading-tight"
                    style={{ color: currentTheme.text }}
                  >
                    أرشيف الحكايات
                  </span>
                  <span
                    className="font-zain-reg text-xs opacity-60 mt-1 leading-tight"
                    style={{ color: currentTheme.text }}
                  >
                    {totalNotesCount} حكاية • {totalWordsCount.toLocaleString("ar-EG")} كلمة
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportBackup}
                className="flex-1 h-9 rounded-full font-zain-bold text-xs border transition-all active:scale-95 flex items-center justify-center cursor-pointer gap-2"
                style={{
                  backgroundColor: \`\${currentTheme.accent}10\`,
                  borderColor: \`\${currentTheme.accent}30\`,
                  color: currentTheme.accent,
                }}
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصدير</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 h-9 rounded-full font-zain-bold text-xs border transition-all active:scale-95 flex items-center justify-center cursor-pointer gap-2"
                style={{
                  backgroundColor: \`\${currentTheme.bg}80\`,
                  borderColor: currentTheme.border,
                  color: currentTheme.text,
                }}
              >
                <Upload className="w-3.5 h-3.5" style={{ color: currentTheme.accent }} />
                <span>استيراد</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />
            </div>
          </div>

          {/* ─── 5. مفاتيح المساعد الأدبي ─── */}
          <div
            className="border transition-all flex flex-col gap-4 justify-center"
            style={{
              backgroundColor: currentTheme.glass,
              borderColor: currentTheme.border,
              borderRadius: "32px",
              padding: "20px 24px",
              boxShadow: \`0 8px 32px -8px \${currentTheme.shadow}\`,
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className="w-12 h-12 flex items-center justify-center border flex-shrink-0"
                  style={{
                    backgroundColor: \`\${currentTheme.accent}10\`,
                    borderColor: \`\${currentTheme.accent}20\`,
                    borderRadius: "50%",
                  }}
                >
                  <KeyRound className="w-5 h-5" style={{ color: currentTheme.accent }} />
                </div>
                <div className="flex flex-col text-right min-w-0">
                  <span
                    className="font-zain-bold text-sm leading-tight"
                    style={{ color: currentTheme.text }}
                  >
                    مفاتيح المساعد
                  </span>
                  <span
                    className="font-zain-reg text-xs opacity-60 mt-1 leading-tight"
                    style={{ color: currentTheme.text }}
                  >
                    {managedKeys.length > 0 ? \`\${managedKeys.length} مفاتيح مُضافة\` : "تبديل تلقائي للمفاتيح"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setAddKeyError(null);
                  setNewKeyInput("");
                  setNewKeyLabel("");
                  setShowAddKeyDialog(true);
                }}
                className="w-9 h-9 rounded-full border transition-all active:scale-95 flex items-center justify-center cursor-pointer flex-shrink-0"
                style={{
                  backgroundColor: \`\${currentTheme.accent}10\`,
                  borderColor: \`\${currentTheme.accent}30\`,
                  color: currentTheme.accent,
                }}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* List of Collapsed Key Cards / Empty State */}
            {managedKeys.length > 0 && (
              <div className="flex flex-col gap-2">
                {managedKeys.slice(0, 2).map((item) => {
                  const isActive = item.status === "active";
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 border rounded-2xl transition-all"
                      style={{
                        backgroundColor: \`\${currentTheme.bg}70\`,
                        borderColor: currentTheme.border,
                      }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-6 h-6 flex items-center justify-center border rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: \`\${currentTheme.accent}10\`,
                            borderColor: \`\${currentTheme.accent}25\`,
                          }}
                        >
                          <KeyRound className="w-3 h-3" style={{ color: currentTheme.accent }} />
                        </div>
                        <span
                          className="font-zain-bold text-xs truncate"
                          style={{ color: currentTheme.text }}
                        >
                          {item.label || "مفتاح API"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        )}
                        <button
                          onClick={() => setKeyToDelete(item)}
                          className="p-1 rounded-full opacity-50 hover:opacity-100 hover:text-red-500 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {managedKeys.length > 2 && (
                  <div className="text-center text-[10px] font-zain-bold opacity-50 mt-1">
                    +{managedKeys.length - 2} مفاتيح أخرى
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── 6. تحديثات التطبيق (OTA) ─── */}
          <div
            className="border transition-all flex flex-col justify-center"
            style={{
              backgroundColor: currentTheme.glass,
              borderColor: currentTheme.border,
              borderRadius: "32px",
              padding: "20px 24px",
              boxShadow: \`0 8px 32px -8px \${currentTheme.shadow}\`,
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className="w-12 h-12 flex items-center justify-center border flex-shrink-0 relative"
                  style={{
                    backgroundColor: \`\${currentTheme.accent}10\`,
                    borderColor: \`\${currentTheme.accent}20\`,
                    borderRadius: "50%",
                  }}
                >
                  <Smartphone className="w-5 h-5" style={{ color: currentTheme.accent }} />
                  {appVersion && (
                    <div
                      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border flex items-center justify-center shadow-sm"
                      style={{
                        backgroundColor: currentTheme.bg,
                        borderColor: currentTheme.border,
                      }}
                    >
                      <Sparkles className="w-2.5 h-2.5" style={{ color: currentTheme.accent }} />
                    </div>
                  )}
                </div>
                <div className="flex flex-col text-right min-w-0">
                  <span
                    className="font-zain-bold text-sm leading-tight"
                    style={{ color: currentTheme.text }}
                  >
                    تحديثات التطبيق
                  </span>
                  <span
                    className="font-zain-reg text-xs opacity-60 mt-1 leading-tight"
                    style={{ color: currentTheme.text }}
                  >
                    الإصدار {appVersion ? appVersion.versionName : "الحالي"}
                  </span>
                </div>
              </div>
              <button
                onClick={handleCheckUpdateNow}
                disabled={isCheckingUpdate}
                className="h-8 px-3.5 rounded-full border text-xs font-zain-bold transition-all active:scale-95 flex items-center justify-center cursor-pointer gap-1.5 flex-shrink-0"
                style={{
                  backgroundColor: \`\${currentTheme.accent}10\`,
                  borderColor: \`\${currentTheme.accent}30\`,
                  color: currentTheme.accent,
                  opacity: isCheckingUpdate ? 0.7 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {isCheckingUpdate ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>فحص</span>
              </button>
            </div>
            
            {updateFeedback && (
              <div
                className="mt-4 flex items-center gap-2 px-3 py-2 rounded-2xl text-[11px] font-zain-bold border animate-in fade-in"
                style={{
                  backgroundColor: updateFeedback.success
                    ? "rgba(16, 185, 129, 0.08)"
                    : "rgba(239, 68, 68, 0.08)",
                  borderColor: updateFeedback.success
                    ? "rgba(16, 185, 129, 0.25)"
                    : "rgba(239, 68, 68, 0.25)",
                  color: updateFeedback.success ? "#059669" : "#dc2626",
                }}
              >
                {updateFeedback.success ? (
                  updateFeedback.isLatest ? (
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                  ) : (
                    <ArrowUpCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  )
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                <span className="leading-tight">{updateFeedback.message}</span>
              </div>
            )}
          </div>
        </div>
      </div>
`;

const finalContent = beforeContent + '\n' + newContentJSX + '\n' + afterFooter;

fs.writeFileSync('components/SettingsPage.cjs.tsx', finalContent, 'utf8');
