import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { marked } from "marked";
import { type Plugin, defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { NAVIGATION_FALLBACK_DENYLIST } from "./src/pwa/navigationDenylist";

const ROOT = dirname(fileURLToPath(import.meta.url));

/** A production PWA service worker can otherwise keep serving an old app shell when this repository
 * is later opened through Vite on the same localhost origin. During development, replace that worker
 * with a one-shot reset worker: it clears app-shell caches, unregisters itself, and reloads clients
 * onto Vite. IndexedDB (the map library) is deliberately untouched. */
function devServiceWorkerResetPlugin(): Plugin {
  return {
    name: "dev-service-worker-reset",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/sw.js", (_req, res) => {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.end(`
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((name) => caches.delete(name)));
    await self.registration.unregister();
    const windows = await self.clients.matchAll({ type: "window" });
    await Promise.all(windows.map((client) => client.navigate(client.url)));
  })());
});
`);
      });
    },
  };
}

/** Local-only command queue used by `pnpm ithread`. Browser-origin POSTs from anywhere except this
 * Vite origin are rejected, so an unrelated website cannot drive the editor through localhost. */
function iThreadCliBridgePlugin(): Plugin {
  const queue: Record<string, unknown>[] = [];
  const results = new Map<string, unknown>();
  const capabilities = [
    "listMaps",
    "getMap",
    "openMap",
    "createMap",
    "importFile",
    "exportMap",
    "addTopic",
    "updateTopic",
    "moveTopic",
    "deleteTopic",
    "batchTopics",
  ];
  let lastAppPoll = 0;
  const send = (res: import("node:http").ServerResponse, status: number, body?: unknown) => {
    res.statusCode = status;
    res.setHeader("Cache-Control", "no-store");
    if (body === undefined) return res.end();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  };
  const readJson = async (req: import("node:http").IncomingMessage): Promise<unknown> => {
    let text = "";
    for await (const chunk of req) {
      text += chunk;
      // File-import commands carry the source as base64. Keep this local-only bridge roomy enough for
      // real iThoughts libraries while still rejecting accidentally unbounded requests.
      if (text.length > 64_000_000) throw new Error("Command is too large");
    }
    return JSON.parse(text || "{}");
  };
  return {
    name: "ithread-cli-bridge",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        if (!url.pathname.startsWith("/__ithread_cli/v1/")) return next();
        const remote = req.socket.remoteAddress ?? "";
        if (!/^(127\.|::1$|::ffff:127\.)/.test(remote))
          return send(res, 403, { error: "CLI access is restricted to this computer" });
        const origin = req.headers.origin;
        if (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin))
          return send(res, 403, { error: "Cross-origin CLI access denied" });
        try {
          if (req.method === "GET" && url.pathname === "/__ithread_cli/v1/status")
            return send(res, 200, {
              name: "iThread",
              protocolVersion: 1,
              transport: "vite-loopback",
              appConnected: Date.now() - lastAppPoll < 2500,
              queued: queue.length,
              capabilities,
            });
          if (req.method === "POST" && url.pathname === "/__ithread_cli/v1/commands") {
            if (queue.length >= 100) return send(res, 429, { error: "CLI queue is full" });
            const body = (await readJson(req)) as Record<string, unknown>;
            if (typeof body.action !== "string") return send(res, 400, { error: "Missing action" });
            const id = crypto.randomUUID();
            queue.push({ ...body, requestId: id });
            return send(res, 202, { id });
          }
          if (req.method === "GET" && url.pathname === "/__ithread_cli/v1/commands/next") {
            lastAppPoll = Date.now();
            const command = queue.shift();
            return command ? send(res, 200, command) : send(res, 204);
          }
          const match = url.pathname.match(/^\/__ithread_cli\/v1\/commands\/([^/]+)\/result$/);
          if (match && req.method === "POST") {
            results.set(match[1], await readJson(req));
            return send(res, 204);
          }
          if (match && req.method === "GET") {
            if (!results.has(match[1])) return send(res, 200, { status: "pending" });
            const payload = results.get(match[1]);
            results.delete(match[1]);
            return send(res, 200, { status: "complete", payload });
          }
          return send(res, 404, { error: "Unknown CLI endpoint" });
        } catch (error) {
          return send(res, 400, { error: error instanceof Error ? error.message : String(error) });
        }
      });
    },
  };
}

// Render USER_GUIDE.md to a styled, standalone user-guide.html. Done here (at
// build time / on dev request) so the published manual is always generated from
// the one canonical source — never a hand-maintained second copy that can drift.
function renderUserGuide(): string {
  const md = readFileSync(join(ROOT, "USER_GUIDE.md"), "utf8");
  let body = marked.parse(md, { async: false, gfm: true }) as string;
  // GitHub-style heading slugs so the guide's own [text](#anchor) links resolve.
  body = body.replace(/<h([1-6])(?:\s[^>]*)?>([\s\S]*?)<\/h\1>/g, (_full, lvl, inner) => {
    const id = inner
      .replace(/<[^>]+>/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-");
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`;
  });
  return userGuideShell(body);
}

