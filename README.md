# iThread

**Current preview: v0.2.0** · Windows 11 focused · Local-first · Apache-2.0

> iThread 是独立社区项目，与 iThoughts 及其原作者不存在隶属、授权或背书关系。

[在线体验](https://kidultank.github.io/iThread/) ·
[下载 Windows 预览版](https://github.com/KIDULTANK/iThread/releases) ·
[中文快速上手](docs/QUICKSTART.zh-CN.md) ·
[已知限制](docs/KNOWN_LIMITATIONS.zh-CN.md) ·
[问题反馈](https://github.com/KIDULTANK/iThread/issues/new/choose)

iThread 是一款面向 Windows 的本地优先思维导图应用，重点兼容 iThoughts `.itmz` 文件，
提供流畅的大型导图浏览、键盘操作、中英文界面和可供智能体调用的本地 CLI。应用无需账号，
导图默认保存在浏览器 IndexedDB 或用户选择的本地文件中。

A local-first, offline mind-mapping PWA — a self-hosted replacement for Corel/Mindjet
MindManager. Built on [React Flow](https://reactflow.dev) (`@xyflow/react`, MIT) with a
format-agnostic canonical model as the single source of truth. No telemetry, no accounts —
your maps live in your browser (IndexedDB) and on disk.

This repository is derived from
[Dann Bleeker Pedersen's MindMap Studio](https://github.com/dannbleeker/mindmap-studio)
under the Apache License 2.0. The upstream copyright, licence and notices are preserved.

![iThread Windows 界面](docs/images/ithread-windows.png)

## Windows 11 desktop app

Download the portable `iThread-0.2.0-Windows-x64.exe` from the
[releases page](https://github.com/KIDULTANK/iThread/releases). It runs as a standalone
Windows application and does not require an installer. Windows may show a SmartScreen notice because
the community build is not code-signed; verify the SHA-256 value published with the release before
running it.

> [!IMPORTANT]
> iThread can import iThoughts `.itmz` files and export a new iThoughts-compatible `.itmz`. It never
> overwrites the source file. Keep day-to-day work in the lossless native `.ithread` format, retain
> the original `.itmz`, and use **Export → `.itmz`** when a copy must reopen in iThoughts. Legacy
> `.mmst` files remain fully readable.

To build the desktop executable from source:

```powershell
pnpm install --frozen-lockfile
pnpm desktop:dist
```

## Code signing policy

iThread has applied for the SignPath Foundation open-source code-signing programme. Free code
signing provided by [SignPath.io](https://signpath.io/), certificate by
[SignPath Foundation](https://signpath.org/). Until the application is approved and the signing
pipeline is active, a release may remain unsigned; always compare its SHA-256 checksum with the
value published in the GitHub release.

The complete policy, maintainer roles, build provenance and approval process are documented in
[CODE_SIGNING_POLICY.md](CODE_SIGNING_POLICY.md). iThread's data-handling commitments are documented
in [PRIVACY.md](PRIVACY.md).

## Run locally

Requires Node.js 22+ and pnpm 11:

```powershell
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1 --port 4174
```

Open <http://127.0.0.1:4174/>. For a production build:

```powershell
pnpm gate
pnpm preview
```

The local agent/automation interface is documented in [docs/CLI.md](docs/CLI.md).

## Features

- **Start screen** — a dedicated home (shown when no map is open, and reachable any time via
  **⌂ Start**): capture a new map (type a topic, paste an outline, or a blank canvas), reopen
  **Recent** maps grouped by last-edited, browse **Templates** (with computed node counts) and
  **Layouts**, import files, or hit **⌘K** for a command palette. Theme-aware and fully local.
- **Open** `.mmap` (MindManager exports) and `.md` (Markdown outlines) — rendered as a
  MindManager-style map. The `.mmap` importer is field-mapped from the bundled MindManager
  XSD (topic tree, notes, icons, hyperlinks, relationships, boundaries, floating topics).
  Select multiple files to batch-import a whole folder of maps into the library at once.
  Also opens native `.json` maps (exported from this app) losslessly, and interchanges with
  other tools: `.opml` outlines, **FreeMind/Freeplane `.mm`**, **Mermaid** `mindmap`,
  **XMind `.xmind`** (modern + legacy), **SimpleMind `.smmx`**, **iThoughts `.itmz`**,
  **MindMeister `.mind`**, **MindMup `.mup`**, **Markmap** (`.md`), and **Word `.docx` / Excel
  `.xlsx`** outlines.
- **Paste text → map** — turn a pasted outline / bullet list / Markdown into topics (indentation or
  `#` levels set the hierarchy); drop in as a new map or graft under the selected node.
- **Edit** on the canvas — keyboard-first (Enter = sibling, Tab = child, Ctrl/⌘+Enter or F2 to
  edit in place), drag-to-reparent,
  undo/redo (Ctrl+Z / Ctrl+Shift+Z), inline **rich-text** topics (Ctrl+B/I/U), images on
  nodes, and a unified **ℹ Info** panel (note, markers, tags, style, links) for the selected node.
- **Find & Replace** — search the map by topic or note (matches focused on the canvas,
  cycling on repeated Enter), and replace the search text across all matching topics. Find is
  **typo-tolerant** — it falls back to a fuzzy match when nothing matches exactly (`Launhc` → Launch).
  It searches **every node field** (tags, markers, links, callouts, attachments), supports
  **operators** (`tag:`, `marker:`, `priority:`, `due:`, `has:`, `level:`, `-exclude`, `"phrase"`),
  lists **all matches** as a clickable list, and recalls your recent queries.
- **Library-wide search** — the **🔎 All maps** button searches every map in the library by
  topic or note (floating topics included) and jumps to the chosen map and node.
- **Outline** — a side panel showing the map as an indented outline; click a row to jump to
  that node (noted nodes are marked 📝).
- **Marker & tag index** — a side panel listing every marker and tag in the map, grouped with
  the topics carrying each one; click a topic to jump to it.
- **Auto-numbering** — a toggle that prefixes every topic with its outline number (1, 1.2, …)
  on the canvas, in the outline, and in exports; purely a view (your topic text is untouched).
- **Power Filter** — a read-only filter that dims every topic except those matching your criteria
  (text, markers, tags) and the paths to them; nothing is hidden or deleted. Name and **save** a
  filter to reuse it as a preset across maps.
- **Focus a branch** — spotlight one branch (and its path to the root); everything else dims (Esc exits).
- **Per-map canvas background** — set a background colour for a map; it persists and exports with it.
- **Minimap + zoom** — a corner overview with a draggable viewport for panning large maps,
  plus integrated zoom controls (−/+, live %, fit).
- **Topic info panel** — one **ℹ Info** side panel consolidating the selected node's note,
  markers (click-to-toggle, with active highlighted), **tags** (add/remove), style
  (shape/fill/border/bold), and links, organised into **Details / Style / Notes** tabs.
- **Task progress** — press **P** to increase a topic's completion (0→25→…→100) and **Shift+P**
  to decrease it; the state stays visually compact so the topic itself remains the focus.
  Parents **roll up automatically** (average + done/total count), with the percentage echoed in the
  Outline and in image exports.
- **Due & start dates** — give a topic dates in the **ℹ Info** panel; a **📅 chip** shows on the node
  and turns **red when overdue**. Date fields take **natural language** ("tomorrow", "next monday",
  "+3d"). Filter by due date (has-a-date / overdue / due ≤ 7 days) in the Power Filter, and
  **Move project** shifts every start/due date on a branch (or the whole map) ±N days in one undo step.
- **Task priority** — set High / Med / Low on a topic (coloured chip on the node); filter by priority
  in the Power Filter.
- **Fast capture** — a header **Quick add** box (type + Enter to add under the selection, keeps
  focus), **drop a link** from your browser onto the canvas to make a floating topic, and a
  **⏱ brainstorm timer** for timeboxed sprints.
- **File attachments** — attach any file to a topic (**📎 chip** on the node); stored inline so it
  travels with the map, with one-click download.
- **Board view (Kanban)** — **▦ Board** shows topics grouped into columns; a **Group by**
  selector lays them out by **tag**, by a **marker group** (Priority / Status / Mood / Vote — one
  column per member), or by a **schedule** of date buckets (Overdue / Today / This week / Later /
  Unscheduled). Cards carry progress + due; clicking one jumps to it on the map, and **dragging a
  card to another column re-tags / re-marks / re-schedules** the topic.
- **Summary topics** — **⊐ Summary** draws a labelled bracket beside a branch (side-aware;
  double-click to rename), the classic MindManager summary.
- **Node shapes** — beyond box / rounded / pill, give a topic a **diamond** (decision), **oval**
  (start/end), **parallelogram** (I/O), **hexagon**, or **cylinder** (data store) from the style
  bar — the flowchart vocabulary. Drawn from one path builder shared by the canvas, exports, and the
  picker, so the screen and the export always match.
- **Conditional formatting** — a **🎨 Styles** panel of rules that auto-style topics by tag, marker,
  or completion (view-only; manual styling wins).
- **Styles organizer** — save a topic's look as a **named style** and reuse it on others (in the same
  **🎨 Styles** panel); persists across maps.
- **Layouts** — beyond the two-sided map: all-left / all-right, org-chart (down/up), radial,
  timeline, fishbone, a **grid / matrix** (tiles the first-level branches into a grid — a
  2×2 for SWOT / Eisenhower frames), and a **brace map** (left-to-right tree with `{` fork
  connectors), switchable from the toolbar and remembered per session. **Per-branch layout**:
  right-click a branch → *Branch layout* to give just that subtree a different layout (e.g. an
  org-chart branch inside a radial map).
- **Free-canvas (whiteboard) mode** — **🧲 Free layout** turns any map into a free canvas: drag
  topics anywhere and they stay (the auto-layout pauses). With shapes + directional arrows it makes
  place-anywhere flowcharts, concept maps, and whiteboards; positions persist on the node and flip
  back to auto-layout cleanly.
- **Diagram backdrops** — **◎ Diagram** draws a geometric frame behind your topics — **onion**
  (concentric rings), **funnel** (stacked stages), or **Venn** (2 or 3 overlapping circles) — and
  switches to free layout so you drop topics into its regions; **−/+** changes the ring/stage count.
  The frame renders into image exports too.
- **Free background shapes** — **Insert → Shapes** drops ad-hoc canvas objects behind your topics —
  **rectangle, ellipse, block arrow, chevron** (SWOT quadrants, flow arrows, framing). Click to select,
  drag the body to move, drag a corner grip to resize; a small inline toolbar recolours it, changes its
  kind, or deletes it. Shapes render behind the topics on the canvas and in every image / PDF / HTML
  export (canvas == export).
- **Smart containers** — two of the shapes are **containers**: a **Swimlane** (lanes) and a **Matrix**
  (grid) that behave like MindManager Smart Shapes — **dragging the container moves every topic sitting
  inside it** (membership is by position, so there's nothing to wire up: drop topics onto a lane and
  drag it).
- **Multi-map library** — keep many named maps; switch, create, and delete from the header. Group
  maps into **folders** (the ⌘K switcher groups by folder), **pin** favourites to the top, filter by
  title, and recover deleted maps from a **Trash** (soft-delete with undo). Open maps appear as
  **tabs** under the toolbar (the open set is remembered across reloads). Promote a branch to its
  own map, or insert a library map as a branch — maps **cross-link**: topic links can target another
  map's topic, and a backlinks section shows what links here from other maps.
- **Version history** — per-map snapshots (auto while editing + on demand) with one-click restore;
  capped at 30, stored in IndexedDB, deleted with the map.
- **Autosave + reload** — every change persists to IndexedDB; your last map is restored on
  startup. Works fully offline.
- **Work with files (`.ithread`)** — open and save maps as real files on disk, like a desktop app:
  **Open file…** (Ctrl+O), **Save** (Ctrl+S, writes back to the same file with no dialog), and
  **Save as…** (Ctrl+Shift+S). Once a map is linked to a file, edits **autosave through to it** and
  the title bar shows a ● until the file is up to date. An `.ithread` is the same lossless schema as
  `.json`. On Chromium desktop (Chrome/Edge), an **installed** copy can be set as the default app for
  `.ithread`, so double-clicking one in Windows Explorer opens it here. Existing `.mmst` files remain
  losslessly readable. Browsers without the File System
  Access API (Firefox/Safari) fall back to a download/upload, and IndexedDB autosave still applies.
  An installed copy also registers for MindManager **`.mmap`** files: double-clicking (or **Open
  file…**) one **imports** it into the library (the import is one-way + lossy, and an opened `.mmap`
  isn't bound for autosave — use *Save as iThread file…* to keep working in a linked file). You can still
  **Export → `.mmap`** to write a map back out for MindManager.
- **Relationships** — draw a labelled, **directional** arrow (arrowhead at the target) between two
  nodes: right-click a node → **Link to…**, then click the target (with an optional label). Give it a
  **semantic type** (relates-to / depends-on / causes / supports / blocks) and filter by it;
  double-click to relabel, right-click for the full menu (label, arrowheads/direction, line style,
  type, delete). A map-wide **Relationships panel** lists every arrow and link, click-to-jump.
  Imported `.mmap` relationships render too.
- **Links** — from the **ℹ Info** panel, give a node a clickable 🔗 to another **topic** in the
  same map, to another **map**, or to a **web page**; click the 🔗 to follow it.
- **Boundaries** — a toolbar **⬚ Group** draws a shaded, rounded box around the selected
  branch and its subtree (double-click the box's chip to label it); imported MindManager
  boundaries render the same way, and boundaries you draw round-trip back into the model.
- **Callouts** — anchored sticky-note annotations on any node (right-click → Add callout),
  inline-editable; they render into image exports too.
- **Floating topics** — imported detached topics render in a labelled "Floating topics"
  branch, and are editable: rename, add, remove, nest, or drag them in/out of the tree, and
  the changes round-trip back into the model.
- **Export** — native `.json` (lossless — the format for backup/transfer), Markdown
  (`.md`), OPML (`.opml`), **FreeMind/Freeplane `.mm`**, **Mermaid** (`.mmd`), **XMind `.xmind`**,
  **SimpleMind `.smmx`**, **iThoughts-compatible `.itmz`**, **MindManager `.mmap`** (round-trips topics/notes/links/icons, tags,
  task metadata, and embedded images — the inverse of the importer), PNG (with **2×/4× scale** and
  **transparent background** options), SVG, a self-contained HTML file, a standalone HTML
  **slide deck** and a **PowerPoint** (`.pptx`) deck (both render **each branch as its actual map
  image**, not a bullet outline, and carry per-slide **speaker notes**), a Word **`.docx`**
  outline document, an Excel **`.xlsx`** outline sheet, direct **PDF** (fit / A4 / Letter, portrait
  or landscape) as well as print-to-PDF. **Export a single branch** in any of these formats from
  the node's context menu.
- **Copy outline / copy image** — copy the map as a Markdown outline, or as a **PNG image**,
  straight to the clipboard (no file) for pasting into an email, chat, or doc.
- **Present** — a Walk-Through mode that steps through the map as fullscreen slides, plus a
  **cinematic guided walk** that frames each branch with animated zoom on the real canvas. A
  presenter **pacing timer** (with a time budget and colour cues) and a **B/W blackout** key
  round out the workshop kit.
- **Theme gallery** — pick a canvas style (Light, Dark, Ocean, Sunset) or **design your own** in
  the custom theme designer (save, import, and export themes); persists and carries into image
  exports. Per-topic font/colour/background via the node editor panel. The app chrome itself has
  **System / Light / Dark** modes plus **high-contrast** and **reduced-motion** support (following
  the OS or an in-app toggle).
- **Quick-capture Inbox** — a map-independent **Unfiled** bucket: jot ideas down without leaving
  the map you're in, and file them onto a map later.
- **Editing accelerators** — a **slash menu** in the topic editor (insert child / task / date /
  boundary / note / marker from the keyboard), an inline **`#tag`** picker, **`[[` / `@`**
  name-based link autocomplete, **smart Ctrl+V** (image / outline / URL / internal branch routed
  automatically), **sort children** (by name / priority / due / progress), and drag modifiers
  (**Shift-drag** detaches a topic to floating, **Ctrl-drag** copies the subtree).
- **Deep links & history** — every topic has a copyable **deep link** (`?node=` URL), in-note
  links can jump to any topic or map, and **Alt+← / Alt+→** walk your navigation history.
- **Scales to big maps** — viewport virtualisation keeps the canvas responsive above ~500 nodes;
  GPU-composited camera movement and parent-origin branch transitions keep navigation fluid.
- **Installable PWA** — install to the home screen / desktop; precached app shell for offline use.

## Architecture

A format-agnostic **canonical model** (`src/model/types.ts`) is the single source of truth.
Everything targets it through thin adapters, so the rendering engine and file formats stay
replaceable:

- `src/mindmap/flow/` — the React Flow canvas: model→nodes/edges projection (`project.ts`),
  layouts (`layout.ts`), pure edit ops (`ops.ts`), and the native-text SVG exporter (`exportSvg.ts`).
- `src/import/mmap.ts` — one-way `.mmap` importer (ZIP of `Document.xml`; XSD-sourced mapping);
  `src/io/mmap.ts` is the paired `.mmap` writer (the export inverse).
- `src/mindmap/flow/canvasShapes.ts` — the free background-shape + smart-container geometry, shared
  by the canvas (`ShapeLayer.tsx`) and the exporters so screen and export always match.
- `src/io/` — the interchange adapters (Markdown, native-JSON, OPML, FreeMind, Mermaid, XMind,
  SimpleMind, docx/xlsx, …) plus self-contained-HTML/print I/O.
- `src/io/fileSystem.ts` — native `.ithread` open/save/autosave plus legacy `.mmst` compatibility
  (download/upload fallback + Windows file association through the PWA manifest `file_handlers`).
- `src/useMapExports.ts` — the header's export handlers (json/md/png/svg/html/pdf).
- `src/store/mapStore.ts` — IndexedDB-backed multi-map library (autosave + last-opened + file handles).
- `src/present/` — the Walk-Through presentation overlay.

## Commands

```sh
pnpm install
pnpm dev         # dev server (preview: "mindmap-dev", port 5175)
pnpm gate        # full local gate — run before every push
pnpm test        # unit + integration tests (vitest)
pnpm build       # production build
```

## Local agent CLI

With the development preview open, local scripts and agents can inspect and edit maps through the
`pnpm ithread` command. It supports listing and reading maps, creating a map, and adding, renaming,
moving, or explicitly deleting topics. Changes to the open map appear on the canvas immediately.
The bridge listens only on the local preview and does not require an internet connection.

See [`docs/CLI.md`](docs/CLI.md) for commands, examples, and safety rules.

`pnpm gate` is the "green before done" check: typecheck → lint/format (Biome) → dead-code
(knip) → tests → build → bundle-size budget (entry chunk), fail-fast. CI
(`.github/workflows/ci.yml`) runs the same command. See `USER_GUIDE.md` for how to use the
app, `CLAUDE.md` for how we build, `CHANGELOG.md` for what's shipped, and `NEXT_STEPS.md` for
open work.

## The `.mmap` importer

`.mmap` is a ZIP of `Document.xml` (Mindjet's proprietary, partly-binary schema). The import is
**one-way and lossy by design** — it recovers the topic tree, notes, icons, hyperlinks,
relationships, and boundaries (field-mapped from the bundled MindManager XSD), warns about
out-of-scope data (e.g. tasks), and flags any topics it leaves behind. Validated against a real
MindManager export (a 25-topic map imported with zero content loss) plus synthetic unit fixtures
and a CI-safe, env-gated (`MMAP_FILE`) integration test. A paired **`.mmap` writer** (`src/io/mmap.ts`)
exports maps back out — round-tripping topics, notes, links, icons, tags, task metadata, and embedded
images through our own importer.

## Status

**v0.2.0** is the current public-preview release. It adds the native `.ithread` extension (while
keeping `.mmst` readable) and iThoughts-compatible `.itmz` export. Its `.itmz` importer/exporter is
regression-tested against five large real-world maps and 31,389 topics. The app also includes a
Windows/iPad-style keyboard workflow, right-growing layouts, Chinese and English UI, rich Markdown
rendering, animated branch transitions, multi-topic selection, typography controls, and the
localhost-only CLI bridge. It remains local-first and usable without a mandatory network connection.

## The book

A longer-form guide to mind mapping — _Thinking in Maps_ — lives in
[`docs/guide/`](docs/guide/), built from one Markdown source to two downloads that refresh
automatically when the manuscript changes:

- **EPUB** (reflowable, Kindle-friendly): [`public/Thinking-in-Maps.epub`](public/Thinking-in-Maps.epub)
- **PDF** (fixed A4, cover + clickable TOC + bookmarks): [`public/Thinking-in-Maps.pdf`](public/Thinking-in-Maps.pdf)

Run `pnpm book` to rebuild both (pure Node — no Chromium or LaTeX). Authoring notes are in
[`docs/guide/AUTHORING.md`](docs/guide/AUTHORING.md).

## License

iThread is dual-licensed. The two artefacts in this repository are governed by different
licenses:

- **The software** — all source code under `src/`, `test/`, `scripts/`, the build configuration,
  etc. — is licensed under the **Apache License 2.0**. See [LICENSE](LICENSE) for the full text.
  Permissive use including commercial use, with attribution and a patent grant.
- **The book** — the practitioner guide in [`docs/guide/`](docs/guide/) (the source Markdown, the
  assembled EPUB, the PDF) — is licensed under **Creative Commons Attribution-NonCommercial 4.0
  International (CC BY-NC 4.0)**. See [LICENSE-BOOK](LICENSE-BOOK) for the full text + scope. Free
  for non-commercial use with attribution; commercial republishing or paid courses / consulting use
  requires prior written permission.

Third-party trademarks and third-party authors' work referenced in the book remain the property of
their respective owners. See [NOTICE.md](NOTICE.md) for the trademark notices and the boundary
between iThread's own license and what it doesn't grant rights to.
