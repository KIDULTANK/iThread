# iThread — User Guide

A local-first, offline mind-mapping app — a self-hosted replacement for Corel/Mindjet
MindManager. Your maps live in your browser (IndexedDB) and on disk; there are no accounts
and no telemetry.

This guide covers everything in the toolbar, top to bottom. For what changed recently see
[`CHANGELOG.md`](CHANGELOG.md); for how the project is built see [`README.md`](README.md).

---

## Getting started

1. `pnpm install`
2. `pnpm dev` and open the printed URL (dev server `mindmap-dev`, port 5175).
3. On first launch you'll land on the **[Start screen](#the-start-screen)**: capture a new map
   (type a topic, paste an outline, or open a blank canvas), or pick a template. Once a map is
   open you're in the editor — click around, then start your own.

Everything autosaves to your browser as you work, and the last map you had open — along with the
side panels you had open (Notes, Outline, Markers, Style) — is restored next time, dropping you
straight back into the editor. Press **⌂ Start** in the toolbar to return to the Start screen any
time. It also works fully offline and can be installed (see [Install as an app](#install-as-an-app)).

Local scripts and agents can also create, inspect, batch-modify, import and export maps while either
the Windows app or development preview is open. See the [iThread CLI guide](docs/CLI.md) for the
supported commands and safety rules.

---

## The Start screen

When no map is open — on a fresh install, or any time you press **⌂ Start** in the toolbar —
iThread shows a dedicated home. A left rail switches sections; the main area changes in
place and your editor is never touched:

- **Start** — a capture hero to make a new map three ways: **type a topic**, **paste an outline**
  (indentation or `#` levels set the hierarchy), or open a **blank canvas**. Below it sit your most
  **recent** maps and a few **templates** for a quick start.
- **All maps** — your whole library as cards or a list, sortable by last-edited, name, or size, with a
  **search box** to filter by title. Each card's thumbnail mirrors the map's real branches, and its
  **⋯** menu opens, renames, duplicates, exports, **pins**, or deletes the map. **Pinned** maps (marked
  ★) float to the top of every list regardless of recency, so your go-to maps stay one click away (the
  list view also shows when each map was last edited).
- **Recent** — every map grouped by when you last edited it (Today / Yesterday / Earlier this week /
  This month / Older).
- **Templates** — every [starter map](#templates), each with a thumbnail and a **computed** node
  count and branch preview. Picking one opens it pre-filled.
- **Layouts** — open a blank map directly in any [layout](#layout) (two-sided, org-chart, radial,
  timeline, fishbone, grid, brace…) or diagram backdrop (onion, funnel, Venn).
- **Import** — drop in or pick files in any [supported format](#importing).
- **Learn** — a short primer on mind-mapping principles, with a link to the companion book.
- **About** — what the app is and how your data stays local, plus links to the **book**
  (*Thinking in Maps*, PDF + EPUB), the [user guide](#), the dashboard, and the source.

Press **⌘K** (Ctrl-K) anywhere on the Start screen for a **command palette**: type to fuzzy-search
your maps and the main actions, then Enter to go.

---

## The toolbar

Left to right:

| Control | What it does |
|---|---|
| **☰ Outline** | Toggle the [outline panel](#outline-panel) |
| **📑 Index** | Toggle the [marker & tag index](#marker--tag-index) |
| **🎚 Filter** | Toggle the [Power Filter](#power-filter) (dim non-matching topics) |
| **🕔 History** | Toggle [version history](#version-history) — restore an earlier snapshot |
| **+ New…** | Create a map from a [template](#templates) (Blank, Brainstorm, SWOT, Project, 5 Whys, Decision, Retrospective, Meeting, Pre-mortem) |
| **(map dropdown)** | Switch between maps in your [library](#the-map-library) |
| **Delete** | Delete the current map |
| **▶ Present** | Start [presentation mode](#presentation-mode) |
| **Fit** | Scale + center the map in the viewport |
| **⊟ / ⊞** | [Collapse / expand all](#collapse--expand) branches |
| **1. Numbering** | Toggle [outline numbering](#auto-numbering) (1, 1.2, …) on every topic |
| **⌒ Line jumps** | Toggle [line-jumps](#relationships-boundaries--callouts) — a hop where two relationship arrows cross |
| **◎ Focus** | [Focus the selected branch](#focus-a-branch) — dim everything else (Esc exits) |
| **Canvas** | **Free layout (whiteboard)** toggle + **Theme, design presets & backdrop…** — which opens the [Map panel](#topic-info-panel), where the whole per-map look lives (theme, background, design presets, connectors, typography) |
| **ℹ Info** | Toggle the [topic info panel](#topic-info-panel) — note, markers, tags, style, links for the selected node |
| **🔍 Find** | Open [Find & Replace](#find--replace) — a top-right overlay to search and replace topics & notes (`Ctrl/⌘+F` or `/`) |
| **Layout** | [Layout direction](#layout): Both sides / Right / Left |
| **⬆ Export…** | Save the map in any format — see [Exporting](#exporting) |
| **⬇ Backup** | [Back up](#backup--restore) the whole library to one file |
| **Open files** | [Import](#importing) one or many files |

Related controls are grouped into labelled **menus** (Panels, Insert, Canvas, Export, More). Every
menu is fully **keyboard-navigable** — open with the mouse or **↓**, move with **↑ ↓ Home End**, run
with **Enter**, and close with **Esc** (focus returns where it was). On phones the menus open as a
full-width **bottom sheet**. And anywhere in the editor, press **⌘K** (Ctrl-K) for a **command
palette** — fuzzy-search and run any toolbar action (present, export, toggle a panel, switch layout,
group a branch, …) without reaching for the menus. The palette also lists every other library map as
**Switch to map: …** (foldered maps read *folder / map*), so changing documents is a keystroke, not
a trip to the dropdown.

---

## Editing the map

Keyboard-first, just like MindManager:

- **Enter** — add a sibling topic
- **Tab** — add a child topic
- **Ctrl + Enter** — add a child of the selected topic
- **Delete** — remove the selected topic and its branch immediately (with several topics multi-selected, it removes them all in one step); an **Undo** toast appears (and Ctrl/⌘+Z works) — no confirmation prompt
- **Just start typing** on a selected topic — it opens for editing with your first keystroke replacing the old text (type straight on)
- **Double-click** a node, or press **F2** with it selected — edit its text inline (starting from the existing text, all selected)
- **Ctrl + B / I / U** — while editing a topic: bold / italic / underline the selection
- **⌘K / Ctrl-K** — open the [command palette](#the-toolbar) to search and run any action
- **← / → / ↑ / ↓** — walk the selection through the tree (← parent, → child, ↑↓ siblings); in
  **🧲 Free layout**, **Ctrl/⌘ + arrows** instead nudge the topic 10 px
- **Drag** a node onto another — re-parent it (drop on the top/bottom edge to reorder it
  before/after instead of nesting)
- **Shift-drag onto empty canvas** — detach the branch to a floating topic; **Ctrl/⌘-drag onto a
  topic** — drop a *copy* of the branch there, original untouched
- **Ctrl/⌘ + C** — copy the selected branch (a multi-selection copies every selected branch);
  **Ctrl/⌘ + Shift + V** — paste them under the selection, re-numbered, in one undo step. The
  branch clipboard persists across maps and reloads, so this is also cross-map copy/paste.
  **Ctrl/⌘ + D** duplicates the branch as a sibling
- **Ctrl/⌘ + Shift + ↑ / ↓** — move the topic up / down among its siblings
- **Alt + Shift + ← / →** — promote (outdent) / demote (indent) the topic
- **Ctrl/⌘ + Shift + 1…9** — set the topic's task priority (see [Priority](#topic-info-panel))
- **Ctrl/⌘ + V** (with a topic selected, not typing) — [smart paste](#smart-paste): an image, an
  outline, a URL, or a spreadsheet selection, routed automatically
- **Ctrl/⌘ + + / − / 0** — zoom in / out / reset to 100%; **Shift + 1 / Shift + 2** — fit the whole
  map / fit the selection
- **Alt + ← / →** — back / forward through the topics you've visited (browser-style history,
  across maps)
- **Ctrl + Z / Ctrl + Shift + Z** (or Ctrl + Y) — **undo / redo** (kept in sync with what's saved)
- Right-click a node for the full context menu (add/remove, summary, link, focus mode, move up/down,
  lock position) — or, on the selected node, use the **More…** button on its quick-action popover to
  open the same menu. When the branch contains dated tasks, the menu also offers **Shift task dates
  (this branch)** — chips for **−1w / −1d / +1d / +1w / +1mo** move every start *and* due date in
  the subtree by that amount, offsets preserved, in one undo step ("the project slipped a week" is
  one click)
- **Sort children** (⌘K) — reorder the selected topic's direct children **A → Z**, by **priority**,
  **due date**, or **progress**; ties keep their order and topics without the field sort last
- On touch or pen, **long-press the canvas** for the pane menu (add topic, paste branch, fit,
  reset zoom)

Edits you make on the canvas — adding, renaming, moving, restyling — are captured into the map's
underlying model, so the outline, every export, and the autosave always reflect your latest changes.

### Topic info panel

Select a node and open **ℹ Info** to see and edit everything about it in one side panel — its
note, markers, tags, style, and links. (This replaces the old separate **Notes**, **Markers**, and
**Style** toggles.) The panel is organised into three tabs: **Details** (markers, tags, progress, dates,
priority, and collapsible Attachments / Links / Linked-from sections that start collapsed when empty),
**Style** (shape / fill / border / font, stickers), and **Notes** (the Markdown editor, with an
**⤢ Open in dock** button that pops it into the roomy side-panel editor) — move between the tabs with the **←/→** (and **Home/End**) keys once
one is focused. **Minimize** it with the **›** button to collapse it to a thin strip
on the right edge (click the strip's ℹ to bring it back) — minimizing sticks, so selecting other
nodes won't reopen it; re-expanding shows whatever node is selected then. **Drag the panel's left
edge to resize it** (the width is remembered); the header shows the topic's path (Root › Branch …)
and a facts line — outline number, depth, child count, and note size — plus, once a topic has been
created or edited, a **created / last-edited** line. (Those times are saved in the map's `.json` but
never drawn on the canvas or in image / PDF exports.)

**Text-wrap width.** The **Style** tab's **Wrap** slider sets how wide a topic grows before its text
wraps — drag for any width; it snaps to **Narrow / Medium / Wide**, and the far end means *no cap*. On a
**taller selected topic** you can also grab the **slim grip on its right edge** and drag to set the width
straight on the canvas (or nudge it with the **←/→** arrow keys) — it's the same setting, so slider and
grip always agree. On short topics — where the right edge is busy with the add-child ＋ and relate grip —
the grip is hidden, so use the slider. (The grip is desktop-only; on touch the slider is the wrap control.)

**Edit several topics at once.** Select multiple topics — **Shift/Ctrl/⌘-click** to add to the
selection, or **drag a box** across the empty canvas — and the inspector switches to bulk mode (an
"N topics selected" banner). Changes to **shape, fill, border, font/bold, progress, dates and
priority** apply to every selected topic at once (a single undo reverts them all). **Markers and
tags** also work in bulk — on the **Details** tab, the same place they sit for a single topic — with a
*tri-state* view: a chip is **lit** when every selected topic has
it and **dashed (a “+” chip)** when only some do — clicking adds it to the whole selection, or
removes it from all if they all already have it. The remaining per-item editors (notes, stickers,
attachments, links) stay single-topic — select one topic to edit those. If the selected topics
disagree on a field (progress, dates or priority), its control
shows blank and is tagged **Mixed** — so a bulk edit never silently overwrites them all with one
topic's value; set the control to apply a single value to the whole selection. A plain click clears
the multi-selection. *(Because the canvas now box-selects on a
left-drag, pan with the middle or right mouse button; wheel/two-finger scrolling pans, and
Ctrl/⌘-scroll or pinch zooms around the pointer.)*

**Map properties.** With nothing selected, the panel shows the **Map** — rename the map inline and
set its **theme**, **layout**, **background colour / image**, **accent colour**, and **line-jumps**
there, above a quick **overview** (topics, branches, task progress). The **Layout** field is a
visual **gallery**: its menu shows a schematic thumbnail per layout, grouped **Radial** (Both sides /
Right / Left / Radial hub), **Tree** (Org chart ↓ / ↑), and **Diagram** (Timeline / Fishbone /
Grid / **Swimlane** / Brace map). A **Design** field applies a one-click **preset** — **Classic**,
**Blueprint**, **Midnight**, **Sunrise**, or **Diagram** — each bundling a theme, connector style,
branch weight, and accent colour in one step. And a collapsed **More styling** section holds the
rest of the per-map look: **Connectors** (Organic / Curved / Elbow / Straight), **Branch weight**
(Fine / Regular / Bold), and the map **typography** — a base **Font** (Default / Sans / Serif /
Mono) and a **Text size** scale (Compact 0.85× / Comfortable 1× / Large 1.2×), which any per-topic
font setting still overrides. The **accent** is the default tint for relationship lines and boundary boxes — pick any
colour (or **Reset** to the theme default) without touching the rest of the style.
When the map has a **diagram backdrop** (onion / funnel / Venn), a **Backdrop** section lets you
add / remove a ring or stage, set its **colour**, and remove the backdrop. Clicking a **relationship**
arrow instead shows a connector editor (see [Relationships](#relationships-boundaries--callouts)).

- **Note** — write in the **WYSIWYG** editor: a formatting toolbar (**bold**, *italic*,
  ~~strikethrough~~, bulleted list, numbered list, headings, highlight, code, checklist, **🔗 link**,
  image, table) and inline formatting as you type — no raw markup to read. The **🔗 Link** button wraps
  the selected text in a link (or, with nothing selected, drops in the URL). The note editor lives on
  its own roomy **Notes** tab in the inspector (and a dockable Note-editor panel shows the *same* note,
  docked for more room). Notes autosave, travel with the map (and the
  lossless `.json` export). Behind the scenes the note is stored as **Markdown** (`#` headings,
  `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, `- lists`, `1. numbered`, `[links](https://…)`),
  so it stays portable across every export. Nodes with a note show a 📝 — in the
  [outline](#outline-panel) and on the topic itself; **hover the topic's 📝 to peek** at the note in a
  small card, or **click it to jump straight to the note** (selecting the topic and opening this panel
  on the Notes tab). A topic's 📎 chip lists its attached file names on hover. A **Spell-check**
  toggle (View menu, off by default) turns the browser's spell-checker on in both the topic and
  note editors.
- **Markers** — click a marker (✅ ❗ ⭐ 🚩 priority numbers, …) to toggle it on the selected topic(s);
  active markers are highlighted. You can also **drag a marker chip onto any topic** on the canvas to
  apply it there (the topic highlights as you hover). Imported MindManager icons map to these glyphs
  automatically. The palette shows a curated starter set; the **Find a marker…** box searches the full
  **library of 45** by name or keyword ("done" → ✅, "warning" → ⚠️). Four **marker groups** are
  single-select sets — **Priority** (1️⃣–9️⃣), **Status** (coloured dots), **Mood** (🙂 😐 🙁), and
  **Vote** (👍 👎) — applying one member automatically clears any other from the same group, so a
  topic never carries two priorities at once. Below the bar, a **Suggested:** row offers markers
  inferred from the topic's own text ("urgent" suggests ❗, "risk" suggests 🚩, "idea" suggests 💡…) —
  click a dashed chip to apply it.
- **Stickers** — click a sticker in the grid (star, heart, check / cross badge, flag, idea, warning,
  info, speech bubble, thumbs up / down, target, rocket, lock, key, clock, pin, fire, question, arrow)
  to drop a built-in illustration on the node — no file needed. A sticker becomes the node's
  [image](#images), so it shows on the canvas and carries into every export. To swap or remove it,
  pick another image/sticker (a sticker replaces the node's current picture).
- **Tags** — type a tag and press **Enter** to add it (the field **autocompletes** from every tag
  already in the map); click a chip's ✕ to remove it. Tags feed Find, the
  [marker & tag index](#marker--tag-index), and the [Power Filter](#power-filter). Map-wide tag
  housekeeping lives in the **Markers & tags** panel: each tag row has a **✎ rename** (type an
  *existing* tag's name to **merge** the two), a **✕ delete** (removes the tag from every topic),
  and a **colour swatch** that **tints every topic carrying that tag** (⊘ clears the tint — it's a
  view-only wash, so a topic's own fill still wins).
- **Progress** — set a task's completion with the **0 / 25 / 50 / 75 / 100** buttons (✕ clears it,
  so it stops being a task — the pie disappears). Hovering a topic also reveals a small **checkbox
  on its left edge** that cycles **not-a-task → to-do (0%) → done (100%) → not-a-task** — the
  quickest way to run a checklist (a partially-done task jumps straight to done; the checkbox hides
  on the root and on parents whose progress is rolled up). A small **completion pie** (MindManager-style: empty
  at 0%, a wedge in between, a full disc with a **✓** at 100%) appears on the node. **Click the pie on
  the node to step its completion** (0 → 25 → 50 → 75 → 100 → 0) without opening this panel. **Parents
  roll up automatically**: a branch with sub-tasks shows their average plus a *done / total* count
  (e.g. *75% · 1/2*) and is read-only (marked *auto*, so its pie isn't clickable). The percentage also
  shows in the Outline, and the pie is carried into image exports (PNG/SVG).
- **Dates** — set a **Start** and **Due** date; a **📅 chip** appears on the node and turns **red when
  overdue** (past due and not yet 100%). Clearing a date removes the chip. Dates are carried into
  image exports and saved with the map; the [Power Filter](#power-filter) can filter by due date.
  - **Type a date in plain language.** Each date field accepts natural language and resolves it when you
    press **Enter** or **Tab** away: `today`, `tomorrow`, `yesterday`, `+7d` (seven days from now),
    `next fri`, or a weekday name like `monday`. It also takes an exact `YYYY-MM-DD`. If it can't read
    what you typed the field turns red and keeps its old value. The **📅 button** beside the field opens
    the calendar picker as before.
- **Priority** — set a priority **1–9** (MindManager's full range: 1 = High, 2 = Med, 3 = Low, 4–9
  read as their number), or press **Ctrl/⌘ + Shift + 1…9** with the topic selected; a small coloured
  chip shows on the node (✕ clears it). Unlike the emoji priority markers, this is a structured value
  the [Power Filter](#power-filter) can filter by.
- **Attachments** — attach any file (**+ Attach file**); a **📎** count shows on the node and the
  panel lists each file with its size, a click-to-**download** link, and a ✕ to remove it. Files are
  stored inline in the map (capped at 5 MB each), so they stay offline and travel with a `.json`
  export — nothing is uploaded.
- **Style** — **Shape** (Box / Rounded / Pill, plus the vector shapes **diamond** = decision,
  **oval** = start/end, **parallelogram** = input/output, **hexagon** = preparation, **cylinder** =
  data store, **trapezoid** = manual operation, **octagon** = stop/limit, **document** = report/output,
  **callout** = speech/annotation, **star** = highlight, **cloud** = idea/external system), **Fill**,
  **Border** (swatch or ✕ for none), **B** for bold, **Reset** to clear; a **Font** picker
  (Sans / Serif / Mono) plus font size/colour live here too. Shapes and the chosen font render
  identically on the canvas and in image exports. Beyond the preset fill swatches sit **◧
  branch-colour tint** (a soft wash of the topic's own branch colour) and **◨ gradient**; a
  **Colour** row of free pickers takes any custom **text**, **fill**, or **branch (connector)**
  colour beyond the presets; **Raised / Flat** toggles a drop shadow; and **Fill image…** covers
  the whole card with a picture (single topic; it wins over any fill — **Clear fill image** removes
  it). The bar also *reads back*: the selected topic's active shape, fill, border, bold, and shadow
  light up, so the style bar doubles as a readout of what's applied.
- **Links** — give the node a clickable **🔗**: a **web** URL, **Link to a map** (another map in
  your library), or **Jump to a topic** (an in-map jump). Click the 🔗 on the node to follow it;
  **✕ Remove link** clears it. Once a map link is set, a third picker appears — **…and a topic** —
  listing the linked map's topics, so the link can land on a *specific topic* in the other map
  (`#map=…&node=…`), not just open it. The 🔗 carries one **primary** link; the Details tab's
  **Additional links** list holds any further URLs on the same topic — they're picked up by search
  and the backlink scans. The same in-app addresses work **inside notes**: a Markdown link to
  `#node=…` or `#map=…` in any note jumps through the canvas when clicked.
- **Linked from other maps** — when topics in *other* maps link to this map, the inspector grows a
  **Linked from other maps** section: each row names the linking topic and its map, and clicking it
  opens that map and focuses the topic — cross-map backlinks, so an atlas is navigable in both
  directions.
- **Links to** — the outgoing view: every topic this one points at, via its jump link(s) (`↪`) or
  an outgoing relationship arrow (`↬`, with its label), each row a one-click jump.
- **Linked from** — the reverse view: every topic that points *at* this one, via a topic-jump link
  (`↪`) or an incoming relationship arrow (`↬`, with its label). Each row is a one-click jump that
  selects and centres that source topic. The section appears only when something links in. For the
  whole map at once, the **Relationships panel** (Panels menu) lists **every relationship and
  in-map topic link** as *from → to · label* rows, both ends click-to-jump — the map's connective
  tissue in one list.

### Images

Click **Image**, pick a picture, and it's attached to the selected node. Images are
downscaled and stored inside the map (as a data URL), so they stay offline and travel with a
`.json` export.

Don't have a file handy? The **ℹ Info** panel's **Stickers** grid offers 20 built-in inline-SVG
illustrations (see [Markers / Stickers](#topic-info-panel) above). A sticker *is* the node's image —
same render, same exports — so it's the quickest way to add a touch of visual meaning without
supplying your own picture. A node holds one image at a time, so a new image or sticker replaces it.

### Smart paste

With a topic selected (and no text field focused), **Ctrl/⌘ + V** looks at what's on the clipboard
and does the right thing — no dialog:

- An **image** → becomes the selected topic's picture.
- A lone **URL** → one new topic under the selection, titled from the URL itself (the last path
  segment, de-slugged and title-cased — `…/blog/my-great-post` becomes *My Great Post*; just a
  domain becomes the host name) and carrying the link. Fully offline — nothing is fetched.
- An **outline / bullet list / Markdown** → parsed into a subtree under the selection (indentation
  or `#` levels set the hierarchy). Markdown shorthand is understood: `[ ]` / `[x]` prefixes become
  to-do / done tasks, a whole-line `[label](url)` becomes a linked topic titled *label*, and
  `**bold**` / `*italic*` / `` `code` `` markers are stripped to clean text.
- A **spreadsheet selection** (Excel / Sheets — anything with tab-separated columns) → one topic
  per row. With a header row, the *topic/name/title* column becomes the topic, other columns become
  labelled note lines, and a *Tags* column becomes tags.

(The internal **branch** clipboard is separate on purpose: `Ctrl/⌘+C` / `Ctrl/⌘+Shift+V` move
branches; plain `Ctrl/⌘+V` handles the outside world.)

### Type-ahead accelerators

Three triggers work while you're typing a topic, all driven by the same ↑ ↓ Enter/Tab Esc keys:

- **`/` as the first character** opens a small **command menu** — *Add child topic*, *Add sibling
  topic*, *Mark as to-do*, *Mark as done*, *Due today*, *High priority*, *Group in a boundary*,
  *Add a note*, *Star marker*. Keep typing to filter ("task" finds *Mark as to-do*).
- **`#` at a word boundary** pops the **tag picker**: keep typing to match an existing tag or create
  a new one; choosing it assigns the tag and strips the `#word` from the title.
- **`[[` or `@`** opens **link autocomplete** over every topic (and map) by name; picking one
  inserts its label into the text and attaches the jump link (`#node=…` for a topic, `#map=…` for a
  map) — the fastest way to wire up a knowledge map.

### Rich-text topics

Per-topic styling restyles the *whole* node; rich text formats *part* of the topic. While
editing a topic, a small **format bar** appears above it with **B / I / U** buttons and a row of
text-colour swatches — or use the keyboard: **Ctrl + B**, **Ctrl + I**, **Ctrl + U** to bold, italic,
or underline. Select the characters first, or toggle the format on and keep typing. The
formatting is saved with the map and travels in the `.json` export. The plain text is always
kept alongside it, so the outline and Find stay clean and readable. Inline Markdown is recognised
inside topics too: `**bold**`, `==highlight==`, `__underline__`, `*italic*`, `~~strike~~`, and
`` `code` `` are restored visually when typed, pasted, or imported from `.md`; Markdown export
writes the same markers back out instead of flattening the formatting.

---

## Navigating

### Breadcrumb bar

Select a topic and a thin **breadcrumb** appears above the canvas showing its path from the root
(Root › Branch › …). Click any crumb to centre that ancestor — a quick way to climb back up a deep
branch without scrolling.

### Outline panel

**☰ Outline** opens a live, indented outline of the whole map. Click any row to jump to that
node on the canvas — and it works the other way too: selecting a topic on the canvas scrolls its
outline row into view. The **Filter outline…** box narrows the list to matching topics; 📝 marks
noted nodes. **Double-click a row to rename it** in place (while renaming, **Enter** commits and
adds a sibling, **Tab** commits and adds a child — rapid entry without touching the canvas).
**Drag a row** to reorder or re-nest it (drop on the top/bottom edge to place it
before/after, or in the middle to nest it as a child); with a keyboard, **Shift + ↑/↓** reorders and
**Shift + ←/→** promotes/demotes the focused row. **On a touch screen, press and hold a row** for a
moment to pick it up, then slide and lift to drop.

### Auto-numbering

**1. Numbering** prefixes every topic with its hierarchical outline number — `1`, `1.2`,
`1.2.3`, and so on — both on the canvas and in the Outline panel, and the numbers carry through
to image, PDF, and Office exports. The central topic is the implicit "0" and stays unnumbered.
It's a view toggle: the numbers are derived from the tree's shape, never written into your topic
text, so turning it off leaves your topics exactly as they were and search/exports stay clean.
While the toggle is **on**, the numbers are also baked into **⧉ Copy outline** and the Markdown
export, so a numbered map pastes as a numbered outline.
Handy for referring to a specific node by number ("see 3.2") in a meeting or a written summary.
The setting is remembered between sessions. Two **numbering styles** are available while the
toggle is on (View menu, or the mobile Options menu): **decimal** (1, 1.1, 1.1.1 — the default)
or **outline / legal** (I, A, 1, a, i by level).

### Marker & tag index

**📑 Index** opens a side panel that gathers every [marker](#markers) and [tag](#markers) used
anywhere in the map, grouped by marker/tag with a count and the list of topics carrying it. Click
any topic to centre and select it on the canvas. It's the read-only counterpart to the **Markers**
palette: the palette *applies* markers to a node, the index *finds* every node that already has one
— handy for "show me everything flagged ❗" on a big map. Each row also has a **⧩ quick-filter**
button that pre-fills the [Power Filter](#power-filter) with that one marker or tag — the map dims
to just those topics in one click — and tag rows carry the rename / merge / delete / colour
controls described under [Tags](#topic-info-panel).

### Power Filter

**🎚 Filter** opens a read-only filter that **dims** every topic except the ones that match your
criteria — and the branches leading to them, so each match keeps its context. Combine a free-text
search (matches topic **and** note) with toggle chips for any marker or tag in the map, plus a
**Due date** option (*Has a date · Overdue · Due ≤ 7 days*), a **Priority** option (a level 1–9,
matching that priority or higher), a **Completion** option (*Done · In progress · Not done*, judged
on rolled-up progress), and a **Has relationship** option (by direction, optionally a specific
type); criteria are combined with AND (a topic must satisfy each category you've set). A live count
shows how many topics matched. It changes nothing in the map — **Clear** or closing the panel restores
everything — so it's a safe way to focus a crowded map on, say, every urgent (❗) item mentioning
"budget". (This differs from **Find**, which steps you through matches one at a time, and the
**Filter outline…** box, which narrows the outline list.)

Two more controls at the foot of the panel: **Hide non-matches (instead of fading)** swaps the dim
for a full hide — still read-only, still one click back — and, once a filter is active, **Extract
matches to a new map** copies the lit set (matches plus their ancestors) into a fresh library map
titled *"(filtered)"*, leaving the original untouched.

Once a filter is set, name it and click **Save** to keep it as a reusable preset. **Saved filters**
appear in the panel: click a name to re-apply it (on any map), or **✕** to remove it. Presets are
stored locally and travel with you between maps — handy for views you return to, like "every blocked
🚩 item" or "this quarter's tags".

### Focus a branch

Select a node and click **◎ Focus** to spotlight just that branch: the node, its whole subtree,
and the path back to the central topic stay bright while everything else dims. It's the fastest way
to talk through one part of a busy map without deleting or collapsing anything. Press **Esc** or
click **Show all** in the banner to bring the rest back. (Like the Power Filter, it only changes
opacity — nothing is removed.)

### Isolate a branch

A structural cousin of Focus: **Isolate branch (collapse others)** (view menu or **⌘K**) collapses
every *other* top-level branch and expands the path down to the selected topic. Unlike Focus and
the Power Filter, this really toggles the branches' collapsed state — it's an ordinary, undoable
edit, the "fold everything else away" move done in one step.

### Drill into a topic

Where **Focus** only dims, **Drill in** *re-roots* the canvas at the selected topic so its subtree
fills the screen — MindManager's "focus on topic". Select a topic and choose **Drill into the selected
topic** (view menu or **⌘K**). A bar shows what you're drilled into; press **Esc** or **Exit** to come
back out, and use the [breadcrumb](#breadcrumb-bar) to re-root at an ancestor (or click the map root to
exit). You can **keep editing while drilled** — it's just a view, so every change still belongs to the
whole map, and exiting brings back the rest with all its links and boundaries.

### Find & Replace

Press **`Ctrl/⌘+F`** (or **`/`** when you're not typing, or the toolbar's **🔍 Find** button) to
open the **Find & Replace** overlay in the top-right corner. It's non-modal — the map stays fully
visible and editable behind it, and **Esc** closes it.

Type in **Find** and every matching topic is **ringed on the canvas** as you type, so you can see all
hits at once; press **Enter** repeatedly to jump between them (**Shift+Enter** steps backwards; an
`n/total` counter shows where you are). Clearing the box removes the rings. **List all (N)** expands
a clickable list of every match — each row with its ancestor breadcrumb and, when the hit is in a
note, a snippet of the note around it. Type in the **Replace** box and click
**Replace all** to rewrite the search text across every matching topic. **Aa** matches case and
**`.*`** treats the query as a regular expression; the scope selector limits replace to topics,
notes, or both. The Find box also remembers your **last 10 queries** — they're offered as a
dropdown as you type.

Find searches **every field a topic carries** — not just its text and note, but tags, markers, the
hyperlink(s), callout text, attachment names, and resources — so "the node with the budget.xlsx
attachment" is findable by the file name.

**Operator search.** For sharper questions, the same box takes scoped operators (they can be
combined, and combine as AND):

| Operator | Matches |
|---|---|
| `tag:q3` | topics carrying that tag |
| `marker:flag-red` (or `icon:`) | topics carrying that marker |
| `priority:1` (or `p:1`) | task priority exactly that level (1–9) |
| `due:dated` / `due:overdue` / `due:soon` | has any date / past due / due within ~7 days |
| `has:note` / `has:attachment` / `has:link` / `has:task` / `has:image` | topic carries that field |
| `level:2`, `level:>=2`, `level:<3` (or `depth:`) | outline depth (root = 0) |
| `-term`, `-"phrase"` | excludes matches |
| `"exact phrase"` | quoted exact phrase |

Plain-word searches stay **typo-tolerant**: if nothing matches exactly, Find automatically retries
with a fuzzy pass, so a slip like `Launhc` still finds **Launch**. Exact matches always take
priority, and very short queries stay strict — so precise searches behave exactly as before.

### Search all maps

**🔎 All maps** (in the header) searches your whole library at once — every map's topics and
notes, including floating topics, with the same operators as in-map Find (`tag:`, `priority:`,
`has:`, `-exclude`, …). Each result shows the topic, its **ancestor breadcrumb**, a **note
snippet** when the match is in a note, and which map it's in. Pick a result and it opens that map
and focuses the node (if the match is in the current map, it jumps straight there). Handy once the
library grows into a connected knowledge base.

### Back / forward, and links to a topic

The app keeps a browser-style **history of the topics you visit**: press **Alt + ←** to go back
and **Alt + →** to go forward (also in ⌘K as *Go back / Go forward*). A "visit" is arriving at a
distinct topic — a Find jump, an outline click, a link — and history crosses maps, so backing out
of a cross-map link returns you to where you came from.

You can also link *into* a map from outside: **Copy link to this topic** (More menu, or ⌘K) puts a
URL with `?map=…&node=…` on the clipboard. Opening that URL launches the app on that map and
focuses that topic — paste it into a ticket, a doc, or a chat as a deep link (with nothing
selected, the command is *Copy link to this map*). The address bar tracks your active map and
selection, so the current URL is always shareable.

### Saved views

A view worth returning to — a particular zoom on a particular corner, a drill-in plus a filter —
can be bookmarked: **View ▾ → Save current view…**, give it a name, and it joins the **Saved
views** list in the same menu. Applying one restores the **pan/zoom**, any **drill-in**, and the
**Power Filter** it was saved with; ✕ deletes it (with an undo toast). Views are per-map.

### Map statistics & legend

**📊 Map statistics** (Panels menu or ⌘K) is a read-only dashboard of the current map:
**Structure** (topics, leaves, max depth, floating topics), **Tasks** (count, completed x/y,
overdue), and **Content** (word count and an estimated **reading time**, notes, attachments,
distinct tags and markers, relationships, boundaries).

The **Legend** toggle (View menu) draws an on-canvas box listing every **marker, tag, and
conditional-formatting rule actually in use**, each with its swatch — and the identical legend is
drawn into SVG/PNG exports, so a shared map explains its own colour code.

### Board view (Kanban)

**▦ Board** shows the map's topics as cards grouped into **columns** — pick the grouping source in
the board's header: **Tags** (one column per tag, the rest in **Untagged**), a single-select
**marker group** (Priority / Status / Mood / Vote), or **Schedule** (due-date buckets: Overdue /
Today / This week / Later). Each card shows its rolled-up [progress](#topic-info-panel) and
[due date](#topic-info-panel) (red when overdue). The board writes back: **drag a card to another
column** to re-tag, re-mark, or re-schedule that topic on the map. **Click a card** to jump to it on
the canvas. Tag your topics (in the **ℹ Info** panel) to give the tag board its columns.

### Conditional formatting

**🎨 Styles** opens a panel where you set **rules** that auto-style topics. The *When* dropdown
offers nine triggers: **has tag**, **has marker**, **is completed** (task at 100%), **is overdue**,
**is due soon** (due within the next 7 days — the same window the Power Filter and search use),
**priority ≤** (a threshold on the 1–9 scale), **text contains**, **has attachment**, and **has
relationship** (any, or a specific semantic type). Each condition has a **NOT** checkbox to invert
it, and **+ AND condition** adds further clauses — all must hold, each independently negatable —
so "tagged `q3` AND NOT completed" is one rule. A matching rule can apply a **fill** and/or
**border**, and can also **auto-apply a marker** or a **branch colour**. So "colour completed
topics green" or "flag every overdue topic with ❗" happens automatically as the map changes.
Rules are a **view-only overlay** — they layer *under* a topic's own styling, so anything you set
by hand on a node still wins, and nothing is baked into the topic. They're saved with the map and
carried into image exports. Add a rule with **+ Add rule**; remove one with **✕**.

The same panel has a **Named styles** organizer: style a topic by hand (shape / fill / border / bold
in the **ℹ Info** panel), then in **🎨 Styles** type a name and **Save** to capture that look. It
appears in the list — click it to **apply** that style to the selected topic, or **✕** to remove it.
Named styles are kept locally and reusable across maps, so a house style is one click away.

For one-off reuse there's also a **Format Painter** (view menu / **⌘K**): **Copy format** from a
styled topic, then select one or many topics and **Paste format** to apply that look in a single step —
no need to name it first. And **Auto-colour branches** repaints every top branch a distinct colour from
the current theme palette in one click.

### Collapse / expand

**⊟** collapses every branch to a level-1 overview; **⊞** expands the whole tree. **Fit**
re-frames the map. The **Detail level** items (in the same menu, and via **⌘K**) show the map to an
exact depth — **Show level 1** reveals only the top branches, **level 2** one tier more, and so on —
the quickest way to step a big map between an overview and full detail (MindManager's detail levels).
Those menu commands apply to the whole map. The number keys are branch-relative: with a topic
selected, **1** reveals one level below that topic, **2** reveals two levels, and so on; **0** expands
all of that selected branch. Other branches keep their current state. Press **.** to toggle only the
selected branch. Space is intentionally left unassigned.

### Minimap & zoom

A **minimap** in the bottom-right corner shows a shrunk overview of the whole map with a
rectangle marking the part you're viewing. **Click or drag** inside it to pan the main canvas
there. Below it, the zoom controls — **−**, a live **percentage**, **+**, and **⤢ fit** — give
precise, stepped zoom (Ctrl/⌘ + mouse wheel zooms too). Handy for orienting on a large map and for
lining one up before a screenshot or screen-share. When the overview is in the way, the
**Minimap ▾** button collapses it (click **Minimap ▴** to bring it back); the choice is remembered.
A slim **status bar** along the bottom shows the topic count, how many topics are selected (click
it to zoom to the selection), and the live zoom % (click it to reset to 100%) — plus a
**Map / Outline / Board** switcher that flips between the three views of the same map in one click.
Very large maps stay fluid automatically: above ~500 topics the canvas **virtualises**, rendering
only what's on screen — no toggle, nothing to configure.

**Pan the canvas** with the middle or right mouse button; left-dragging empty space draws a selection
box around multiple topics.

### Layout

The **Layout** dropdown changes how the whole map is arranged; the choice is remembered and the
map re-flows into the new shape without losing any edits:

- **Both sides / Right / Left** — the classic radial map, branches on both sides of the root or
  pushed all to one side.
- **Org-chart (down / up)** — a top-down (or bottom-up) hierarchy, like a reporting tree.
- **Radial** — branches fan out evenly in a ring around the root.
- **Timeline** — the first level laid left-to-right as a sequence; good for roadmaps and steps.
- **Fishbone** — an Ishikawa cause-and-effect diagram, branches angling into a central spine.
- **Grid / matrix** — tiles the first-level branches into a grid (four branches → a 2×2), each with
  its subtree beneath it and the root as a title above; the shape of a SWOT or Eisenhower matrix.
- **Swimlane** — the first-level branches as parallel lanes, each with its subtree flowing down it;
  the shape of a process split by owner or stage.
- **Brace map** — a left-to-right tree where each parent joins its children with a `{` fork brace
  (the Thinking-Maps part-whole diagram) instead of the curved branches.
- **Per-branch layout** — right-click any branch → **Branch layout** and pick a kind to lay out just
  that subtree differently from the rest of the map (e.g. an org-chart branch inside a radial map);
  pick **Default (map)** to clear it. The subtree is kept clear of its siblings, and the choice
  travels with the map.
- **Balancing the two sides** — in **Both sides**, the main branches are split left/right automatically
  to keep the map evenly weighted. To override it, right-click a main branch → **Map side → Left / Right**
  to pin it to a half (the rest re-balance around it), or **Auto** to release the pin. **View ▾ → Balance
  map** (also in ⌘K) clears every pin and redistributes the branches evenly again.
- **🧲 Free layout (whiteboard)** — a toggle (next to the layout picker), not a layout. Turn it on and
  you can **drag any topic anywhere** — it stays put and the auto-layout pauses. Combined with node
  shapes and directional arrows, this is how you build a **place-anywhere flowchart, concept map, or
  whiteboard**. Turning it on keeps everything where it is; turning it off returns to the auto-layout
  (your positions are remembered, so you can switch back). Try the **Whiteboard (free layout)**
  example in **+ New…**. In free layout you can also **align & distribute** several topics: select 2+
  and pick *Align left / centre / right / top / middle / bottom*, or select 3+ and *Distribute
  horizontally / vertically* (view menu or **⌘K**) to tidy them onto a clean grid. While you drag,
  **smart alignment guides** appear and snap the topic to the edges and centres of its neighbours
  (within ~6 px), so hand-placed layouts line up without fuss. And a topic you've placed *just so*
  can be pinned: right-click it → **Lock position** — it grows a 🔒 badge, can't be dragged, and
  align/distribute skip it (**Unlock position** frees it again).
- **◎ Diagram (backdrops)** — adds a geometric **frame** behind your topics and switches to free
  layout so you drop topics into its regions: an **onion** (concentric rings), a **funnel** (stacked
  stages), or a **Venn** (2 or 3 overlapping circles). Use **−/+** to change the ring/stage count
  (onion + funnel) and **✕ Backdrop** to remove it. The region labels are ordinary topics you place
  in each region; the frame renders into image exports. Try the **Onion**, **Funnel**, and **Venn**
  examples in **+ New…**.

### Themes

The **Theme** dropdown restyles the whole canvas — **Light**, **Dark**, **Ocean**, **Sunset** —
live, without losing edits. Image exports inherit the theme, so a dark map exports dark.

**Custom themes.** Pick **Manage themes…** at the bottom of the Theme dropdown (in the Map panel or
Settings) to open the **theme designer** — give a theme a name, a six-colour branch palette, a
background and node-fill colour, a font, and a branch weight, with a live preview. Saved themes appear
in the dropdown under *Custom* alongside the built-ins; choosing one applies its palette and colours
(with readable text and light/dark mode picked from the background) plus its font and branch weight.
**Download** a theme as a `.json` to reuse it on another map or machine, and **Import** one back in.
The four built-in themes can't be changed.

### Settings, appearance & accessibility

**Settings** (Ctrl/⌘ + `,`, or via ⌘K) gathers the app-wide preferences:

- **App theme** — separately from the canvas theme, this controls the *chrome*: the toolbar, side
  panels, inspector and dialogs. Choose **System** (the default — it follows your operating
  system's light/dark setting and updates live when you change it), **Light**, or **Dark**. The app
  theme is independent of the canvas theme, with one tie: a **Dark** canvas always darkens the
  chrome too, so you never end up with a bright toolbar around a dark map.
- **Reduce motion** — **System / On / Off**. *System* follows your OS's reduced-motion preference;
  *On* makes canvas zoom/fit and the guided walk instant and drops chrome transitions.
- **High contrast** — **System / On / Off**. *System* follows your OS's contrast / forced-colors
  setting (Windows High Contrast included); *On* strengthens chrome borders, dividers and text and
  adds bolder focus rings.
- **Getting started** — bring back the "3 things to try" tips card.
- **Local data** — a storage-usage estimate, plus buttons to clear the ⌘K command history, the
  branch clipboard, or (with confirmation) **all local data**.

Screen-reader users get the canvas's non-focusable overlays as hidden navigable lists —
**Boundaries**, **Summaries**, **Callouts**, and **Relationships**, each with its label and
topics — so nothing drawn on the canvas is invisible to assistive tech.

### Canvas background

The **Canvas** colour control sets the background for **this map only**, overriding the theme's
canvas colour — handy for colour-coding maps (a green "ideas" map, a red "risks" map) or matching a
brand. It's saved with the map and carries into the image/PDF export; the **✕** resets it to the
theme default.

Next to it, the **🖼** button sets a **background image** for the map: pick any image file and it
fills the canvas behind your topics (sitting on top of the background colour, so a transparent PNG
lets the colour show through). The picture is downscaled and stored inside the map, so the map stays
offline and portable, and it carries into every export — SVG, PNG, PDF, and HTML all show the same
backdrop you see on the canvas. The second **✕** removes the image.

---

## Relationships, boundaries & callouts

- **Relationships** — draw a labelled, **directional** arrow between two nodes: right-click the first
  node → **Link to…**, then click the target (you'll be prompted for an optional label). You can also
  **drag the small round grip** on a topic's right edge (it appears on hover) straight onto another
  topic — same result, same optional-label prompt — or press **Ctrl/⌘ + Shift + L** to start the link
  from the keyboard (also in ⌘K as *Start a relationship from selected topic*). On a left-growing
  branch the grip mirrors to the topic's **left (outward) edge**, alongside the add-child ＋.
  **Click a relationship to select it** and the inspector becomes a connector editor — a
  **Presets** row applies a whole look in one click (**Arrow**, **Dashed**, **Dotted**, **Thick**,
  **Curved**, **Double**), and below it you can change the **label**, **direction / arrowheads**
  (target, source, both, or none), **colour**, **width**, **line style** (dashed / solid / dotted),
  and **curve** (auto / straight / bow), or **delete** it. **Double-click the line** to edit its
  label right on the canvas, and **right-click a relationship** for the same options as a quick
  menu (label, arrowheads / direction, line style, type, delete). The
  selected relationship gets a highlight halo. Styling is lossless in `.json` and carries into every
  image / PDF / HTML export; drawn and imported (`.mmap`) relationships both persist.
  - **Relationship types** — give a relationship a semantic **type** in the inspector: *relates-to*
    (the default), *depends-on*, *causes*, *supports*, or *blocks*. This is separate from its text
    label. Tick **Show type labels on the canvas** (per relationship) to draw the type as a small
    pill near the arrowhead. Types
    drive two queries: a **has relationship** [conditional-formatting rule](#conditional-formatting)
    that styles the endpoints, and a **Has relationship** section in the [Power Filter](#power-filter)
    (by direction — outgoing / incoming / either — and optionally a specific type). Types are saved in
    `.json`; flat exports (including `.mmap`) drop them.
  - **Line jumps** — on a busy map where relationship arrows cross each other, click **⌒ Line jumps**
    in the toolbar. Wherever two relationships cross, one of them draws a small semicircular **hop**
    over the other, so the lines clearly *pass over* rather than appear to join (you get one bump per
    crossing, never two). It's a per-map setting, saved with the map, and the hops are drawn into
    every image export exactly as they appear on the canvas.
- **Boundaries** — a shaded, rounded box grouping a node and its subtree. Select a node and
  click **⬚ Group** in the toolbar. With **2+ topics selected**, **Insert ▸ Group selection
  (boundary)** wraps the whole multi-selection in a single box instead. **Click the box (its rim or label) to select it** — the inspector
  becomes a boundary editor where you can **name** or **delete** it. Drawn and imported boundaries
  both round-trip and persist.
- **Summary topics** — a labelled **bracket** beside a branch (rather than a box around it). Select a
  node and click **⊐ Summary** (or right-click → **Summarize branch**); the bracket auto-sizes to the
  branch and sits on the matching side. **Double-click its label** to rename it (clear the label to
  remove the summary). Summaries persist and are drawn into image exports.
- **Callouts** — a small sticky-note annotation pinned beside a node. Right-click a node →
  **Add callout**, then double-click the bubble to edit its text (the **×** removes it). Callouts
  are saved with the map and are drawn into the image exports too.
- **Editing overlays in the inspector** — clicking a **boundary**, **summary** bracket, or **callout**
  selects it (with a highlight) and turns the right panel into an editor for its label / text, a
  **Colour** swatch row (with **Default** to reset), and a **Delete** button — an alternative to the
  inline double-click gestures, which still work. A picked colour re-tints the whole object (outline,
  fill, and label) on the canvas and in every export; the backdrop colour lives in the Map panel.
  **Right-click any overlay** for a quick menu — recolour (and, for a boundary, its **shape** + **outline
  style**) or **Delete** — without opening the inspector.
- **Floating topics** — detached topics that live outside the central tree. You get them several ways:
  **double-click an empty spot** on the canvas, drop a **🗒 sticky note**, **Detach to floating topic**
  from a branch's menu, drop a link/URL onto the canvas, or import a map that carries them (`.mmap`,
  `.xmind`, `.smmx`, `.itmz`, …) — where they appear under a **"Floating topics"** branch. A floating
  topic is a **first-class node**: right-click or use the keyboard to **add a child** (Tab) or **sibling**
  (Enter), **indent / outdent** (Tab / Shift+Tab — a child can outdent into its own floating topic, a
  floating topic can indent under the previous one), **reorder**, **group in a boundary**, **summarize**,
  **paste a branch** under it, and **delete** it — and every inspector edit (note, colour, task fields,
  hyperlink, markers, tags, style, image, callouts) applies just as it does to a central topic. Drag one
  into the tree (or back out) to re-parent. All changes are saved.
- **Sticky notes** — **Insert ▸ Sticky note** drops a free-floating coloured note card on the
  canvas. A row of **colour chips** under the menu item picks the colour at insert time — **amber**
  (the default), lime, sky, rose, violet, or slate — and the chip you pick becomes the remembered
  default for the plain *Sticky note* item. It's a floating topic underneath, so you rename it,
  drag it (in **🧲 Free layout**), and it exports and round-trips like any topic — handy for
  captions, reminders, and legends.
- **Background shapes** — **Insert ▸ Shapes** drops a free, resizable shape *behind* the topics:
  **Rectangle**, **Ellipse**, **Block arrow**, or **Chevron** — the raw material for SWOT quadrants,
  Venn frames, and flow arrows. Adding one switches the map to **free-canvas** mode (positions
  preserved). Click a shape to select it: drag the body to move, drag a **corner grip** to resize
  (one undo step per gesture), and use its small floating toolbar to **recolour** it, **change its
  kind**, or **delete** it. Shapes render behind the topics on the canvas and in every image / PDF /
  HTML export.
- **Smart containers** — two of those shapes are containers that *carry their contents*: a
  **Swimlane** (a header band over vertical lanes) and a **Matrix** (a grid). A topic whose centre
  sits inside the container belongs to it, and **dragging the container moves every contained topic
  with it** in one undo step — move the lane, its cards follow. Membership is by position, so
  there's nothing to wire up: drop topics into a lane and drag.

---

## The map library

Every map you create or import is kept in the browser, keyed by name in the **map dropdown**.
Switch freely; each is autosaved. **Delete** removes the current one — a **soft delete**: an Undo
toast appears, and the map goes to the **Trash** (Start screen sidebar), where it stays until you
**Restore** it or **Delete forever** / **Empty Trash** (permanent — that also drops the map's
version history). Deleting a map that other maps link to or roll up warns you first.

If the **same map is open in two browser tabs**, a one-time warning appears — "edits here may
overwrite the other tab's autosaves" — so two-tab editing never clobbers silently.

Maps you open appear as **tabs** in a strip under the toolbar — one tab per document, the active one
underlined. Open a map (from the dropdown, a cross-map link, or **+**) and it gets a tab; click **×**
(or middle-click) to close it. The open tabs + the active one are remembered, so a reload reopens your
whole workspace.

**Folders.** On the **All maps** screen you can group maps into named folders. Click **＋ New folder**,
then use a map card's **⋯ → Move to folder…** to file it. Folders show as cards at the top of All
maps; click one to drill in (an **All maps / Folder** breadcrumb takes you back, and you can rename or
delete the folder there). A map lives in one folder or none; **deleting a folder keeps its maps** —
they move back to the top level. Folder structure is included in the [library backup](#backup--restore).

### Promote a branch, merge a map

Two inverse moves keep a growing library well-factored (both in **⌘K**):

- **New map from this topic** — copies the selected branch into a fresh, standalone library map
  and opens it. Non-destructive: the source map keeps its branch, and no link is created. For the
  branch that has outgrown its map.
- **Insert map as branch: *map*** — the reverse: grafts another library map's whole tree under the
  selected topic (re-numbered, so ids never clash). For consolidating small maps into one.

### Copying a branch between maps

Right-click a branch → **Copy branch** to copy it (the whole subtree) to a clipboard kept in your
browser. Then — in the *same map or any other* — right-click where you want it → **Paste branch
here**: it grafts a fresh copy under that node (or drops it in as a floating topic if you paste onto
nothing). Because the clipboard persists across maps, this is how you **move a branch from one map
into another**, or assemble a roll-up by pasting branches from several maps into one. Each paste is
re-numbered internally, so you can paste the same branch as many times as you like without clashes.

### Rolling up other maps

A roll-up keeps a node mirroring another map. Select a node, pick a source map from the **⤵ Roll-up**
menu in the toolbar — or **right-click the node → Roll-up** to bind (or unbind) a source there — then
click **🔄 Roll-ups** — the node's children become a fresh copy of that map's branches. Click
**🔄 Roll-ups** again any time to pull the latest. A bound node shows a small **⤵** badge on the canvas. One map can aggregate
several others — give each child node a different source — which is the *live* cousin of copy/paste
above (a paste is a one-off snapshot; a roll-up re-pulls on demand). A roll-up node is a mirror: its
children are replaced on each refresh, so edit the **source** map, not the pulled copy. Pick
**— Unbind** in the menu to detach it.

### Templates

**+ New…** offers starter maps: **Blank**, **Brainstorm** (the 5 Ws + How), **SWOT**,
**Project plan**, **5 Whys** (a nested root-cause chain), **Decision** (pros & cons),
**Retrospective** (Start / Stop / Continue), **Meeting notes**, and **Pre-mortem**.

### Examples

The same **+ New…** menu has an **Examples** group: 20 *complete*, worked maps to open and
adapt — Product launch plan, Meeting notes, Decision log, Quarterly OKRs, Team retrospective,
a worked SWOT, a Flowchart (shapes + flow), a Concept map (linked ideas), a Whiteboard (free
layout), Onion / Funnel / Venn diagrams, Incident runbook, GTD natural planning, GTD Areas of
Focus (the 20,000-ft "horizon" of standing responsibilities), Talk/content outline, Personal
knowledge map, Study/revision map, Trip plan (with an image), and a Cross-map atlas. Unlike
templates (empty frames), examples are filled in — the quickest way to see a finished map and
learn a feature by reading one that uses it. Opening one creates a fresh, editable copy.

---

## Working with files

Your maps always autosave into the browser (the [library](#the-map-library)), but you can also keep a
map as a **file on disk** — to store it in a folder, sync it through Dropbox/OneDrive, email it, or
put it in version control. iThread's native file is **`.ithread`** (the same lossless format as a
`.json` export, just a distinct extension so your computer can associate it with the app). Files
created by earlier previews with the `.mmst` extension remain fully readable.

In **More ▸ File** (or the **⌘K** command palette):

- **Open file…** (`Ctrl/⌘ + O`) — pick an `.ithread`, legacy `.mmst`, or `.json` file and open it. You can also pick a
  MindManager **`.mmap`** here — see *Opening MindManager files* below.
- **Open recent** — the same menu lists your recently opened disk files (up to 8) for one-click
  reopening.
- **Save to file** (`Ctrl/⌘ + S`) — save the current map back to its linked file, with no dialog. The
  first time (no file linked yet) this acts like *Save as…*.
- **Save as…** (`Ctrl/⌘ + Shift + S`) — choose a new file/location.

Once a map is linked to a file, your edits **autosave through to that file** as you work — so the disk
copy stays current without you pressing Save. The window/tab title shows the file name, with a **●** in
front whenever the file is briefly behind your latest edit; if you try to close the tab with unsaved
file changes, the browser warns you first. The link is remembered, so reopening the app reconnects the
map to its file.

**If the file changes on disk** while you're working (edited elsewhere, or synced in), the app
notices: background autosave-to-file **pauses** with a warning rather than overwriting, and an
explicit **Save** asks first — *"File changed on disk … Overwrite it with this version?"* — with
your map safe in the library either way.

> **Browser support.** Open/Save-to-the-same-file and file autosave use the **File System Access API**,
> available in **Chrome, Edge, and other Chromium browsers on desktop**. In Firefox, Safari, and on
> mobile, **Save** downloads an `.ithread` file and **Open** uses the normal file picker instead — and your
> work still autosaves to the browser, so nothing is lost.

### Make it your default app for `.ithread` (Windows)

If you **install** iThread as an app (the install button in Chrome/Edge, or *Apps ▸ Install*),
Windows can associate `.ithread` files with it: right-click an `.ithread` ▸ **Open with ▸ Choose another app**
▸ pick iThread ▸ *Always*. After that, **double-clicking an `.ithread` in File Explorer opens it
directly in the app** (in the already-running window if one is open). This is a Chromium-desktop
feature; it isn't available in Firefox/Safari or on mobile.

### Opening MindManager files (`.mmap`)

An installed copy also registers for MindManager **`.mmap`** files, so you can double-click one in File
Explorer (after setting the default the same way as above) or pick it via **Open file…**. Opening a
`.mmap` **imports** it — a one-way conversion. It recovers the topic tree, **notes** (full body),
**tags**, **markers/icons**, **rich text** (bold/italic/underline + colour), **hyperlinks**,
**embedded images** and **attachments**, **relationships** and **boundaries** (with their styling),
**callouts**, the two-sided arrangement, the **map background**, **task info** (start/due dates,
priority, progress), and **explicit per-topic colours, fonts & shapes**. A few MindManager-only things
are still dropped — theme-*inherited* (non-explicit) styling, summary brackets, and vector (EMF/WMF)
images without a raster fallback — and whatever was dropped is listed in the import banner.

**Important — `.mmap` is import-only, and you can't save back to it.** An opened `.mmap` becomes an
ordinary map in your **library** (autosaved to the browser as usual, so your edits aren't lost), but it
is **not** linked to the `.mmap` file — *Save* won't write `.mmap`. To keep your changes as a file, use
**Save as iThread file…** to write an **`.ithread`**; after that it behaves like any native file (Save / autosave to
disk). Re-opening the same `.mmap` again imports a fresh copy.

---

## Importing

### Paste text → map

**📋 Paste text** is the quickest way in: paste an outline, a bullet list, or Markdown and it
becomes topics. **Indentation** (spaces or tabs) or **`#` heading levels** set the hierarchy, and
`-` / `*` / `+` / `•` and numbered (`1.`) markers are all recognised — so an outline copied from a
doc, an email, or anywhere else just works. Choose **New map** to drop it in as its own map, or
**Add under selected** to graft it onto the current map under the selected node. It's all local —
a fast, private way to bring in an outline you wrote (or generated) elsewhere, with no upload.
Inline formatting markers (`**bold**`, `==highlight==`, `__underline__`, and the italic/strike/code
forms) are restored on the topic rather than discarded.

### Fast capture

For getting ideas down quickly, three header tools:

- **Quick add** — type a topic in the **Quick add… ⏎** box and press **Enter**; it's added under the
  selected node (or the central topic if nothing's selected) and the box keeps focus, so you can
  fire off several in a row without touching the canvas. **Paste multiple lines** into the same box
  and they land as a whole nested **subtree** in one step — indentation or `#` levels set the
  depth (a single line is always taken verbatim, so "1. Intro" stays "1. Intro").
- **📥 Inbox** — a map-independent holding pen (Panels menu → *Inbox (quick capture)*). Jot a
  thought and press **Enter**; items persist across map switches and reloads until you file them —
  each row's **→ map** button drops it onto the current map as a floating topic, ✕ discards it.
  For the idea that arrives while you're in the *wrong* map.
- **Drop a link** — drag a link (or selected text) from your browser onto the canvas to create a
  **floating topic**; a dropped URL becomes a clickable link on it (unsafe links are refused).
- **⏱ Brainstorm timer** — pick **3 / 5 / 10 / 15 min** to timebox an idea sprint; it counts down
  in the toolbar and flags **time's up**. Purely a focus aid — it changes nothing in the map.
- **Map parts** — **Insert ▸ Map parts** drops a ready-made mini-structure under the selected
  topic: **SWOT** (Strengths / Weaknesses / Opportunities / Threats), **Pros & cons**, **5W1H**
  (Who / What / When / Where / Why / How), or **Meeting agenda** (Attendees / Topics / Decisions /
  Action items / Next steps). The neighbouring **Insert ▸ Templates** fly-out grafts any full
  [template](#templates)'s structure under the selection the same way — frameworks as building
  blocks, not just starting points.

### Open files

**Open files** accepts (and you can multi-select to **batch-import** a whole folder):

| Format | Notes |
|---|---|
| `.mmap` | MindManager export — recovers topics, notes, icons, hyperlinks, relationships, boundaries, floating topics (lossy by design; the `.mmap` export below is the return trip) |
| `.md` / `.markdown` | Markdown outline — `#`/`##`/`###` headings **and** nested bullets (also imports **Markmap** files, stripping any `---` frontmatter; its `title:` becomes the map title) |
| `.json` | A native iThread map — **lossless** |
| `.opml` | OPML outline (Freeplane, OmniOutliner, Workflowy, …) |
| `.mm` | FreeMind / Freeplane map — topics, links, folded state, and notes |
| `.mmd` / `.mermaid` | Mermaid `mindmap` text (any node shape; hierarchy by indentation) |
| `.xmind` | XMind — topics, notes, web links, labels→tags (modern `content.json` **and** legacy `content.xml`) |
| `.smmx` | SimpleMind — topic tree, notes, web links, and relations→cross-links |
| `.itmz` | iThoughts — topic tree, notes, web links, relationships→cross-links, floating topics |
| `.mind` | MindMeister — topic tree, notes, and web links from `map.json` |
| `.mup` | MindMup — JSON map (rank-ordered children, notes, links) |
| `.textpack` | TextBundle / TextPack (Bear, Ulysses, iA Writer) — the bundle's `text.md` → topic tree |
| `.docx` | Word — the document's outline (heading styles or indentation) → topic tree, with italic note paragraphs |
| `.xlsx` | Excel — an indented-outline sheet (first non-empty column = depth, trailing column = note); reads inline + shared strings. Empty-topic rows aren't imported |

Each imported file becomes its own library entry; batch imports report how many were added.
MindManager stock icons are mapped to the closest **emoji** marker, so an imported map keeps its
visual cues rather than arriving as bare text.

### Version history

**🕔 History** opens a per-map list of past snapshots, newest first, each labelled with when it
was taken and its topic count. **Restore** rolls the map back to that snapshot — and because your
current state is checkpointed first, a restore is itself undoable (just restore the top entry).
Snapshots are captured **automatically as you edit** (coalesced to about one every few minutes) and
on demand with **Save version now**. History is capped at the 30 most recent per map (older ones are
pruned), lives entirely in your browser (IndexedDB), and is deleted along with the map. It's the
fine-grained companion to **Backup** (which snapshots the *whole library* to a file).

**▶ Play timeline** turns that list into a playback: it shows each snapshot on the canvas in order,
oldest to newest, so you can *watch* the map evolve. A control bar gives you play/pause, step
(⏮ / ⏭), and a scrubber to jump to any point; playback is **read-only**, so nothing changes until
you click **Restore this** at the frame you want — or **Exit** (or press **Esc**) to return to the
live map. Needs at least two saved versions.

### Backup & restore

**⬇ Backup** saves your entire library — every map — into a single `mindmap-library.json`.
To restore, just **Open** that file: all the maps come back. Great for moving your whole
library to another machine or keeping a safe copy.

---

## Exporting

Pick a format from the **⬆ Export…** menu:

| Format | Output |
|---|---|
| `.json` | Native, **lossless** — use for backup or moving a map between machines |
| `.md` | Markdown outline |
| `.opml` | OPML outline |
| `.mm` | FreeMind / Freeplane — topics, links, folded state, notes (opens in FreeMind, Freeplane, XMind, …) |
| `.mmd` | Mermaid `mindmap` text — paste into Markdown, GitHub, or docs that render Mermaid |
| `.xmind` | XMind (2020+) — topic tree, notes, links, tags, plus floating topics + relationships |
| `.smmx` | SimpleMind — topic tree, notes, web links, relations, plus floating topics |
| `.itmz` | iThoughts-compatible copy — topic tree, notes, links, folded state, task progress, relationships, floating topics and embedded images; the source `.itmz` is never overwritten |
| `.mmap` | MindManager — topic tree, notes, hyperlinks, icons, tags, task info (dates / priority / progress), embedded images, relationships, and the two-sided side; the mirror of the `.mmap` importer (round-trips back into Studio for these fields) |
| `.png` / `.svg` | Image of the map (inherits the current theme). PNG comes in four flavours: **`.png` (image)**, **`@2×` (sharp)**, **`@4×` (print)**, and **transparent** (no background fill) |
| `.html` (standalone) | A single self-contained HTML file — the whole map as an image (opens anywhere, offline) |
| `.html` (interactive) | A single self-contained HTML file that opens on the **visual map** (the real coloured render, pan/zoom) with a toggle to a **collapsible, searchable** outline: fold branches, filter topics (no app, no backend, offline) |
| `.html` (slide deck) | A standalone, navigable slide presentation — the [Walk-Through](#presentation-mode) as a shareable file (arrow keys / click / Prev-Next, offline). Each branch slide shows the branch **as its actual map image** (the overview slide is the whole map), falling back to a bullet outline if the canvas isn't available. **Speaker notes** are included, hidden by default — press **N** or the footer **Notes** button to show them |
| `.docx` | A Word document — the map as an editable, indented outline (opens in Word, LibreOffice, Pages, Google Docs) |
| `.pptx` | A PowerPoint deck — an overview slide, then one per branch **rendered as its live map image**, with each topic's note carried into the slide's speaker notes (opens in PowerPoint, Keynote, LibreOffice, Google Slides) |
| `.xlsx` | An Excel worksheet — the map as an indented outline (a column per depth) with a Notes column (opens in Excel, LibreOffice Calc, Numbers, Google Sheets) |
| `.pdf` (file) | A real PDF file, no print dialog — **fit to map**, **A4 landscape**, or **Letter portrait** (the map embedded as a sharp 2× image) |
| `.pdf` (via print dialog) | Opens your browser's print dialog → "Save as PDF" (landscape) |

Or **⧉ Copy outline** copies the map as a Markdown outline straight to the clipboard — no
file — for pasting into an email, chat, or doc. Two more clipboard routes: **Copy image to
clipboard** (in the Export menu's Image group) puts the map on the clipboard as a PNG, ready to
paste into a chat or a slide; and **Copy as table (TSV)** (More ▸ Map, or ⌘K) copies every topic
as a spreadsheet-ready row — **Topic / Depth / Note / Tags** — for pasting straight into Excel or
Sheets.

**Export just one branch.** Right-click a topic that has children and choose **Export this branch…**
(or press ⌘K and pick **Export selected branch…**) to export only that topic and everything under it —
as PNG, SVG, standalone or interactive HTML, PDF, `.json`, or Markdown. The image / SVG / HTML / PDF
render just the branch, framed to its own bounds, exactly as it looks on the canvas.

---

## Presentation mode

**▶ Present** opens a fullscreen **Walk-Through**: an overview slide, then one slide per
branch with its nested points. Navigate with **Prev / Next**, the **arrow keys** (**Home** returns
to the first slide, **Space** advances), and **Esc** to exit. Press **B** for a black curtain or
**W** for a white one — the classic "eyes on me" move; any key or click lifts it. A footer
**clock** tracks elapsed time (pause / resume / reset).

### Pacing timer

In [Presenter view](#presenter-view), a **Timer** section adds a time **budget** in 5-minute steps
(**−5 / +5**; 0 = off). With a budget set, the clock changes colour as you go — **green** while
comfortably inside it, **amber** in the final 20%, **red** once you're over — and shows how far
under or over you are, so pacing is a glance, not arithmetic.

### Presenter view

Click **Presenter view** in the control bar (or press **P**) to turn on a presenter sidebar
beside the live slide — what *you* see while the audience still sees only the slide. It shows:

- **Speaker notes** — the current branch's [note](#notes), rendered as Markdown (or a quiet
  "No notes for this slide." when there isn't one). Write your talking points in the note and
  they're waiting for you here.
- **Next up** — the heading of the slide you're about to advance to (or "End of map" on the last
  one), so you can land the transition.
- **Agenda** — the map of your whole talk: every slide (the overview plus each branch) in order,
  with a **3 / 8**-style position indicator and the current slide highlighted. Click any item to
  jump straight to that slide.

It's a single-screen layout (no second window to manage), and the toggle only changes *your* view
— the audience slide is untouched. Press **P** again to hide it.

To share the same walk-through without the app, export it as a **slide deck** — the
`.html (slide deck)` option in the **⬆ Export…** menu saves a standalone, navigable HTML file
that opens in any browser, offline.

### Guided walk

Where Present is a slide overlay, the **guided walk** tours the *live canvas*: **More ▸ Guided
walk (step through topics)** (or ⌘K → *Start guided walk*) spotlights each topic in depth-first
order, dimming the rest. A floating bar gives **◀ / ▶** (or the **← / →** keys), an *n / total*
counter, the current topic's **speaker note** in a strip below, and **Exit** (**Esc**). The **🎬**
toggle switches on **cinematic mode** — each step animates a Prezi-style zoom that frames the
whole branch instead of centring one topic flat; the choice is remembered across sessions. Use the
walk for working sessions where the map should stay live and editable; use Present when you want
slides.

---

## Install as an app

iThread is an installable PWA: your browser will offer to install it to your desktop /
home screen, after which it launches in its own window and runs fully offline (the app shell
is precached). On a **phone** the layout adapts — the editor toolbar becomes a single swipeable
strip so the canvas fills the screen, the side panels (Outline, Info, …) open as **bottom sheets**
over a full-width canvas rather than squeezing it, and the start screen's rail folds into a top nav.

When a new version is deployed, the running app shows a quiet **"A new version is available —
Refresh now"** prompt; click it to swap to the new build and reload. It never reloads on its
own, so an in-flight edit is never lost. You can also force a check via **About → Check for
updates**.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Enter | Add sibling |
| Tab | Add child |
| Ctrl + Enter | Add child (selected topic) |
| Shift + Tab | Outdent (promote one level) |
| Delete | Remove the topic + its branch — or the whole multi-selection (instant — undo from the toast) |
| F2 / double-click | Edit in place, keeping the text |
| P / Shift + P | Increase / decrease task progress (and create/remove task state at the ends) |
| Ctrl + B / I / U (while editing) | Bold / italic / underline the selection |
| Ctrl + Z / Ctrl + Shift + Z / Ctrl + Y | Undo / redo |
| Ctrl + C / Ctrl + Shift + V / Ctrl + D | Copy branch(es) / paste under selection / duplicate as sibling |
| Ctrl + V (topic selected) | Smart paste — image, outline, URL, or table |
| Arrow keys | Walk selection: ← parent, → child, ↑↓ siblings |
| Ctrl + Shift + ↑ / ↓ | Move topic up / down among siblings |
| Alt + Shift + ← / → | Promote / demote the topic |
| Ctrl + Shift + 1…9 | Set task priority |
| Ctrl + Shift + L | Start a relationship from the selected topic |
| Ctrl + + / − / 0 | Zoom in / out / reset to 100% |
| Shift + 1 / Shift + 2 | Fit the whole map / fit the selection |
| Alt + ← / Alt + → | Back / forward through visited topics |
| Ctrl + K | Open the command palette — run anything, or jump to a topic |
| Ctrl + F or `/` | Open Find & Replace |
| Enter / Shift + Enter (in Find) | Next / previous match |
| Ctrl + O / Ctrl + S / Ctrl + Shift + S | Open file / save to file / save as |
| Ctrl + `,` | Settings & preferences |
| Arrow keys / Esc (in Present) | Navigate / exit slides |
| P / B / W (in Present) | Presenter view / black curtain / white curtain |

(All of these — Ctrl works as ⌘ on a Mac.) The same list is built into the app: press the **?**
button at the bottom of the left rail, or ⌘K → **"Keyboard shortcuts"**, for a cheat-sheet grouped by
Editing / Navigation / View.

### On the canvas

- **Add a topic with the mouse.** Right-click a topic and choose **Add child** or **Add sibling**;
  keyboard users can use Tab and Enter. The canvas stays visually clean without permanent add buttons.
- **Move around.** Use the **middle/right mouse button** to drag-pan, or wheel/two-finger scroll to
  glide across the map; **Ctrl/⌘ + scroll** or pinch zooms around the pointer. Branches animate out
  from their parent when added or expanded, while dragging lifts a topic above the map. You can also
  **double-click an empty spot** to drop a floating topic. Left-drag empty canvas to rubber-band a
  multi-selection.
- **Re-parent by dragging.** Drag a topic onto another; the target highlights with a
  **"↳ Make child of X"** label so you can see the result before you let go. Drop on empty space to
  cancel.
- **Delete safely.** Deleting a topic or a whole map is **instant and reversible** — an **Undo** toast
  appears (and Ctrl/⌘+Z works too); there's no blocking confirmation.

---

## Notes on scope

iThread targets **brainstorming, knowledge mapping, and presentation/sharing**. The
project / task-management layer (Gantt, schedules, dependencies, resources) is intentionally
out of scope, as are MindManager's collaboration / enterprise features (real-time co-editing,
cloud sync, the web/Teams apps); see `NEXT_STEPS.md` for the current edges.
