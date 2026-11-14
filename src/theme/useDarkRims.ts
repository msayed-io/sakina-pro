import { useEffect } from 'react';
import { observeRims } from '../app/rim';

/**
 * Mounts the specular rim engine only while the dark theme is active and
 * tears it down completely (canvases, data attributes, observers, listeners)
 * the moment the scheme flips back to light. The light DOM therefore never
 * contains canvas.qf-specular-rim or data-qf-rim.
 */
export function useDarkRims() {
  useEffect(() => {
    let cleanup: (() => void) | null = null;

    const sync = () => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      if (dark && !cleanup) {
        cleanup = observeRims();
      } else if (!dark && cleanup) {
        cleanup();
        cleanup = null;
      }
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => sync();
    if (typeof media.addEventListener === 'function') media.addEventListener('change', onChange);
    return () => {
      observer.disconnect();
      if (typeof media.removeEventListener === 'function') media.removeEventListener('change', onChange);
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
    };
  }, []);
}
