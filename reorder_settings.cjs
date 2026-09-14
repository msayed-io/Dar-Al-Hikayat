const fs = require('fs');
const filePath = 'components/SettingsPage.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

function getBlock(startMarker, endMarker) {
    const startIndex = lines.findIndex(l => l.includes(startMarker));
    let endIndex = startIndex;
    if (endMarker) {
        endIndex = lines.findIndex((l, i) => i > startIndex && l.includes(endMarker));
        // Back up slightly if we caught something else, but here we will just use exact indices if we know them.
    }
    return { startIndex, endIndex };
}

// Since we know exact line bounds or markers, let's use a robust approach
function getChunk(startStr, nextStr) {
    const startIdx = lines.findIndex(l => l.includes(startStr));
    const nextIdx = lines.findIndex(l => l.includes(nextStr));
    if (startIdx === -1 || nextIdx === -1) throw new Error("Marker not found");
    return lines.slice(startIdx, nextIdx).join('\n');
}

const headerChunk = lines.slice(0, lines.findIndex(l => l.includes('        {/* ─── قسم أجواء وثيمات الدار (الكبسولة المدمجة الأنيقة) ─── */}'))).join('\n');

const b1_themes = getChunk(
  '{/* ─── قسم أجواء وثيمات الدار (الكبسولة المدمجة الأنيقة) ─── */}',
  '{/* ─── قسم محراب المواقيت (الموقع والتنبيهات الذكية) ─── */}'
);

const b2_location = getChunk(
  '{/* ─── قسم محراب المواقيت (الموقع والتنبيهات الذكية) ─── */}',
  '{/* ─── قسم قفل الدار (تصميم كبسولي مدمج ومفتاح سلس راقٍ) ─── */}'
);

const b3_lock = getChunk(
  '{/* ─── قسم قفل الدار (تصميم كبسولي مدمج ومفتاح سلس راقٍ) ─── */}',
  '{/* ─── قسم مفاتيح الاتصال بالمساعد الأدبي (Multi-Key Rotation System) ─── */}'
);

const b4_keys = getChunk(
  '{/* ─── قسم مفاتيح الاتصال بالمساعد الأدبي (Multi-Key Rotation System) ─── */}',
  '{/* ─── قسم أرشيف الحكايات والنسخ الاحتياطي (تصميم متناسق ومدمج) ─── */}'
);

const b5_backup = getChunk(
  '{/* ─── قسم أرشيف الحكايات والنسخ الاحتياطي (تصميم متناسق ومدمج) ─── */}',
  '{/* ─── قسم تحديثات التطبيق والإصدار (OTA In-App Updates) ─── */}'
);

const b6_updates = getChunk(
  '{/* ─── قسم تحديثات التطبيق والإصدار (OTA In-App Updates) ─── */}',
  '{/* ─── الفوتر الرقيق ─── */}'
);

const footerAndRestIdx = lines.findIndex(l => l.includes('{/* ─── الفوتر الرقيق ─── */}'));
const footerAndRest = lines.slice(footerAndRestIdx).join('\n');

// Build the new content
// Replace gap-3.5 with gap-4
let newHeaderChunk = headerChunk.replace('gap-3.5', 'gap-4');

const newContent = [
    newHeaderChunk,
    b1_themes,
    b3_lock,
    b2_location,
    b5_backup,
    b4_keys,
    b6_updates,
    footerAndRest
].join('\n');

fs.writeFileSync(filePath, newContent, 'utf8');
console.log("File reordered successfully");
