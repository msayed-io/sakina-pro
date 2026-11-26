import { Capacitor, registerPlugin } from "@capacitor/core";
import type { HadithBookInfo, HadithChapter, HadithInnerBook, HadithItem } from "../types/hadith.types";

export type NativeProgress = { bookId: string; percent: number; status: string };
export interface HadithNativePlugin {
  isDownloaded(options: { bookId: string }): Promise<{ downloaded: boolean }>;
  downloadBook(options: { bookId: string; url: string; sha256: string }): Promise<{ downloaded: boolean }>;
  deleteBook(options: { bookId: string }): Promise<{ deleted: boolean }>;
  getBooks(options: { bookId: string }): Promise<{ books: HadithInnerBook[] }>;
  getChapters(options: { bookId: string; innerBookId?: string }): Promise<{ chapters: HadithChapter[] }>;
  getHadiths(options: { bookId: string; innerBookId?: string; chapterId?: string; page?: number; limit?: number; search?: string }): Promise<{ total: number; totalPages: number; hadiths: HadithItem[] }>;
  searchHadiths(options: { query: string; bookId?: string; limit?: number }): Promise<{ results: HadithItem[] }>;
  addListener(eventName: "downloadProgress", listener: (event: NativeProgress) => void): Promise<{ remove: () => Promise<void> }>;
}

export const HadithNative = registerPlugin<HadithNativePlugin>("HadithNative");

const isNative = () => Capacitor.isNativePlatform();

export const HadithNativeService = {
  isNative,
  async isBookDownloaded(bookId: string): Promise<boolean> {
    if (!isNative()) return false;
    return (await HadithNative.isDownloaded({ bookId })).downloaded;
  },
  async getDownloadStats(books: HadithBookInfo[]): Promise<Record<string, boolean>> {
    const entries = await Promise.all(books.map(async (book) => [book.id, await this.isBookDownloaded(book.id)] as const));
    return Object.fromEntries(entries);
  },
  async downloadBook(book: HadithBookInfo, onProgress: (percent: number, status: string) => void): Promise<void> {
    if (!isNative()) throw new Error("تنزيل كتب الحديث متاح داخل تطبيق أندرويد فقط.");
    const listener = await HadithNative.addListener("downloadProgress", (event: NativeProgress) => {
      if (event.bookId === book.id) onProgress(event.percent, event.status);
    });
    try {
      await HadithNative.downloadBook({ bookId: book.id, url: book.downloadUrl, sha256: book.sha256 });
      onProgress(100, "تم تجهيز الكتاب للقراءة");
    } finally {
      await listener.remove();
    }
  },
  async deleteBook(bookId: string): Promise<void> {
    if (isNative()) await HadithNative.deleteBook({ bookId });
  },
  async getChapters(bookId: string): Promise<HadithChapter[]> {
    if (!isNative()) return [];
    return (await HadithNative.getChapters({ bookId })).chapters;
  },
  async getBooks(bookId: string): Promise<HadithInnerBook[]> {
    if (!isNative()) return [];
    return (await HadithNative.getBooks({ bookId })).books;
  },
  async getChaptersForBook(bookId: string, innerBookId = "all"): Promise<HadithChapter[]> {
    if (!isNative()) return [];
    return (await HadithNative.getChapters({ bookId, innerBookId })).chapters;
  },
  async getHadiths(bookId: string, chapterId = "all", page = 1, search = "", innerBookId = "all"): Promise<{ total: number; totalPages: number; hadiths: HadithItem[] }> {
    if (!isNative()) throw new Error("قاعدة الحديث المحلية غير متاحة خارج تطبيق أندرويد.");
    return HadithNative.getHadiths({ bookId, innerBookId, chapterId, page, limit: 20, search });
  },
  async searchOffline(query: string, bookId = "all"): Promise<HadithItem[]> {
    if (!isNative()) return [];
    return (await HadithNative.searchHadiths({ query, bookId, limit: 40 })).results;
  },
};
