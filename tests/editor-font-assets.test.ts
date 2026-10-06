import { expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { EDITOR_FONTS } from "../lib/editor-fonts";
const directory = new URL("../public/fonts/editor/", import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL("SOURCES.json", directory), "utf8"),
);
it("ships unmodified pinned upstream font files with licences and only actual weights", () => {
  expect(manifest.revision).toMatch(/^[a-f0-9]{40}$/);
  const css = readFileSync(
    new URL("../components/EditorFonts.css", import.meta.url),
    "utf8",
  );
  for (const font of EDITOR_FONTS.filter((f) => f.id !== "default")) {
    expect(existsSync(new URL(`${font.id}-OFL.txt`, directory))).toBe(true);
    const supported = new Set<number>();
    for (const name of font.files) {
      const asset = manifest.files.find((a: any) => a.file === name);
      expect(asset).toBeDefined();
      const bytes = readFileSync(new URL(name, directory));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        asset.sha256,
      );
      expect(bytes.length).toBe(asset.bytes);
      expect(bytes.readUInt32BE(0)).toBe(0x00010000);
      expect(css).toContain(`/fonts/editor/${name}`);
      supported.add(asset.weightRange[0]);
      supported.add(asset.weightRange[1]);
      for (let w = 100; w <= 1000; w += 100) {
        if (w >= asset.weightRange[0] && w <= asset.weightRange[1])
          supported.add(w);
      }
    }
    expect(font.weights).toEqual([...supported].sort((a, b) => a - b));
  }
});
