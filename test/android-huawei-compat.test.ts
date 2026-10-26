import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const java = source("android/app/src/main/java/com/ithread/android/RuntimeCapabilities.java");
const expression = java.slice(java.indexOf("static final String SCRIPT ="), java.lastIndexOf(";"));
const probe = (expression.match(/"(?:\\.|[^"\\])*"/g) ?? [])
  .map((part) => JSON.parse(part))
  .join("");

function runtime() {
  return {
    structuredClone,
    crypto: { randomUUID: () => "synthetic-id" },
    indexedDB: { open() {} },
    Worker: class {},
    ResizeObserver: class {},
    TextEncoder,
    TextDecoder,
    AbortController,
    DOMMatrixReadOnly: class {},
    document: { createElement: () => ({ noModule: false }) },
  };
}

describe("Huawei compatibility profile", () => {
  it("allows all required capabilities without depending on the package version", () => {
    expect(probe).toContain("structuredClone");
    expect(runInNewContext(probe, runtime())).toBe("PASS");
  });
  it.each([
    "structuredClone",
    "crypto",
    "indexedDB",
    "Worker",
    "ResizeObserver",
    "TextEncoder",
    "TextDecoder",
    "AbortController",
    "DOMMatrixReadOnly",
  ])("fails closed without %s", (missing) => {
    expect(runInNewContext(probe, { ...runtime(), [missing]: undefined })).toBe("FAIL");
  });
  it("checks cloning behavior and module support rather than just API names", () => {
    expect(runInNewContext(probe, { ...runtime(), structuredClone: () => ({ a: [0] }) })).toBe(
      "FAIL",
    );
    expect(runInNewContext(probe, { ...runtime(), document: { createElement: () => ({}) } })).toBe(
      "FAIL",
    );
  });
  it("does not widen the native bridge's trusted document or introduce a generic interface", () => {
    const main = source("android/app/src/main/java/com/ithread/android/MainActivity.java");
    expect(main).toContain("!SyncPolicy.appDocument(view.getUrl())");
    expect(main).not.toContain("addJavascriptInterface");
    expect(main).toContain('withProbe("\\"PASS\\"".equals(result) ? "PASS" : "FAIL")');
    expect(main).toContain("handler.postDelayed(compatibilityTimeout, 30000)");
  });
  it("keeps the normal APK identity and uses a different identity for the special build", () => {
    const gradle = source("android/app/build.gradle");
    expect(gradle).toContain("applicationIdSuffix '.preview'");
    expect(gradle).toContain("applicationIdSuffix '.huawei.compat'");
    expect(gradle).toContain("buildConfigField 'boolean', 'HUAWEI_COMPAT', 'false'");
    expect(source("android/app/src/main/java/com/ithread/android/SyncPolicy.java")).toContain(
      "MIN_WEBVIEW_MAJOR = 124",
    );
    expect(source("vite.config.ts")).toContain('target: "chrome98"');
  });
});
