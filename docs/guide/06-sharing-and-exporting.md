# Sharing and exporting

### Getting the map out -- losslessly when it matters

A map you can't get out of the app is a map held hostage. MindMap Studio is built on the
opposite principle: your work is plain data, and there are many doors out. This chapter
is the catalogue of them, and when to use which.

## The export menu

The toolbar's **Export** menu offers, in rough order of fidelity:

- **JSON** -- the native format, and the only **lossless** one. Topics, notes, markers,
  images, boundaries, relationships, styling: everything in the model survives a round
  trip. Export to JSON for backup, for moving a map between machines, or any time you
  might want to re-open it later with nothing lost.
- **Markdown** -- the map as an indented outline (`#` root, nested bullets). Perfect for
  pasting into a document, a wiki, or a pull request. It's round-trippable as structure,
  though it naturally drops canvas-only detail like colours and arrows. (One thing it *keeps*
  when you ask: with outline numbering on -- Chapter 5 -- the numbers are baked into each line.)
- **OPML** -- the interchange format outliners speak. Use it to hand your structure to
  another outlining tool.
- **FreeMind / Freeplane (`.mm`)** -- the most widely-read mind-map format. Carries the
  topic tree, links, folded branches, and notes, so a map opens in FreeMind, Freeplane,
  XMind, and the many tools that import `.mm`. The bridge to almost any other mind-mapper.
- **Mermaid (`.mmd`)** -- the `mindmap` text format you embed in Markdown, a README, or a
  wiki that renders Mermaid (GitHub, GitLab, Notion, many docs tools). For when the map
  should live *as text* inside something you're already writing.
- **XMind (`.xmind`)** -- the native format of one of the most popular mind-mappers, written
  the modern (2020+) way. Carries the topic tree, notes, links, and tags, plus floating topics
  and relationships, so the map opens natively in XMind rather than going through `.mm`.
- **SimpleMind (`.smmx`)** -- the native format of the cross-platform SimpleMind app. Carries
  the topic tree, notes, web links, and relations, plus floating topics, so the map opens
  natively in SimpleMind on desktop or mobile.
- **MindManager (`.mmap`)** -- MindManager's own format. Writes the topic tree, notes,
  hyperlinks, stock icons, relationships, and the two-sided left/right arrangement -- the
  mirror of the `.mmap` importer, so a map you started here can go back to a MindManager user.
- **PNG** and **SVG** -- the map as a picture. PNG for slides and chat -- in plain, sharp
  **@2x**, print-grade **@4x**, and **transparent** variants -- and SVG when you want a crisp,
  scalable image that survives zooming. There's also **Copy image to clipboard**, which skips the
  file entirely and pastes straight into a chat or a deck.
- **HTML** -- a self-contained web page of the map, openable in any browser with nothing
  installed.
- **Interactive HTML** -- the same one-file, opens-anywhere idea, but *navigable* instead of a
  picture: the map becomes a collapsible, searchable outline. The recipient folds branches by
  clicking a topic, expands or collapses the whole thing at once, and types in a filter box to
  highlight and narrow to matching topics (plus Ctrl/⌘-scroll to zoom and drag to pan). It's all
  one file with the data, styling, and a tiny script inlined -- no app, no server, no internet --
  so it's the format for handing a *big* map to someone who needs to explore it, not just look at it.
- **HTML slide deck** -- the walk-through (Chapter 7) as a standalone, navigable
  presentation in a single file: an overview slide, then one per branch -- each drawn as its
  **actual map image**, not a bullet list -- advanced with the arrow keys or a click, speaker
  notes a keypress away. Hand someone the file and they can present your map with nothing
  installed.
- **PowerPoint (`.pptx`)** -- a real, editable slide deck: an overview slide, then one per
  branch rendered as its **live map image**, with each topic's note carried into the slide's
  speaker notes. For when the deck has to live in PowerPoint -- a house template to apply, or a
  room to run from the corporate machine.
- **Word (`.docx`)** -- the map as an editable outline document: a title, indented bulleted
  topics, and notes as italic lines. For when the next step lives in a word processor --
  minutes, a brief, a hand-off to someone who doesn't use the app.
- **Excel (`.xlsx`)** -- the map as an indented outline worksheet: each topic in the column
  matching its depth, with a Notes column. For when you want to sort, filter, or count the
  outline as a spreadsheet.
