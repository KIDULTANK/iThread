import { registerMessages, t } from "../i18n/registry";

registerMessages("en", {
  "android.exportFailed": "Export failed; your local map is still saved. {error}",
});

/** Android exports use the system document picker, not an unsupported WebView blob download. */
export async function saveAndroidBlob(blob: Blob, filename: string): Promise<boolean> {
  try {
    if (blob.size > 16 * 1024 * 1024)
      throw new Error("Export exceeds the 16 MiB Android preview limit");
    // Let the browser's asynchronous reader produce the payload instead of running a large
    // byte-to-character loop on the editor's JavaScript thread.
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const value = String(reader.result);
        const split = value.indexOf(",");
        if (split < 0) reject(new Error("Invalid export data"));
        else resolve(value.slice(split + 1));
      };
      reader.onerror = () => reject(reader.error ?? new Error("Export read failed"));
      reader.onabort = () => reject(new Error("Export cancelled"));
      reader.readAsDataURL(blob);
    });
    if (!window.iThreadAndroid) throw new Error("Android export unavailable");
    return await window.iThreadAndroid.saveFile({
      filename,
      mime: blob.type || "application/octet-stream",
      base64,
    });
  } catch (error) {
    window.alert(t("android.exportFailed", { error: String(error) }));
    return false;
  }
}
