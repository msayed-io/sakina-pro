import { HadithOfflineSearchService } from "../services/hadith-offline-core";
import type { HadithWorkerRequest, HadithWorkerResponse } from "../services/hadith-offline-protocol";

// The worker owns the expensive fetch/parse/index/search and its IndexedDB
// reads/writes. It sends only progress and the bounded search results to the UI.
const scope = self as unknown as {
  postMessage(message: HadithWorkerResponse): void;
  onmessage: ((event: MessageEvent<HadithWorkerRequest>) => void) | null;
};
scope.onmessage = async ({ data }) => {
  try {
    if (data.type === "index") {
      await HadithOfflineSearchService.downloadAndIndexBook(data.book, (percent, status) => {
        scope.postMessage({ type: "progress", percent, status });
      });
      scope.postMessage({ type: "done" });
    } else {
      const result = await HadithOfflineSearchService.searchOffline(data.query, data.bookId);
      scope.postMessage({ type: "done", result });
    }
  } catch (error) {
    scope.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
};
// A worker cannot use localStorage. Only accept jobs if both stores can use
// IndexedDB; otherwise the main-thread compatibility path keeps working.
void Promise.all([
  HadithOfflineSearchService.hadithBooksStore.ready(),
  HadithOfflineSearchService.searchMetaStore.ready(),
]).then(() => {
  const indexedDb = HadithOfflineSearchService.hadithBooksStore.driver() === "asyncStorage"
    && HadithOfflineSearchService.searchMetaStore.driver() === "asyncStorage";
  scope.postMessage({ type: indexedDb ? "ready" : "unavailable" });
}).catch(() => scope.postMessage({ type: "unavailable" }));
