/* Real Chromium canvas probes. This is NOT an Android/emulator performance gate. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = process.env.HW_EVIDENCE || path.resolve('docs/evidence/handwriting');
fs.mkdirSync(output, { recursive: true });
const mutation = process.argv.includes('--mutation');
const lateRestore = process.argv.includes('--late-restore');
const root = process.env.HW_BASE_URL || 'http://localhost:3000';
(async () => {
    const browser = await chromium.launch({ args: ['--enable-precise-memory-info'] });
    const rounds = [];
    try {
        for (let round = 1; round <= ((mutation || lateRestore) ? 1 : 3); round++) {
            const page = await browser.newPage({ viewport: { width: 390, height: 820 }, deviceScaleFactor: 2, hasTouch: true });
            const errors = [], warnings = [];
            page.on('pageerror', e => errors.push(e.message));
            page.on('console', m => { if (m.type() === 'warning' || m.type() === 'error')
                warnings.push(m.text()); });
            if (mutation)
                await page.addInitScript(() => { for (const name of ['fill', 'stroke']) {
                    const original = CanvasRenderingContext2D.prototype[name];
                    CanvasRenderingContext2D.prototype[name] = function (...args) { if (this.canvas.id === 'handwriting-canvas-layer')
                        return; return original.apply(this, args); };
                } });
            await page.goto(root + '/tools/handwriting-baseline/');
            await page.waitForFunction(() => !!window.__hwBaseline);
            await page.evaluate(() => window.__hwBaseline.mode('edit'));
            await page.waitForSelector('#handwriting-canvas-layer');
            await page.waitForTimeout(450);
            await page.evaluate(() => {
                window.hwProbe = {
                    event(type, x, y, id = 1, pointerType = 'pen') { const target = type === 'pointerdown' ? document.getElementById('handwriting-canvas-layer') : window; target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType, isPrimary: true, clientX: x, clientY: y, pressure: .5, buttons: type === 'pointerup' ? 0 : 1 })); },
                    pixel(x, y) { const c = document.getElementById('handwriting-canvas-layer'); const d = Math.min(devicePixelRatio || 1, 2); return c.getContext('2d').getImageData(Math.round(x * d), Math.round(y * d), 1, 1).data[3]; },
                    image() { return document.getElementById('handwriting-canvas-layer').toDataURL(); },
                    frame() { return new Promise(r => requestAnimationFrame(r)); }
                };
            });
            const first = await page.evaluate(() => { const c = document.getElementById('handwriting-canvas-layer'); const t = performance.now(); hwProbe.event('pointerdown', 100, 160); const alpha = hwProbe.pixel(100, 160); return { alpha, cpuObservableInkMs: performance.now() - t, width: c.width, height: c.height, cssWidth: c.getBoundingClientRect().width, touchAction: getComputedStyle(c).touchAction }; });
            assert(first.alpha > 0, 'FIRST_PIXEL_MISSING: synchronous pointerdown did not create visible alpha');
            assert.equal(first.width, 780);
            assert.equal(first.height, 1640);
            assert.equal(first.touchAction, 'none');
            const live = await page.evaluate(() => { hwProbe.event('pointermove', 200, 160); return { middle: hwProbe.pixel(130, 160), endpoint: hwProbe.pixel(195, 160) }; });
            assert(live.middle > 0);
            if (round === 1)
                await page.screenshot({ path: path.join(output, 'baseline-during.png') });
            const ended = await page.evaluate(() => { hwProbe.event('pointerup', 200, 160); return { middle: hwProbe.pixel(130, 160), endpoint: hwProbe.pixel(195, 160) }; });
            assert(ended.middle > 0);
            await page.waitForTimeout(30);
            if (round === 1)
                await page.screenshot({ path: path.join(output, 'baseline-after-lift.png') });
            const originalImage = await page.evaluate(() => hwProbe.image());
            await page.locator('#handwriting-btn-eraser').click();
            assert.equal(await page.evaluate(() => hwProbe.image()), originalImage);
            await page.locator('#handwriting-btn-pen').click();
            assert.equal(await page.evaluate(() => hwProbe.image()), originalImage);
            await page.evaluate(() => window.__hwBaseline.undo());
            await page.waitForTimeout(20);
            assert.equal(await page.evaluate(() => hwProbe.pixel(130, 160)), 0);
            await page.evaluate(() => window.__hwBaseline.redo());
            await page.waitForTimeout(20);
            assert.equal(await page.evaluate(() => hwProbe.image()), originalImage);
            // Fast successive completed strokes; state/history commits may occur between events.
            for (let i = 0; i < 30; i++) {
                await page.evaluate(i => { hwProbe.event('pointerdown', 45 + i * 9, 220); hwProbe.event('pointermove', 48 + i * 9, 240); hwProbe.event('pointerup', 48 + i * 9, 240); }, i);
            }
            assert.equal(await page.evaluate(() => window.__hwBaseline.strokes().length), 31);
            const vectors = await page.evaluate(() => window.__hwBaseline.strokes());
            const prior = await page.evaluate(() => hwProbe.image());
            // Window blur is only a lifecycle surrogate, not Capacitor app-background verification.
            await page.evaluate(() => window.dispatchEvent(new Event('blur')));
            assert.equal(await page.evaluate(() => hwProbe.image()), prior);
            await page.evaluate(() => window.__hwBaseline.mode('off'));
            await page.waitForSelector('#handwriting-canvas-layer', { state: 'detached' });
            await page.evaluate(() => window.__hwBaseline.mode('edit'));
            await page.waitForSelector('#handwriting-canvas-layer');
            await page.waitForTimeout(50);
            assert.equal(await page.evaluate(() => hwProbe.image()), prior);
            await page.evaluate(() => window.__hwBaseline.save());
            if (lateRestore) {
                await page.reload();
                await page.waitForFunction(() => !!window.__hwBaseline);
                await page.evaluate(() => window.__hwBaseline.restore());
            }
            else {
                await page.goto(root + '/tools/handwriting-baseline/?restore=1');
                await page.waitForFunction(() => !!window.__hwBaseline);
            }
            await page.waitForSelector('#handwriting-canvas-layer');
            await page.waitForTimeout(100);
            assert.deepEqual(await page.evaluate(() => window.__hwBaseline.strokes()), vectors);
            const reopened = await page.locator('#handwriting-canvas-layer').evaluate(c => c.toDataURL());
            const pixelComparison = await page.evaluate(async (prior) => { const img = new Image(); img.src = prior; await img.decode(); const c = document.getElementById('handwriting-canvas-layer'); const copy = document.createElement('canvas'); copy.width = c.width; copy.height = c.height; copy.getContext('2d').drawImage(img, 0, 0); const a = copy.getContext('2d').getImageData(0, 0, c.width, c.height).data, b = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let changed = 0, maxDelta = 0; for (let i = 0; i < a.length; i++) {
                if (a[i] !== b[i])
                    changed++;
                maxDelta = Math.max(maxDelta, Math.abs(a[i] - b[i]));
            } return { changedChannels: changed, maxDelta }; }, prior);
            console.log('Reload decoded pixel comparison', JSON.stringify(pixelComparison));
            if (pixelComparison.changedChannels) {
                fs.writeFileSync(path.join(output, 'reload-before.png'), Buffer.from(prior.split(',')[1], 'base64'));
                fs.writeFileSync(path.join(output, 'reload-after.png'), Buffer.from(reopened.split(',')[1], 'base64'));
                await page.waitForTimeout(500);
                const delayed = await page.locator('#handwriting-canvas-layer').evaluate(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let inkPixels = 0; for (let i = 3; i < d.length; i += 4)
                    if (d[i])
                        inkPixels++; return { inkPixels, strokes: window.__hwBaseline.strokes().length }; });
                fs.writeFileSync(path.join(output, 'late-restore-observation.json'), JSON.stringify({ initialPixelMismatch: pixelComparison, afterAdditional500ms: delayed, scenario: 'Off-mounted empty component receives external strokes and edit activation together; separate from preloaded-note opening.' }, null, 2));
                console.log('Late restore after additional 500ms', JSON.stringify(delayed));
            }
            assert.equal(pixelComparison.changedChannels, 0, 'Reloaded raw RGBA differs');
            const geometry = await page.locator('#handwriting-document-layer').evaluate(el => ({ canvas: el.querySelector('#handwriting-canvas-layer').getBoundingClientRect().toJSON(), buttons: [...el.querySelectorAll('[id^="handwriting-btn-"]')].map(b => ({ id: b.id, rect: b.getBoundingClientRect().toJSON() })), zIndex: getComputedStyle(el).zIndex, background: getComputedStyle(el).backgroundColor }));
            if (round === 1)
                await page.screenshot({ path: path.join(output, 'baseline-reopened.png') });
            // Synthetic pen geometry, paced by rAF. Readbacks occur only at boundaries.
            const perf = await page.evaluate(async () => {
                const c = document.getElementById('handwriting-canvas-layer'), ctx = c.getContext('2d');
                function send(type, x, y) { (type === 'pointerdown' ? c : window).dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 9, pointerType: 'pen', isPrimary: true, clientX: x, clientY: y, pressure: .5, buttons: type === 'pointerup' ? 0 : 1 })); }
                const tick = () => new Promise(r => requestAnimationFrame(r));
                const summaries = [];
                for (const [name, count, strokes] of [['short', 16, 1], ['long', 520, 1], ['dozens', 20, 40]]) {
                    __hwBaseline.clear();
                    await tick();
                    const intervals = [], eventCosts = [], starts = [];
                    const before = performance.memory?.usedJSHeapSize ?? null;
                    let previous;
                    for (let s = 0; s < strokes; s++) {
                        const y = 160 + (s % 20) * 19;
                        const t = performance.now();
                        send('pointerdown', 40, y);
                        const alpha = ctx.getImageData(80, Math.round(y * 2), 1, 1).data[3];
                        starts.push({ ms: performance.now() - t, alpha });
                        for (let i = 1; i < count; i++) {
                            const frame = await tick();
                            if (previous !== undefined)
                                intervals.push(frame - previous);
                            previous = frame;
                            const start = performance.now();
                            send('pointermove', 40 + (i % 100) * 3, y + Math.sin(i * .2) * 8);
                            eventCosts.push(performance.now() - start);
                        }
                        send('pointerup', 40 + ((count - 1) % 100) * 3, y + Math.sin((count - 1) * .2) * 8);
                        await tick();
                    }
                    const stats = a => { const sorted = [...a].sort((a, b) => a - b); return { p50: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.floor(sorted.length * .95)], max: sorted.at(-1) }; };
                    summaries.push({ name, pointsPerStroke: count, strokeCount: strokes, firstCpuInkMs: stats(starts.map(s => s.ms)), allFirstPixels: starts.every(s => s.alpha > 0), frameIntervalMs: stats(intervals), handlerMs: stats(eventCosts), meanRafHz: 1000 / (intervals.reduce((a, b) => a + b, 0) / intervals.length), heapBefore: before, heapAfter: performance.memory?.usedJSHeapSize ?? null });
                }
                return summaries;
            });
            assert(perf.every(p => p.allFirstPixels));
            assert.equal(errors.length, 0, errors.join('\n'));
            rounds.push({ round, first, live, ended, tailChangesOnLift: live.endpoint === 0 && ended.endpoint > 0, regressions: { firstPixel: true, movement: true, lift: true, toolSwitch: true, undoRedo: true, rapid31Strokes: true, modeRemount: true, windowBlurSurrogate: true, storageServiceWebSaveReload: true }, geometry, perf, pageErrors: errors, consoleWarnings: warnings });
            console.log('PASS desktop real-canvas baseline round', round);
            await page.close();
        }
        fs.writeFileSync(path.join(output, 'desktop-baseline.json'), JSON.stringify({ baseline: 'd8dc095', environment: 'Headless Chromium, synthetic pen, CSS390x820 DPR2; NOT Android', rounds }, null, 2));
    }
    finally {
        await browser.close();
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
