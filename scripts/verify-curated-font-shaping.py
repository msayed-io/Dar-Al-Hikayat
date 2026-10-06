"""Offline QA for the eight curated additions. Requires fonttools and uharfbuzz.
Run from repository root: python3 scripts/verify-curated-font-shaping.py
Checks actual glyph coverage and HarfBuzz Arabic shaping at every offered weight.
This checks glyph availability/layout execution, not subjective visual quality.
"""
import io
import json
from pathlib import Path
from fontTools.ttLib import TTFont
import uharfbuzz as hb

ROOT = Path(__file__).resolve().parents[1] / "public/fonts/editor"
PREFIXES = ("Fustat-", "Zain-", "Rubik-", "AlanSans-", "PlaypenSansArabic-", "Estedad-", "Ruwudu-", "Mikhak-")
LETTERS = "ءآأؤإئابتثجحخدذرزسشصضطظعغفقكلمنهويىةًٌٍَُِّْ،؛؟"
SAMPLES = [
    "رَحْمَةُ تَكْتُبُ حِكَايَتَهَا الأُولَى، وَفِي الذَّاكِرَةِ ضَوْءٌ لَا يَنْطَفِئُ.",
    "أإآ ؤ ئ ء ة ى لا لأ لإ لآ ٠١٢٣٤٥٦٧٨٩ 0123456789؟؛،",
    LETTERS,
]
report = []
for asset in json.loads((ROOT / "SOURCES.json").read_text())["files"]:
    if not asset["file"].startswith(PREFIXES):
        continue
    data = (ROOT / asset["file"]).read_bytes()
    font = TTFont(io.BytesIO(data))
    cmap = font.getBestCmap()
    assert all(ord(c) in cmap for c in LETTERS), asset["file"]
    assert "GSUB" in font and "GPOS" in font, asset["file"]
    axes = {a.axisTag: (a.minValue, a.maxValue) for a in font["fvar"].axes} if "fvar" in font else {}
    lo, hi = axes.get("wght", (font["OS/2"].usWeightClass,) * 2)
    weights = sorted({lo, hi} | {w for w in range(100, 1001, 100) if lo <= w <= hi})
    for weight in weights:
        shaped = hb.Font(hb.Face(data))
        hb.ot_font_set_funcs(shaped)
        shaped.set_variations({"wght": weight})
        joining = hb.Buffer()
        joining.add_str("ببب")
        joining.direction, joining.script, joining.language = "rtl", "Arab", "ar"
        hb.shape(shaped, joining)
        isolated_beh = font.getGlyphID(cmap[ord("ب")])
        assert [g.codepoint for g in joining.glyph_infos] != [isolated_beh] * 3, (asset["file"], "joining")
        for sample in SAMPLES:
            buf = hb.Buffer()
            buf.add_str(sample)
            buf.direction, buf.script, buf.language = "rtl", "Arab", "ar"
            hb.shape(shaped, buf)
            assert all(g.codepoint != 0 for g in buf.glyph_infos), (asset["file"], weight)
    report.append({"file": asset["file"], "weights": weights, "samplesPerWeight": len(SAMPLES), "passed": True})
assert len(report) == 16, "Curated file count changed; review the QA scope"
print(json.dumps(report, ensure_ascii=False, indent=2))