- **PDF** -- a real `.pdf` file, written directly (sized to the map, or **A4** / **Letter**), or
  the classic route through the browser's print dialog when you want its options.

A rule of thumb: **JSON to keep it, Markdown to discuss it, PNG/SVG/HTML to show it,
interactive HTML to let someone explore it, the slide deck or PowerPoint to present it, Word or
PDF to send it, Excel to crunch it.**

And the scope is yours: **right-click any topic -> Export this branch...** exports just that
subtree, in any of the picture/document formats, framed to its own bounds -- for the one branch
that needs to travel without the map around it.

A worked tour of the interchange exports, one file each. Take a project map and pick **Export -> OPML**; open the `.opml` in your outliner and the topics arrive as nested headings, ready to keep editing as an outline. **Export -> FreeMind (`.mm`)** and double-click the file: it opens in FreeMind, Freeplane, or XMind with the tree, the folded branches, the links, and the notes intact -- the one bridge almost every mind-mapper reads. **Export -> Mermaid (`.mmd`)** gives you a `mindmap` block you paste straight into a README on GitHub, where it renders as a diagram in the rendered Markdown. **Export -> XMind (`.xmind`)** opens natively in XMind 2020+ -- tree, notes, links, tags, floating topics, and relationships -- with no `.mm` detour. **Export -> SimpleMind (`.smmx`)** opens natively in SimpleMind on desktop or phone, carrying notes, web links, and relations. And **Export -> HTML** hands someone a single self-contained page that opens in any browser with nothing installed -- one file, no app, no server. Same map, six more doors, and every one is a file on *your* disk.

## Copy the outline

Sometimes you don't want a file at all -- you want the text on your clipboard, ready to
paste. The **⧉ Copy outline** button copies the whole map as a Markdown outline in one
click: drop it straight into an email, a chat message, a ticket, or a document. It's the
same structure as the Markdown export without the round trip through a saved file -- the
fastest way to turn a map into words somewhere else. Reach for it when the map was the
*thinking* and some other place is where the writing has to land.

