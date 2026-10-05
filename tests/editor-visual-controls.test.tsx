/** @vitest-environment jsdom */
import React from "react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { setupDom, theme, click } from "./helpers/handwriting-dom";
const app = vi.hoisted(() => ({ selectedNote: null, currentTheme: {} as any, backToHome: vi.fn(), saveNote: vi.fn(), toggleTheme: vi.fn() }));
vi.mock("../contexts/AppContext", () => ({ useApp: () => app }));
vi.mock("../lib/storage-service", () => ({ StorageService: { getStoryBody: vi.fn().mockResolvedValue("") } }));
vi.mock("../components/DarAlHikayatAIAssistant", () => ({ default: () => null }));
vi.mock("../components/RemoteKeyboardModal", () => ({ default: () => null }));
vi.mock("../lib/remote-keyboard-service", () => ({ listenForRemoteKeystrokes: () => () => {}, updateRemoteSession: vi.fn() }));
import Editor from "../components/DarAlHikayatEditor";
let dom: ReturnType<typeof setupDom>;
beforeEach(() => { dom = setupDom(); app.currentTheme = theme; });
afterEach(() => dom.cleanup());
it("moves handwriting into the five-tool grid without theme switching controls", async () => {
  await dom.render(<Editor />);
  const button = dom.host.querySelector('#handwriting-mode-trigger-btn')!;
  expect(button.closest('.grid')?.children.length).toBe(5);
  expect(button.classList.contains('w-12')).toBe(true);
  expect(dom.host.querySelector('button[title="كلاسيكي ملكي"]')).toBeNull();
  expect(dom.host.querySelector('button[title="همس الليالي"]')).toBeNull();
  await click('#handwriting-mode-trigger-btn');
  expect(document.querySelector('#handwriting-document-layer')?.getAttribute('data-mode')).toBe('edit');
});
it.each([theme, { ...theme, accent: '#9FA365', isDark: true, mode: 'night_whisper' }, { ...theme, accent: '#F5F5F5', isDark: true, mode: 'apple_dark' }])("uses the active theme for the font-size track and thumb ($mode)", async current => {
  app.currentTheme = current;
  await dom.render(<Editor />);
  const range = dom.host.querySelector<HTMLInputElement>('input[aria-label="حجم الخط"]')!;
  expect(range.min).toBe('16'); expect(range.max).toBe('36');
  expect(range.style.getPropertyValue('--range-accent')).toBe(current.accent);
  expect(range.style.getPropertyValue('--range-progress')).toBe(`${(Number(range.value)-16)*5}%`);
});
