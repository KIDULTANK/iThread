import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppTips } from "../src/components/start/AppTips";
import { MapCard, type MapEntry } from "../src/components/start/MapCard";
import { About } from "../src/components/start/sections/About";
import { AllMaps } from "../src/components/start/sections/AllMaps";
import { Recent } from "../src/components/start/sections/Recent";
import { Templates } from "../src/components/start/sections/Templates";
import type { StartContext } from "../src/components/start/types";
import { type Locale, registerMessages, setLocale } from "../src/i18n";

// Library-backed Start sections (All maps / Recent) + the leaf cards (MapCard / Templates) and the
// static About blurb. AllMaps/Recent read the library through useLibrary (IndexedDB); we mock that
// hook so the views are tested against fixed entries without driving the store.

let libEntries: MapEntry[] = [];
let libFolders: { id: string; name: string; createdAt: number }[] = [];
vi.mock("../src/components/start/useLibrary", () => ({
  useLibrary: () => libEntries,
  useFolders: () => libFolders,
}));
// The folder CRUD is unit-tested in mapStore.test; here we only need the AllMaps UI not to hit the
// store, so stub the mutators (create/move/rename/delete) the dialogs call on submit.
vi.mock("../src/store/mapStore", () => ({
  createFolder: vi.fn(async () => ({ id: "new", name: "New", createdAt: 0 })),
  deleteFolder: vi.fn(async () => {}),
  moveMapToFolder: vi.fn(async () => {}),
  renameFolder: vi.fn(async () => {}),
}));

const mkCtx = (over: Partial<StartContext> = {}): StartContext => ({
  onOpen: vi.fn(),
  onImportFiles: vi.fn(),
  go: vi.fn(),
  libraryRev: 0,
  onLibraryChange: vi.fn(),
  ...over,
});

const u = userEvent.setup();

afterEach(() => {
  libEntries = [];
  libFolders = [];
  // The active locale is module-level global state — without this the Danish case below leaks into
  // whatever test file runs next and fails it somewhere unrelated.
  setLocale("en");
});

describe("MapCard", () => {
  const entry: MapEntry = { id: "m1", title: "Roadmap", nodeCount: 1, updatedAt: undefined };

  it("renders title + singular meta and opens via the thumbnail", async () => {
    const onAction = vi.fn();
    render(<MapCard entry={entry} onAction={onAction} />);
    expect(screen.getByText("Roadmap")).toBeTruthy();
    expect(screen.getByText("1 node")).toBeTruthy(); // singular, no timestamp
    await u.click(screen.getByRole("button", { name: /open roadmap/i }));
    expect(onAction).toHaveBeenCalledWith("open", entry);
  });

  it("falls back to (untitled) and fires every kebab action", async () => {
    const onAction = vi.fn();
    const e: MapEntry = { id: "m2", title: "", nodeCount: 3, updatedAt: 1 };
    render(<MapCard entry={e} onAction={onAction} />);
    expect(screen.getByText("(untitled)")).toBeTruthy();
    expect(screen.getByText(/^3 nodes ·/)).toBeTruthy(); // plural + timeAgo appended
    for (const label of ["Rename", "Duplicate", "Export…", "Delete"]) {
      await u.click(screen.getByRole("button", { name: label }));
    }
    expect(onAction.mock.calls.map((c) => c[0])).toEqual([
      "rename",
      "duplicate",
      "export",
      "delete",
    ]);
  });

  it("draws real branch spokes in the thumbnail when the entry carries branch colours", () => {
    const e: MapEntry = {
      id: "m3",
      title: "Colourful",
      nodeCount: 4,
      branches: ["#e8593c", "#3b8bd4"],
    };
    const { container } = render(<MapCard entry={e} onAction={vi.fn()} />);
    // One coloured spoke per real branch (circle fill + connecting line stroke) rather than a hash glyph.
    expect(container.querySelector('circle[fill="#e8593c"]')).toBeTruthy();
    expect(container.querySelector('line[stroke="#3b8bd4"]')).toBeTruthy();
  });

  it("shows the pinned indicator and toggles pin via the kebab", async () => {
    const onAction = vi.fn();
    const e: MapEntry = { id: "m4", title: "Important", nodeCount: 1, pinned: true };
    render(<MapCard entry={e} onAction={onAction} />);
    expect(screen.getByTitle("Pinned")).toBeTruthy(); // ★ indicator on a pinned card
    await u.click(screen.getByRole("button", { name: "Unpin" })); // pinned → the kebab reads "Unpin"
    expect(onAction).toHaveBeenCalledWith("pin", e);
  });
});

