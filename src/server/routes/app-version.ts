import { Router } from "express";

/**
 * آخر إصدار منشور فعليًا على GitHub Releases.
 *
 * لا رقم مكتوب بيد في أي مكان: المصدر هو وسم الإصدار الحقيقي (tag_name)
 * الذي ينشره الـworkflow. يُخزَّن 10 دقائق في الذاكرة، وإن فشل الطلب
 * الخارجي نُعيد آخر قيمة ناجحة بدل رقم مختلَق.
 */

const REPO = "msayed-io/sakina-pro";
const CACHE_MS = 10 * 60 * 1000;

type Cache = { version: string; at: number } | null;

const router = Router();
let cache: Cache = null;

/** "v2.3.43" → "2.3.43" */
function stripV(tag: string): string {
  return tag.replace(/^v/i, "").trim();
}

router.get("/app-version", async (_req, res) => {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    res.json({ version: cache.version, source: "cache" });
    return;
  }

  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "sakina-app",
    };
    // التوكن اختياري: يرفع حد المعدّل فقط، ولا يُرسل أبدًا إلى العميل.
    const token = process.env.GITHUB_RELEASES_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(`GitHub releases responded ${response.status}`);
    }
    const data = (await response.json()) as { tag_name?: string };
    const version = data.tag_name ? stripV(data.tag_name) : "";
    if (!version) throw new Error("tag_name missing from release payload");

    cache = { version, at: Date.now() };
    res.json({ version, source: "github" });
  } catch (error) {
    console.warn("App version lookup failed:", error);
    if (cache) {
      // آخر قيمة ناجحة أفضل من لا شيء.
      res.json({ version: cache.version, source: "stale" });
      return;
    }
    res.status(502).json({ error: "unavailable" });
  }
});

export default router;
