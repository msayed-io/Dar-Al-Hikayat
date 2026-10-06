import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { EDITOR_FONTS, WEIGHT_LABELS, findEditorFont, editorFontCssFamily } from "../lib/editor-fonts";
const root = "public/fonts/editor/";
const manifest = JSON.parse(readFileSync(root + "SOURCES.json", "utf8"));
function tables(bytes: Buffer) {
  const result: Record<string, number> = {};
  for (let i = 0; i < bytes.readUInt16BE(4); i++) {
    const offset = 12 + i * 16;
    result[bytes.toString("ascii", offset, offset + 4)] = bytes.readUInt32BE(offset + 8);
  }
  return result;
}
it("derives every shipped weight from actual SFNT OS/2 or fvar tables, not the manifest", () => {
  for (const family of EDITOR_FONTS.filter(f => f.files.length)) {
    const actual = new Set<number>();
    for (const file of family.files) {
      const bytes = readFileSync(root + file), table = tables(bytes);
      let low = bytes.readUInt16BE(table["OS/2"] + 4), high = low;
      if (table.fvar !== undefined) {
        const fvar = table.fvar;
        const start = fvar + bytes.readUInt16BE(fvar + 4);
        const count = bytes.readUInt16BE(fvar + 8), size = bytes.readUInt16BE(fvar + 10);
        for (let i = 0; i < count; i++) {
          const axis = start + i * size;
          if (bytes.toString("ascii", axis, axis + 4) === "wght") {
            low = bytes.readInt32BE(axis + 4) / 65536;
            high = bytes.readInt32BE(axis + 12) / 65536;
          }
        }
      }
      actual.add(low); actual.add(high);
      for (let w = 100; w <= 1000; w += 100) if (w >= low && w <= high) actual.add(w);
      expect(manifest.files.find((f: any) => f.file === file).weightRange).toEqual([low, high]);
    }
    expect(family.weights, family.id).toEqual([...actual].sort((a,b) => a-b));
    for (const weight of actual) expect(WEIGHT_LABELS[weight]).toBeTruthy();
  }
});
it("keeps the curated additions unique and Zain's missing intermediate weights unavailable", () => {
  expect(EDITOR_FONTS).toHaveLength(39);
  expect(new Set(EDITOR_FONTS.map(f => f.id)).size).toBe(EDITOR_FONTS.length);
  expect(new Set(EDITOR_FONTS.map(f => f.family)).size).toBe(EDITOR_FONTS.length);
  expect(EDITOR_FONTS.find(f => f.id === "zain")?.weights).toEqual([200,300,400,700,800,900]);
  for (const id of ["fustat","zain","rubik","alansans","playpensansarabic","estedad","ruwudu","mikhak"]) {
    const license = manifest.licenses.find((l: any) => l.family === id);
    const bytes = readFileSync(root + id + "-OFL.txt");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(license.sha256);
    expect(license.revision).toMatch(/^[0-9a-f]{40}$/);
    expect(license.url).toContain(license.revision);
  }
});

it("isolates Zain from legacy app UI and resolves the alias on reopening/export", () => {
  const zain = EDITOR_FONTS.find(f => f.id === "zain")!;
  expect(editorFontCssFamily(zain)).toBe("Dar Editor Zain");
  expect(findEditorFont('"Dar Editor Zain", serif')).toBe(zain);
  expect(findEditorFont("Zain")).toBeUndefined(); // Existing Thmanyah UI alias is not editor Zain.
  const css = readFileSync("components/EditorFonts.css", "utf8");
  expect(css).not.toMatch(/font-family:\s*["']Zain["']/);
  expect(css).toContain('font-family: "Dar Editor Zain"');
});
