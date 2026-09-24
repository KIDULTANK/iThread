import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// public/dashboard.html is a standalone, build-step-free page: static markup plus one inline <script>
// that (a) renders project metrics from the committed public/stats.json + public/stats-history.json and
// (b) pulls live repo activity from the GitHub API. It has no other test coverage, so these guard that
// it actually LOADS:
//   1. structure  — every element the script drives by id exists in the markup, Chart.js is pinned, and
//                   both data sources are wired to window load;
//   2. contract   — the committed stats.json / stats-history.json carry every field the dashboard reads
//                   (so a build-stats.mjs key rename fails CI instead of silently showing "—");
//   3. behaviour  — the REAL inline script, executed against the real DOM with stubbed Chart + fetch,
//                   fills the page from real data, renders the live GitHub pulse, and degrades cleanly
//                   when the network is down.

// vitest runs from the repo root (as does scripts/build-stats.mjs), so resolve artifacts off cwd.
const ROOT = process.cwd();
const readText = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
// biome-ignore lint/suspicious/noExplicitAny: test fixtures read untyped JSON artifacts.
const readJson = (rel: string): any => JSON.parse(readText(rel));

const DASHBOARD = readText("public/dashboard.html");

// ---------------------------------------------------------------------------------------------------
// 1. structure
// ---------------------------------------------------------------------------------------------------
describe("dashboard.html structure", () => {
  it("has a markup element for every id the script drives", () => {
    const referenced = [...DASHBOARD.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)].map(
      (m) => m[1],
    );
    expect(referenced.length).toBeGreaterThan(30);
    const missing = [...new Set(referenced)].filter(
      (id) =>
        !new RegExp(`id=["']${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`).test(DASHBOARD),
    );
    expect(missing).toEqual([]);
  });

  it("pins Chart.js with subresource integrity", () => {
    expect(DASHBOARD).toMatch(
      /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/chart\.js@[\d.]+\/dist\/chart\.umd\.js"/,
    );
    expect(DASHBOARD).toMatch(/integrity="sha384-[^"]+"/);
    expect(DASHBOARD).toContain('crossorigin="anonymous"');
  });

  it("boots both data sources on window load", () => {
    expect(DASHBOARD).toMatch(/addEventListener\(\s*['"]load['"]/);
    expect(DASHBOARD).toContain("loadLive()");
    expect(DASHBOARD).toContain("loadStats()");
  });

  it("reads the CI metrics by filename", () => {
    expect(DASHBOARD).toContain("stats.json");
    expect(DASHBOARD).toContain("stats-history.json");
  });
});

// ---------------------------------------------------------------------------------------------------
// 2. contract — the committed JSON has the shape the dashboard consumes
// ---------------------------------------------------------------------------------------------------
describe("stats.json contract (what the dashboard reads)", () => {
  const stats = readJson("public/stats.json");

  it("carries the headline numbers", () => {
    for (const k of ["linesTsJs", "tests", "lineCoveragePct", "trackedFiles"]) {
      expect(typeof stats.headline[k], k).toBe("number");
    }
  });

  it("carries a coverage block with pct/covered/total per metric", () => {
    for (const m of ["lines", "statements", "functions", "branches"]) {
      const blk = stats.coverage[m];
      expect(blk, m).toBeTruthy();
      for (const k of ["pct", "covered", "total"])
        expect(typeof blk[k], `${m}.${k}`).toBe("number");
    }
  });

  it("carries the code breakdown rows", () => {
    expect(Array.isArray(stats.code)).toBe(true);
    expect(stats.code.length).toBeGreaterThan(0);
    for (const c of stats.code) {
      expect(typeof c.category).toBe("string");
      expect(typeof c.lines).toBe("number");
    }
  });

  it("carries the feature (documentation) coverage", () => {
    const fc = stats.featureCoverage;
    for (const k of [
      "total",
      "manual",
      "manualPct",
      "book",
      "bookPct",
      "bookExample",
      "bookExamplePct",
    ]) {
      expect(typeof fc[k], k).toBe("number");
    }
    expect(fc.byArea).toBeTypeOf("object");
    expect(fc.gaps).toBeTypeOf("object");
  });

  it("carries the quality, hygiene, footprint, bundle, docs, git, domain and tests blocks", () => {
    expect(Array.isArray(stats.quality.leastCovered)).toBe(true);
    expect(Array.isArray(stats.quality.churnHotspots)).toBe(true);
    expect(Array.isArray(stats.quality.risky)).toBe(true);
    expect(stats.hygiene).toBeTypeOf("object");
    expect(typeof stats.footprint.depsProd).toBe("number");
    expect(typeof stats.footprint.depsDev).toBe("number");
    expect(Array.isArray(stats.footprint.biggestFiles)).toBe(true);
    expect(typeof stats.bundle.totalGzipKb).toBe("number");
    expect(typeof stats.bundle.budgetKb).toBe("number");
    expect(stats.docs).toBeTypeOf("object");
    expect(stats.git).toBeTypeOf("object");
    expect(stats.domain).toBeTypeOf("object");
    expect(stats.tests).toBeTypeOf("object");
  });

  it("stats-history.json is an array of the trend points the trends panel reads", () => {
    const hist = readJson("public/stats-history.json");
    expect(Array.isArray(hist)).toBe(true);
    if (hist.length) {
      const p = hist[hist.length - 1];
      expect(typeof p.date).toBe("string");
      for (const k of [
        "linesTsJs",
        "coveragePct",
        "tests",
        "bundleKb",
        "featureManualPct",
        "featureBookPct",
      ]) {
        expect(k in p, k).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------
// 3. behaviour — run the real inline script against the real DOM
// ---------------------------------------------------------------------------------------------------

// The inline body <script>, with its window-load bootstrap stripped so the test can drive the entry
// points directly (the bootstrap wiring itself is asserted by the structure suite above). The markup
// is everything in <body> except that script.
const bodyMarkup = (DASHBOARD.match(/<body>([\s\S]*)<\/body>/)?.[1] ?? "").replace(
  /<script>[\s\S]*?<\/script>/,
  "",
);
const inlineScript = (DASHBOARD.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "").replace(
  /window\.addEventListener\(\s*['"]load['"][\s\S]*$/,
  "",
);

type Dash = {
  loadLive: () => Promise<void>;
  loadStats: () => Promise<void>;
  renderTrends: () => Promise<void>;
};

const chartsCreated: string[] = [];
class StubChart {
  constructor(el: { id?: string } | null) {
    chartsCreated.push(el?.id || "");
  }
  destroy() {}
}

const realFetch = globalThis.fetch;
const el = (id: string): HTMLElement => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node;
};
const text = (id: string) => (el(id).textContent ?? "").trim();

function mountDashboard(): Dash {
  document.body.innerHTML = bodyMarkup;
  chartsCreated.length = 0;
  (window as unknown as Record<string, unknown>).Chart = StubChart;
  (globalThis as unknown as Record<string, unknown>).Chart = StubChart;
  // The script's helpers close over its private state; expose the three entry points the tests drive.
  const factory = new Function(`${inlineScript}\n;return { loadLive, loadStats, renderTrends };`);
  return factory() as Dash;
}

// biome-ignore lint/suspicious/noExplicitAny: the dashboard reads loosely-shaped JSON / API bodies.
const ok = (body: any) =>
  Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const fail = () => Promise.resolve({ ok: false, status: 503, json: () => Promise.resolve({}) });

function useFetch(handler: (url: string) => ReturnType<typeof ok>) {
  globalThis.fetch = ((input: unknown) => handler(String(input))) as unknown as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  document.body.innerHTML = "";
});

describe("dashboard loads (inline script against jsdom)", () => {
  it("fills the project-metrics section from the committed stats.json", async () => {
    const stats = readJson("public/stats.json");
    const history = readJson("public/stats-history.json");
    useFetch((url) => {
      if (url.endsWith("stats-history.json")) return ok(history);
      if (url.endsWith("stats.json")) return ok(stats);
      return fail(); // GitHub (and anything else) is unreachable in this test
    });
    const dash = mountDashboard();
    await dash.loadStats();
    await dash.renderTrends();

    const nfmt = (n: number) => Number(n).toLocaleString();
    expect(el("stats-pending").style.display).toBe("none");
    expect(el("stats-body").style.display).toBe("block");
    expect(text("m-lines")).toBe(nfmt(stats.headline.linesTsJs));
    expect(text("m-tests")).toBe(nfmt(stats.headline.tests));
    expect(text("m-cov")).toBe(`${stats.headline.lineCoveragePct}%`);
    expect(text("m-files")).toBe(nfmt(stats.headline.trackedFiles));

    // code breakdown + coverage bars + documentation coverage all rendered
    expect(document.querySelectorAll("#code-rows tr")).toHaveLength(stats.code.length);
    expect(document.querySelectorAll("#cov-bars .cov-row").length).toBeGreaterThanOrEqual(1);
    const manualPct = stats.headline.featureManualPct ?? stats.featureCoverage.manualPct;
    expect(text("dc-manual")).toBe(`${manualPct}%`);
    expect(chartsCreated).toContain("codeChart");

    if (history.length >= 2) {
      expect(el("trends-section").style.display).toBe("block");
    }
  });

  it("fills the live GitHub pulse from API responses", async () => {
    const stats = readJson("public/stats.json");
    const history = readJson("public/stats-history.json");
    const day = 86_400_000;
    const isoAgo = (d: number) => new Date(Date.now() - d * day).toISOString();
    const repo = {
      name: "iThread",
      full_name: "KIDULTANK/iThread",
      default_branch: "main",
      language: "TypeScript",
      created_at: isoAgo(5),
      pushed_at: isoAgo(1),
      open_issues_count: 2,
      stargazers_count: 7,
    };
    const commits = [
      {
        sha: "abc1234def",
        html_url: "https://github.com/x/commit/abc1234def",
        commit: {
          message: "feat: add dashboard tests\n\nbody",
          author: { name: "Dann", date: isoAgo(1) },
        },
        author: { login: "dannbleeker" },
      },
      {
        sha: "beef567cafe",
        html_url: "https://github.com/x/commit/beef567cafe",
        commit: { message: "fix: a bug", author: { name: "Dann", date: isoAgo(2) } },
        author: { login: "dannbleeker" },
      },
    ];
    const pulls = [
      {
        number: 42,
        title: "Add dashboard tests",
        merged_at: isoAgo(1),
        state: "closed",
        user: { login: "dannbleeker" },
        html_url: "https://github.com/x/pull/42",
      },
      {
        number: 7,
        title: "Bot bump",
        merged_at: isoAgo(3),
        state: "closed",
        user: { login: "dependabot[bot]" },
        html_url: "https://github.com/x/pull/7",
      },
    ];
    useFetch((url) => {
      if (url.includes("api.github.com")) {
        if (url.includes("/pulls")) return ok(pulls);
        if (url.includes("/commits")) return ok(commits);
        return ok(repo);
      }
      if (url.endsWith("stats-history.json")) return ok(history);
      if (url.endsWith("stats.json")) return ok(stats);
      return fail();
    });
    const dash = mountDashboard();
    await dash.loadLive();

    expect(text("s-age")).toBe("5");
    expect(text("s-7d")).toBe("2");
    expect(text("s-30d")).toBe("2");
    expect(text("s-prs")).toBe("2");
    expect(text("s-issues")).toBe("2");
    expect(el("gh-commit").innerHTML).toContain("abc1234");
    expect(document.querySelectorAll("#commit-list li")).toHaveLength(2);
    expect(document.querySelectorAll("#pr-list li")).toHaveLength(2);
    expect(text("fetched")).toMatch(/^fetched /);
    for (const id of [
      "activityChart",
      "typeChart",
      "authorChart",
      "dowChart",
      "hourChart",
      "prChart",
      "prSplitChart",
    ]) {
      expect(chartsCreated, id).toContain(id);
    }
  });

  it("shows the pending banner and a live-unavailable note when offline", async () => {
    useFetch(() => fail());
    const dash = mountDashboard();
    await dash.loadStats();
    await dash.loadLive();

    expect(el("stats-pending").style.display).toBe("block");
    expect(el("stats-body").style.display).toBe("none");
    expect(text("fetched")).toBe("live fetch unavailable");
    expect(text("s-age")).toBe("—");
  });
});
