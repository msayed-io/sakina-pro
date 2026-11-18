import type { HadithBookInfo, HadithItem } from "../types/hadith.types";

export type HadithWorkerRequest =
  | { type: "index"; book: HadithBookInfo }
  | { type: "search"; query: string; bookId: string };

export type HadithWorkerResponse =
  | { type: "ready" }
  | { type: "unavailable" }
  | { type: "progress"; percent: number; status: string }
  | { type: "done"; result?: HadithItem[] }
  | { type: "error"; message: string };
