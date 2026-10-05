/** @vitest-environment jsdom */
import { expect, it } from "vitest";
import { Document, Packer } from "docx";
import JSZip from "jszip";
import { htmlToDocxParagraphs } from "../lib/docx-export";
it("Word retains body paragraphs, mixed font families and explicit nonbold Arabic overrides", async () => {
  const paragraphs = htmlToDocxParagraphs(
    '<p style="font-family: Amiri; font-weight:700">رحمة <span style="font-family: Noto Naskh Arabic; font-weight:400">تكتب</span></p>',
    { fontSize: 18 },
  );
  expect(paragraphs).toHaveLength(1);
  const buffer = await Packer.toBuffer(
    new Document({ sections: [{ children: paragraphs }] }),
  );
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")!.async("string");
  expect(xml).toContain("رحمة");
  expect(xml).toContain("تكتب");
  expect(xml).toContain('w:cs="Amiri"');
  expect(xml).toContain('w:cs="Noto Naskh Arabic"');
  expect(xml).toContain("<w:bCs/>");
  expect(xml).toContain('<w:bCs w:val="false"/>');
});
