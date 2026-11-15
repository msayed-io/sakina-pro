import { IDENTITY, multiply, rasterRim, type Linear } from '../lib/specular-rim';

// Explicit opt-in by name: never a card, menu plate, list, dialog, sheet,
// scrim, header/top bar, hero, text node, media or the Mushaf page.
const TARGET = '.sk-rim,.sk-rim-nested';
const NESTED = '.sk-rim-nested';

type Owner = { canvas: HTMLCanvasElement; key: string; restorePosition?: () => void };

/**
 * The spec's display layer sizes the canvas to the host's *padding box*
 * (inset:0 of the padding box), while rasterRim paints only the host's
 * *border box* at ceil(w*dpr). Any non-zero border (ours are 1px transparent)
 * therefore makes the compositor downscale the bitmap (~2-5%), smearing the
 * 1px rim into a soft, thick-looking second edge. Sync the canvas to the
 * border box exactly: same size as offsetWidth/Height, offset by the border
 * widths, 1:1 with the bitmap. `right/bottom:auto` because we always set
 * left/top — an owned, unambiguous position in RTL too. Pointer-events: none
 * and absolute positioning mean zero layout or interaction impact.
 */
function syncCanvasBox(element: HTMLElement, canvas: HTMLCanvasElement) {
  const style = getComputedStyle(element);
  const left = parseFloat(style.borderLeftWidth) || 0;
  const top = parseFloat(style.borderTopWidth) || 0;
  canvas.style.position = 'absolute';
  canvas.style.left = `${-left}px`;
  canvas.style.top = `${-top}px`;
  canvas.style.right = 'auto';
  canvas.style.bottom = 'auto';
  canvas.style.width = `${element.offsetWidth}px`;
  canvas.style.height = `${element.offsetHeight}px`;
}

function angle(value: string) {
  const n = parseFloat(value) || 0;
  return value.endsWith('turn') ? n * 2 * Math.PI : value.endsWith('rad') ? n : (n * Math.PI) / 180;
}

function linear(element: HTMLElement): Linear {
  let result: Linear = IDENTITY;
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const style = getComputedStyle(node);
    const transform = new DOMMatrix(style.transform === 'none' ? undefined : style.transform);
    const values = style.scale && style.scale !== 'none' ? style.scale.split(/\s+/).map(Number) : [1];
    const rotation = angle(style.rotate || '0'), c = Math.cos(rotation), s = Math.sin(rotation);
    const local = multiply([c, s, -s, c], multiply([values[0], 0, 0, values[1] ?? values[0]], [transform.a, transform.b, transform.c, transform.d]));
    result = multiply(local, result);
  }
  return result;
}

/**
 * Adapted from the reference implementation (specular-rim-spec-ar.md §4.2).
 * The render model, invalidation key, observers and cleanup semantics are
 * unchanged. Only TARGET/NESTED point at Sakinah's opt-in classes, and the
 * host element is promoted to position:relative *only* when its computed
 * position is static (restored on cleanup), per §5.3 / §9.5.
 */
