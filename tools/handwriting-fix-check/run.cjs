/* Real Canvas regression checks. Desktop Chromium is NOT an Android acceptance test. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const dest = process.env.HW_EVIDENCE || '/home/user/handwriting-fix-evidence';
fs.mkdirSync(dest, { recursive: true });
const edited = process.env.HW_URL || 'http://localhost:3170';
const original = process.env.HW_ORIGINAL || 'http://localhost:3171';
const route = '/tools/handwriting-fix-check/';
const fixture = [{id:'legacy', color:'#121A1B',width:3.5,points:[{x:60,y:190,pressure:.5,time:0},{x:150,y:240,pressure:.5,time:16},{x:240,y:170,pressure:.5,time:32}]}];
async function setup(browser, url, dark=false) {
 const p = await browser.newPage({viewport:{width:390,height:820},deviceScaleFactor:2,hasTouch:true});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(url+route+(dark?'?dark=1':''));await p.waitForFunction(()=>!!window.__hwBaseline);
 await p.evaluate(()=>window.__hwBaseline.mode('edit'));await p.waitForSelector('#handwriting-canvas-layer');await p.waitForTimeout(450);
 await install(p);return {p,errors};
}
async function install(p) {await p.evaluate(()=>{
 window.probe={event(t,x,y){(t==='pointerdown'?document.getElementById('handwriting-canvas-layer'):window).dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,pointerId:1,pointerType:'pen',clientX:x,clientY:y,pressure:.5,buttons:t==='pointerup'?0:1}));},
 alpha(x,y){const c=document.getElementById('handwriting-canvas-layer');return c.getContext('2d').getImageData(x*2,y*2,1,1).data[3];},
 image(){return document.getElementById('handwriting-canvas-layer').toDataURL();},
 circle(){this.event('pointerdown',280,330);for(let i=1;i<=32;i++){let t=i*Math.PI/16;this.event('pointermove',190+90*Math.cos(t),330+90*Math.sin(t));}},
 };});}
async function shot(p){return p.evaluate(()=>probe.image());}
async function clear(p){await p.evaluate(()=>window.__hwBaseline.clear());await p.waitForTimeout(30);}
async function circle(p,ms=0,event='pointerup'){await p.evaluate(()=>probe.circle());if(ms)await p.waitForTimeout(ms);await p.evaluate(event=>{if(event==='blur')window.dispatchEvent(new Event('blur'));else probe.event(event,280,330);},event);await p.waitForTimeout(30);}
(async()=>{const browser=await chromium.launch();const results=[];try {
 // Immutable old-content image and toolbar geometry compare, both themes.
 for(const dark of [false,true]){
  let images=[],geometries=[];
  for(const url of [original,edited]){const {p,errors}=await setup(browser,url,dark);await p.evaluate(s=>window.__hwBaseline.load(s),fixture);await p.waitForTimeout(80);images.push(await shot(p));geometries.push(await p.locator('[id^="handwriting-btn-"]').evaluateAll(es=>es.map(e=>({id:e.id,rect:JSON.stringify(e.getBoundingClientRect()),class:e.className}))));await p.screenshot({path:`${dest}/${url===original?'original':'fixed'}-${dark?'dark':'light'}.png`});assert.deepEqual(errors,[]);await p.close();}
  assert.equal(images[0],images[1],'Legacy pixels changed');assert.deepEqual(geometries[0],geometries[1],'Toolbar layout/classes changed');results.push({legacyTheme:dark?'dark':'light',exactPixels:true,exactToolbar:true});
 }
 for(let round=1;round<=3;round++){
  const {p,errors}=await setup(browser,edited);
  const first=await p.evaluate(()=>{const t=performance.now();probe.event('pointerdown',70,250);return {alpha:probe.alpha(70,250),cpuMs:performance.now()-t};});assert(first.alpha>0);
  await p.evaluate(()=>{for(let i=1;i<=35;i++)probe.event('pointermove',70+i*7,250+Math.sin(i*.25)*35);});
  const live=await shot(p);await p.evaluate(()=>probe.event('pointerup',315,270));await p.waitForTimeout(30);
  assert.equal(await shot(p),live,'Pen changes at lift');
  const savedVectors=await p.evaluate(()=>window.__hwBaseline.strokes());assert.equal(savedVectors[0].renderVersion,1);assert(savedVectors[0].points.every(x=>x.inkWidth>0));
  await p.locator('#handwriting-btn-eraser').click();await p.locator('#handwriting-btn-pen').click();assert.equal(await shot(p),live);
  await p.evaluate(()=>window.__hwBaseline.undo());assert.equal(await p.evaluate(()=>probe.alpha(70,250)),0);
  await p.evaluate(()=>window.__hwBaseline.redo());assert.equal(await shot(p),live);
  await p.evaluate(()=>window.__hwBaseline.save());await p.goto(edited+route+'?restore=1');await p.waitForFunction(()=>!!window.__hwBaseline);await p.waitForSelector('#handwriting-canvas-layer');await p.waitForTimeout(450);await install(p);
  assert.deepEqual(await p.evaluate(()=>window.__hwBaseline.strokes()),savedVectors);assert.equal(await shot(p),live,'Reopen changes pixels');
  // Lasso selection frame is visible, but excluded from image exports.
  await p.locator('#handwriting-btn-lasso').click();await p.evaluate(()=>{probe.event('pointerdown',40,190);for(const [x,y]of[[345,190],[345,315],[40,315],[40,190]])probe.event('pointermove',x,y);probe.event('pointerup',40,190);});await p.waitForTimeout(60);
  assert.notEqual(await shot(p),live);assert.equal(await p.evaluate(()=>window.__hwBaseline.exportImage()),live,'Selection handles leaked into export');
  await p.evaluate(()=>{probe.event('pointerdown',190,250);probe.event('pointermove',205,265);probe.event('pointermove',220,280);probe.event('pointerup',220,280);});
  const moved=(await p.evaluate(()=>window.__hwBaseline.strokes()))[0];assert.equal(moved.points[0].x,savedVectors[0].points[0].x+30);assert.equal(moved.points[0].y,savedVectors[0].points[0].y+30);assert.equal(moved.points[5].inkWidth,savedVectors[0].points[5].inkWidth);
  await p.evaluate(()=>window.__hwBaseline.undo());assert.equal(await shot(p),live);
  // Select again, then drag the lower-right corner to double size about top-left.
  await p.evaluate(()=>{probe.event('pointerdown',40,190);for(const [x,y]of[[345,190],[345,315],[40,315],[40,190]])probe.event('pointermove',x,y);probe.event('pointerup',40,190);});
  await p.evaluate(()=>{const pts=window.__hwBaseline.strokes()[0].points;const left=Math.min(...pts.map(p=>p.x))-12,top=Math.min(...pts.map(p=>p.y))-12,right=Math.max(...pts.map(p=>p.x))+12,bottom=Math.max(...pts.map(p=>p.y))+12;probe.event('pointerdown',right,bottom);probe.event('pointermove',left+2*(right-left),top+2*(bottom-top));probe.event('pointerup',left+2*(right-left),top+2*(bottom-top));});
  const scaled=(await p.evaluate(()=>window.__hwBaseline.strokes()))[0];assert(Math.abs(scaled.width-savedVectors[0].width*2)<1e-8);assert(Math.abs(scaled.points[5].inkWidth-savedVectors[0].points[5].inkWidth*2)<1e-8);
  await p.evaluate(()=>window.__hwBaseline.undo());assert.equal(await shot(p),live);
  await p.locator('#handwriting-btn-pen').click();await clear(p);
  await circle(p);assert.notEqual((await p.evaluate(()=>window.__hwBaseline.strokes()))[0].tool,'shape');
  await clear(p);await circle(p,550);const shape=(await p.evaluate(()=>window.__hwBaseline.strokes()))[0];assert.equal(shape.tool,'shape');
  await p.evaluate(()=>window.__hwBaseline.undo());assert.deepEqual((await p.evaluate(()=>window.__hwBaseline.strokes()))[0].points,shape.originalPoints);
  await p.evaluate(()=>window.__hwBaseline.redo());assert.equal((await p.evaluate(()=>window.__hwBaseline.strokes()))[0].tool,'shape');
  await clear(p);await p.evaluate(()=>probe.circle());await p.waitForTimeout(550);await p.evaluate(()=>{probe.event('pointermove',305,345);probe.event('pointerup',305,345);});assert.notEqual((await p.evaluate(()=>window.__hwBaseline.strokes()))[0].tool,'shape');
  for(const event of ['pointercancel','blur']){await clear(p);await circle(p,550,event);assert.notEqual((await p.evaluate(()=>window.__hwBaseline.strokes()))[0].tool,'shape');}
  await clear(p);await p.locator('#handwriting-btn-highlighter').click();const hAlpha=await p.evaluate(()=>{probe.event('pointerdown',100,330);return probe.alpha(100,330);});assert(hAlpha>0,'Highlighter first pixel delayed');
  await p.evaluate(()=>{for(let i=1;i<30;i++)probe.event('pointermove',100+i*5,330);});await p.waitForTimeout(40);const hl=await shot(p);await p.evaluate(()=>probe.event('pointerup',245,330));await p.waitForTimeout(40);assert.equal(await shot(p),hl,'Highlighter changes on lift');
  await clear(p);await p.locator('#handwriting-btn-pen').click();
  const perf=await p.evaluate(async()=>{const durations=[];probe.event('pointerdown',40,400);for(let i=0;i<520;i++){const t=performance.now();probe.event('pointermove',40+i%280,400+Math.sin(i*.1)*40);durations.push(performance.now()-t);if(i%8===0)await new Promise(r=>requestAnimationFrame(r));}const img=probe.image();probe.event('pointerup',280,400);durations.sort((a,b)=>a-b);return{exact:img===probe.image(),p95HandlerMs:durations[Math.floor(durations.length*.95)],maxHandlerMs:Math.max(...durations),points:window.__hwBaseline.strokes()[0].points.length};});assert(perf.exact);assert.equal(perf.points,521);
  await clear(p);for(let i=0;i<40;i++)await p.evaluate(i=>{probe.event('pointerdown',50+i*6,400);probe.event('pointermove',50+i*6,420);probe.event('pointerup',50+i*6,420);},i);assert.equal(await p.evaluate(()=>window.__hwBaseline.strokes().length),40);await p.evaluate(()=>window.__hwBaseline.undo());assert.equal(await p.evaluate(()=>window.__hwBaseline.strokes().length),39);
  await clear(p);await p.evaluate(()=>{probe.event('pointerdown',60,400);for(let i=1;i<=55;i++)probe.event('pointermove',60+i*5,400);probe.event('pointerup',335,400);});const beforeErase=await shot(p);
  await p.locator('#handwriting-btn-eraser').click();await p.evaluate(()=>{probe.event('pointerdown',190,400);probe.event('pointerup',190,400);});await p.waitForTimeout(40);
  const fragments=await p.evaluate(()=>window.__hwBaseline.strokes());assert.equal(fragments.length,2);assert(fragments.every(s=>s.renderVersion===1 && s.points.every(q=>q.inkWidth>0)));assert.equal(await p.evaluate(()=>probe.alpha(190,400)),0);
  const erased=await shot(p);await p.evaluate(()=>window.__hwBaseline.undo());assert.equal(await shot(p),beforeErase);await p.evaluate(()=>window.__hwBaseline.redo());assert.equal(await shot(p),erased);
  await p.locator('#handwriting-btn-eraser').click();if(!await p.getByRole('button',{name:'مسح المسار بالكامل',exact:true}).isVisible())await p.locator('#handwriting-btn-eraser').click();await p.getByRole('button',{name:'مسح المسار بالكامل',exact:true}).click();await p.evaluate(()=>{probe.event('pointerdown',110,400);probe.event('pointerup',110,400);});assert.equal(await p.evaluate(()=>window.__hwBaseline.strokes().length),1);await p.evaluate(()=>window.__hwBaseline.undo());assert.equal(await shot(p),erased);
  assert.deepEqual(errors,[]);results.push({round,first,highlighterFirstAlpha:hAlpha,perf,pageErrors:errors});console.log('PASS real Canvas round',round);await p.close();
 }
 fs.writeFileSync(dest+'/browser-results.json',JSON.stringify({baseline:'228b3963bced16420ced8005f33691a28e56af1d',notAndroid:true,results},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e.message);console.error(e.stack?.split('\n').slice(1,4).join('\n'));process.exitCode=1;});
