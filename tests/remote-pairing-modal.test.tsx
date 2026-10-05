/** @vitest-environment jsdom */
import React from 'react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { setupDom, theme, click } from './helpers/handwriting-dom';
const network=vi.hoisted(()=>({get:vi.fn()}));
vi.mock('../lib/remote-keyboard-service',()=>({getDeviceLocalIp:network.get}));
vi.mock('qrcode.react',()=>({QRCodeSVG:({value,size}:any)=><svg data-pairing-url={value} width={size}/> }));
import Modal from '../components/RemoteKeyboardModal';
let dom:ReturnType<typeof setupDom>;
let close=vi.fn<() => void>(),disconnect=vi.fn<() => void>();
const render=(connected=false,open=true)=>dom.render(<Modal isOpen={open} isConnected={connected} onClose={close} onDisconnect={disconnect} sessionPin="481780" currentTheme={theme}/>);
beforeEach(()=>{dom=setupDom();close=vi.fn();disconnect=vi.fn();network.get.mockReset().mockResolvedValue({primaryIp:'192.168.1.5',connectionUrl:'http://192.168.1.5:8787'});});
afterEach(()=>dom.cleanup());
it('keeps the exact pairing URL and both steps, removes the footer and supplementary copy',async()=>{
 await render();expect(dom.host.querySelector('svg[data-pairing-url]')!.getAttribute('data-pairing-url')).toBe('http://192.168.1.5:8787?pin=481780');
 expect(dom.host.textContent).toContain('١. افتحي تطبيق');expect(dom.host.textContent).toContain('٢. امسحي الرمز');
 expect(dom.host.querySelector('[role="status"]')!.textContent).toBe('في انتظار الاتصال');
 expect(dom.host.textContent).not.toContain('الانتقال للمحرر');expect(dom.host.textContent).not.toContain('المسار الرسمي');expect(dom.host.textContent).not.toContain('الفأرة');
 expect(dom.host.querySelectorAll('button')).toHaveLength(1);
});
it('connected state has one concise message, one disconnect action and no QR or duplicate panels',async()=>{
 await render(true);expect(dom.host.querySelector('[role="status"]')!.textContent).toBe('الكيبورد متصل');expect(dom.host.querySelector('svg[data-pairing-url]')).toBeNull();
 expect(dom.host.textContent).toContain('الهاتف جاهز للكتابة.');expect(dom.host.querySelectorAll('button')).toHaveLength(2);
 expect(dom.host.textContent).not.toContain('الانتقال للمحرر');expect(dom.host.textContent).not.toContain('التابلت');
 await click('.remote-pairing-disconnect');expect(disconnect).toHaveBeenCalledTimes(1);expect(close).not.toHaveBeenCalled();
});
it.each([false,true])('closing only dismisses the dialog, does not disconnect (%s)',async connected=>{
 await render(connected);await click('[aria-label="إغلاق نافذة الاقتران"]');expect(close).toHaveBeenCalledTimes(1);expect(disconnect).not.toHaveBeenCalled();
});
it('inside clicks do not close, backdrop clicks retain existing dismiss behavior',async()=>{
 await render();await click('[role="dialog"]');expect(close).not.toHaveBeenCalled();await click('[dir="rtl"]');expect(close).toHaveBeenCalledTimes(1);expect(disconnect).not.toHaveBeenCalled();
});
it('closed modal does not start network lookup and keeps loading placeholder when network is unavailable',async()=>{
 await render(false,false);expect(dom.host.textContent).toBe('');expect(network.get).not.toHaveBeenCalled();network.get.mockResolvedValue(null);await render();expect(dom.host.textContent).toContain('جارٍ تشغيل السيرفر المحلي');
});
it('switches from connected back to QR without changing the PIN or triggering another action',async()=>{
 await render(true);await render(false);expect(dom.host.querySelector('[data-pairing-url]')!.getAttribute('data-pairing-url')).toContain('pin=481780');expect(disconnect).not.toHaveBeenCalled();expect(close).not.toHaveBeenCalled();
});

it('copies the lock dialog dimensions and theme pill buttons only while connected',async()=>{
 await render(true); const d=dom.host.querySelector<HTMLElement>('[role="dialog"]')!;
 expect(d.style.width).toBe('260px');expect(d.style.maxWidth).toBe('calc(100vw - 32px)');expect(d.style.borderRadius).toBe('28px');expect(d.style.padding).toBe('24px 20px');
 const button=dom.host.querySelector<HTMLButtonElement>('.remote-pairing-disconnect')!;
 expect(button.style.borderRadius).toBe('9999px');expect(button.style.height).toBe('34px');expect(button.parentElement!.querySelectorAll('button')).toHaveLength(2);
 expect(button.style.backgroundColor).toBe('rgb(167, 170, 99)');
 await render(false);expect(d.style.width).toBe('384px');expect(d.style.padding).toBe('24px 20px');expect(d.classList.contains('max-w-sm')).toBe(true);
});

it('uses lock styling for waiting while keeping its 384px width and inline status',async()=>{
 await render();const d=dom.host.querySelector<HTMLElement>('[role="dialog"]')!;
 expect(d.style.width).toBe('384px');expect(d.style.maxWidth).toBe('calc(100vw - 32px)');expect(d.style.borderRadius).toBe('28px');expect(d.style.padding).toBe('24px 20px');
 expect(dom.host.querySelector('.remote-pairing-waiting-icon svg')).not.toBeNull();
 expect(dom.host.querySelector('.remote-pairing-header [role="status"]')).not.toBeNull();
 expect(dom.host.querySelectorAll('button')).toHaveLength(1);
});