export function observeRims() {
  const owners = new Map<HTMLElement, Owner>();
  let stopped = false, animationFrame = 0;

  function draw(element: HTMLElement, owner: Owner) {
    if (!element.isConnected || !element.getClientRects().length) return;
    const style = getComputedStyle(element);
    const w = parseFloat(style.width) || element.offsetWidth, h = parseFloat(style.height) || element.offsetHeight;
    if (w <= 0 || h <= 0) return;
    syncCanvasBox(element, owner.canvas);
    const radius = style.borderTopLeftRadius;
    const r = Math.min(w / 2, h / 2, radius.endsWith('%') ? (parseFloat(radius) * Math.min(w, h)) / 100 : parseFloat(radius) || 0);
    const m = linear(element), dpr = devicePixelRatio || 1;
    // Position/translation/scroll and theme do NOT invalidate the raster.
    const key = [w, h, r, dpr, ...m].map((n) => n.toFixed(5)).join('|');
    if (key === owner.key) return;
    const frame = rasterRim(w, h, r, m, dpr);
    owner.canvas.width = frame.width; owner.canvas.height = frame.height;
    const context = owner.canvas.getContext('2d');
    if (!context) return;
    context.putImageData(new ImageData(frame.pixels, frame.width, frame.height), 0, 0);
    owner.key = key;
  }

  function refresh() { if (!stopped) owners.forEach((owner, element) => draw(element, owner)); }

  const resize = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const element = entry.target as HTMLElement, owner = owners.get(element);
      if (owner) draw(element, owner);
    }
  });

  function discover() {
    for (const [element, owner] of owners) {
      if (!element.isConnected || !element.matches(TARGET)) {
        resize.unobserve(element);
        owner.canvas.remove();
        owner.restorePosition?.();
        element.removeAttribute('data-qf-rim');
        owners.delete(element);
      }
    }
    document.querySelectorAll<HTMLElement>(TARGET).forEach((element) => {
      const existing = owners.get(element);
      if (existing) { if (existing.canvas.parentElement !== element) element.append(existing.canvas); return; }
      // The canvas is positioned against the element itself; promote only static hosts.
      let restorePosition: (() => void) | undefined;
      const computed = getComputedStyle(element);
      if (computed.position === 'static') {
        const previous = element.style.position;
        element.style.position = 'relative';
        restorePosition = () => { element.style.position = previous; };
      }
      const canvas = document.createElement('canvas');
      canvas.className = 'qf-specular-rim';
      canvas.setAttribute('aria-hidden', 'true');
      element.setAttribute('data-qf-rim', element.matches(NESTED) ? 'nested' : 'single');
      element.append(canvas);
      syncCanvasBox(element, canvas);
      const owner: Owner = { canvas, key: '', restorePosition };
      owners.set(element, owner);
      resize.observe(element);
      draw(element, owner);
    });
  }

  // JS springs mutate inline styles. Draw in the mutation microtask, before the
  // browser presents that frame, not in a one-frame-late RAF. Canvas writes
  // are ignored, so they cannot feed an observer loop.
  const mutation = new MutationObserver((records) => {
    if (stopped) return;
    let structural = false;
    const dirty = new Set<HTMLElement>();
    for (const record of records) {
      const target = record.target;
      if (target instanceof HTMLCanvasElement) continue;
      if (record.type === 'childList') {
        if ([...record.addedNodes, ...record.removedNodes].some((n) => !(n instanceof HTMLCanvasElement))) structural = true;
      } else if (target instanceof HTMLElement) {
        if (record.attributeName === 'class' || record.attributeName === 'aria-selected') structural = true;
        for (const element of owners.keys()) if (element === target || target.contains(element)) dirty.add(element);
      }
    }
    if (structural) discover();
    for (const element of dirty) { const owner = owners.get(element); if (owner) draw(element, owner); }
  });
  mutation.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'class', 'aria-selected', 'hidden', 'dir'] });

  // CSS transitions/animations do not mutate style attributes every frame.
  const animated = new Set<HTMLElement>();
  function animate() {
    animationFrame = 0; if (stopped) return;
    let active = false;
    for (const [element, owner] of owners) {
      let moving = false;
      for (let node: HTMLElement | null = element; node; node = node.parentElement) {
        if (node.getAnimations().some((a) => a.playState === 'running')) { moving = true; break; }
      }
      if (moving || animated.has(element)) draw(element, owner);
      if (moving) { animated.add(element); active = true; } else animated.delete(element);
    }
    if (active) animationFrame = requestAnimationFrame(animate);
  }
  function wake() { if (!animationFrame) animationFrame = requestAnimationFrame(animate); }

  document.addEventListener('transitionrun', wake, true);
  document.addEventListener('animationstart', wake, true);
  for (const name of ['transitionend', 'transitioncancel', 'animationend', 'animationcancel']) document.addEventListener(name, refresh, true);
  addEventListener('resize', refresh);
  document.fonts?.ready.then(() => { if (!stopped) { discover(); refresh(); } });
  discover();

  return () => {
    stopped = true; cancelAnimationFrame(animationFrame);
    resize.disconnect(); mutation.disconnect();
    document.removeEventListener('transitionrun', wake, true);
    document.removeEventListener('animationstart', wake, true);
    removeEventListener('resize', refresh);
    for (const name of ['transitionend', 'transitioncancel', 'animationend', 'animationcancel']) document.removeEventListener(name, refresh, true);
    owners.forEach((owner, element) => {
      owner.canvas.remove();
      owner.restorePosition?.();
      element.removeAttribute('data-qf-rim');
    });
    owners.clear();
  };
}
