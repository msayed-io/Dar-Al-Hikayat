import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
const css = readFileSync("components/EditorFontSheet.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
it("fixes the shell independently of content with an old-WebView-safe viewport cap", () => {
  const shell = css.match(/\.editor-font-sheet\s*\{([^}]+)\}/)![1];
  expect(shell).toMatch(/height:\s*420px;/);
  expect(shell).toMatch(/max-height:\s*calc\(100vh - 112px\);/);
  expect(shell).not.toContain("dvh");
  expect(css).toContain("@supports (height: 100dvh)");
});
it("contains scrolling in a shrinkable wrapper and a full-height border-box list", () => {
  const wrap = css.match(/\.editor-font-list-wrap\s*\{([^}]+)\}/)![1];
  const list = css.match(/\.editor-font-list\s*\{([^}]+)\}/)![1];
  expect(wrap).toContain("flex: 1 1 0;");
  expect(wrap).toContain("min-height: 0;");
  expect(list).toContain("box-sizing: border-box;");
  expect(list).toContain("height: 100%;");
  expect(list).toContain("overflow-y: auto;");
  expect(list).not.toContain("max-height:");
});
