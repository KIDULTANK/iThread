import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { initLocale, loadLocaleMessages } from "./i18n";
import "./mobile.css";

// The locale is resolved and <html lang>/<html dir> stamped by the `src/i18n` barrel, at import time.
// It CANNOT be done here: this statement runs after the imports above, and `./App` drags in the whole
// eager graph — including 99 module-scope `t()` calls that would already have frozen against the
// default locale. See the comment in src/i18n/index.ts.
//
// This call is kept as a belt-and-braces no-op for any entry point that reaches main.tsx without
// having imported the barrel. It re-resolves to the same value; `initLocale` is idempotent.
initLocale();

// StrictMode intentionally omitted: its double-invoked effects re-init the canvas
// engine instance, which muddies headless screenshots used for verification.
async function start(): Promise<void> {
  await loadLocaleMessages();
  // biome-ignore lint/style/noNonNullAssertion: #root is guaranteed by index.html
  createRoot(document.getElementById("root")!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>,
  );
}

void start();
