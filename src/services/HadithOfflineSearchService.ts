import { HadithOfflineSearchService as core } from "./hadith-offline-core";
import type { HadithWorkerRequest, HadithWorkerResponse } from "./hadith-offline-protocol";
import type { HadithBookInfo, HadithItem } from "../types/hadith.types";

export { stripDiacritics, normalizeArabic, extractArabicStems } from "./hadith-offline-core";

type Progress = (percent: number, status: string) => void;

// If workers are unavailable or fail to start, retain the original behavior.
// Never retry an already-started indexing job: that could duplicate a write.
function runInWorker(request: HadithWorkerRequest, onProgress?: Progress): Promise<HadithItem[] | undefined> | null {
  if (typeof Worker === "undefined") return null;
  let worker: Worker;
  try {
    worker = new Worker(new URL("../workers/hadith-offline.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return null;
  }
  return new Promise((resolve, reject) => {
    let started = false;
    let settled = false;
    const finish = (error?: Error, result?: HadithItem[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(startupTimer);
      worker.terminate();
      if (error) reject(error); else resolve(result);
    };
    const startupFailure = () => {
      if (started || settled) return;
      settled = true;
      clearTimeout(startupTimer);
      worker.terminate();
      // No job was sent, so it is safe to use the existing implementation.
      if (request.type === "index") {
        core.downloadAndIndexBook(request.book, onProgress ?? (() => {})).then(() => resolve(undefined), reject);
      } else {
        core.searchOffline(request.query, request.bookId).then(resolve, reject);
      }
    };
    const startupTimer = setTimeout(startupFailure, 10000);
    worker.onerror = (event) => {
      if (!started) startupFailure();
      else finish(new Error(event.message || "تعذر تنفيذ مهمة الحديث في الخلفية."));
    };
    worker.onmessageerror = () => {
      if (!started) startupFailure();
      else finish(new Error("تعذر استلام نتيجة مهمة الحديث."));
    };
    worker.onmessage = ({ data }: MessageEvent<HadithWorkerResponse>) => {
      if (settled) return;
      if (data.type === "unavailable") {
        startupFailure();
      } else if (data.type === "ready") {
        if (started) return;
        started = true;
        clearTimeout(startupTimer);
        try { worker.postMessage(request); }
        catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
      } else if (data.type === "progress") {
        try { onProgress?.(data.percent, data.status); }
        catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
      } else if (data.type === "done") {
        finish(undefined, data.result);
      } else if (data.type === "error") {
        finish(new Error(data.message));
      }
    };
  });
}

export const HadithOfflineSearchService = {
  ...core,
  async downloadAndIndexBook(book: HadithBookInfo, onProgress: Progress): Promise<void> {
    const task = runInWorker({ type: "index", book }, onProgress);
    if (task) await task;
    else await core.downloadAndIndexBook(book, onProgress);
  },
  async searchOffline(query: string, bookId = "all"): Promise<HadithItem[]> {
    const task = runInWorker({ type: "search", query, bookId });
    return task ? (await task ?? []) : core.searchOffline(query, bookId);
  },
};
