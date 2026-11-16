import { createPortal } from "react-dom";

/**
 * Top progressive fade/blur pinned under the floating capsules.
 * Default: portal to <body> at body level (used on document-scrolling tabs,
 * above content, below the top capsules).
 * `inline`: render in-place (for opaque full-screen overlays hosted by the
 * app at z-50 — a body-level portal at z-18 would be painted *under* the
 * opaque overlay and never visible). Rendered as the overlay's first child,
 * it sits above the overlay background and below its z-40 header capsules —
 * exactly like the tab pages. Same markup, same styles either way.
 */
export default function ProgressiveBlur({ inline = false }: { inline?: boolean }) {
  if (typeof document === "undefined") return null;

  const node = (
    <div className="progressive-blur progressive-blur-top" aria-hidden="true">
      <i />
      <i />
    </div>
  );

  return inline ? node : createPortal(node, document.body);
}
