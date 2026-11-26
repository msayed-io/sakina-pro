package com.sakeenah.app.plugin

import android.database.sqlite.SQLiteDatabase
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.Locale
import kotlin.concurrent.thread

@CapacitorPlugin(name = "HadithNative")
class HadithNativePlugin : Plugin() {
    private val root by lazy { File(context.filesDir, "hadith") }

    @PluginMethod
    fun isDownloaded(call: PluginCall) {
        val id = call.getString("bookId") ?: return call.reject("معرّف المصدر غير صالح")
        call.resolve(JSObject().put("downloaded", File(root, "$id.db").exists()))
    }

    @PluginMethod
    fun deleteBook(call: PluginCall) {
        val id = call.getString("bookId") ?: return call.reject("معرّف المصدر غير صالح")
        val deleted = File(root, "$id.db").delete() || !File(root, "$id.db").exists()
        call.resolve(JSObject().put("deleted", deleted))
    }

    @PluginMethod
    fun downloadBook(call: PluginCall) {
        val id = call.getString("bookId") ?: return call.reject("معرّف المصدر غير صالح")
        val url = call.getString("url") ?: return call.reject("رابط المصدر غير صالح")
        val expected = call.getString("sha256")?.lowercase(Locale.ROOT) ?: return call.reject("بصمة المصدر غير صالحة")
        thread(name = "hadith-download-$id") {
            try {
                root.mkdirs()
                val target = File(root, "$id.db")
                val partial = File(root, "$id.db.part")
                val existing = if (partial.exists()) partial.length() else 0L
                val connection = (URL(url).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 20000
                    readTimeout = 30000
                    requestMethod = "GET"
                    if (existing > 0) setRequestProperty("Range", "bytes=$existing-")
                }
                connection.connect()
                val append = existing > 0 && connection.responseCode == HttpURLConnection.HTTP_PARTIAL
                if (!append) partial.delete()
                val total = (if (append) existing else 0L) + connection.contentLengthLong.coerceAtLeast(0L)
                val input = connection.inputStream
                val output = FileOutputStream(partial, append)
                val buffer = ByteArray(64 * 1024)
                var copied = if (append) existing else 0L
                var read: Int
                emitProgress(id, if (total > 0) ((copied * 100) / total).toInt() else 0, "جارٍ تنزيل الكتاب")
                while (input.read(buffer).also { read = it } != -1) {
                    output.write(buffer, 0, read)
                    copied += read
                    if (total > 0) emitProgress(id, ((copied * 100) / total).toInt().coerceAtMost(99), "جارٍ تنزيل الكتاب")
                }
                output.flush(); output.close(); input.close(); connection.disconnect()
                emitProgress(id, 100, "جارٍ تجهيز الكتاب")
                val actual = sha256(partial)
                if (!actual.equals(expected, ignoreCase = true)) {
                    partial.delete()
                    throw IllegalStateException("تعذر التحقق من سلامة الكتاب")
                }
                if (!partial.renameTo(target)) {
                    target.delete()
                    if (!partial.renameTo(target)) throw IllegalStateException("تعذر حفظ الكتاب")
                }
                notifyListeners("downloadProgress", JSObject().apply {
                    put("bookId", id); put("percent", 100); put("status", "تم تجهيز الكتاب للقراءة")
                })
                call.resolve(JSObject().put("downloaded", true))
            } catch (error: Exception) {
                notifyListeners("downloadProgress", JSObject().apply {
                    put("bookId", id); put("percent", 0); put("status", error.message ?: "تعذر تنزيل الكتاب")
                })
                call.reject(error.message ?: "تعذر تنزيل الكتاب")
            }
        }
    }

    @PluginMethod
    fun getBooks(call: PluginCall) {
        try {
            val id = call.getString("bookId") ?: return call.reject("معرّف المصدر غير صالح")
            val db = open(id); val rows = JSArray()
            db.rawQuery("SELECT b.id, b.book_number, b.title_ar, COUNT(h.id) FROM books b LEFT JOIN hadiths h ON h.book_id=b.id GROUP BY b.id, b.book_number, b.title_ar ORDER BY b.book_number, b.id", null).use { c ->
                while (c.moveToNext()) rows.put(JSObject().apply {
                    put("id", c.getLong(0).toString()); put("number", c.getInt(1)); put("title", c.getString(2)); put("hadithCount", c.getInt(3))
                })
            }
            db.close(); call.resolve(JSObject().put("books", rows))
        } catch (e: Exception) { call.reject(e.message ?: "تعذر قراءة كتب المصدر") }
    }

