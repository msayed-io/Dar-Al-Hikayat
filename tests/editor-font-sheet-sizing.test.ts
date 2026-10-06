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
it("preserves the original list layout and bounds its internal scrolling", () => {
  const wrap = css.match(/\.editor-font-list-wrap\s*\{([^}]+)\}/)![1];
  const list = css.match(/\.editor-font-list\s*\{([^}]+)\}/)![1];
  expect(wrap).not.toContain("flex:");
  expect(wrap).toContain("min-height: 0;");
  expect(list).not.toMatch(/(?:^|[;\s])height:\s*100%/);
  expect(list).toContain("max-height: 418px;");
  expect(list).toContain("max-height: min(418px, calc(100vh - 114px));");
  expect(list).toContain("overflow-y: auto;");
  expect(list).toContain("padding: 72px 20px 64px;");
});
it("keeps the original floating capsules and both magnetic dissolve overlays", () => {
  for (const selector of ["editor-font-sheet-heading", "editor-font-actions"]) {
    const rule = css.match(new RegExp("\\." + selector + "\\s*\\{([^}]+)\\}"))![1];
    expect(rule).toContain("position: absolute;");
    expect(rule).toContain("z-index: 3;");
    expect(rule).toContain("pointer-events: none;");
  }
  expect(css).toContain(".editor-font-top-dissolve.apple-magnetic-dissolve");
  expect(css).toContain(".editor-font-bottom-dissolve.apple-magnetic-dissolve-bottom");
  expect(css).toContain("height: 76px;");
  expect(css).toContain("height: 68px;");
});