Its sibling **Copy as table (TSV)** (in the **More** menu) flattens the tree into rows instead:
one per topic, with **Topic / Depth / Note / Tags** columns, tab-separated so it pastes straight
into a spreadsheet *as columns*. It's the bridge from map to grid -- tag topics with owners while
you plan, copy as a table, paste into the sheet, and the per-owner breakdown is a pivot away.
(Chapter 8's decision recipe reaches for this map-to-grid bridge when a comparison outgrows the map.)

## Importing

The same breadth applies going in. MindMap Studio reads:

- **Native `.json`** -- the lossless round trip of the export above.
- **Markdown** outlines -- any `#`/bullet structure becomes a map, **Markmap**-flavoured
  Markdown (YAML frontmatter plus multi-level headings) included.
- **OPML** -- from other outliners.
- **FreeMind / Freeplane `.mm`** -- topics, links, folded state, and notes.
- **Mermaid** `mindmap` text -- any node shape; the hierarchy comes from the indentation.
- **XMind `.xmind`** (2020+) -- topics, notes, web links, and labels become tags.
- **SimpleMind `.smmx`** -- topic tree, notes, web links, and relations.
- **MindMup `.mup`** -- the JSON maps from the browser-based MindMup.
- **TextBundle / TextPack** (`.textpack`) -- the bundle's Markdown becomes the map; what Bear,
  Ulysses, and iA Writer export.
- **MindManager `.mmap`** -- see below.

You can **batch-import** several files at once, which turns a folder of outlines into a
library of maps in one step. (The list keeps growing -- Word `.docx`, Excel `.xlsx`, iThoughts
`.itmz`, MindMeister `.mind`, and older XMind files all open too.) These bridges cover the common
ground between tools; each keeps the topic tree and the fields that map cleanly, and -- like the
`.mmap` importer -- quietly leaves behind only the tool-specific extras it can't represent.

The **Excel** door deserves a sentence of its own, because it's how a *spreadsheet-shaped* plan
becomes a map: the importer reads the first sheet as an indented outline -- the column of a row's
first filled cell is its depth (column A a root, B its child, and so on), and a later cell on the
same row comes along as that topic's note. It's exactly the shape the Excel *export* writes, so
the worksheet a colleague reorganised can come back in as the map it started from.

Not everything you want to map arrives as a file, though. Often it's just *text* -- an agenda in
an email, a list in a chat, the bones of an outline you typed somewhere else. **📋 Paste text**
takes that straight from the clipboard: paste it in and the indentation (or `#` heading levels)
becomes the tree, bullet and number markers are stripped, and you get topics. It reads Markdown's
shorthand on the way through: a `[ ]` or `[x]` checkbox becomes a real task (to-do or done), a
`[text](url)` line becomes a topic with the link attached, and stray `**bold**` markers are
cleaned off rather than pasted in. A rectangular *spreadsheet* selection pastes just as well --
rows become topics, with the extra columns carried along. Drop it in as a new
map, or **Add under selected** to graft it onto a branch you're already growing. It's the lowest-
friction on-ramp there is -- and, because it never leaves the browser, the private way to bring in
an outline you drafted anywhere, including one a chatbot wrote for you.

## The MindManager bridge

If you're arriving from MindManager, the **`.mmap` importer** is the on-ramp. It reads a
`.mmap` file and recovers the parts that map cleanly onto MindMap Studio's model: the
topic tree and text, notes, stock icons (rendered as emoji markers), hyperlinks,
relationships, boundaries, and floating topics. It was built against MindManager's own
published schema rather than guessed at, so the common cases come through faithfully.

There is now also an **off-ramp**: **Export -> MindManager (`.mmap`)** writes the same parts
back out -- tree, notes, hyperlinks, icons, tags, task info (dates, priority, progress),
embedded images, relationships, and the two-sided left/right arrangement -- so a map you built
here can land on a MindManager user's desk. It is the
mirror of the importer, and a map round-trips back into MindMap Studio with those fields
intact. MindManager is strict about its format, so confirm an exported file opens in your
MindManager version before relying on it.

Both directions are deliberately **lossy on project data**: MindManager carries task
scheduling, resources, and Gantt information that MindMap Studio doesn't model, and the
importer tells you when it has left something behind rather than pretending the map came
across whole.

> **Why lossy is the honest choice.** A converter that silently drops what it can't
> represent leaves you to discover the gaps later, usually at the worst moment. The
> importer's warnings are a feature: they tell you exactly what to check.

## Going back in time

Exporting a `.json` is a snapshot you take on purpose; **version history** takes them for you. The
**🕔 History** panel keeps a running list of past states of the current map -- captured quietly as
you edit (every few minutes, not every keystroke) and whenever you click **Save version now**.
Each entry shows when it was taken and how big the map was; **Restore** rolls the map back to it.
The safety net under the safety net: restoring first checkpoints what you have *now*, so even an
unwanted restore is one click from undone. It's all local (capped at the 30 most recent, kept in
the browser's database) and travels with nothing -- a private undo that outlives the session, where
the in-session Undo (Chapter 1) stops at the last reload. Think of Backup as the whole-library
snapshot and History as the per-map flight recorder.

There's also a **▶ Play timeline** button: instead of eyeballing the list, play the snapshots back
in order and *watch* the map grow on the canvas -- step frame by frame, drag the scrubber to any
point, or let it auto-play. It's read-only while you watch, so nothing changes until you pick a
frame and hit **Restore this** (or **Exit**, or Esc, to drop back to the live map). On a map you've
been building for weeks, it's a quietly satisfying way to see how the thinking took shape.

## A map as a file on disk

Between "lives in the browser" and "exported once" there's a third way to keep a map: link it to
a **file on disk**. iThread's native file is **`.ithread`** (the lossless JSON format under a
distinct extension; legacy `.mmst` files still open). **Open file...** (Ctrl+O) opens one; **Save to file** (Ctrl+S) and **Save
as...** write one; an **Open recent** list brings back the files you use often. Once a map is
linked to its file, the same continuous autosave **writes through to disk** as you edit -- so a
map kept in a synced folder (Dropbox, OneDrive, a git repo) stays current without a Save
ritual. The app is careful at the edges: if the file changes on disk underneath you -- edited
elsewhere, or synced in -- background saving pauses and an explicit Save asks before
overwriting, and if the same map is open in two tabs, you're warned before the autosaves can
fight. (Save-in-place needs a Chromium desktop browser; elsewhere, Save downloads the file and
your work still autosaves to the browser.)

## Where your data lives

Nothing in this chapter sends your map anywhere. Exports are files saved to *your*
machine; imports read files *you* choose. Day to day, every map lives in your browser's
local database, and the app works fully offline (Chapter 7). Sharing is always an
explicit act, never a background one -- which is exactly how a thinking tool should treat
the half-formed ideas you trust it with.

