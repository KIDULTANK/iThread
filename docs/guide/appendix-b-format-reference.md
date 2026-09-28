# Appendix B -- Format reference

What goes in, what comes out, and what survives the trip. For the day-to-day guidance on
*which* format to reach for, see Chapter 6; this appendix is the detail.

## Export formats

- **JSON** (native) -- **lossless**. The complete model: topics, notes, markers, images,
  boundaries, relationships, styling. The format to use whenever you might re-open the map.
- **Markdown** -- the tree as an outline (`#` root, nested bullets). Round-trippable as
  structure; canvas-only detail (colour, arrows) is naturally dropped.
- **OPML** -- standard outliner interchange. Structure and topics; not canvas styling.
- **FreeMind / Freeplane (`.mm`)** -- the most widely-read mind-map format: topic tree, links,
  folded state, and notes. The bridge to most other mind-mappers.
- **Mermaid (`.mmd`)** -- the `mindmap` text format you embed in Markdown that renders Mermaid
  (GitHub, GitLab, Notion, many docs tools).
- **XMind (`.xmind`)** -- the modern (2020+) XMind package: topics, notes, links, tags, floating
  topics, and relationships.
- **SimpleMind (`.smmx`)** -- the native SimpleMind format: topic tree, notes, web links,
  relations, and floating topics.
- **MindManager (`.mmap`)** -- topic tree, notes, hyperlinks, stock icons, tags, task info
  (dates, priority, progress), embedded images, relationships, boundaries, and the two-sided
  arrangement; the mirror of the importer below.
- **PNG** -- a raster image of the canvas, for slides and chat; plain, @2x, @4x, and
  transparent variants.
- **SVG** -- a vector image: crisp at any zoom, ideal for high-resolution use.
- **HTML** -- a single self-contained page, openable in any browser.
- **Interactive HTML** -- the same single file, but navigable: the visual map with pan/zoom
  plus a collapsible, searchable outline.
- **HTML slide deck** -- the walk-through as a standalone, navigable presentation in one
  self-contained file (an overview slide, then one per branch as its live map image, with
  speaker notes).
- **PowerPoint (`.pptx`)** -- a real, editable slide deck (an overview slide, then one per
  branch with its subtree as bullets); a minimal PresentationML package that opens in
  PowerPoint, Keynote, LibreOffice, and Google Slides.
- **Excel (`.xlsx`)** -- the map as an indented outline worksheet (each topic in the column
  matching its depth, plus a Notes column); a minimal SpreadsheetML package that opens in
  Excel, LibreOffice Calc, Numbers, and Google Sheets.
- **Word (`.docx`)** -- the map as an editable outline document (title, indented bulleted
  topics, notes as italic lines); a minimal Open-XML package that opens in Word,
  LibreOffice, Pages, and Google Docs.
- **PDF** -- written directly as a real file (fit-to-map, A4, or Letter), or via the browser's
  print path when you want its options.
- **`.ithread`** -- the native *file* format (lossless JSON under the app's own extension), for
  keeping a map on disk with autosave writing through to it (Chapter 6). Legacy `.mmst` remains
  readable.
- **iThoughts `.itmz`** -- compatibility export for reopening a copy in iThoughts; carries the topic
  tree, notes, web links, folded state, task progress, relationships, floating topics and images.

## Import formats

- **JSON** (native) -- the lossless round trip of the JSON export.
- **Markdown** -- any `#`/bullet outline becomes a map, including **Markmap**-flavoured Markdown
  (YAML frontmatter plus multi-level headings).
- **OPML** -- outlines from other tools.
- **FreeMind / Freeplane `.mm`** -- topics, links, folded state, and notes.
- **Mermaid `.mmd`** -- `mindmap` text; the hierarchy comes from the indentation.
- **XMind `.xmind`** (2020+) -- topics, notes, web links, and labels (as tags).
- **SimpleMind `.smmx`** -- topic tree, notes, web links, and relations.
- **MindMup `.mup`** -- the JSON maps from the browser-based MindMup.
- **TextBundle / TextPack** (`.textpack`) -- the bundle's Markdown (`text.md`) becomes the map;
  what Bear, Ulysses, and iA Writer export.
- **iThoughts `.itmz`**, **MindMeister `.mind`**, **Word `.docx`**, **Excel `.xlsx`** -- topic
  tree (and notes, where the format carries them). iThoughts also has the compatibility export above.
- **MindManager `.mmap`** -- one-way, lossy (see below).
- **Batch import** -- select several files at once to create several maps in one step.

## What the `.mmap` importer recovers

The MindManager importer was built from MindManager's published XML schema, not guessed
at. From a `.mmap` file it recovers:

- the **topic tree** and all topic text;
- **notes** (the full body), **tags**, and **rich text** (bold / italic / underline, colour);
- **stock icons**, mapped to the closest **emoji** marker;
- **hyperlinks**, **embedded images**, and **attachments**;
- **relationships** and **boundaries**, with their styling; **callouts**;
- **task info** -- start and due dates, priority, progress;
- the two-sided arrangement, the **map background**, and explicit per-topic colours, fonts,
  and shapes;
- **floating topics**.

## What it deliberately leaves behind

A few MindManager-only things still don't cross: theme-*inherited* (non-explicit) styling,
summary brackets, vector (EMF/WMF) images with no raster fallback, and the project-management
layer beyond basic task info -- schedules, durations, resource assignments, Gantt data. The
importer **warns** you about what it skipped rather than dropping it silently, and it does a
left-behind check for any topic it couldn't reach. Treat the import as a migration --
a clean start in a new tool -- not as a two-way sync.

## A practical note on lossless round trips

Only **JSON in and JSON out** is guaranteed to reproduce a map exactly. If a map matters,
keep a JSON export (or a whole-library backup, Chapter 7) as the canonical copy, and treat
the other formats as *views* of it -- excellent for sharing, not the thing you archive.