describe("AppTips", () => {
  it("opens the command palette from the ⌘K card (show, not just tell)", async () => {
    const onOpen = vi.fn();
    render(<AppTips onOpenCommandPalette={onOpen} />);
    await u.click(screen.getByRole("button", { name: /open the command palette/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    // The other tips stay static, non-interactive cards.
    expect(screen.queryByRole("button", { name: /right-click a topic/i })).toBeNull();
  });
});

describe("About section", () => {
  it("renders the local-first blurb and every resource link with its href", () => {
    render(<About />);
    expect(screen.getByRole("heading", { name: /About iThread/i })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /Read & reference/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /User guide/i })).toBeNull();
    expect(screen.getByRole("link", { name: /Source/i }).getAttribute("href")).toBe(
      "https://github.com/KIDULTANK/iThread",
    );
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});

describe("Templates section", () => {
  it("renders a card per non-blank template and opens one through buildTemplate", async () => {
    const ctx = mkCtx();
    render(<Templates ctx={ctx} />);
    expect(screen.queryByText("Blank", { selector: ".st-card-title" })).toBeNull(); // blank excluded
    await u.click(screen.getByRole("button", { name: /SWOT/i }));
    expect(ctx.onOpen).toHaveBeenCalledTimes(1);
    const [doc] = (ctx.onOpen as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(doc.root).toBeTruthy(); // a built template doc
  });

  it("filters by search query and shows the empty state when nothing matches", async () => {
    render(<Templates ctx={mkCtx()} />);
    await u.type(screen.getByPlaceholderText(/search templates/i), "swot");
    expect(screen.getByRole("button", { name: /SWOT/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Brainstorm/i })).toBeNull();
    await u.clear(screen.getByPlaceholderText(/search templates/i));
    await u.type(screen.getByPlaceholderText(/search templates/i), "zzzznope");
    expect(screen.getByText(/No templates match/i)).toBeTruthy();
  });
});

describe("AllMaps section", () => {
  const lib: MapEntry[] = [
    { id: "a", title: "Banana", nodeCount: 2, updatedAt: 100 },
    { id: "b", title: "Apple", nodeCount: 9, updatedAt: 200 },
  ];

  it("shows the empty state when the library is empty, with a templates path (UI-7)", async () => {
    const ctx = mkCtx();
    render(<AllMaps ctx={ctx} />);
    expect(screen.getByText(/No maps yet/i)).toBeTruthy();
    // The returning-but-empty state offers a guided path to templates, not just a blank canvas.
    await u.click(screen.getByRole("button", { name: /Browse templates/i }));
    expect(ctx.go).toHaveBeenCalledWith("templates");
  });

  it("counts maps, sorts by the chosen key, and toggles grid ↔ list", async () => {
    libEntries = lib;
    render(<AllMaps ctx={mkCtx()} />);
    expect(screen.getByText(/2 maps in your library/i)).toBeTruthy();

    // Default sort = recently edited (updatedAt desc) → Apple (200) before Banana (100).
    const titlesInGrid = () => screen.getAllByText(/Apple|Banana/).map((n) => n.textContent);
    expect(titlesInGrid()[0]).toBe("Apple");

    // Sort by name A–Z → Apple before Banana (still, but via the name path).
    await u.selectOptions(screen.getByLabelText(/Sort maps/i), "name");
    expect(titlesInGrid()[0]).toBe("Apple");
    // Sort by most nodes → Apple (9) before Banana (2).
    await u.selectOptions(screen.getByLabelText(/Sort maps/i), "nodes");
    expect(titlesInGrid()[0]).toBe("Apple");

    // Toggle to list view: rows render the title as a link + a node-count·date span.
    await u.click(screen.getByRole("button", { name: /List/i }));
    expect(screen.getByRole("button", { name: "Apple" })).toBeTruthy();
    expect(screen.getByText(/9 nodes ·/)).toBeTruthy(); // node count + last-edited date in the list row
  });

  it("floats pinned maps to the top regardless of the chosen sort", () => {
    libEntries = [
      { id: "a", title: "Apple", nodeCount: 9, updatedAt: 200 },
      { id: "b", title: "Banana", nodeCount: 2, updatedAt: 100, pinned: true },
    ];
    render(<AllMaps ctx={mkCtx()} />);
    // Banana is older + fewer nodes but pinned → it leads ahead of the more-recent Apple.
    const titles = screen.getAllByText(/Apple|Banana/).map((n) => n.textContent ?? "");
    expect(titles[0]).toMatch(/Banana/);
  });

  it("filters the library by a title search and shows a no-match state", async () => {
    libEntries = lib; // Banana, Apple
    render(<AllMaps ctx={mkCtx()} />);
    const box = screen.getByLabelText(/search your maps/i);
    await u.type(box, "app");
    expect(screen.getByText("Apple")).toBeTruthy();
    expect(screen.queryByText("Banana")).toBeNull();
    await u.clear(box);
    await u.type(box, "zzznope");
    expect(screen.getByText(/No maps match/i)).toBeTruthy();
  });

  it("shows folder cards + a folder count, and only the unfiled maps at the top level (C2)", () => {
    libFolders = [{ id: "wk", name: "Work", createdAt: 1 }];
    libEntries = [
      { id: "a", title: "Filed", nodeCount: 1, folderId: "wk" },
      { id: "b", title: "Loose", nodeCount: 1 },
    ];
    render(<AllMaps ctx={mkCtx()} />);
    expect(screen.getByText(/1 folder/)).toBeTruthy();
    expect(screen.getByText("Work")).toBeTruthy(); // the folder card
    expect(screen.getByText("1 map")).toBeTruthy(); // Work holds 1 map
    // At the top level, only the unfiled map shows.
    expect(screen.getByText("Loose")).toBeTruthy();
    expect(screen.queryByText("Filed")).toBeNull();
  });

  it("drills into a folder and back via the breadcrumb (C2)", async () => {
    libFolders = [{ id: "wk", name: "Work", createdAt: 1 }];
    libEntries = [{ id: "a", title: "Filed", nodeCount: 1, folderId: "wk" }];
    render(<AllMaps ctx={mkCtx()} />);
    await u.click(screen.getByTitle("Open folder Work"));
    expect(screen.getByText(/map in this folder/)).toBeTruthy();
    expect(screen.getByText("Filed")).toBeTruthy(); // the folder's map now shows
    expect(screen.getByRole("button", { name: "Delete folder" })).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "All maps" })); // breadcrumb back
    expect(screen.getByText(/in your library/)).toBeTruthy();
  });

  it("opens the New-folder prompt and the Move-to-folder picker (C2)", async () => {
    libFolders = [{ id: "wk", name: "Work", createdAt: 1 }];
    libEntries = [{ id: "b", title: "Loose", nodeCount: 1 }];
    render(<AllMaps ctx={mkCtx()} />);
    await u.click(screen.getByRole("button", { name: /New folder/ }));
    expect(screen.getByLabelText("Folder name")).toBeTruthy();
    await u.keyboard("{Escape}");
    // Move-to-folder from a map card's kebab (the item lives in the always-rendered <details> menu).
    await u.click(screen.getByRole("button", { name: /Move to folder/ }));
    expect(screen.getByText(/Move .* to…/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Top level/ })).toBeTruthy();
  });
});

