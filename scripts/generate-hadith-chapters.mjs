#!/usr/bin/env node
/**
 * توليد جدول أسماء أبواب الحديث بالعربية — بلا كتابة يدوية ولا ترجمة بشرية.
 *
 * المصدر (أهل السنة والجماعة، مجموعة حديثية عربية مفتوحة):
 *   https://github.com/AhmedBaset/hadith-json
 *   المسار: db/by_book/the_9_books/<book>.json   (حقل chapters[].arabic)
 *
 * مصدر التطبيق الذي نُطابق عليه (نفس بيانات التطبيق الفعلية):
 *   https://github.com/fawazahmed0/hadith-api  — editions/ara-<book>.min.json
 *   (يحمل النصوص العربية وأسماء الأبواب **بالإنجليزية** فقط)
 *
 * المطابقة على شيئين معًا:
 *   ① نص العنوان الإنجليزي (مطبَّع)  → ARABIC_CHAPTER_BY_BOOK / GLOBAL
 *   ② رقم الباب نفسه                  → ARABIC_CHAPTER_BY_NUMBER
 * الرقم ضروري لأن البيانات المحفوظة عند المستخدم تحتفظ بـ chapterId بلا عنوان
 * إنجليزي، فتُحلّ الأسماء وقت العرض بلا مسح بياناته.
 *
 * التحقق الآلي قبل الكتابة:
 *   • كل عنوان إنجليزي غير فارغ في المصدر له مقابل عربي (وإلا يفشل السكربت)
 *   • ترقيم الأبواب متصل من 1..max بلا ثغرات ولا تداخل
 *   • عدد الأبواب العربية لكل كتاب يُطبع للمراجعة
 *
 * التشغيل:  node scripts/generate-hadith-chapters.mjs [--out src/data/hadithArabicChapters.ts]
 */

import fs from "node:fs";
import path from "node:path";

const BOOKS = [
  "bukhari",
  "muslim",
  "abudawud",
  "tirmidhi",
  "nasai",
  "ibnmajah",
  "malik",
];

const AR_SOURCE = "https://raw.githubusercontent.com/AhmedBaset/hadith-json/main/db/by_book/the_9_books";
const UPSTREAM = "https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions";

const normalize = (value) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

/** يقرأ بيانات المصدر العربي (أسماء الأبواب العربية). */
async function fetchArabicChapters(book) {
  const res = await fetch(`${AR_SOURCE}/${book}.json`);
  if (!res.ok) throw new Error(`تعذر تحميل ${book}: ${res.status}`);
  const data = await res.json();
  const byNumber = new Map();
  for (const chapter of data.chapters ?? []) {
    const arabic = String(chapter.arabic ?? "").trim();
    if (!arabic) continue;
    byNumber.set(String(chapter.id), arabic);
  }
  return byNumber;
}

/** يقرأ عناوين الأبواب كما هي في بيانات التطبيق (إنجليزية). */
async function fetchUpstreamSections(book) {
  const res = await fetch(`${UPSTREAM}/ara-${book}.min.json`, {
    headers: { Range: "bytes=0-1200000" },
  });
  const raw = await res.text();
  const match = raw.match(/"sections"\s*:\s*\{.*?\}/s);
  if (!match) throw new Error(`لا أقسام في ${book}`);
  return JSON.parse(match[0].slice(match[0].indexOf(":") + 1));
}

function assertContiguous(book, numbers) {
  const sorted = [...numbers].map(Number).sort((a, b) => a - b);
  const max = sorted[sorted.length - 1] ?? 0;
  const missing = [];
  for (let i = 1; i <= max; i += 1) if (!numbers.has(String(i))) missing.push(i);
  if (missing.length) {
    throw new Error(`${book}: ترقيم الأبواب غير متصل — ثغرات: ${missing.join(",")}`);
  }
  return max;
}

