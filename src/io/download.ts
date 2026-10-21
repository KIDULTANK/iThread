/** Trigger a browser download of a Blob as `filename` — an object URL behind a transient <a>, revoked
 *  right after the click. The one place the download mechanism lives (export handlers, the map-card
 *  "download", and the save-picker fallback all share it). */
export async function downloadBlob(blob: Blob, filename: string): Promise<boolean> {
  if (import.meta.env.MODE === "android" && window.iThreadAndroid) {
    return (await import("./androidDownload")).saveAndroidBlob(blob, filename);
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return true;
}
