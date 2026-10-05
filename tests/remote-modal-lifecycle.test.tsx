/** @vitest-environment jsdom */
import React, { act } from 'react';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { setupDom, theme, click } from './helpers/handwriting-dom';
const app=vi.hoisted(()=>({selectedNote:null,currentTheme:{} as any,backToHome:vi.fn(),saveNote:vi.fn(),toggleTheme:vi.fn()}));
const remote=vi.hoisted(()=>({payload:null as any,status:null as any,pin:'',update:vi.fn()}));
vi.mock('../contexts/AppContext',()=>({useApp:()=>app}));
vi.mock('../lib/storage-service',()=>({StorageService:{getStoryBody:vi.fn().mockResolvedValue('')}}));
vi.mock('../components/DarAlHikayatAIAssistant',()=>({default:()=>null}));
vi.mock('../lib/remote-keyboard-service',()=>({
 listenForRemoteKeystrokes:(pin:string,payload:any,status:any)=>{remote.pin=pin;remote.payload=payload;remote.status=status;return ()=>{};},
 updateRemoteSession:remote.update,
 getDeviceLocalIp:vi.fn().mockResolvedValue({primaryIp:'192.168.1.5',connectionUrl:'http://192.168.1.5:8080/'}),
}));
import Editor from '../components/DarAlHikayatEditor';
let dom:ReturnType<typeof setupDom>;
const trigger='button[title="لوحة المفاتيح اللاسلكية الروائية (عن بُعد)"]';
const dialog=()=>document.querySelector('[role="dialog"]');
const ping=()=>act(async()=>{remote.status(true);remote.payload({sessionPin:remote.pin,type:'COMMAND',action:'PING'});});
beforeEach(()=>{dom=setupDom();app.currentTheme=theme;remote.update.mockClear();});
afterEach(()=>dom.cleanup());
it('auto-closes on first pairing, but repeated status and PING cannot dismiss reopened controls',async()=>{
 await dom.render(<Editor/>);await click(trigger);expect(dialog()).not.toBeNull();
 await ping();expect(dialog()).toBeNull();await click(trigger);expect(dialog()?.textContent).toContain('الكيبورد متصل');
 for(let i=0;i<20;i++)await ping();expect(dialog()?.textContent).toContain('قطع الاتصال');
 await act(async()=>{remote.payload({sessionPin:remote.pin,type:'KEY',char:'أ'});});expect(dialog()).not.toBeNull();
 await click('.remote-pairing-connected-dialog');expect(dialog()).not.toBeNull();
 await act(async()=>{dialog()!.parentElement!.dispatchEvent(new MouseEvent('click',{bubbles:true}));});expect(dialog()).not.toBeNull();
 const pin=remote.pin;await click('.remote-pairing-disconnect');
 expect(dialog()?.textContent).toContain('في انتظار الاتصال');expect(remote.pin).not.toBe(pin);
 expect(remote.update).toHaveBeenLastCalledWith(remote.pin,false);
});
it('explicit close preserves the connection and reopening stays stable',async()=>{
 await dom.render(<Editor/>);await ping();await click(trigger);const pin=remote.pin;
 await click('[aria-label="إغلاق نافذة الاقتران"]');expect(dialog()).toBeNull();expect(remote.pin).toBe(pin);
 await click(trigger);await ping();expect(dialog()?.textContent).toContain('الكيبورد متصل');
});
it('a genuine disconnect then reconnect still closes the pairing view once',async()=>{
 await dom.render(<Editor/>);await ping();await click(trigger);
 await act(async()=>remote.status(false));expect(dialog()?.textContent).toContain('في انتظار الاتصال');
 await ping();expect(dialog()).toBeNull();await click(trigger);await ping();expect(dialog()).not.toBeNull();
});
