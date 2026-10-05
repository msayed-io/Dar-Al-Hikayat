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
it.each(['royal_classic','night_whisper','apple_dark'])('removes only the logo backing, retaining dimensions and text (%s)', async mode => {
  app.currentTheme={...theme,mode,isDark:mode!=='royal_classic'};
  await dom.render(<SplashScreen onFinish={() => {}} />);
  const img=dom.host.querySelector('img')!; const frame=img.parentElement!;
  expect(img.getAttribute('src')).toBe(`/dar-al-hikayat-logo-transparent-${mode}.png`);
  expect(img.className).toBe('w-20 h-20 object-contain relative z-20 drop-shadow-md');
  expect(frame.classList.contains('w-28')).toBe(true); expect(frame.classList.contains('h-28')).toBe(true);
  expect(frame.classList.contains('border')).toBe(true); // preserve box geometry
  expect(frame.style.background).toBe('transparent'); expect(frame.style.borderColor).toBe('transparent');expect(frame.style.boxShadow).toBe('none');
  expect(frame.parentElement!.className).toBe('relative mb-6 p-1 animate-smooth-pop');
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
