import { useLayoutEffect, useMemo, useRef } from "react";
import type { AzkarCounterType } from "@/types/app.types";
import { getAzkarReferenceData } from "./adapter";
import { mountAzkarReference } from "./screen";

type Props = { azkarType: AzkarCounterType; hisnCategory?: string; onClose: () => void };

export default function AzkarReferenceScreen({ azkarType, hisnCategory, onClose }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const data = useMemo(() => getAzkarReferenceData(azkarType, hisnCategory), [azkarType, hisnCategory]);
  useLayoutEffect(() => {
    if (!root.current || !data.items.length) return;
    return mountAzkarReference(root.current, data, () => onCloseRef.current());
  }, [data]);
  return <div ref={root} />;
}
