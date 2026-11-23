#!/usr/bin/env node
/**
 * مولّد مانيفست التحديث التفاضلي لـ «سَكِينَة».
 *
 * يقرأ مجلد البناء `dist/` ويُنتج `version.json` يحوي:
 *  - `manifest`: بصمة SHA-256 لكل ملف، مع رابط تنزيل مباشر من فرع `ota-bundle`.
 *  - `url` + `sha256`: مسار احتياطي صامت إلى حزمة `dist.zip` الكاملة.
 *
 * مكتبات Node الأساسية فقط (fs, path, crypto) — لا اعتماديات.
 *
 * الاستخدام:
 *   OTA_VERSION=2.3.47.62 \
 *   MIN_NATIVE_VERSION=2.3.45 \
 *   FALLBACK_ZIP_URL=https://github.com/o/r/releases/download/v1/dist.zip \
 *   FALLBACK_ZIP_SHA256=<hex64> \
 *   RAW_BASE_URL=https://raw.githubusercontent.com/o/r/ota-bundle \
 *   node scripts/generate-ota-manifest.mjs [--dist dist] [--out dist/version.json]
 */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

/* ------------------------------------------------------------------ */
/* قراءة الوسائط                                                       */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args[key] = next;
        i += 1;
      } else {
        args[key] = "true";
      }
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const repoRoot = process.cwd();

const distDir = path.resolve(repoRoot, args.dist ?? "dist");
const outFile = path.resolve(repoRoot, args.out ?? path.join(distDir, "version.json"));

const env = process.env;
const otaVersion = (args.version ?? env.OTA_VERSION ?? "").trim();
const minNativeVersion = (args.min ?? env.MIN_NATIVE_VERSION ?? "").trim();
const fallbackUrl = (args.url ?? env.FALLBACK_ZIP_URL ?? "").trim();
const fallbackSha = (args.sha ?? env.FALLBACK_ZIP_SHA256 ?? "").trim().toLowerCase();
const rawBase = (args.raw ?? env.RAW_BASE_URL ?? "").trim().replace(/\/+$/, "");

const errors = [];
if (!otaVersion) errors.push("OTA_VERSION غائب");
if (!minNativeVersion) errors.push("MIN_NATIVE_VERSION غائب");
if (!fallbackUrl) errors.push("FALLBACK_ZIP_URL غائب");
if (!fallbackSha) errors.push("FALLBACK_ZIP_SHA256 غائب");
if (!rawBase) errors.push("RAW_BASE_URL غائب");

if (fallbackSha && !/^[0-9a-f]{64}$/.test(fallbackSha)) {
  errors.push(`FALLBACK_ZIP_SHA256 ليس SHA-256 hex صالحًا (64 حرفًا): ${fallbackSha}`);
}
if (fallbackUrl && !fallbackUrl.startsWith("https://")) {
  errors.push(`FALLBACK_ZIP_URL يجب أن يكون https:// — القيمة: ${fallbackUrl}`);
}
if (rawBase && !rawBase.startsWith("https://")) {
  errors.push(`RAW_BASE_URL يجب أن يكون https:// — القيمة: ${rawBase}`);
}

if (errors.length > 0) {
  for (const message of errors) console.error(`[ota-manifest] خطأ: ${message}`);
  process.exit(1);
}

/* ------------------------------------------------------------------ */
/* جمع ملفات dist/                                                     */
/* ------------------------------------------------------------------ */

/** ملفات نظام لا معنى لبصمتها. */
function isIgnored(name) {
  return name.startsWith(".") && name !== ".well-known";
}

/**
 * يمشي dist/ بعمق، ويعيد المسارات النسبية بفواصل `/`، مرتبة أبجديًا.
 * ترتيب ثابت ضروري: مانيفست قابل للتمييز (diff-friendly) بين تشغيلين.
 */
function collectFiles(dir, prefix = "", collected = []) {
  let names;
  try {
    names = readdirSync(dir);
  } catch (error) {
    throw new Error(`تعذّرت قراءة المجلد ${dir}: ${error.message}`);
  }
  names.sort();
  for (const name of names) {
    if (isIgnored(name)) continue;
    const absolute = path.join(dir, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    const stats = statSync(absolute);
    if (stats.isDirectory()) {
      collectFiles(absolute, relative, collected);
    } else if (stats.isFile()) {
      collected.push({ absolute, relative, size: stats.size });
    }
  }
  return collected;
}

/**
 * يرمّز كل مقطع من المسار على حدة حتى تبقى الفواصل `/` سليمة،
 * فتعمل الروابط مع الأسماء العربية والمسافات.
 */
function encodePath(relative) {
  return relative
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function sha256File(absolute) {
  const hash = createHash("sha256");
  hash.update(readFileSync(absolute));
  return hash.digest("hex");
}

/* ------------------------------------------------------------------ */
/* التوليد                                                             */
/* ------------------------------------------------------------------ */

function main() {
  let files;
  try {
    files = collectFiles(distDir);
  } catch (error) {
    console.error(`[ota-manifest] ${error.message}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error(`[ota-manifest] لا ملفات داخل ${distDir} — تأكد من نجاح البناء أولًا.`);
    process.exit(1);
  }

  const manifest = files.map((file) => ({
    file_name: file.relative,
    file_hash: sha256File(file.absolute),
    download_url: `${rawBase}/${encodePath(file.relative)}`,
  }));

  // index.html شرط صارم للبلوجن: بدونه ترفض الإضافة الحزمة.
  if (!manifest.some((entry) => entry.file_name === "index.html")) {
    console.error("[ota-manifest] index.html غير موجود في جذر dist/ — البلوجن سيرفض الحزمة.");
    process.exit(1);
  }

  const payload = {
    version: otaVersion,
    minNativeVersion,
    url: fallbackUrl,
    sha256: fallbackSha,
    manifest,
  };

  const json = `${JSON.stringify(payload, null, 2)}\n`;
  writeFileSync(outFile, json, "utf8");

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const sizeKb = Buffer.byteLength(json, "utf8") / 1024;
  const mib = (bytes) => (bytes / 1048576).toFixed(2);

  console.log("[ota-manifest] ✔ تم توليد البيان التفاضلي");
  console.log(`[ota-manifest]   الإصدار          : ${otaVersion}`);
  console.log(`[ota-manifest]   أدنى APK أصلي    : ${minNativeVersion}`);
  console.log(`[ota-manifest]   عدد الملفات      : ${manifest.length}`);
  console.log(`[ota-manifest]   حجم المحتوى      : ${mib(totalBytes)} MiB`);
  console.log(`[ota-manifest]   حجم version.json : ${sizeKb.toFixed(1)} KiB`);
  console.log(`[ota-manifest]   المسار           : ${outFile}`);
}

main();
