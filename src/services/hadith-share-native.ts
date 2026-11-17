import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Media } from "@capacitor-community/media";

// 768 KiB is divisible by three: each independently encoded chunk can be
// appended as decoded binary by the native Filesystem implementation.
const CHUNK_BYTES = 3 * 256 * 1024;
const ALBUM_NAME = "Sakina";

type SaveResult = "gallery" | "shared" | "cancelled";

function encodeChunk(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string" || !reader.result.includes(",")) {
        reject(new Error("Unable to encode image"));
        return;
      }
      resolve(reader.result.slice(reader.result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read image"));
    reader.readAsDataURL(blob);
  });
}

async function removeTemp(path: string): Promise<void> {
  await Filesystem.deleteFile({ directory: Directory.Cache, path }).catch(() => undefined);
}

async function writeTemp(blob: Blob, path: string): Promise<string> {
  if (!blob.size) throw new Error("Empty image");
  try {
    for (let offset = 0; offset < blob.size; offset += CHUNK_BYTES) {
      const data = await encodeChunk(blob.slice(offset, offset + CHUNK_BYTES));
      if (offset === 0) await Filesystem.writeFile({ directory: Directory.Cache, path, data });
      else await Filesystem.appendFile({ directory: Directory.Cache, path, data });
    }
    return (await Filesystem.getUri({ directory: Directory.Cache, path })).uri;
  } catch (error) {
    await removeTemp(path);
    throw error;
  }
}

async function getAppAlbum(): Promise<string> {
  // Media 9 uses app-owned external-media directories by default, without
  // broad storage permissions. Match the path as well as the album name so a
  // different application's identically named album cannot be selected.
  const { path } = await Media.getAlbumsPath();
  const expected = `${path.replace(/\/$/, "")}/${ALBUM_NAME}`;
  const find = async () => (await Media.getAlbums()).albums.find(
    (album) => album.name === ALBUM_NAME && album.identifier.replace(/\/$/, "") === expected,
  );
  let album = await find();
  if (!album) {
    await Media.createAlbum({ name: ALBUM_NAME });
    album = await find();
  }
  if (!album) throw new Error("Album unavailable");
  return album.identifier;
}

/** Native Android bridge. The sheet remains responsible for browser download and user messages. */
export async function saveHadithImage(blob: Blob, fileName: string): Promise<SaveResult> {
  if (Capacitor.getPlatform() !== "android") throw new Error("Native Android only");
  const stem = fileName.replace(/\.png$/i, "").replace(/[^a-zA-Z0-9_-]/g, "_") || "sakina-hadith";
  const uniqueStem = `${stem}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tempName = `${uniqueStem}.png`;
  const uri = await writeTemp(blob, tempName);
  try {
    const albumIdentifier = await getAppAlbum();
    await Media.savePhoto({ path: uri, albumIdentifier, fileName: uniqueStem });
    await removeTemp(tempName);
    return "gallery";
  } catch {
    // Keep the file until the OS share target has had time to read it.
  }
  try {
    await Share.share({ title: "سكينة", files: [uri] });
    setTimeout(() => void removeTemp(tempName), 120_000);
    return "shared";
  } catch (error) {
    await removeTemp(tempName);
    // The installed Android Share plugin rejects user cancellation with this
    // exact message; don't hide unrelated errors that happen to contain it.
    if (error instanceof Error && error.message === "Share canceled") return "cancelled";
    throw error;
  }
}
