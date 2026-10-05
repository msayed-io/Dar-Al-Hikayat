/** @vitest-environment jsdom */
import React, { act } from "react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { setupDom, theme } from "./helpers/handwriting-dom";
const app = vi.hoisted(() => ({ currentTheme: {} as any }));
vi.mock("../contexts/AppContext", () => ({ useApp: () => app }));
import SplashScreen from "../components/SplashScreen";
let dom: ReturnType<typeof setupDom>;
beforeEach(() => { dom=setupDom(); app.currentTheme=theme; });
afterEach(() => { dom.cleanup(); vi.useRealTimers(); });
it.each(['royal_classic','night_whisper','apple_dark'])('keeps the transparent logo and gives the title/byline a scoped hierarchy (%s)', async mode => {
  app.currentTheme={...theme,mode,isDark:mode!=='royal_classic'};
  await dom.render(<SplashScreen onFinish={() => {}} />);
  const img=dom.host.querySelector('img')!; const frame=img.parentElement!;
  expect(img.getAttribute('src')).toBe(`/dar-al-hikayat-logo-transparent-${mode}.png`);
  expect(img.style.width).toBe('64px'); expect(img.style.height).toBe('64px');
  expect(frame.style.width).toBe('64px'); expect(frame.style.height).toBe('64px');
  expect(frame.style.background).toBe('transparent'); expect(frame.style.borderColor).toBe('transparent');expect(frame.style.boxShadow).toBe('none');
  expect(frame.parentElement!.classList.contains('animate-smooth-pop')).toBe(true);
  expect(frame.parentElement!.style.marginBottom).toBe('16px');
  const title=dom.host.querySelector('h1')!; const byline=dom.host.querySelector('p')!;
  expect(title.style.fontSize).toBe('clamp(32px, 5vw, 36px)');
  expect(title.style.fontFamily).toContain('Thmanyah Serif Display');
  expect(byline.style.fontFamily).toContain('Thmanyah Serif Text');
  expect(byline.style.fontSize).toBe('14px');
  expect(byline.style.letterSpacing).toBe('normal');
  expect(dom.host.querySelector('h1')!.textContent).toBe('دَارُ الحِكَايَاتِ');
  expect(dom.host.querySelector('p')!.textContent).toBe('للكاتبة رحمه السيد موافي');
});
it('preserves the 1400ms exit and 1900ms finish timings',async()=>{
  vi.useFakeTimers();const finish=vi.fn();await dom.render(<SplashScreen onFinish={finish}/>);
  await act(async()=>{vi.advanceTimersByTime(1399)});expect(finish).not.toHaveBeenCalled();expect(dom.host.firstElementChild!.className).toContain('opacity-100');
  await act(async()=>{vi.advanceTimersByTime(1)});expect(dom.host.firstElementChild!.className).toContain('opacity-0');
  await act(async()=>{vi.advanceTimersByTime(499)});expect(finish).not.toHaveBeenCalled();
  await act(async()=>{vi.advanceTimersByTime(1)});expect(finish).toHaveBeenCalledTimes(1);
});
