import { check, type Update } from "@tauri-apps/plugin-updater";

export interface AppUpdateInfo {
  available: boolean;
  version?: string;
  body?: string;
  date?: string;
  update?: Update;
  error?: string;
}

export async function checkForUpdates(): Promise<AppUpdateInfo> {
  try {
    const update = await check();
    if (update) {
      return {
        available: update.available,
        version: update.version,
        body: update.body || "",
        date: update.date || "",
        update,
      };
    }
    return { available: false };
  } catch (err: any) {
    console.warn("Updater check error:", err);
    return {
      available: false,
      error: err?.message || String(err),
    };
  }
}

export async function installAppUpdate(
  update: Update,
  onProgress?: (downloaded: number, contentLength?: number) => void,
): Promise<void> {
  let downloaded = 0;
  let contentLength = 0;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case "Started":
        contentLength = event.data.contentLength || 0;
        if (onProgress) onProgress(0, contentLength);
        break;
      case "Progress":
        downloaded += event.data.chunkLength;
        if (onProgress) onProgress(downloaded, contentLength);
        break;
      case "Finished":
        if (onProgress) onProgress(contentLength, contentLength);
        break;
    }
  });
}
