const fs = require('fs');
const filePath = 'components/SettingsPage.tsx';
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
const footerIndex = lines.findIndex(l => l.includes('{/* ─── الفوتر الرقيق ─── */}'));

if (footerIndex !== -1 && lines[footerIndex - 2] === '      </div>') {
    lines.splice(footerIndex - 2, 1);
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log("Fixed extra div");
} else {
    console.log("Could not find the extra div exactly 2 lines above the footer.");
}