async function main() {
  const outIndex = process.argv.indexOf("--out");
  const outPath = outIndex > -1 ? process.argv[outIndex + 1] : "src/data/hadithArabicChapters.ts";

  const byBook = {};      // "book::english" -> arabic
  const byNumber = {};    // book -> { "1": arabic }
  const globalMap = {};
  const summary = [];

  for (const book of BOOKS) {
    const arabicByNumber = await fetchArabicChapters(book);
    const upstream = await fetchUpstreamSections(book);

    let matched = 0;
    const unmatched = [];
    for (const [number, english] of Object.entries(upstream)) {
      const title = String(english ?? "").trim();
      if (!title) continue;
      const arabic = arabicByNumber.get(String(number));
      if (!arabic) {
        unmatched.push(`${number}: ${title}`);
        continue;
      }
      byBook[`${book}::${normalize(title)}`] = arabic;
      globalMap[normalize(title)] = globalMap[normalize(title)] ?? arabic;
      matched += 1;
    }
    if (unmatched.length) {
      throw new Error(`${book}: ${unmatched.length} بابًا بلا اسم عربي — ${unmatched.join(" | ")}`);
    }

    const numbers = new Map(arabicByNumber);
    const max = assertContiguous(book, new Set(numbers.keys()));
    byNumber[book] = Object.fromEntries(numbers);
    summary.push(`${book}: ${numbers.size} بابًا (1..${max}) — مطابقة بالعنوان ${matched}`);
  }

  const dumpFlat = (obj, indent = "  ") =>
    Object.keys(obj)
      .sort()
      .map((k) => `${indent}${JSON.stringify(k)}: ${JSON.stringify(obj[k])},`)
      .join("\n");

  const content = `/**
 * أسماء أبواب كتب الحديث بالعربية — مولَّد آليًا. لا تُحرّره يدويًا.
 *
 * المُولِّد: scripts/generate-hadith-chapters.mjs
 * المصدر : github.com/AhmedBaset/hadith-json (db/by_book/the_9_books/*.json، حقل chapters[].arabic)
 * المطابقة: مقابل بيانات التطبيق github.com/fawazahmed0/hadith-api (editions/ara-*.min.json)
 *           التي تحمل أسماء الأبواب بالإنجليزية فقط.
 * الترخيص: بيانات مفتوحة منشورة على GitHub (راجع مستودع المصدر).
 *
 * ${summary.join("\n * ")}

 * لا شبكة ولا حساب وقت التشغيل: الجدول ثابت داخل الحزمة.
 */

/** تطبيع عنوان الباب للمطابقة (توحيد المسافات وحالة الأحرف). */
export function normalizeChapterTitle(title: string): string {
  return String(title ?? "").trim().replace(/\\s+/g, " ").toLowerCase();
}

/** أسماء الأبواب العربية مفهرسة بـ«معرّف الكتاب::العنوان الإنجليزي المطبَّع». */
export const ARABIC_CHAPTER_BY_BOOK: Record<string, string> = {
${dumpFlat(byBook)}
};

/** أسماء الأبواب العربية مفهرسة بـ«معرّف الكتاب::رقم الباب» — للحل وقت العرض. */
export const ARABIC_CHAPTER_BY_NUMBER: Record<string, Record<string, string>> = {
${Object.keys(byNumber)
  .sort()
  .map((book) => `  ${JSON.stringify(book)}: {\n${dumpFlat(byNumber[book], "    ")}\n  },`)
  .join("\n")}
};

/** احتياطي عام لعنوان إنجليزي غير مفهرس لكتابه. */
export const ARABIC_CHAPTER_GLOBAL: Record<string, string> = {
${dumpFlat(globalMap)}
};

/** اسم الباب العربي من عنوانه الإنجليزي، أو null. */
export function arabicChapterFor(bookId: string, englishTitle: string): string | null {
  const key = normalizeChapterTitle(englishTitle);
  if (!key) return null;
  return ARABIC_CHAPTER_BY_BOOK[bookId + "::" + key] ?? ARABIC_CHAPTER_GLOBAL[key] ?? null;
}

/** اسم الباب العربي من رقمه داخل كتابه، أو null. */
export function arabicChapterByNumber(bookId: string, sectionNumber: string): string | null {
  const table = ARABIC_CHAPTER_BY_NUMBER[bookId];
  if (!table) return null;
  return table[String(sectionNumber ?? "").trim()] ?? null;
}

/** هل النص بديل رقمي مُخترَع (قديم) يجب استبداله؟ */
export function isPlaceholderChapterTitle(title: string): boolean {
  const value = String(title ?? "").trim();
  return value === "" || /^(كتاب|باب)\\s*رقم/.test(value);
}
`;

  fs.writeFileSync(path.resolve(outPath), content, "utf8");
  console.log(summary.join("\n"));
  console.log(`\n✔ كُتب ${outPath} (${content.length} حرفًا)`);
}

main().catch((error) => {
  console.error("✘ فشل التوليد:", error.message);
  process.exit(1);
});
