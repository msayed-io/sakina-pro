import { createPortal } from "react-dom";

export default function ProgressiveBlur() {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="progressive-blur progressive-blur-top" aria-hidden="true">
      <i />
      <i />
    </div>,
    document.body,
  );
}