function userGuideShell(body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>User Guide — iThread</title>
<style>
  :root {
    --bg: #ffffff; --fg: #18181b; --muted: #71717a; --accent: #6366f1;
    --border: #e4e4e7; --code-bg: #f4f4f5;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0a0a0a; --fg: #fafafa; --muted: #a1a1aa; --accent: #818cf8;
      --border: #27272a; --code-bg: #18181b;
    }
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--fg); }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.65; font-size: 16px; padding: 2rem 1.25rem 4rem;
  }
  main { max-width: 48rem; margin: 0 auto; }
  header.page-header {
    display: flex; justify-content: space-between; align-items: baseline;
    padding-bottom: 1rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border);
    position: sticky; top: 0; background: var(--bg); z-index: 1;
  }
  header.page-header a.back { font-size: 0.875rem; color: var(--accent); text-decoration: none; }
  header.page-header a.back:hover { text-decoration: underline; }
  header.page-header .brand { font-size: 0.875rem; color: var(--muted); }
  h1 { font-size: 1.9rem; margin: 0 0 1rem; letter-spacing: -0.02em; }
  h2 { font-size: 1.35rem; margin: 2.25rem 0 0.75rem; letter-spacing: -0.01em;
       padding-top: 0.5rem; border-top: 1px solid var(--border); }
  h3 { font-size: 1.1rem; margin: 1.5rem 0 0.5rem; }
  h2 a.anchor, h3 a.anchor { scroll-margin-top: 4rem; }
  h2[id], h3[id] { scroll-margin-top: 4rem; }
  p, ul, ol { margin: 0 0 1rem; }
  ul, ol { padding-left: 1.5rem; }
  li { margin-bottom: 0.35rem; }
  a { color: var(--accent); }
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: var(--code-bg); padding: 0.1em 0.35em; border-radius: 0.25rem; font-size: 0.9em;
  }
  pre {
    background: var(--code-bg); padding: 0.9rem 1rem; border-radius: 0.5rem;
    overflow-x: auto; font-size: 0.875rem; line-height: 1.5;
  }
  pre code { background: transparent; padding: 0; }
  blockquote { border-left: 3px solid var(--accent); padding: 0.1rem 1rem; margin: 1rem 0; color: var(--muted); }
  table { border-collapse: collapse; margin: 1rem 0; font-size: 0.93rem; width: 100%; }
  th, td { border: 1px solid var(--border); padding: 0.4rem 0.7rem; text-align: left; vertical-align: top; }
  th { background: var(--code-bg); }
  hr { border: none; border-top: 1px solid var(--border); margin: 2rem 0; }
  footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.85rem; }
