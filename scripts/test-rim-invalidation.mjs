// Isolated browser regression for the shared dark-rim engine.
// node scripts/test-rim-invalidation.mjs
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from 'playwright';

const html = `<!doctype html><html><head><style>
body{margin:0}.fixture{position:relative;width:320px;height:180px}
.sk-rim{position:relative;width:160px;height:54px;border:1px solid transparent;border-radius:25px;background:#876}
.unrelated{width:60px;height:30px}
</style></head><body><script type="module">
import {observeRims} from '/src/app/rim.ts';
import {rasterRim} from '/src/lib/specular-rim.ts';
window.testRim={observeRims,rasterRim};
</script></body></html>`;
const server = await createServer({ configFile: false, logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] }, server: { host: '127.0.0.1', port: 0 }, plugins: [{
  name: 'rim-test-page', configureServer(vite) { vite.middlewares.use('/__rim_test__', (_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); }); }
}] });
await server.listen();
const browser = await chromium.launch();
try {
  const address = server.httpServer.address();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.goto(`http://127.0.0.1:${address.port}/__rim_test__`);
  await page.waitForFunction(() => window.testRim);
  const result = await page.evaluate(async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    document.body.innerHTML = '<div id="outer" class="fixture"><div id="owner" class="sk-rim"></div></div><div id="unrelated" class="unrelated"></div>';
    const outer = document.querySelector('#outer'), owner = document.querySelector('#owner'), unrelated = document.querySelector('#unrelated');
    const stop = window.testRim.observeRims();
    await wait(120);
    const canvas = owner.querySelector('canvas');
    function matchesReference() {
      const s = getComputedStyle(owner), matrix = new DOMMatrix(getComputedStyle(outer).transform);
      const frame = window.testRim.rasterRim(parseFloat(s.width), parseFloat(s.height), parseFloat(s.borderTopLeftRadius), [matrix.a, matrix.b, matrix.c, matrix.d], devicePixelRatio);
      const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      const reference = document.createElement('canvas'); reference.width = frame.width; reference.height = frame.height;
      const refContext = reference.getContext('2d'); refContext.putImageData(new ImageData(frame.pixels, frame.width, frame.height), 0, 0);
      const expected = refContext.getImageData(0, 0, frame.width, frame.height).data;
      return canvas.width === frame.width && canvas.height === frame.height && pixels.length === expected.length && pixels.every((value, i) => value === expected[i]);
    }
    const initial = matchesReference();
    const originalStyle = window.getComputedStyle;
    let reads = 0;
    window.getComputedStyle = function (...args) { reads++; return originalStyle.apply(this, args); };
    for (let i = 0; i < 30; i++) unrelated.dispatchEvent(new Event('transitionend', { bubbles: true }));
    const irrelevantReads = reads;
    window.getComputedStyle = originalStyle;

    // An ancestor transform affects the owner: start tracking actual frames,
    // finish and dispatch an end event, then compare every pixel to the core rasterizer.
    let writes = 0;
    const originalPut = CanvasRenderingContext2D.prototype.putImageData;
    CanvasRenderingContext2D.prototype.putImageData = function (...args) { if (this.canvas === canvas) writes++; return originalPut.apply(this, args); };
    const animation = outer.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(25deg)' }], { duration: 300, fill: 'forwards' });
    outer.dispatchEvent(new Event('animationstart', { bubbles: true }));
    await wait(150);
    const animationWrites = writes;
    animation.finish();
    outer.dispatchEvent(new Event('animationend', { bubbles: true }));
    await wait(100);
    CanvasRenderingContext2D.prototype.putImageData = originalPut;
    const rotated = matchesReference();
    owner.style.width = '180px';
    await wait(120);
    const resized = matchesReference();
    const extra = document.createElement('div'); extra.className = 'sk-rim'; outer.append(extra);
    await wait(120); const added = extra.querySelectorAll('canvas').length;
    extra.className = 'other'; await wait(120); const removed = extra.querySelectorAll('canvas').length;
    stop();
    const cleanup = document.querySelectorAll('canvas.qf-specular-rim').length;
    return { initial, irrelevantReads, animationWrites, rotated, resized, added, removed, cleanup };
  });
  assert.deepEqual([result.initial, result.rotated, result.resized], [true, true, true], 'Rim pixels must match the unchanged rasterizer');
  assert.equal(result.irrelevantReads, 0, 'Unrelated animation events must not recalculate rim styles');
  assert(result.animationWrites > 1, 'An animated ancestor should update rim frames');
  assert.deepEqual([result.added, result.removed, result.cleanup], [1, 0, 0]);
  console.log('Rim invalidation, animation, exact raster pixels, resizing, dynamic targets and cleanup: PASS', result);
} finally { await browser.close(); await server.close(); }