    @PluginMethod
    fun getChapters(call: PluginCall) {
        try {
            val id = call.getString("bookId") ?: return call.reject("معرّف المصدر غير صالح")
            val innerBookId = call.getString("innerBookId") ?: "all"
            val db = open(id); val rows = JSArray()
            val sql = "SELECT id, chapter_number, title_ar, (SELECT COUNT(*) FROM hadiths h WHERE h.chapter_id=chapters.id) FROM chapters" + (if (innerBookId == "all") "" else " WHERE book_id = ?") + " ORDER BY chapter_number, id"
            val args = if (innerBookId == "all") null else arrayOf(innerBookId)
            db.rawQuery(sql, args).use { c ->
                while (c.moveToNext()) rows.put(JSObject().apply {
                    put("id", c.getLong(0).toString()); put("number", c.getInt(1)); put("title", c.getString(2)); put("hadithCount", c.getInt(3));
                })
            }
            db.close(); call.resolve(JSObject().put("chapters", rows))
        } catch (e: Exception) { call.reject(e.message ?: "تعذر قراءة أبواب الكتاب") }
    }

    @PluginMethod
    fun getHadiths(call: PluginCall) {
        try {
            val id = call.getString("bookId") ?: return call.reject("معرّف المصدر غير صالح")
            val chapter = call.getString("chapterId") ?: "all"
            val innerBookId = call.getString("innerBookId") ?: "all"
            val page = (call.getInt("page", 1) ?: 1).coerceAtLeast(1)
            val limit = (call.getInt("limit", 20) ?: 20).coerceIn(1, 100000)
            val search = call.getString("search")?.trim().orEmpty()
            val db = open(id); val all = readHadiths(db, id, innerBookId, chapter, search); db.close()
            val start = ((page - 1) * limit).coerceAtMost(all.size)
            val rows = JSArray(); all.drop(start).take(limit).forEach { rows.put(it) }
            call.resolve(JSObject().apply { put("total", all.size); put("totalPages", (all.size + limit - 1) / limit.coerceAtLeast(1)); put("hadiths", rows) })
        } catch (e: Exception) { call.reject(e.message ?: "تعذر قراءة الأحاديث") }
    }

    @PluginMethod
    fun searchHadiths(call: PluginCall) {
        try {
            val query = call.getString("query")?.trim().orEmpty()
            val bookId = call.getString("bookId") ?: "all"
            val ids = if (bookId == "all") root.listFiles { f -> f.extension == "db" }?.map { it.nameWithoutExtension } ?: emptyList() else listOf(bookId)
            val results = JSArray(); ids.forEach { id ->
                val db = open(id); readHadiths(db, id, "all", "all", query).take(40 - results.length()).forEach { results.put(it) }; db.close()
            }
            call.resolve(JSObject().put("results", results))
        } catch (e: Exception) { call.reject(e.message ?: "تعذر البحث في الأحاديث") }
    }

    private fun open(id: String): SQLiteDatabase = SQLiteDatabase.openDatabase(File(root, "$id.db").absolutePath, null, SQLiteDatabase.OPEN_READONLY)

    private fun readHadiths(db: SQLiteDatabase, id: String, innerBookId: String, chapter: String, search: String): List<JSObject> {
        val args = mutableListOf<String>(); val where = mutableListOf<String>()
        if (innerBookId != "all") { where += "h.book_id = ?"; args += innerBookId }
        if (chapter != "all") { where += "h.chapter_id = ?"; args += chapter }
        val sql = "SELECT h.hadith_number, h.text_tashkeel, h.text_plain, h.chapter_id, c.title_ar, b.title_ar FROM hadiths h JOIN chapters c ON c.id=h.chapter_id JOIN books b ON b.id=h.book_id" + if (where.isEmpty()) "" else " WHERE " + where.joinToString(" AND ") + " ORDER BY h.id"
        val normalized = search.lowercase(Locale.ROOT)
        val output = mutableListOf<JSObject>()
        db.rawQuery(sql, args.toTypedArray()).use { c ->
            while (c.moveToNext()) {
                val number = c.getString(0); val tashkeel = c.getString(1); val plain = c.getString(2); val chapterTitle = c.getString(4); val bookTitle = c.getString(5)
                if (normalized.isNotEmpty() && !number.contains(normalized) && !plain.lowercase(Locale.ROOT).contains(normalized) && !tashkeel.lowercase(Locale.ROOT).contains(normalized) && !chapterTitle.lowercase(Locale.ROOT).contains(normalized)) continue
                output += JSObject().apply { put("bookId", id); put("bookTitle", bookTitle); put("hadithnumber", number.toIntOrNull() ?: 0); put("arabicnumber", number); put("chapterId", c.getString(3)); put("chapterTitle", chapterTitle); put("text", tashkeel); put("textAvailable", tashkeel.isNotBlank()) }
            }
        }
        return output
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256"); FileInputStream(file).use { input -> val buffer = ByteArray(64 * 1024); var n: Int; while (input.read(buffer).also { n = it } != -1) digest.update(buffer, 0, n) }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private fun emitProgress(id: String, percent: Int, status: String) = notifyListeners("downloadProgress", JSObject().apply { put("bookId", id); put("percent", percent); put("status", status) })
}
