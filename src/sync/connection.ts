import { HistoryWebDavRepository } from "./historyWebdav";
import { WebDavRepository } from "./webdav";

/** Each operation owns a short-lived connection. Native credentials are never persisted. */
export async function connectSyncRepository(endpoint: string, username: string, password: string) {
  const root = new URL(endpoint);
  new WebDavRepository(endpoint); // Shared validation, before any network or IPC.
  if (!root.pathname.endsWith("/")) root.pathname += "/";
  if (root.hostname === "dav.jianguoyun.com") {
    const desktop =
      typeof window === "undefined" ? undefined : (window.iThreadAndroid ?? window.iThreadDesktop);
    if (!desktop?.syncConnect || !desktop.syncRequest || !desktop.syncDisconnect)
      throw new Error("desktop-required");
    const token = await desktop.syncConnect({ endpoint: root.href, username, password });
    let closed = false;
    const request: typeof fetch = async (input, init) => {
      if (closed) throw new Error("cancelled");
      const url = new URL(String(input));
      if (
        url.origin !== root.origin ||
        !url.pathname.startsWith(root.pathname) ||
        url.search ||
        url.hash
      )
        throw new Error("Invalid sync request path");
      const filename = url.pathname.slice(root.pathname.length);
      const response = await desktop.syncRequest?.(token, {
        filename,
        method: init?.method ?? "GET",
        headers: Object.fromEntries(new Headers(init?.headers)),
        ...(typeof init?.body === "string" ? { body: init.body } : {}),
      });
      if (!response) throw new Error("Native sync unavailable");
      return new Response([204, 205, 304].includes(response.status) ? null : response.body, {
        status: response.status,
        headers: response.headers,
      });
    };
    return {
      repository: new HistoryWebDavRepository(root.href, request),
      close: async () => {
        if (!closed) {
          closed = true;
          await desktop.syncDisconnect?.(token);
        }
      },
    };
  }
  if (typeof window !== "undefined" && window.iThreadAndroid)
    throw new Error("android-provider-unsupported");
  const controller = new AbortController();
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  const authorization =
    username || password ? `Basic ${btoa(String.fromCharCode(...bytes))}` : undefined;
  return {
    repository: new WebDavRepository(root.href, (input, init) =>
      fetch(input, {
        ...init,
        signal: AbortSignal.any([controller.signal, ...(init?.signal ? [init.signal] : [])]),
        headers: {
          ...Object.fromEntries(new Headers(init?.headers)),
          ...(authorization ? { Authorization: authorization } : {}),
        },
      }),
    ),
    close: async () => {
      controller.abort();
    },
  };
}
