// Compare new pen drawing with original 228b396, not with the rejected v1 replay contract.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{const browser=await chromium.launch();const results=[];try{
 for(const dark of [false,true])for(const pointerType of ['touch','pen']){
  const samples=[];
  for(const url of [process.env.HW_ORIGINAL||'http://localhost:3171',process.env.HW_URL||'http://localhost:3170']){
   const p=await browser.newPage({viewport:{width:390,height:820},deviceScaleFactor:2,hasTouch:true});const errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.goto(url+'/tools/handwriting-fix-check/'+(dark?'?dark=1':''));await p.waitForFunction(()=>!!window.__hwBaseline);
   await p.evaluate(()=>window.__hwBaseline.mode('edit'));await p.waitForSelector('#handwriting-canvas-layer');await p.waitForTimeout(300);
   const sample=await p.evaluate(pointerType=>{
    const c=document.getElementById('handwriting-canvas-layer');const nativeNow=performance.now.bind(performance);let clock=1000;Object.defineProperty(performance,'now',{configurable:true,value:()=>clock});
    const image=()=>c.toDataURL();const images=[];
    const event=(type,x,y,pressure)=>{(type==='pointerdown'?c:window).dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:1,pointerType,clientX:x,clientY:y,pressure,buttons:type==='pointerup'?0:1}));};
    try{event('pointerdown',70,240,.5);images.push(image());for(let i=1;i<=8;i++){clock+=16;event('pointermove',70+i*30,240+Math.sin(i*.65)*45,pointerType==='touch'?.5:.2+i*.08);images.push(image());}clock+=16;event('pointerup',310,240+Math.sin(8*.65)*45,0);images.push(image());
     const strokes=window.__hwBaseline.strokes().map(({id,...stroke})=>stroke);return {images,strokes};
    }finally{Object.defineProperty(performance,'now',{configurable:true,value:nativeNow});}
   },pointerType);
   assert.deepEqual(errors,[]);samples.push(sample);await p.close();
  }
  assert.deepEqual(samples[1],samples[0],'Original and restored pen differ');assert.equal(samples[1].strokes[0].renderVersion,undefined);
  results.push({dark,pointerType,exactLiveAndLiftPixels:true,exactPointData:true,frames:samples[1].images.length});
 }
 fs.writeFileSync(process.env.HW_ROLLBACK_EVIDENCE||'/home/user/handwriting-rollback-evidence/browser.json',JSON.stringify({baseline:'228b396',notDeviceTesting:true,results},null,2));console.log('PASS original-versus-restored ink: touch/pen, light/dark, 40 exact Canvas snapshots and point data');
}finally{await browser.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});
