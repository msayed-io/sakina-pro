import { azkarData, type AzkarItem } from "@/data/azkarData";
import { hisnAlMuslimData } from "@/data/hisnAlMuslimData";
import type { AzkarCounterType } from "@/types/app.types";

/** Data boundary for the reference screen; never substitutes sample content. */
export type AzkarReferenceItem = {
  id: number;
  text: string;
  count: number;
  source?: string;
  bookmarkKey: string;
};

const titles: Record<Exclude<AzkarCounterType, "hisn">, string> = {
  morning: "أذكار الصباح",
  evening: "أذكار المساء",
  sleep: "أذكار النوم",
  post_prayer: "أذكار بعد الصلاة",
};

export function getAzkarReferenceData(type: AzkarCounterType, category?: string): {
  title: string;
  items: AzkarReferenceItem[];
} {
  let items: AzkarItem[];
  switch (type) {
    case "morning": items = azkarData.morningAzkar; break;
    case "evening": items = azkarData.eveningAzkar; break;
    case "sleep": items = azkarData.sleepAzkar; break;
    case "post_prayer": items = azkarData.postPrayerAzkar; break;
    case "hisn": items = category ? hisnAlMuslimData.getAzkarByCategory(category) : []; break;
  }
  return {
    title: type === "hisn" ? category ?? "" : titles[type],
    items: items.map((item) => ({
      id: item.id,
      text: item.text,
      count: item.count,
      ...(item.source !== undefined ? { source: item.source } : {}),
      bookmarkKey: type === "hisn" ? `hisn_${category}_${item.id}` : `${type}_${item.id}`,
    })),
  };
}
