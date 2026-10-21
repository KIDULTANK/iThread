import { registerMessages, t } from "../i18n/registry";

registerMessages("en", {
  "android.exportFailed": "Export failed; your local map is still saved. {error}",
});

/** Android exports use the system document picker, not an unsupported WebView blob download. */
export async function saveAndroidBlob(blob: Blob, filename: string): Promise<void> {
  try {
    if (blob.size > 16 * 1024 * 1024)
      throw new Error("Export exceeds the 16 MiB Android preview limit");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let at = 0; at < bytes.length; at += 32768)
      binary += String.fromCharCode(...bytes.subarray(at, at + 32768));
    await window.iThreadAndroid?.saveFile({
      filename,
      mime: blob.type || "application/octet-stream",
      base64: btoa(binary),
    });
  } catch (error) {
    window.alert(t("android.exportFailed", { error: String(error) }));
  }
}