Because the app is a PWA, that locality holds even with no network. Load it once and it keeps working offline: the app shell is precached, so on your next visit -- plane, train, dead Wi-Fi -- it opens and your maps are right there, with a quiet **Ready to use offline.** note the first time the cache lands. When a new version ships, it never reloads under you mid-edit; instead a small **A new version is available.** toast appears with a **Refresh now** button, and the swap happens only when you click it. And on a phone the editor adapts -- the wide toolbar collapses into a single compact, horizontally-scrollable strip and the side panels slide up as bottom sheets -- so the same map is workable on a screen it was never drawn for.

## Now you try

Take any map and export it twice: once to **JSON** and once to **Markdown**. Open the
Markdown in a text editor — there's your outline, ready to paste into a document. Now start
a **new** map and import the JSON you saved: it comes back exactly, down to the markers and
arrows. You've just proved the thing that matters most about a thinking tool — your work
isn't trapped in it. **JSON to keep it, Markdown to share it.** Make that round trip once
and you'll trust the app with the ideas you're still figuring out.

Then take the same map to an audience two more ways. Export the **slide deck** (or
**PowerPoint**, if the deck has to live there) and open it -- you're presenting: an overview,
then one slide per branch, arrow keys to move, nothing installed. Export **Word** and open it
in your word processor -- the same map as an editable
outline, ready to become minutes or a brief. One map, four jobs -- archived, discussed,
presented, and written up -- and not once did your work leave your machine.

Now get it out as a *picture* and as a *paste*. Export **PNG** (or **SVG** for a crisp,
scalable version) and drop it into a slide or a chat -- notice the labels, icons, arrows and
boundaries all render, because the image carries real text, not a screenshot. Export to
**PDF** when it needs to print, or to **Excel** when you want to sort and count the outline
as a spreadsheet. For a big map someone needs to *explore* rather than glance at, export
**Interactive HTML** and open it: same single offline file, but now you can fold branches and
type in the filter box to narrow to what matters -- proof the export can carry the *navigation*,
not just the picture. Finally, when you just need the words somewhere *now*, click **⧉ Copy
outline** and paste -- no file, no download, just the map as a Markdown outline wherever your
cursor is; or **Copy as table (TSV)** and paste into a blank sheet to watch Topic / Depth /
Note / Tags land as real columns. Same map, every door out: a file to keep, a picture to show, a
sheet to crunch, a paste to drop.

One round trip is worth running deliberately: export your map to **Excel**, move a row or edit a
note in the spreadsheet, and **import** the `.xlsx` back -- the column-indented sheet returns as
the tree it described. That's the full map-to-grid-to-map loop, and once you've made it, "can you
put that in a spreadsheet?" stops being a rewrite.

One safety net is worth feeling before you trust a map with real work: make a few edits, then
open **version history** and restore an earlier snapshot -- the map rewinds intact, and you can
**play the timeline back** to watch it grow from the first node to now. And when you bring a map in
from MindManager, notice that its stock icons arrive as familiar **emoji** -- the meaning crosses
over even when the file format doesn't.

Now prove the *interchange*. Export the map to **OPML** and reopen the `.opml` in your outliner --
the headings are your topics. Export **FreeMind (`.mm`)** and open it in Freeplane; export
**Mermaid (`.mmd`)** and paste the `mindmap` block into a README so it renders as a diagram; export
**XMind** or **SimpleMind** and watch it open natively in those apps, notes and links along for the
ride; export self-contained **HTML** and double-click it in any browser. Then go the other way:
take that `.mm` (or a `.opml`, `.xmind`, `.smmx`, `.mup`, `.itmz`, `.mind`, `.xlsx`, `.docx`,
`.textpack`, a MindManager `.mmap`, a plain or Markmap-flavoured `.md`, or a Mermaid file) and
**Import** it back -- the tree and the fields that map cleanly come across -- or drop a whole folder
at once to **batch-import** them into a library. When you've only got loose text -- an agenda from an email --
**Paste text** turns the indentation into a tree in one click. Finally, feel the PWA: kill your
network and reload (it still opens, maps and all, because the shell is precached), watch for the
**A new version is available.** toast next time a build ships, and open the same map on your phone
-- the toolbar shrinks to one scrollable strip and the panels become bottom sheets.

The final chapter is about the most demanding kind of sharing: standing up and walking a
room through a map live.
