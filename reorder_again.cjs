const fs = require('fs');
const filePath = 'components/SettingsPage.tsx';
const lines = fs.readFileSync(filePath, 'utf8').split('\n');

function getChunk(startStr, nextStr) {
    const startIdx = lines.findIndex(l => l.includes(startStr));
    const nextIdx = lines.findIndex(l => l.includes(nextStr));
    if (startIdx === -1 || nextIdx === -1) throw new Error("Marker not found: " + startStr + " or " + nextStr);
    return lines.slice(startIdx, nextIdx).join('\n');
}

const beforeThemes = lines.slice(0, lines.findIndex(l => l.includes('{/* ─── 1. أجواء وثيمات الدار ─── */}'))).join('\n');

const b1_themes = getChunk(
  '{/* ─── 1. أجواء وثيمات الدار ─── */}',
  '{/* ─── 2. قفل الدار بالبصمة ─── */}'
);

const b2_lock = getChunk(
  '{/* ─── 2. قفل الدار بالبصمة ─── */}',
  '{/* ─── 3. محراب المواقيت (الموقع) ─── */}'
);

const b3_location = getChunk(
  '{/* ─── 3. محراب المواقيت (الموقع) ─── */}',
  '{/* ─── 4. أرشيف المخطوطات والنسخ الاحتياطي ─── */}'
);

const b4_archive = getChunk(
  '{/* ─── 4. أرشيف المخطوطات والنسخ الاحتياطي ─── */}',
  '{/* ─── 5. مفاتيح المساعد الأدبي ─── */}'
);

const b5_keys = getChunk(
  '{/* ─── 5. مفاتيح المساعد الأدبي ─── */}',
  '{/* ─── 6. تحديثات التطبيق (OTA) ─── */}'
);

const b6_updates = getChunk(
  '{/* ─── 6. تحديثات التطبيق (OTA) ─── */}',
  '{/* ─── الفوتر الرقيق ─── */}'
);

const footerAndRest = lines.slice(lines.findIndex(l => l.includes('{/* ─── الفوتر الرقيق ─── */}'))).join('\n');

// Adjust the comments to match the new numbers (optional but good for maintainability)
let newContent = [
    beforeThemes,
    b1_themes,
    b3_location.replace('3. محراب', '2. محراب'),
    b5_keys.replace('5. مفاتيح', '3. مفاتيح'),
    b4_archive, // Keeps 4
    b2_lock.replace('2. قفل', '5. قفل'),
    b6_updates,
    footerAndRest
].join('\n');

fs.writeFileSync(filePath, newContent, 'utf8');
console.log("Reordered successfully");
