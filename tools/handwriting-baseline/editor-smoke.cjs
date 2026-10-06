const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
    const b = await chromium.launch();
    try {
        const p = await b.newPage({ viewport: { width: 390, height: 820 }, deviceScaleFactor: 2, hasTouch: true });
        const errors = [];
        p.on('pageerror', e => errors.push(e.message));
        await p.addInitScript(() => localStorage.setItem('dar_app_auto_update_check_enabled', 'false'));
        await p.goto('http://localhost:3000');
        const strokes = [{ id: 'legacy_fixture_curve', color: '#121A1B', width: 3.5, points: [{ x: 80, y: 180, pressure: .5, time: 0 }, { x: 120, y: 150, pressure: .5, time: 16 }, { x: 180, y: 210, pressure: .5, time: 32 }] }, { id: 'legacy_fixture_dot', color: '#121A1B', width: 7, points: [{ x: 200, y: 180, pressure: .5, time: 60 }] }];
        await p.evaluate(async (strokes) => { const { StorageService } = await import('/lib/storage-service.ts'); await StorageService.saveStory({ id: 880000009, title: 'BASELINE_OLD_SCHEMA', content: '', styles: { fontSize: 20, fontWeight: 400, textAlign: 'right', textColor: '#121A1B', paperStyleIndex: 0, handwriting: { strokes, isPageRuled: false, dataUrl: '' } } }); }, strokes);
        await p.reload();
        await p.getByText('BASELINE_OLD_SCHEMA', { exact: true }).first().click();
        await p.waitForSelector('#handwriting-canvas-layer');
        await p.waitForTimeout(450);
        const state = await p.locator('#handwriting-canvas-layer').evaluate(c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4)
            if (d[i])
                n++; return { alphaPixels: n, width: c.width, height: c.height, mode: document.getElementById('handwriting-document-layer').dataset.mode }; });
        assert(state.alphaPixels > 0);
        assert.equal(state.width, 780);
        assert.equal(state.height, 1640);
        assert.equal(state.mode, 'read');
        await p.screenshot({ path: 'docs/evidence/handwriting/editor-old-schema.png' });
        const cdp = await p.context().newCDPSession(p);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 250, y: 350, id: 1, force: .5 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await p.waitForFunction(() => document.getElementById('handwriting-document-layer')?.dataset.mode === 'edit');
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 120, y: 350, id: 2, force: .5 }] });
        const touchAlpha = await p.locator('#handwriting-canvas-layer').evaluate(c => c.getContext('2d').getImageData(240, 700, 1, 1).data[3]);
        assert(touchAlpha > 0);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 190, y: 350, id: 2, force: .5 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        assert.equal(errors.length, 0, errors.join('\n'));
        fs.writeFileSync('docs/evidence/handwriting/editor-smoke.json', JSON.stringify({ oldSchemaSyntheticFixture: strokes, actualEditorReadMode: state, chromiumEmulatedTouchFirstPixel: touchAlpha, pageErrors: errors, notAndroid: true }, null, 2));
        console.log('PASS actual editor opens vector fixture; Chromium emulated touch first pixel', touchAlpha);
    }
    finally {
        await b.close();
    }
})().catch(e => { console.error(e); process.exitCode = 1; });