describe("Recent section", () => {
  it("shows the empty state with no maps", () => {
    render(<Recent ctx={mkCtx()} />);
    expect(screen.getByText(/No maps yet/i)).toBeTruthy();
  });

  it("groups maps by last-edited into finer buckets (Today / Earlier this week / Not yet saved)", () => {
    const now = Date.now();
    const DAY = 86_400_000;
    libEntries = [
      { id: "t", title: "Fresh", nodeCount: 1, updatedAt: now },
      { id: "w", title: "MidWeek", nodeCount: 1, updatedAt: now - 4 * DAY },
      { id: "n", title: "Unsaved", nodeCount: 1, updatedAt: undefined },
    ];
    render(<Recent ctx={mkCtx()} />);
    expect(screen.getByRole("heading", { name: "Today" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Earlier this week" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Not yet saved" })).toBeTruthy();
    expect(screen.getByText("Fresh")).toBeTruthy();
    expect(screen.getByText("MidWeek")).toBeTruthy();
  });

  it("keeps every bucket and every map when the locale is not English", () => {
    // THE REGRESSION GUARD. Buckets used to be keyed by their rendered LABEL: `GROUPS` held
    // `t("start.earlierThisWeek")` while `groupOf()` returned the English literal. Those agree only
    // while the catalogue is English — under a second locale `byGroup.has()` stops matching and the
    // section, WITH EVERY MAP IN IT, disappears from the page. Not a translation glitch: data the user
    // can see going missing. The test above cannot catch it, because it only ever runs under `en`.
    //
    // `t()` returns `string`, so the old `type Group = (typeof GROUPS)[number]` collapsed to `string`
    // and tsc could not catch the drift either. Buckets are keyed on ids now, labels resolved at
    // render.
    registerMessages("da" as Locale, {
      "start.today": "I dag",
      "start.earlierThisWeek": "Tidligere i denne uge",
      "start.notYetSaved": "Ikke gemt endnu",
    });
    setLocale("da" as Locale);

    const now = Date.now();
    const DAY = 86_400_000;
    libEntries = [
      { id: "t", title: "Fresh", nodeCount: 1, updatedAt: now },
      { id: "w", title: "MidWeek", nodeCount: 1, updatedAt: now - 4 * DAY },
      { id: "n", title: "Unsaved", nodeCount: 1, updatedAt: undefined },
    ];
    render(<Recent ctx={mkCtx()} />);

    // Headings follow the locale...
    expect(screen.getByRole("heading", { name: "I dag" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Tidligere i denne uge" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Ikke gemt endnu" })).toBeTruthy();
    // ...and — the part that actually mattered — the maps are still on the page.
    expect(screen.getByText("Fresh")).toBeTruthy();
    expect(screen.getByText("MidWeek")).toBeTruthy();
    expect(screen.getByText("Unsaved")).toBeTruthy();
  });
});