</style>
</head>
<body>
<main>
<header class="page-header">
<a href="/" class="back">← Back to iThread</a>
<span class="brand">iThread</span>
</header>
${body}
<footer>Rendered from <code>USER_GUIDE.md</code> in the iThread repo at build time.</footer>
</main>
</body>
</html>
`;
}

// Serves /user-guide.html in dev and emits it into the build, both rendered from
// USER_GUIDE.md on demand — so the in-app Help link always points at a fresh manual.
function userGuidePlugin(): Plugin {
  const FILE = "user-guide.html";
  return {
    name: "mindmap-user-guide",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || "").split("?")[0];
        if (url === `/${FILE}`) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(renderUserGuide());
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: FILE, source: renderUserGuide() });
    },
  };
}

// Content-Security-Policy for the shipped app. Injected into index.html at BUILD time only (apply:
// "build"), so the dev server + HMR — which need inline scripts — are untouched. A strict policy is
// possible because (a) we ship no inline scripts (the module-preload polyfill is disabled below, so
// modern browsers load only hashed external modules) and (b) all dynamic content is allowlist-
// sanitised before it reaches the DOM. `script-src 'self'` is the key line: it blocks inline event
// handlers (onerror=…) and javascript: URLs as a belt-and-suspenders backstop to the sanitisers.
// `style-src` keeps 'unsafe-inline' (inline styles aren't a script-exec vector; React + 3rd-party CSS
// need it). `object-src 'none'` + `base-uri 'none'` close off plugin and <base> vectors. (Clickjacking
// protection — frame-ancestors / X-Frame-Options — is header-only; it's ignored in a <meta> and so
// belongs at the hosting layer.) Only index.html is transformed; the standalone dashboard.html (which
// calls GitHub) lives in public/ and is copied untouched.
function cspPlugin(): Plugin {
  const CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
  ].join("; ");
  return {
    name: "mindmap-csp",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        "</title>",
        `</title>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

// base "./" keeps the build host-agnostic (local preview + a GitHub Pages
// project/custom-domain deploy without path juggling). Vitest config lives in
// vitest.config.ts to avoid a dual-vite type clash.
export default defineConfig({
  base: "./",
  // No inline module-preload polyfill → the production HTML carries zero inline scripts, so the strict
  // `script-src 'self'` CSP holds (modern browsers / the PWA target support modulepreload natively).
  build: { modulePreload: { polyfill: false } },
  plugins: [
    devServiceWorkerResetPlugin(),
    iThreadCliBridgePlugin(),
    react(),
    cspPlugin(),
    userGuidePlugin(),
    // Installable, offline-capable PWA: precaches the app shell so it works
    // with no network and can be installed to the home screen / desktop.
    VitePWA({
      // "prompt" (not "autoUpdate"): a new deploy parks the new SW in `waiting`
      // and we surface an explicit "Refresh now" toast (src/pwa/pwaUpdate.ts),
      // so a background reload never throws away in-flight edits.
      registerType: "prompt",
      includeAssets: ["icon.svg", "icon-192.png", "icon-512.png", "apple-touch-icon.png"],
      manifest: {
        // A manifest is BAKED AT BUILD TIME, so unlike `<html lang>` and the exporters it cannot follow
        // the locale the user picks at runtime — the install prompt and the OS launcher read this file
        // before the app runs. The web-app-manifest spec has no supported runtime i18n (the
        // `translations` member is not broadly implemented), so serving a per-locale manifest is the
        // real answer if a second language ships. Until then `lang` + `dir` at least tell the OS what
        // language these three strings ARE, which is what a screen reader in the launcher needs.
        lang: "en",
        dir: "ltr",
        name: "iThread",
        short_name: "iThread",
        description: "Local-first visual thinking and mind mapping for Windows.",
        theme_color: "#26215c",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
        ],
        // Register the app as a handler for native `.ithread` + legacy `.mmst`, and MindManager
        // files (import-only — opening one converts it into a library map; see App.tsx launchQueue +
        // src/import/mmap.ts). When the installed PWA is set as the default app (Windows / ChromeOS,
        // Chromium only), double-clicking such a file launches it and hands the file to
        // `window.launchQueue`. Chromium desktop only.
        file_handlers: [
          { action: "./", accept: { "application/json": [".ithread", ".mmst"] } },
          { action: "./", accept: { "application/octet-stream": [".mmap", ".mmp"] } },
        ],
        // Route an opened file into the already-running window instead of spawning a new one.
        launch_handler: { client_mode: "focus-existing" },
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg}"],
        // Don't rewrite navigations to real files (the book PDF/EPUB, the
        // standalone .html pages, stats.json) into the SPA shell — see the
        // unit-tested constant for the rule.
        navigateFallbackDenylist: NAVIGATION_FALLBACK_DENYLIST,
      },
      // No service worker in dev — it causes confusing reload loops.
      devOptions: { enabled: false },
    }),
  ],
});
