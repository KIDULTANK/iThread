// Loaded synchronously before the bundled editor. The native listener only accepts this origin's
// main frame; no Android interface is exposed to maps or external browser pages.
(() => {
  if (!window.IThreadNative?.postMessage) return;
  const pending = new Map();
  function call(method, input) {
    if (pending.size >= 8) return Promise.reject(new Error("Android bridge busy"));
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      // A document picker may remain open longer than a network request.
      const timer = setTimeout(
        () => {
          pending.delete(id);
          reject(new Error("Android operation timed out"));
        },
        method === "saveFile" ? 600000 : 45000,
      );
      pending.set(id, { resolve, reject, timer });
      try {
        window.IThreadNative.postMessage(JSON.stringify({ id, method, input }));
      } catch (error) {
        clearTimeout(timer);
        pending.delete(id);
        reject(error);
      }
    });
  }
  window.IThreadNative.onmessage = ({ data }) => {
    let response;
    try {
      response = JSON.parse(data);
    } catch {
      return;
    }
    const request = pending.get(response.id);
    if (!request) return;
    pending.delete(response.id);
    clearTimeout(request.timer);
    if (response.error) request.reject(new Error(response.error));
    else request.resolve(response.value);
  };
  Object.defineProperty(window, "iThreadAndroid", {
    value: Object.freeze({
      syncConnect: (input) => call("syncConnect", input),
      syncRequest: (token, input) => call("syncRequest", { token, ...input }),
      syncDisconnect: (token) => call("syncDisconnect", { token }),
      saveFile: (input) => call("saveFile", input),
    }),
  });
  document.documentElement.dataset.platform = "android";
  // The APK owns updates; a website service worker must never replace bundled app code.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void call("syncCloseAll", {}).catch(() => {});
  });
})();
