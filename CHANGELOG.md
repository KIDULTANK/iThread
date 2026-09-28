# Changelog

Notable changes to MindMap Studio. Loosely follows Keep a Changelog; pre-1.0 and
phase-based. Open work lives in `NEXT_STEPS.md`, not here.

## [Unreleased]

## [0.2.0] - 2026-09-28

### Added

- iThoughts-compatible `.itmz` export, including map XML, style and plist metadata, preview image,
  relationships, floating topics, task state and embedded image assets.
- Real-file import → export → import regression coverage across five iThoughts maps and 31,389 topics.

### Changed

- The native file extension is now `.ithread`; legacy `.mmst` and `.json` maps remain losslessly
  readable and can be resaved under the new extension.
- File and export menus now distinguish native iThread saving from iThoughts-compatible export.

## [0.1.1] - 2026-09-28

### Added

- Public-preview documentation in Chinese, including a five-minute quick start, known limitations,
  privacy/security guidance and structured GitHub feedback forms.
- A branded Windows application icon and SHA-256 checksum generation in the public release build.

### Changed

- Public messaging now explicitly describes iThoughts `.itmz` support as import-only and recommends
  preserving the original file while saving editable work as `.mmst`.
- The Windows release is positioned as a pre-release until `.itmz` round-trip export and trusted code
  signing are available.

## [0.1.0] - 2026-09-28

### Added

- Standalone Windows 11 desktop packaging with a portable `.exe` release target.
- Chinese and English interface switching, including a fully translated shortcut guide.
- iThoughts `.itmz` import with large real-world file validation, floating topics, folded branches,
  relationships, images, notes and rich text.
- Local `pnpm ithread` CLI for agents and scripts to list, open, import, create and modify maps.
- Long-press Alt shortcut overlay with clickable category pages.
- Per-topic and map-wide Windows font controls.

### Changed

- Windows/iPad-style keyboard workflow: Alt+arrow branch movement, explicit edit entry, Enter to end
  editing while preserving selection, and P/Shift+P task progress controls.
- Right-growing layout preference, smoother branch animation, smaller canvas controls and improved
  multi-topic rubber-band selection.
- Product name and visible application branding changed to iThread.

### Added

- **A localisation layer, with English as the only locale.** The point isn't a second language — it's
  that adding one later is "write a JSON catalogue" rather than "re-architect the app". `src/i18n/`
  holds a message registry, a typed English catalogue, `Intl.PluralRules`-based plurals and
  `Intl.Collator`-based collation; `<html lang>` / `<html dir>` are now stamped from the resolved locale
  at startup instead of being hardcoded in `index.html`; and the language choice persists and travels
  through the preferences file. `SettingsDialog` and the preferences-file handlers are migrated as the
  first real consumers (43 catalogue entries), which is how two design flaws surfaced — see below.

  **Catalogues are chunk-local, not one global object.** `FlowMindMap` is a ~100 kB *lazy* chunk holding
  ~175 of the app's strings and the exporters under `io/` are lazy too, so a single eager catalogue would
  quietly relocate all of that into the entry chunk that `scripts/size-budget.mjs` caps. Each catalogue
  therefore lives beside the code that uses it and registers itself on import; only the message-key
  *type* union is global, and it's `import type` so it erases at build time and costs nothing.

  Keys are a compile-time union, so a typo or a deleted string fails `tsc --noEmit` (which the gate runs)
  rather than rendering a blank label. A missing key — or a count message called without its `n`, which
  would otherwise print a literal `{n}` — throws in dev and degrades gracefully in production; the throw
  is compiled out by `import.meta.env.DEV`.

  Two things found only by wiring it up to real code, both fixed: registration originally lived in
  `main.tsx`, which meant every *other* entry point (the test suite, and equally any future embed) got a
  working `t()` over an empty registry and threw on every call — the barrel now imports the catalogue, so
  "can call `t()`" and "the messages exist" are one fact. And plural selection ran through
  `Intl.PluralRules` before checking that a count was supplied.

  **Chunk-locality proven, not just asserted.** The canvas now has its own catalogue
  (`mindmap/flow/messages.ts`) and 21 `TopicNode` strings moved onto it. Measured after the build:
  `"Drag onto another topic to link them"` lands in `FlowMindMap-*.js` while
  `"Preferences live in this browser"` lands in `index-*.js`, and **the entry chunk did not grow at
  all** (166.8 kB before and after). A test guards the single mistake that would break it — a lazy
  module importing the `i18n` barrel instead of `i18n/registry`, which would pull the eager chrome
  catalogue into that chunk.

  **A guard against the work rotting.** Nothing stops the next person adding a button with a hardcoded
  label, and the failure is silent — the UI looks right in English and simply never translates. `tsc`
  can't see it (a plain string is valid) and no behavioural test notices, because English IS the
  fallback. So a test scans the migrated files for user-facing literals: a literal in `title` /
  `aria-label` / `placeholder` / `alt`, and bare prose lines (the multi-line paragraphs inside JSX).
  It's an allowlist that grows as files are migrated, rather than a whole-tree scan that would block
  everything untouched. It is tuned for zero false positives — a noisy guard gets switched off, which is
  worse than a narrow one — so it deliberately skips prose containing `:` or `?`, which is
  indistinguishable from `background: style?.fillImage` without a parser. On its first run it found five
  genuinely un-migrated paragraphs in `SettingsDialog`, now moved into the catalogue.

  **Relative times and text ordering now go through `Intl`.** `timeAgo` was hand-built strings;
  it now uses `Intl.RelativeTimeFormat`, so CLDR supplies each locale's phrasing and plural boundaries —
  Danish reads "2 min. siden" and Slavic four-way plurals work with **no catalogue entries at all**. Its
  past-a-week date fallback also formats for the APP's locale now, where the bare `toLocaleDateString()`
  followed whatever the browser happened to be set to. **Visible change:** English wording shifted
  slightly — "2 h ago" is now "2 hr. ago" — because no `Intl` style matches the old terse form exactly,
  and hand-writing one per locale would discard the reason for using `Intl`. "just now" has no
  relative-time equivalent so it stays a message.

  All 12 collation sites now route through `compareText` (`Intl.Collator`): the Kanban tag columns, the
  marker/tag index, the tag/marker value sets, map titles, folder names, the ⌘K map switcher and the
  "Sort by name" control. A bare `.sort()` orders by UTF-16 code point, which strands å/æ/ö past z in
  **every** alphabet — wrong for English as much as Danish — and a bare `localeCompare()` followed the
  browser rather than the app and gave no numeric ordering, so "Item 10" sorted before "Item 2".

  **The editor toolbar is migrated (55 entries).** 70 literals across four shapes — prop attributes, JSX
  text nodes, positional arguments and `label:`/`name:` object properties — collapsing to 55 messages,
  because identical text shares one key (a label repeated across two menus appears once).

  The scripted pass initially rewrote quoted UI text **inside doc comments**, turning
  `/** …library map ("New map from topic"). */` into a `t()` call mid-sentence. It compiled, being a
  comment, but produced nonsense prose and keys slugged from commentary. Caught by reading the diff,
  reverted, and re-run line-by-line with comments excluded. The lint guard then flagged those same two
  comment lines — the guard skipped `//` and `*` but not `/**`, so it was wrong too; both are fixed and
  the doc-comment shape is pinned as a must-not-fire case.

  **The ⌘K command registry is migrated (82 entries).** All 87 palette rows now come from the catalogue.
  This was the shape the plan called hand-work, and it split three ways: ~60 uniform
  `add("id", "Label", …)` sites done by script; 10 labels living in data tuples with no key naming them
  (align modes, sort keys); and 12 **composed** labels that needed a named placeholder — `Layout: {name}`,
  `Export {format}`, `Show detail level {n}`, `Marker: {marker} on selected topic`. Those compose an
  inner label that is itself already translated, and the placeholder is what lets a translator reorder:
  string concatenation could never produce `{name}-layout` for a language that needs it.

  I revised the design recorded in `NEXT_STEPS` while building it. The plan was to drop the label
  argument and derive the key from the command id inside `add()`, which reads elegantly — but a
  template-literal key **cannot be verified by `tsc`**, and compile-time key checking is the property the
  typed catalogue exists for. Each call site now passes an explicit key literal instead: a smaller diff,
  and every key stays checked.

  Building the registry is itself the completeness check, because `t()` throws in dev on a missing key. A
  test adds what that would *not* catch — a placeholder that never got substituted, which would ship
  `Layout: {name}` to a user. That check was vacuous on its first write (a shell-escaping slip left the
  regex as `/{w+}/`, matching literal text) and only caught the fault once fixed; proved by misspelling a
  placeholder in the catalogue and watching it fail.

  **The keyboard cheat sheet is migrated (48 entries).** `shortcuts.ts` became `shortcutGroups()` — a
  function rather than a `const` array, because a module-scope `t()` would bake the locale in at import
  time and never reflect a later switch. The **key names themselves stay literal** ("Ctrl/⌘ + Z",
  "Tab"): they denote physical keys, and the bindings they document aren't locale-dependent. Only the
  five group titles and 44 action descriptions are translated. Proven behaviour-preserving by capturing
  every rendered string before the change and asserting the migrated table reproduces it exactly.

  Budget note: 167 → 169 kB gz, documented in `size-budget.mjs`. The layer is a ~1 kB one-off and the
  marginal cost of migrating a string is the **key**, not the text (the text was already in the bundle,
  inline) — measured at ~25 bytes per entry, which puts the full ~1,400-string extraction at roughly
  +12 kB gz. That does not fit the current ceiling, so **the strategy for it is an open decision recorded
  in `NEXT_STEPS.md`**, not something to absorb with further bumps.

  **The guard was passing over 46 hardcoded strings, and now sees three more shapes.** Every detector so
  far only looked at double quotes, so **prose in a template literal** was invisible —
  `` title={`Delete view ${v.name}`} `` and `` showHint(`Inserted the ${p.name} map part.`) ``, 12 of
  them. `label` was never a watched prop even though it names every `<MenuItem>` and `<optgroup>`, hiding
  60 more. And `"(untitled)"` matched nothing: it opens with `(` so it isn't "capitalised", and it's one
  word so it isn't "multi-word" — it had **20 hardcoded copies**, now one `common.untitled`, the first
  entry in a shared `common.` section. Two further misses were wrapped arguments and ternary arms that
  prettier put on their own lines, where nothing precedes the quote; the `else` arm is now recognised by
  the **space before its colon**, which is how prettier distinguishes `cond ? a : b` from `key: value`.

  Two of the misses shared a root cause worth naming: **a local variable called `t` shadowing the
  imported `t()`**, in `topicLabel`, in the collapsed-branch peek and in two template loops. `t("…")` was
  literally uncallable in those scopes, so the migration passes skipped them silently and left no trace.
  All four locals are renamed — and the last one mattered, because the scripted pass had by then injected
  a `t("hint.selectTopicFirst")` call into one of those scopes, which would have thrown at runtime.

  **The editor toolbar is genuinely finished (93 strings).** It had been on the migrated allowlist since
  the 55-entry pass with a green tick it hadn't earned; it came **off** the list while the rest was done,
  because removing a file is the honest move when the guard turns out to have been blind, and adding an
  exception to keep the tick is not.

  **Budget note — the +12 kB projection above is too pessimistic, measured.** Finishing the toolbar cost
  **+0.5 kB gz** (170.1 → 170.6, still under the 171 kB ceiling, no bump needed) for 93 strings, because
  31 of its labels are word-for-word ⌘K commands and now **reuse the existing `cmd.*` key**. That deletes
  a duplicate copy of the English text and adds a shorter key in its place, so those sites are roughly
  free. The projection assumed every remaining string is new text; wherever the chrome repeats itself —
  and a toolbar mirroring a command palette repeats itself a lot — the real cost is well below it.

  **The canvas is migrated: `FlowMindMap.tsx`, 73 strings, at zero cost to the entry bundle.** Its
  catalogue is chunk-local (`mindmap/flow/messages.ts`, now 89 entries), so the three right-click menus,
  the transient hints, the branch layout/side/colour pickers and the shape toolbar all ship in the lazy
  canvas chunk. Proven in the built output rather than asserted: `"Detach to floating topic"` and
  `"Shift task dates (this branch)"` appear in `FlowMindMap-*.js` and NOT in `index-*.js`, and the entry
  chunk is unchanged at 170.6 kB. Nine labels reuse `cmd.layout.*` / `toolbar.*` keys, because a
  per-branch layout override offers the same layouts as the map-wide picker.

  Six `=== 1` ternaries became **plural messages** — "Branch copied" / "{n} branches copied", "Paste
  branch here" / "Paste {n} branches here", "by {n} day" / "by {n} days". English needs two forms and
  Slavic four; `Intl.PluralRules` picks the arm so no call site has to know a locale's boundaries.

  **Three more detectors, each added only after proving it clean on every file already on the list.**
  A *label/action tuple* (`["Copy image to clipboard", () => io.copyPng()]`) — menus built from data
  rather than JSX, invisible because the label sits behind a `[` and often opens with a `.`; the second
  member must look like a function or a number, which is what keeps `["relates-to", "depends-on"]` (ids,
  not labels) out. *JSX text between its tags* (`<MenuLabel>Arrowheads</MenuLabel>`) — the one place a
  SINGLE word is safe to flag, because `>Type</` is unambiguously rendered content while a bare "Type"
  could be an id. And a *sentence-case rule for short prose lines*: the 12-character floor existed to
  exclude `return null`, but it was also hiding `Map side`, and JS keywords are lowercase.

  Between them they found **51 more live strings in files already ticked** — Toolbar's entire export
  menu (24 format labels + 4 group headings), TopicNode's three one-time coach hints, and FlowMindMap's
  26 menu labels. The habit that keeps failing is now stated in the guard: re-verify the files already
  on the list when a detector is added, rather than trusting the tick.

  **A duplicate-text test across catalogues**, which earned its place the moment it ran: four canvas
  keys repeated messages the eager catalogue already had, and the build confirmed one of them shipping
  the same sentence in *both* chunks. Three were collapsed onto the existing key. The fourth is a real
  homonym — the layout picker's optgroup heading "Radial" names the radial *family*, the branch-layout
  option "Radial" names the layout — so it is listed as an explicit exception with its reasoning, which
  is the point: a locale that distinguishes the two senses must be able to translate them apart.

  A fifth shadowed `t` turned up in the relationship-type chips, which is why that `aria-label` had
  stayed hardcoded through the first canvas pass.

  **`App.tsx` is migrated (83 strings)** — the shell's toasts, the about dialog, the search-all-maps
  overlay, the paste-outline dialog and the skip link. It was **missing from the migration plan
  entirely** until the scanner was pointed at it. Nine more `=== 1 ? "" : "s"` ternaries became plural
  messages (`Restored {n} maps`, `Refreshed {n} roll-ups`, `{n} other maps link to this one`).

  Two judgement calls worth recording. The "select something first" family stays **one message per
  action** rather than collapsing into a generic "nothing selected": each names what the user was
  reaching for, which is the difference between a hint and a scold, and a translator needs the verb to
  inflect. And the search tooltip was a two-part string concatenation — only the sentence introducing
  the operators became a message; `tag:`, `due:overdue` and the rest stay literal, because they are
  **syntax the user types**, the same reasoning that keeps physical key names literal in the cheat
  sheet.

  Cost: **+1.2 kB gz, entry 170.6 → 171.8** against the ceiling raised to 175 for this migration.
  Unlike the toolbar's 93 strings at +0.5 kB, almost none of these reuse an existing message — there is
  no second surface saying "Couldn't access the clipboard" — which is why reuse, not string count,
  predicts the cost.

  **`Panels.tsx` is migrated (233 strings).** Outline, markers & tags
  index, relationships, agenda, maps, inbox, deck editor, power filter, version history, conditional
  styles, the topic inspector, the note editor and the sticker/marker pickers. **684 catalogue entries**
  across the two catalogues, and the scanner reports **0** hardcoded strings in all eight migrated files.

  Entry **174.1 kB gz** against the 175 ceiling — the projection recorded when that ceiling was raised
  was ~174, so it is now a *measured* ceiling with 0.9 kB of headroom rather than forward slack, and the
  note in `bundle-budget.mjs` records the loop as closed.

  **Two bugs the extraction introduced, both caught before landing.** The JSX source wrote its heading
  as the HTML entity `Markers &amp; tags`; a catalogue may not, because `t()` returns a plain JS string
  that React renders verbatim, so the panel would have displayed the entity to the user. An existing
  panel test caught it, and a catalogue-wide entity check now makes the class impossible. And renaming a
  shadowed `t` loop variable left one `{t}` behind in the JSX — caught by `tsc`, which typed it as
  "translation function is not a ReactNode".

  Three more shadowed `t` locals turned up in the tag chips, bringing the total to **seven**. Two of
  them carried hardcoded `title` templates that no detector saw, because stripping `${t}` leaves no
  capitalised word for the template rule to recognise as prose.

  The duplicate-text test paid for itself twice more. It caught four canvas keys repeating new panel
  ones — and the fix direction mattered: `Panels.tsx` is EAGER while the canvas catalogue is LAZY, so
  pointing eager code at a canvas-registered key would have thrown "no message for key" until the canvas
  chunk happened to load. They moved to `common.*` in the eager catalogue instead, which both surfaces
  can reference safely.

  **Declined, with proof: "make the ~103 locale-unsafe `toLowerCase` sites locale-safe".** The count was
  right; the framing was not. Most of those calls fold a MACHINE TOKEN — a tag name, a `KeyboardEvent.key`,
  a BCP-47 language tag — and for a machine token, locale-sensitive folding is a defect, because Turkish
  folds a dotted capital `I` to a dotless `ı`.

  The sharp end is `io/svgSanitize.ts`, which folds tag names to match `FORBIDDEN_TAGS` — a set holding
  `iframe`, `script` and `link`, every one containing an `i`. SVG is parsed as XML, which is
  case-sensitive, so `<IFRAME>` arrives with its case intact; under Turkish folding it becomes `ıframe`,
  misses the set, and **survives into the exported file**. A new regression test pins the invariant
  behaviour, and mutating the sanitiser to `toLocaleLowerCase("tr")` fails that test and only that test —
  the other seven pass, so without it the hole ships silently. Ctrl+I, `<LI>` handling and the locale
  resolver in the i18n layer itself break the same way.

  The genuine question is the smaller subset that folds *user-authored* text for search; the reasoning
  and the shape it should take if picked up are recorded in `NEXT_STEPS.md` rather than left as a
  one-line invitation to break the sanitiser.

  **The exporters and the manifest now carry the locale.** `<html lang>` in the standalone HTML, the
  slide deck and the interactive HTML, plus PPTX's run-level `lang`, are stamped from the active locale
  instead of a baked `"en"` / `"en-US"`. This is not cosmetic: `<html lang>` is what a screen reader
  uses to pick a voice and what a browser uses to hyphenate, and the PPTX run language is what
  PowerPoint uses to choose a **spellcheck dictionary** — a Danish map exported today would be read
  aloud in English and underlined in red throughout.

  Asserting today's output would be tautological with one locale, so the tests **activate a second
  locale** and assert the output follows, exercising the exact path a real language will take before
  there is one. Mutation-proven: putting `"en"` back fails them.

  The PWA manifest is the one that genuinely **cannot** follow the locale — it is baked at build time
  and read by the OS launcher before the app runs, and the spec's `translations` member is not broadly
  implemented. It gains `lang` + `dir` instead, so the launcher at least knows what language its three
  strings are in, with the per-locale-manifest answer recorded for when a second language ships.

  **The node date chip formats through `Intl`.** `formatDateShort` used a hardcoded English `MONTHS`
  table; it now uses `Intl.DateTimeFormat`, so the month NAME and the day/month ORDER both follow the
  locale — "Jun 20" in English, "20. jun." in Danish. Order is the half a translated month table would
  still get wrong, since most of the world writes the day first. The formatter is cached per locale
  because this runs once per dated node, including inside the SVG exporter walking the whole map, and
  canvas == export holds because both sides call this one function.

  **Writing it surfaced a timezone bug, and then a second one hiding behind the first.**
  `new Date("2026-06-20")` parses as UTC midnight and renders as the 19th west of Greenwich — but so
  does `new Date(Date.UTC(…))`, because `Intl.DateTimeFormat` formats in the LOCAL zone unless given a
  `timeZone`. The first draft shipped that second form with a comment claiming it was safe. It was
  caught only by checking whether the accompanying test could fail *at all*: on this UTC+1 machine it
  could not, so it was vacuous. The fix is local midnight formatted locally, and the test now lives in
  its own file with `process.env.TZ` set to `America/New_York` — where it fails against BOTH wrong
  forms and passes against the right one.

  **The OOXML exports are pinned against non-Latin text — and the "font" half of that backlog item was
  overstated.** Whether PowerPoint substitutes a CJK face for Calibri is a rendering decision inside
  Office that nothing here can observe; both apps do glyph fallback, and the empty `<a:ea>`/`<a:cs>`
  theme slots the note pointed at are what Office's own stock theme ships.

  What *was* unguarded is the part that can fail silently and completely: these writers build XML by
  string concatenation and hand it to fflate, so a mis-encoding would yield a file that opens to
  mojibake or refuses to open — and every fixture in `pptx.test.ts` and `xlsx.test.ts` was ASCII. A new
  test pushes CJK, Arabic, Hebrew, Cyrillic, Greek, an emoji (a surrogate pair, the case a naive
  per-charCode escaper splits in half) and raw markup characters through both exporters. Today's code
  passes; mutating the escaper to drop non-ASCII fails all three cases.

  **Correction: this work was briefly summarised as "the chrome migration is complete". It is not.**
  Eight files were migrated — the eight biggest — and that claim was made without scanning the rest of
  the tree. Scanning all 241 source files reports 768 hits across 101: roughly **490 are genuinely
  unmigrated chrome** (`MapPanel` 67, the Start screen ~103, `FindReplaceOverlay` 26, `EdgeInspector`
  25, `ThemeDesignerDialog` 24, and a long tail), 207 are the sample maps' own CONTENT — a separate
  decision from translating chrome — and ~71 are false positives the scanner produces on its own
  catalogue and on the XML/SVG-building exporters. The breakdown is in `NEXT_STEPS.md`.

  Worth recording because it is the same failure the whole programme kept finding, committed once more
  at the summary level: a tick that claims coverage nobody measured. Point the scanner at a file before
  calling it clean.

  **The migration continued on `i18n/complete-migration` (11 batches).** The canvas chunk, the Start
  screen, the theme designer, presentation mode, the eager inspectors, the panel labels, the stickers
  and the eager hook tail are migrated — roughly 750 strings into five chunk-local catalogues. Scanner
  hits across the whole tree went 768 → 405, and the two numbers are only comparable because three more
  detectors landed in between; the count rose to 1001 when they did. What remains is 213 declined map
  content, 46 catalogues quoting their own English (a permanent false positive), 68 in the XML-building
  exporters, 15 blocked on a decision, and ~63 real chrome in a long tail.

  **Three tools were built because the gate could not see this work.** The migration is observationally
  a no-op — every string comes back identical in English — so a passing suite proves nothing about it.
  A **pseudo-locale harness** overlays catalogues via `registerMessages` and renders components under
  markers, which catches an unmigrated string as text that failed to change. Adding it immediately found
  two. The **detectors became one shared module** (`scripts/lib/i18nDetectors.mjs`) so the guard test and
  the tree-wide scanner cannot disagree; each new detector had to run clean over every already-migrated
  file before being added, and the three that landed exposed 85 strings previous batches had ticked off.
  And the catalogue tests now walk N catalogues pairwise, fail on dead keys, catch HTML entities
  captured from JSX (`Find &amp; replace` would have shipped verbatim), and reject a lazy chunk
  referencing another lazy chunk's key — which throws on first use.

  **A trap found at the end, and pinned rather than fixed.** `t()` reads the active locale *at call
  time*, so a call at module scope freezes its string at import. 194 of the migrated strings are that
  shape. They are all correct today — nothing calls `setLocale` outside tests — and all of them stop
  being correct the day a language picker ships, quietly: the app switches locale and the panel tabs,
  slash commands and edge presets stay English. An AST walker now counts them (a regex cannot tell
  module-scope `{ label: t("x") }` from the identical text inside JSX), a test proves the mechanism in
  both directions, and a per-file ratchet stops the count growing. The fix is 194 behaviour-neutral call
  sites and wants its own review; it is decision 4 in `docs/I18N_BLOCKED.md`.

  **`scripts/size-budget.mjs` was measuring a subset of first load.** It weighed `index-*.js` only, but
  Vite emits `<link rel="modulepreload">` for shared eager chunks and the browser fetches those on first
  paint too. So the gate reported a 10.5 kB *improvement* (168.5 → 158.0) for a change that added 141
  catalogue keys — 16.6 kB had moved sideways into `primitives-*.js`. It now computes and prints true
  first load (180.0 kB against a 175 ceiling), and still gates on the old metric deliberately: the true
  figure was already over before this work started, so flipping it silently would read as a regression
  this branch caused. Decision 3 in `docs/I18N_BLOCKED.md`.

- **Fixed: the import toast lost its full stop on success, and a post-merge audit found 21 more
  latent defects.** A 6-lens adversarial hunt over the merged migration raised 25 candidates; 21
  survived a verifier instructed to refute them. Only one was live in English: the migration moved the
  sentence terminator off `hint.importedMaps` and onto `hint.importFailedSuffix`, so a clean import
  rendered "Imported 3 of 3 maps" unterminated while a failed one ended in a stop — from the same
  toast. The fix interpolates the parenthetical *inside* the frame (`…maps{failed}.`), which is what
  the `hint.rollupsRefreshed`/`hint.rollupsMissing` pair three entries below already did correctly;
  concatenating the suffix on the outside can only ever terminate one of the two branches. **No test
  in the repo mentioned either key** — which is why it survived the whole migration — so the fix ships
  with a composed-message test asserting both branches, mutation-proven by reverting it.

  The other 20 are **all latent**: `LOCALES` is `["en"]` and `Locale` is typed off it, so none is
  visible today and all arm on the commit that adds a second entry. They are catalogued in
  `NEXT_STEPS.md` rather than fixed here. The two worth naming: `FlowMindMap`'s canvas context menu
  looks its keyboard hints up in a table **keyed by English display text** while the labels are now
  `t()` results — a fifth instance of the "a label is not an identity" defect already fixed four
  times, verified by rendering the menu under a non-English overlay and watching all six hints vanish;
  and `StartScreen.tsx`'s ten section headings **were never migrated at all** despite the file being
  added to the guard's allowlist, which is the "the allowlist certifies against the detectors, not
  against reality" warning coming true in the same programme that wrote it down.

- **The frozen-`t()` ratchet is closed: 145 → 0 (decision 4 in `docs/I18N_BLOCKED.md`, now resolved).**
  Every remaining module-scope `t()` call — the ones that resolve once at import and can never follow a
  later `setLocale` — turned out to be the same shape across all 17 files: an array or object literal
  with one identity field (`id`/`kind`/`key`/`href`/`w`/`d`/`a`/`value` — never a `t()` call, always what
  callers key React lists and compare on) and one display field (`label`/`name`/`title`/`body`/`tab`/
  `menu`) that was the frozen call. Every display field became a getter (`get label() { return
  t("…"); }`); every identity field was left untouched. That makes it a true drop-in fix — a getter is
  read exactly like a plain property, so `PANEL_LABELS.outline.tab`, `SHAPE_ITEMS[i].name` and every
  other call site across `App.tsx`/`Toolbar.tsx`/etc. needed zero changes, closing the call-site-churn
  concern the original write-up worried about.

  **One real bug fell out of the sweep.** `CaptureCard.tsx`'s three suggested-prompt buttons keyed their
  React list on the translated text itself (`key={ex}`) — the identical "translated label used as
  identity" defect already fixed once for Toolbar's last-export id and Recent's date buckets, just not
  yet found here because the array was still frozen (so the text never actually changed, and the bug
  never fired). Converting it to a live function surfaced the key bug in the same motion; it's now
  `suggestedExamples()` returning stable `{ id, text }` pairs, keyed on `id`.

  `test/i18n-frozen-ratchet.test.ts`'s BUDGET is now `[]` — its three checks (no file over budget, no
  new file, total non-increasing) still run, so a reintroduced frozen call is caught rather than
  silently re-widening the table. `test/i18n-frozen-constants.test.ts`'s PANEL_LABELS test flipped from
  pinning the defect on a real file to a CLEARANCE test proving it now follows a locale change —
  mutation-proven by reverting one getter back to a plain field and watching both that test and the
  ratchet's three fail, then restoring.

- **The blindspot residue is closed: 82 → 8, and every one of the 8 is genuinely literal.** Roughly 70
  strings across `Panels.tsx`, `App.tsx` and a dozen Start-screen files were sentences a JSX element or
  a computed suffix had cut in half — the exact class no line-based rule can ever match, because there
  is no single line containing the whole sentence to check. `tNodes` handles the ones with a real React
  node embedded (`◎ Focusing branch: <strong>{topic}</strong>`, the paste-outline explainer with two
  `<code>` spans); a plain `t()` with a placeholder handles the rest (`Import failed: {error}`, the
  progress-bar summary, the multi-select banner).

  **Two more classes of hardcoded literal, found only by reading every remaining line by hand:**
  - **A ternary as a bare JSX child** — `{cond ? "Word" : other}` with no surrounding prop — matches
    nothing in the guard, which only checks props and text between two tags. Six sites: "Hide" vs
    `t("hint.showAll")`, "Pause"/"Play", "Relationship" vs a `t()` call, "Rename"/"Create",
    "Expand"/"Collapse", "Find" and "Layout" (the last two inside a ternary sharing a slot with `t()`,
    which is exactly why the shape hides — half the ternary already looked migrated).
  - **A widening `loneJsxTextViolations` needed anyway**: its leading-character check was still the
    OLD fixed glyph set (`[A-Z＋✕←→‹›▦☰⏸▶↺−+]`) that `jsxTextViolations` had already moved past for the
    single-line shape — so `⤢ Open in dock` and `☑ List` were invisible on the multi-line wrapped-tag
    shape even though the identical text one line shorter was already caught. Same fix, same file,
    applied to the twin rule; verified clean against every allowlisted file before landing.

  **Two dead catalogue keys got real callers.** `count.topics` and `count.nodes` and `count.maps`
  existed already, unreferenced, built for call sites that ended up hand-rolling
  `{n} topic${n === 1 ? "" : "s"}` instead — three separate places, none of them talking to each other.
  Wiring them up is a correctness fix as much as a translation one: `AllMaps.tsx`'s node count never
  pluralised at all before this (always "nodes", even for one).

  **Found a second `&amp;` entity bug, same class as the About panel's.** `StartSidebar.tsx`'s
  "Local &amp; private…" was still raw JSX text (not yet a `t()` string), so the entity currently
  renders correctly — but migrating it verbatim would have shipped the second instance of exactly the
  bug already fixed once. Written with a real ampersand.

  **My own AST probe had a bug**, found while explaining away what looked like a false hit: for a
  template-literal prop it read `e.getText()` — the raw SOURCE including the `${…}` code — instead of
  the static text around the interpolations, so a function name like `timeAgo` inside one counted as
  if it were prose. Fixed to walk the template's own `head` + span structure, the same static-vs-dynamic
  split the real detector's regex achieves for the non-AST case.

- **Fixed: "last used export" could silently stop working forever after a locale change, plus five
  more defects in the same file, none caught by any existing detector.** `Toolbar.tsx` persisted the
  export menu's *rendered label* as its identity key (`localStorage["mindmap-last-export"]`) and
  matched it back with `lbl === last` — the comment even called the label "the stable id". A label is
  not an identity: the moment a second locale existed, a stored English label would stop matching any
  current (now-translated) entry, and the "Last used" row would just never appear again for that
  install. Every export item now carries a real id alongside its label; the id is what's persisted,
  matched and used as the React key (which was also reading the translated label). Guarded by a test
  that exports in English, switches to a second locale, and proves the pinned row still resolves and
  re-fires the same format — mutation-checked by reverting to label-keying, which fails it exactly as
  predicted.

  Found in the same file while fixing that: **two JSX-text sentences no rule can see** (`Import
  files…`, `Image on selected node…` — plain text following a self-closing icon on the same line,
  which matches none of the `>text</` shapes any detector looks for) and **a "File" heading** split by
  a computed suffix (`File{io.fileName ? … : ""}`). And **six menu triggers said their own word
  twice**, hardcoded both times: once as a plain string argument to `menuTrigger("icon", "Word", …)`,
  again inside `triggerAriaLabel={isMobile ? "Word" : undefined}` for the mobile screen-reader label.
  Neither shape matches anything in the guard — a bare string argument isn't the two-argument
  `add(id, "Label", …)` pattern, and `prop={ternary}` has no literal for the prop-literal rule to find.
  All six now reuse the existing `toolbar.trigger.*` / `common.view` keys already used by the same
  button's tooltip, so the visible label, the tooltip and the screen-reader label can't drift apart.

- **Import failures and exported chrome are translatable (~65 strings).** Every adapter under `io/`
  reported its failures in hardcoded English — and those are not internal diagnostics: `App.tsx`
  renders `err.message` verbatim into the error banner, so "Not a valid .mup file" is copy. The
  interactive-HTML and slide-deck exports also baked their own controls in ("Expand all", "‹ Prev",
  the footer), and those files are opened later or sent to someone else, so they are as much product
  as anything on the canvas. Format names, extensions, XML element names and internal paths stay
  literal — they are tokens, not words.

  They live in a sixth catalogue, `src/io/messages.ts`, and getting that right took three attempts —
  each caught by the size gate, none by review:

  1. The premise was wrong. "Every adapter is behind a dynamic `import()`" is false for ten of them;
     `App.tsx` and `useMapExports` import `attachment`, `image`, `importDispatch`, `library`,
     `fileSystem`, `json`, `mermaid` and more *statically*. Each `import "./messages"` from those
     dragged all ~60 keys into the entry chunk: **+1.3 kB, gate red**.
  2. Deferring `importDispatch` looked like the fix — entry fell **10.9 kB**. True first load went
     **up 0.2**. The weight moved into a preloaded sibling; under the old entry-only metric this would
     have been recorded as a 10.9 kB win. It was reverted.
  3. The actual fix: eager files' keys moved to the eager catalogue, the twelve per-format "what this
     import loses" notes load on demand inside `parseImport` (already `async`), and three eager files
     were importing the catalogue **without using a single key from it**. First load: **181.2 kB**,
     flat against the 181.1 baseline despite the ~65 new strings.

  **`test/i18n.test.ts` now guards it**: a static-import walk from `main.tsx` fails if any eagerly-
  reached file imports a lazy catalogue. It found two flaws in itself first — it matched a comment
  *quoting* the import it warns against, and flagged `keys.ts`, whose `import type` erases at build
  time and is the whole point of that file. Mutation-checked against the exact defect that broke the
  budget.

- **The layout picker, marker groups, sticker headings, priority levels and line presets were never
  translated — and no check could see them.** ~30 strings that were raw English literals rather than
  `t()` calls, so the scanner, the blind-spot probe and the frozen-`t()` ratchet all scored the files
  **0** while the layout gallery rendered "Radial / hub" in every locale. Nine of the eleven layout
  names already had `cmd.layout.*` keys from the command palette; they now share them.

  **Identity split from label everywhere it mattered.** `Sticker.category` is a discriminator, a React
  key *and* a heading; `MARKER_GROUPS.id` and `PRIORITY_LABEL`'s numeric keys are looked up. Those stay
  literal; only the rendered name follows the locale — the same rule the `Recent.tsx` fix established
  after keying on a translated label would have made maps disappear.

- **Nine React keys were the rendered label; six were already locale-dependent.** `AppTips`,
  `Learn`, `BranchExportDialog` and `ShortcutsDialog` keyed on titles that were *already* `t()` results,
  so a language change would have remounted those subtrees — losing focus on the interactive tip button
  — and crashed outright on any two labels that collide in a target language. All now key on stable ids.
  This had to land **with** the item above: migrating those labels first would have converted the three
  remaining latent cases into live ones.

- **Three module-scope derivations would have silently re-frozen.** `MapPanel`'s `LAYOUT_NAME` and
  `Kanban`'s `SOURCES` materialised their inputs at import, so making the underlying labels live would
  have been undone one line later — while the ratchet reported 0, because it counts `t(` calls and
  those tables contain none. Both are functions now. The frozen budget also drops 194 → **145**.

- **The relationship filter showed raw ids, and the status bar had a hand-rolled English plural.** The
  Relationships panel's type dropdown rendered `relates-to`, `depends-on`, `causes`, `supports`,
  `blocks` — the literal option *values* — while `EdgeInspector` showed proper labels for the same five.
  And the canvas status bar carried `{n} topic{n === 1 ? "" : "s"}`, which is precisely the shape
  `i18n/registry.ts` cites as the reason plural messages exist: English needs two forms, Slavic four,
  Arabic six, and a ternary can only ever express two. Both now go through the catalogue; the English
  output is byte-identical for every count.

  Both were sitting in the "legitimately literal" bucket of my own triage, and both were found only by
  opening the file. That bucket is where defects hide, because it is the one nobody re-opens.

- **`pnpm i18n:blindspot` makes the floor visible.** `i18n-scan` is regex-over-lines by design — it has
  to run on any file without a parse step and be quiet enough that nobody switches it off — so "0
  hardcoded strings" has always meant "0 that these rules can see". The gap between those two has been
  the most repeated failure in this migration. The new script walks the TypeScript AST, reports every
  JSX text node and user-facing prop, and subtracts what the detectors already report. It defaults to
  **allowlisted files only**, because an unmigrated file full of English is expected whereas an
  allowlisted one is the gate telling a lie. It is deliberately noisy and gates nothing: a worklist,
  not a check. Currently **85**.

- **"Clear all local data" was missing seven preference keys.** `LOCAL_PREF_KEYS` claims to centralise
  every preference the app writes, so that one action can wipe them all — but `mindmap-contrast`,
  `-info-tab`, `-last-export`, `-layout`, `-minimap-open`, `-search-history` and `-sticky-color` were
  never on it. They survived the wipe and never travelled in a settings file.

  The list had drifted because nothing checked it: the existing test writes the keys the list names
  and asserts those get cleared, which is true of **any** list, including a wrong one. It now derives
  the truth from source instead — every `"mindmap-*"` literal in `src/` must be either a declared
  preference or an explicitly documented non-preference, so a new key cannot appear without a decision
  about which it is. Four are documented as not-storage: the IndexedDB database name, two
  file-format `kind` markers, and a BroadcastChannel name.

  Two of the seven deliberately do **not** travel between machines, following the rule already in
  `settingsFile.ts` that usage history stays put: `mindmap-search-history` is the user's own search
  terms, which should not leave the machine inside a file they might hand to someone else, and
  `mindmap-last-export` stores the export menu's *label* as its identity key — so on a machine running
  another locale it would not match anything anyway.

- **The string detectors could not see three whole shapes, and 56 strings were hiding in files the
  allowlist had already certified clean.** An independent AST sweep — deliberately not built from the
  detectors' own rules — found 149 candidates inside allowlisted files; 56 were real. Three blind spots,
  each fixed by anchoring on *structure* rather than on what prose looks like:

  - **A leading glyph stopped a label being a label.** The JSX-text rule required `[A-Z]` immediately
    after the `>`, so every emoji-prefixed heading was invisible — `🔗 Relationships`, `📊 Map
    statistics`, `🗓 Agenda`, `▦ Board`, `＋ New`. That is the house style for panel headings, not a
    rare shape. The glyph now stays inline in the JSX and only the words move into the catalogue, so
    the fixed form doesn't fire either.
  - **Parentheses were treated as code.** `Presenter view (P)`, `Exit (Esc)`, `Read (PDF)` all slipped
    through. Safe to allow here because that rule is anchored on the surrounding tags.
  - **A user-facing prop could hide in a template literal.** `templateViolations` needs a capitalised
    word followed by a lowercase one, which `` `Apply "${s.name}"` `` never is once the interpolation
    is blanked. Anchoring on the *prop name* makes a single word enough. `Panels.tsx:1285` had
    `` title={`Rename / merge "${key}" — …`} `` whose own `aria-label`, on the same element, was
    already a `t()` call.

  The narrowing that keeps it honest: a **machine-token cheatsheet is not prose**. The search box's
  tooltip lists `tag:foo  marker:flag-red  priority:1` — syntax the user types, where translating would
  break the feature. Two or more `word:value` tokens with no space after the colon is the signature;
  `Relationship: ${label}` still gets caught. Both directions are pinned as unit tests.

  The scanner total went **401 → 410** despite 56 strings being paid, which is the honest arithmetic of
  widening a detector: it found more than it fixed. Every new detector in this programme has done that.

- **Fixed: Recent's date buckets could have taken your maps off the page.** The Start screen's Recent
  section keyed its buckets by the *rendered label* — `GROUPS` held `t("start.earlierThisWeek")` while
  `groupOf()` returned the English literal `"Earlier this week"`. Those agree only while the catalogue
  is English; under a second locale the lookup stops matching and three of the six sections — **with
  every map inside them** — vanish. That reads as data loss, not as a translation glitch. Buckets are
  keyed on stable ids now and labels resolve at render. The type system could not have caught it:
  `t()` returns `string`, so the old `type Group` collapsed to `string` and `groupOf` was free to
  return anything; the ids make it a real union. `"Today"`, `"Yesterday"` and `"Older"` were also
  hardcoded English here and are now catalogued.

- **The locale is resolved before the eager import graph, not after it.** `main.tsx` called
  `initLocale()` in its body, below `import { App }` — and ES imports are hoisted, so the whole eager
  graph had already evaluated its module-scope `t()` calls against the *default* locale. 99 of the 194
  froze before resolution ever ran. The call now lives in the `src/i18n` barrel body, which makes it
  order-independent; an `import "./init"` above `import { App }` would have looked equivalent and been
  silently undone by biome's import sorting.

  **This also corrects the documented story, in the dangerous direction.** `docs/I18N_BLOCKED.md` said
  the frozen strings were "currently correct" because the registry resolved the locale first, and that
  they arm "the moment a language picker ships". Neither was true. The trigger is **`LOCALES` gaining a
  second entry** — `resolveLocale()` reads `navigator.languages`, so the day a second catalogue ships a
  Danish browser gets a half-English first paint with no user action at all.

- **`stickers.ts` and `slashCommands.ts` follow the locale (34 sites).** Converted to getters, which
  cost no call site anything — both have zero consumers outside their own module. The frozen budget
  drops 194 → 157. A clearance test pins one eager and one lazy module actually following `setLocale`,
  since they freeze at different times and an eager-only test would pass while every lazy chunk stayed
  broken. **Deliberately not a 23-file sweep:** the detector counts `t(` calls, so a module-scope
  derivation that materialises its inputs is invisible to it (`MapPanel.tsx:112`, `Kanban.tsx:27`,
  `icons.ts:116`), and the layout and marker-group names those tables carry are raw English literals
  scoring 0 everywhere. Emptying the table while the layout picker still reads "Radial / hub" in Danish
  would be the same green-tick-that-measured-nothing pattern.

  **Checked and cleared:** module-scope *collation* was suspected as a second family of the same bug.
  An independent AST scan found zero — `collator()` builds a fresh `Intl.Collator(active, …)` per call.

- **Fixed: the About panel rendered `Book &amp; docs`.** `t()` returns a plain string, and React
  *escapes* a string child — unlike JSX text, which the compiler decodes. So an `&amp;` captured from
  the JSX source during extraction shipped verbatim to the Start screen's licence line. The catalogue
  test written to catch exactly this had been iterating **two of the five catalogues** while its
  comment said "EVERY catalogue in the app", and the entity check did not even use that array — it
  spread the same two inline. 171 keys, 14% of the corpus, sat outside every check. Widening it to all
  five turned the test red on the real defect, which is how the list was found to be wrong; it also
  surfaced **10 cross-catalogue duplicates**, now collapsed onto the eager key (a lazy chunk may
  reference an eager key, never the reverse), including a new shared `common.delete` for the three
  lazy catalogues that each had their own "Delete".

- **`NEXT_STEPS.md`'s i18n status is measured again, and says what the numbers are worth.** It had read
  "684 catalogue entries across eight migrated files" and "entry bundle 174.2 kB against a 175 ceiling"
  for sixteen commits after each stopped being true — branch-point values left behind while the work
  moved on, and "eight migrated files" was the exact phrasing of the retracted completeness claim that
  section exists to correct. Measured: **1214 entries across five catalogues, 62 files on the
  allowlist, 180.3 kB first-load against 182**.

  Two corrections beyond the arithmetic. The `src/io/` bucket was labelled "mostly XML/SVG markup the
  template rule reads as prose" — **one** of its 68 is markup; 37 are error messages shown to the user
  verbatim and 15 are UI labels compiled into exported HTML, so it is real work, not noise. And the
  scanner total is now stated as a **floor**: an independent AST sweep found ~113 further real strings
  *inside already-allowlisted files*, because the detectors need a leading `[A-Z]`, skip lines
  containing `(`, and cannot see a sentence a JSX element has cut in half. Being on the allowlist means
  clean by the scanner, not clean.

- **Example-map notes no longer name chrome controls.** The sample maps stay English by decision, but
  a note saying "Open the Outline panel" or "open 📝 Notes or 🏷 Markers from the toolbar" names a
  control that will not be called that once the chrome is translated — so the sentence stops being
  untranslated and starts being *wrong*, which in example content reads as the app lying to a new user
  rather than as a missing translation. Six strings reworded to describe the action and keep the
  **glyph** as the finding aid: 🔗, 🧲, 📝, 🏷 and ↓ are not translated, so they point at the right
  control in every locale. Nothing moved into a catalogue — the copy is still English.

  Audited all three content files rather than the ones already known: `templates.ts` has zero. Left
  alone on purpose, and recorded as such: "switch the layout to right-only" (describes the result; the
  label is "Right") and the "Link me to your … map" topic texts (ordinary verb, not a quoted label).

- **`build-stats.mjs` refuses to blank the dashboard's coverage figure.** Every coverage number it
  writes comes from `coverage/coverage-summary.json`, and without that file its `safe()` guards
  degrade to `null` rather than failing — right for a fresh checkout, wrong for a re-run in a repo that
  already has real numbers. Running the script on its own silently replaced `lineCoveragePct: 90.1`
  with `null`; the dashboard then renders "—" and the stats contract test fails with nothing pointing
  at the cause. It now exits non-zero and writes nothing in that case. This deliberately narrows the
  `continue-on-error` on the stats workflow's test step: a flaky test still produces partial coverage
  and refreshes fine, but a run that produced no coverage at all no longer overwrites good numbers.
  Not refreshing beats corrupting.

- **The bundle gate now measures what a browser actually downloads.** It weighed `index-*.js` and
  called that "the initial bundle", but Vite emits `<link rel="modulepreload">` for shared eager chunks
  and the browser fetches those on first paint too. The gate filed them as lazy and stopped counting —
  so it once reported a 10.5 kB *improvement* (168.5 → 158.0) for a change that added 141 catalogue
  keys, because ~16.6 kB had moved sideways into `primitives-*.js`. A ceiling you can satisfy by
  relocating weight is not a ceiling, and the failure looks like progress in CI.

  `BUDGET_KB` is re-based 175 → **182** against the new metric (measured 180.3). **The number going up
  does not mean anything got slower** — the ruler got honest; the true figure had been above the old
  ceiling since before the i18n work started. 182 rather than a rounder 185 because ~4.7 kB of
  unguarded slack is the exact risk the previous bump's own note warned about, and a thin margin cannot
  flake here the way the coverage floor does — this figure is deterministic.

  The measurement moved into `scripts/lib/firstLoad.mjs` because `build-stats.mjs` computed its own
  `withinBudget` from the entry chunk: left alone, the dashboard would have reported green against a
  ceiling it was interpreting differently — the drift `bundle-budget.mjs` exists to prevent, one level
  up from the constant. `test/first-load-budget.test.ts` pins the definition.

- **Sentences that interleave prose with markup are one message again (`tNodes`).** `Press
  <kbd>Tab</kbd> for a child` used to be three JSX fragments in a fixed order, which a translator
  cannot reorder — and most languages need to. German moves the verb, Japanese puts the particle after
  the key name. Worse, the fragments were individually meaningless: "Press" alone has no single correct
  rendering. `src/i18n/nodes.tsx` keeps the sentence whole and resolves `{child}` to a React node, so
  the `<kbd>` styling survives and the word order belongs to the locale. Key names stay literal —
  `Tab` denotes a physical key, not a word.

  The shape turned out to live in **three** files, not the one the blocked-decisions doc named:
  `CanvasOverlays` (both the pointer and touch coachmarks), `FirstRunCard` (five list items, `<strong>`
  as well as `<kbd>`) and `CaptureCard`.

  **Neither the scanner nor the harness could see it, in opposite directions.** No detector matches a
  sentence a JSX element has cut in half, so once `<kbd>` contents were exempted as key names all three
  files reported *zero hardcoded strings* while their prose was still hardcoded — a clean tick over an
  unmigrated file. And the pseudo-locale harness wrapped each message in `⟦…⟧` as a whole, so once
  `tNodes` split a message across sibling text nodes every interior run came back unmarked and was
  reported as hardcoded; it now marks each segment. Both were found by rendering the real components,
  not by review. Two more strings surfaced the same way: `DropLabel` shadowed the imported `t` with a
  local (so its label could not be migrated without a silent runtime error), and `"3 things to try"`
  slipped the JSX-text rule because that rule needs a leading `[A-Z]` and `3` is not one.

  The harness also only overlaid 2 of the 5 catalogues. That is not a coverage gap but a correctness
  one: a component using the Start catalogue would have had all its strings reported as unmarked, and
  the natural response — adding them to the ignore list — would have taught the harness to lie.

- **Export / import your preferences (closes the settings-export residual).** The app has no account,
  so preferences live in this browser and stop there — and saved Power-Filter presets are deliberately
  app-wide rather than stored on a map (see the item-33 note below), which means moving machines used to
  lose them. Settings ▸ **Preferences file** now writes them to a small JSON file and reads one back:
  saved filter presets, custom themes, named styles, panel layout, canvas + app theme, and the
  accessibility preferences. Two things are deliberately excluded — the branch clipboard (a copied
  subtree, not a setting, and potentially large) and the ⌘K recents (this machine's own usage history).
  Import **only replaces the keys the file contains**, so a partial file can't clear a preference it
  never mentioned, and it confirms with a count before reloading. Maps are never touched.

  A settings file is untrusted input, so import is **allowlisted twice**: `parseSettingsFile` keeps
  only known preference keys with string values, and `applySettings` filters again on the way out.
  Without that, an arbitrary `prefs` map in a downloaded file could write any localStorage key in the
  origin.
  Verified in a real browser as well as in tests: a hostile file's extra key is not written.

### Changed

- **The last two `execCommand` calls are gone — lists are selection-based too.** Item 25 left the
  bulleted/numbered list buttons on `document.execCommand` behind a `listFallback()`, on the grounds
  that list toggling is a rich-text-engine problem. That deferral was overweighted, and two facts about
  *this* editor are why. The markdown subset behind the Notes panel is **flat** —
  `noteFormat.serializeList` reads only the *direct* `<li>` children of a list, so nested lists aren't
  representable and were never a requirement. And splitting an item on Enter or merging on Backspace is
  native `contentEditable` behaviour, not something `execCommand` supplied. That left only the toggle,
  which `richTextCommands.toggleList` now does in three cases: already a list of this kind → unwrap;
  already the other kind → retag the container (bulleted ↔ numbered); otherwise → wrap each covered
  line in an `<li>`. A block's *contents* are lifted into the item rather than nesting the wrapper,
  since `<li><div>x</div></li>` serialises with a stray blank line. Verified in a real browser as well
  as in tests, including a markdown → render → toggle → markdown round trip. One documented limit:
  unwrapping a *subset* of a list's items lifts them out above the list rather than splitting it in
  place, so a partial toggle-off can reorder items; toggling a whole list off is exact. `src/` now
  contains no `document.execCommand` call at all.

- **Saved views travel with the map (backlog item 33).** A saved view captures a viewport, a
  drilled-in topic **id** and the active Power Filter — all meaningless outside their own map — yet
  they were persisted per-browser under `mindmap-views:<map id>`, so they didn't survive a
  `.json`/`.mmst` export, never reached a second machine, and vanished with a cleared library. They
  now live on the document (`meta.savedViews`) and are written through the canvas like any other
  map-meta change, so adding or removing one is undoable and autosaved. Views left in localStorage are
  folded into the doc once, on next open, keeping the doc's own copy of any same-named view; the old
  key is then dropped. `FilterCriteria` and `SavedView` moved into `model/types.ts` (they're part of
  the persisted schema now) and are re-exported from `filter.ts` / `savedViews.ts`, so no import site
  changed.

  **Saved *filters* deliberately stay in localStorage**, contrary to how the backlog item was written.
  Their criteria are entirely generic — text, markers, tags, due, priority, completion, relationship
  direction and type, with no map-specific ids — and they're documented as reusable across maps.
  Moving them onto a document would have *removed* that reuse, turning a working feature into a
  per-map one. The genuine gap there (reaching a second machine) wants a settings export, not doc meta.

- **Rich-text editing moved off the deprecated `document.execCommand` (backlog item 25).** Bold,
  italic, underline, strikethrough, text colour, plain-text paste, link insertion and block/heading
  formatting are now selection-and-Range based, in one new tested module (`src/richTextCommands.ts`)
  shared by the Notes panel and the inline topic editor. `execCommand` has no specification, no
  replacement API and inconsistent behaviour across engines; it was reached for in five places across
  two editors. The commands emit **semantic tags** (`<b>`/`<i>`/`<u>`/`<s>`, `<a>`, `<h1..3>`, a
  colour `<span>`) — exactly what the old `execCommand("styleWithCSS", false, "false")` call was
  asking the browser for — so the markdown serialiser still sees the tag family it understands. That
  serialiser is also what makes the change testable: both editors round-trip through `htmlToNote`, so
  the tests assert the **markdown each command produces** rather than DOM shape (jsdom doesn't
  implement `execCommand` at all, so the old path could never be tested directly).

  **The two list commands deliberately stay on `execCommand`**, isolated behind a single
  `listFallback()`: list toggling is a genuine rich-text-engine problem (splitting blocks into items,
  merging adjacent lists, nesting) and a shaky reimplementation would regress a working editor. The
  deprecated surface is now one call in one file instead of five across two.

  One deliberate behaviour change: formatting now requires a **selection**. `execCommand` armed a
  "typing style" so the next typed characters came out bold; there's no standards-track way to
  reproduce that. Two bugs were caught during the work — a real-browser check (not jsdom) found that
  select-all over already-bold content double-wrapped to `<b><b>…</b></b>` instead of toggling off,
  because an ancestor-only lookup misses the case where the common ancestor *is* the editor root; and
  formatting a partly-formatted run nested the same tag. Both fixed and pinned.

### Fixed

- **The XMind round trip no longer loses half the map (backlog item 34).** The `.xmind` writer already
  emitted floating topics as `children.detached` and relationship arrows as sheet `relationships` —
  but our own importer read neither back, so exporting to XMind and reimporting silently dropped every
  floating topic and every cross-link. Per-topic **markers** and **styling** dropped in *both*
  directions. All four now survive: markers translate through a new XMind marker vocabulary
  (`priority-3`, `task-done`, `flag-red`…) built on the same many-to-one map + curated inverse the
  `.mmap` writer already uses, so an emoji XMind has no equivalent for is skipped rather than emitted
  as a junk id, and an unknown incoming id is kept as a visible glyph instead of vanishing. Those
  tables live in `io/xmind.ts` rather than beside the MindManager pair in `icons.ts`, because
  `icons.ts` is in the eager entry chunk while the format adapters are lazy — keeping them next to
  their only caller held the initial bundle flat at 164.0 kB. Styling maps
  to XMind's XSL-FO/SVG property bag (`svg:fill`, `fo:color`, `fo:font-family`, `fo:font-size`,
  `fo:font-weight`, border colour + width). Relationships reference topic ids while the importer mints
  its own, so the walk now threads an original-id → new-id map and resolves both endpoints through it —
  a relationship whose ends don't both resolve is dropped rather than left dangling. The legacy
  (pre-2020) `content.xml` path gained `marker-refs`, detached topics and relationships too. Point/pixel
  conversion is deliberately unrounded: rounding to whole points grew a 2px border to 3px on every
  round trip (caught by the round-trip test, which now pins it). Still lossy by design, and now said so
  in the header: legacy per-topic *style* lives in a separate `styles.xml` keyed by style-id, and XMind's
  line/shape/branch styling has no counterpart in our model.

- **Non-Latin topic text no longer overflows its box or its export.** Every width estimate on the
  canvas and in the SVG exporter was a character count times a Latin-calibrated constant, so a
  full-width glyph was charged about half the space it occupies. Measured against the app's own font
  stack, CJK is exactly **1.000em** against the assumed 0.55: exported Japanese ran **75%** past its
  node box (Chinese 60%, Korean 38%), and the layout reserved **43px where the browser rendered 65px**,
  so CJK topics overlapped their neighbours. `flow/text.ts` now charges each code point a per-script
  advance via a new shared `widthUnits()` — full-width forms (CJK, kana, Hangul, fullwidth) at 1.000em
  and emoji at their real 1.373em, everything else narrow. Cyrillic (0.52), Hebrew (0.51), Greek
  (0.49), Vietnamese (0.49), Thai (0.47) and Arabic (0.43) all measure *under* the existing 0.55 bound,
  so one narrow class still covers every alphabetic script. `widthUnits()` is a drop-in for
  `string.length` at all seven width sites (`layout.ts`'s box estimate and the exporter's callout,
  boundary, summary, priority, date and attachment heuristics): pure-ASCII input returns exactly
  `s.length`, so Latin geometry — and the byte-identical export snapshots pinning it — is unchanged.
  The wrap also iterates by **code point**, so a hard split can no longer cut a surrogate pair in half
  and emit lone surrogates into the SVG (reachable with the emoji markers the app ships). One
  deliberate geometry change: the 📅 and 📎 export chips were sized as two narrow characters against a
  real 1.373em advance, and are now correspondingly wider — pinned by a test so it can't drift back.

- **Map titles keep their own script when downloaded.** The Start-screen "Export" ran the title through
  an ASCII-only slug (`/[^a-z0-9]+/g`), so `Årsplan for Ø-teamet` downloaded as
  `rsplan-for-teamet.json`, `Produktübersicht` as `produkt-bersicht.json`, and a Japanese or Arabic
  title lost every character and fell back to `map.json`. That was one of *three* different filename
  policies in the codebase. They now share one — `io/fileName.ts`'s `safeFileStem()`, which replaces
  only the characters a filesystem actually rejects and is Unicode-preserving — so a download is named
  the same way a native `.mmst` save already was.

- **The canvas chrome reads for touch, not just a mouse.** On a phone the empty-map coachmark told you
  to press `Tab` / `Enter` and `Shift`-drag, and a topic's first-touch tip said "Double-click or F2 to
  edit" — gestures that don't exist without a keyboard or a mouse. The coachmark now swaps in the tap
  equivalents on a phone-width canvas ("Tap ＋ to add a child · double-tap to rename · drag to pan,
  pinch to zoom"), and the topic tip reads "Double-tap to edit" on any coarse pointer (a CSS pointer
  swap, so it's the pointer type — not the width — that decides). The corner minimap also covered a big
  share of a phone screen and its toggle overlapped the bottom status bar; the minimap now defaults
  **closed** on a phone (an explicit choice still persists), and the toggle is lifted clear of the
  status-bar row so the two no longer collide.

- **Tidy-tree layouts no longer overlap topics on dense, mixed-width maps.** The two-sided / left /
  right / org-chart / brace layouts placed breadth (cross-axis) with d3-hierarchy's contour packing,
  which assumes one uniform major column per depth. But the major axis is accumulated *per subtree*
  (a deliberate MindManager-ism: a short-label branch stays tight, a long label only pushes its own
  descendants out), so a **wide** depth-1 topic could reach into an adjacent branch's depth-2 column —
  a pair d3 never guards, because it assumes different depths sit in different columns. On maps with
  many mixed-width branches (typically `.mmap` imports) this produced visible collisions. Breadth is
  now assigned by reserving each subtree a **disjoint band** sized to its own extent (post-order
  measure, pre-order placement), which keeps the per-subtree columns *and* the height-proportional
  sibling gaps while guaranteeing no two boxes overlap at any depth: non-ancestor nodes always land in
  disjoint bands, ancestor/descendant pairs are always separated on the major axis. Pure change in
  `src/mindmap/flow/layout.ts` (`layoutTidyTree`); backed by a regression test that reproduces the
  import bug and fails on the old packing. Verified end-to-end by rendering a real 48-branch imported
  map (11 inter-branch + 1 intra-branch overlaps → **0**). Tip for a lopsided import: **Balance map**
  clears the imported side pins so both halves fill evenly.

- **The book downloads open again in the installed app.** The PWA service worker answers every
  top-level navigation with the cached app shell unless the URL is on a denylist that only covered
  `.html` — so for anyone who had visited before, `/Thinking-in-Maps.pdf` and `/Thinking-in-Maps.epub`
  opened the app instead of the book (fresh, service-worker-free visitors got the real PDF, which is
  why the deploy looked fine from outside). The denylist now excludes any URL with a file extension
  (single unit-tested rule in `src/pwa/navigationDenylist.ts`), so the book, the standalone pages and
  `stats.json` always reach the network; app routes — including dotted query values like
  `/?map=Foo.mmst` — still get the offline shell. Reproduced and verified in a real browser (service
  worker active: navigation returned `text/html` before, `application/pdf` after). Existing installs
  pick the fix up via the normal "Refresh now" update toast.

### Added

- **The book grew a method core — and caught up with the app for real.** *Thinking in Maps* now
  teaches the technique, not only the tool. Chapter 2 expands into the method-foundations chapter —
  why a map beats a list (working memory, visible relationships, deferred ordering, spatial recall),
  the method in five rules, diverge-then-converge, and when *not* to map — and a new Part 4 /
  Chapter 8 (*Thinking with maps*) applies the method to six recurring jobs (brainstorm, study
  notes, meetings, decisions, plans, root-cause, plus the multi-map atlas), each a recipe with a
  worked scenario. A feature pass folded ~50 shipped features into the chapters their narratives
  serve (capture inbox, sort children, group-selection boundaries, tint/gradient + image fills,
  hover-peek, draggable markers, the task checkbox + branch date shifting, outline editing, the
  legend, hide/extract filtering, the Relationships and Map statistics panels, the status bar +
  view switcher, copy-as-table, the Excel round trip, the accessibility settings, and more) with
  exercises to match, and fixed the book's one factual contradiction (outline numbering *does*
  bake into Copy outline / Markdown export while switched on). Appendix C gains the
  cognitive-science pointers behind chapter 2's claims. Catalogue: book 75.5% → **96.8%**,
  bookExample 51.8% → **59.3%**; the eight remaining `book:false` entries are deliberate
  exclusions (UI chrome that doesn't belong in a technique-first book), recorded in NEXT_STEPS.

<!-- 2026-07-02 MindManager review — Tier 4 big-bets (items 21–23). -->

- **Free background shapes (T4-23).** A new canvas-object layer for ad-hoc composition — **rectangle,
  ellipse, block arrow, chevron** — drawn behind the topics (SWOT quadrants, Venn frames, flow arrows).
  Insert them from **Insert → Shapes ▸** (which switches on free-canvas mode); each shape is its own
  positioned + sized object (distinct from the single diagram backdrop). **Click** to select, **drag**
  the body to move, **drag a corner grip** to resize (the whole gesture is one undo step), and a small
  inline toolbar recolours it, changes its kind, or deletes it. Shapes render behind the topics on the
  canvas and in every image/PDF/HTML export (the same shared geometry — canvas == export). Verified
  in-browser end-to-end + unit-tested (geometry per kind, the corner-resize math, ops, export); a 4-lens
  adversarial review's findings (edge-menu mutual exclusion, a resize-anchor drift) are fixed.

- **Smart containers: swimlanes & matrices that carry their topics (T4-22).** Two of the new shapes are
  **containers** — a **Swimlane** (lanes) and a **Matrix** (grid) — that behave like MindManager Smart
  Shapes: **dragging the container moves every topic sitting inside it** by the same amount, in one undo
  step ("move the lane, its cards follow"). Membership is by position (a topic is *in* a container when
  its centre is inside), so there's nothing extra to wire up — drop topics onto a lane and drag it.
  Verified in-browser (drag a swimlane → all contained topics follow) + unit-tested (centre-based
  capture, outside topics untouched, one undo step).

- **The StyleBar reflects the selection (T4-21).** The per-topic style bar was a write-only row of ~35
  icons; it now **shows the current values** (MindManager's context toolbar): the active shape, fill
  swatch, border swatch, tint/gradient, bold, raised/flat and font-family controls **highlight** when
  they match the selected topic, the font selector opens on the live value, and Bold toggles off when
  already bold. Controls are grouped with dividers and enlarge on touch. Reflection is single-select
  only. Verified in-browser + unit-tested.

<!-- 2026-07-02 MindManager review — Tier 1 + Tier 2 (items 1–20), landed as batches A–G. -->

- **Live-map slides: the deck exports the real map, not bullets (T1-1).** The biggest presentation gap
  vs MindManager. The standalone HTML slide deck and the PowerPoint (`.pptx`) export now render **each
  slide's branch as its actual map image** — the same faithful SVG render as the image/PDF exports,
  framed to that branch's bounds — instead of a text bullet outline. The overview slide shows the whole
  map; each branch slide its subtree. For `.pptx` the branch SVGs are rasterised to PNG and embedded as
  real picture shapes, aspect-fitted into the slide body. Both degrade gracefully to the classic bullet
  deck when there's no live canvas (or per-slide, if a branch can't be captured). The in-app cinematic
  guided walk already framed branches on the canvas; this brings that fidelity to the shareable exports.
  Verified end-to-end in a real browser (7 slides, 7 embedded branch SVGs) and with python-pptx (every
  embedded image relationship resolves; portrait/landscape branches are aspect-fitted, not stretched).

- **`.mmap` export fidelity: tags, task info & embedded images (T1-8).** The MindManager writer used to
  drop data our own importer reads. It now round-trips **topic tags** (`TextLabels`), **task metadata**
  (priority 1–9, percent-complete, start/deadline dates, resources), and **embedded images** (PNG/JPEG
  packed into `bin/` parts referenced by an `mmarch://` URI) — the highest-value fidelity items for
  real-MindManager migration. The zip stays byte-deterministic (pinned mtime, FNV-hashed part names).
  Verified by a tags/task/image round-trip through our importer.

- **Board grouping: markers & schedule, not just tags (T1-4, T1-5).** The Kanban board gains a **Group
  by** selector. Beyond tag columns you can now lay the map out by a **marker group** (Priority / Status
  / Mood / Vote — one column per member plus *None*, MindManager's Icon View) or by a **Schedule** of
  date buckets (*Overdue / Today / This week / Later / Unscheduled*, MindManager's Schedule view).
  Dragging a card between columns re-marks or re-schedules the topic (sets `task.due`) as one undoable
  edit, mirroring the existing drag-to-retag. Verified in-browser across all three modes + unit-tested.

- **PNG export: scale factor + transparent background (T2-6).** PNG export was fixed at 1× on white.
  You can now export at **2× / 4×** for crisp print/retina/slide use and toggle a **transparent
  background** (paste onto any colour). Wired to both *Download PNG* and *Copy image*, and the filename
  is tagged (`@2x`, `-transparent`); the branch export inherits it. Unit-tested (raster seam + filename).

- **Direct PDF file export (T2-7).** Alongside the existing print-to-PDF path, a new **Download PDF**
  renders the map to a high-resolution image and embeds it in a real `.pdf` (via pdf-lib) with
  **page-size** (fit-to-map / A4 / Letter) and **orientation** options — no browser print dialog.
  Lazy-loaded to stay within the bundle budget. Unit-tested (page geometry + embed).

- **Smart Ctrl+V routing (T2-13).** One paste shortcut now does the right thing by content: an **image**
  on the clipboard drops in as a node image; an **outline or URL** as text is routed through the paste
  parser (URL → linked topic, indented text → subtree) without the dialog; internal branch clips still
  paste as branches. Previously Ctrl+V was image-only and text needed a separate dialog.

- **"Move project": shift all dates ±N days (T2-14).** Replanning a slipped plan no longer means editing
  every date by hand — a bulk helper shifts every `startDate`/`dueDate` (scoped to a branch or the whole
  map) by ±N days in **one undo step**, preserving offsets. Pure date logic, unit-tested; no Gantt/PM
  engine (stays clear of the out-of-scope work).

- **Drag modifiers: Shift-drag detaches, Ctrl-drag copies (T2-15).** In tree mode, **Shift**-dropping a
  topic on empty canvas now **detaches** it into a floating topic (instead of snapping back), and
  **Ctrl**-dropping **copies** the subtree instead of re-parenting it. Both reuse existing ops.

- **Silent relationship creation + inline label (T1-2).** Creating a relationship (drag-connect or
  linking mode) no longer pops a modal label prompt (which created an unlabelled link even on cancel).
  The link is created immediately and its **inline label editor opens on the new edge** — type the
  label directly on the line, MindManager-style, or press Escape to leave it unlabelled.

- **Relationship right-click menu (T1-3).** Right-clicking a relationship edge used to jump straight to
  a delete confirm — the only surface without a context menu. It now opens a proper menu wiring the
  actions that already existed elsewhere: **edit label, arrowheads/direction, line style, semantic
  type**, and delete.

- **Inline summary rename (T2-9).** Renaming a summary opened a modal prompt while callouts and edge
  labels edited inline. The summary label now **edits inline** on the chip (empty commit deletes it,
  Escape cancels), matching the callout pattern.

- **Keyboard zoom: Ctrl/⌘ +/−/0 (T2-10).** Universal zoom muscle-memory now works on the canvas —
  **Ctrl/⌘ +** zoom in, **−** out, **0** reset — overriding the browser's own zoom and respecting
  reduced motion. Added to the shortcuts cheat sheet.

- **Backspace deletes topics (T2-11).** Topic deletion accepted only forward-**Delete**; **Backspace**
  now deletes too (Mac keyboards lack forward-Delete), matching the overlays. Type-to-edit is unaffected.

- **Inline `#tag` accelerator while typing (T2-16).** Typing **`#`** mid-topic now pops the tag picker
  (reusing the `[[`/`@` link-autocomplete machinery) to assign an existing or new tag without leaving
  the keyboard — MindManager's text accelerators.

- **Sticky-note colour set + preferred style (T2-17).** Inserting a sticky note offers a **6-colour
  palette** at insert time (amber / lime / sky / rose / violet / slate) and remembers your **preferred
  default**, instead of always starting amber.

- **Quick Filter from any marker or tag (T2-12).** The Markers & tags index was jump-only; each group
  row now has a **filter button** that pre-fills the existing Power Filter to show just the topics
  carrying that marker or tag — MindManager's right-click Quick Filter, from wherever you see it.

- **Find & replace: search history (T2-18).** The Find & Replace overlay now remembers your **last ~10
  searches** in a dropdown (localStorage-backed).

- **Command palette: visible trigger + panel parity (T2-19).** The editor command palette was
  hotkey-only (locking out touch users); a **⌘K button** now lives on the icon rail, and the palette
  registers the previously-missing **Agenda / Maps / Inbox** panel toggles.

- **Shared panel-name constants (T2-20).** Dock tabs and the Panels menu drew panel names from separate
  inline literals that had drifted ("Markers & tags" vs "…index", "Deck" vs "Slide deck (custom)"); a
  single shared constant per panel now backs both (dock = base name, menu = base name + optional hint).

- **Design gallery moved into the Map panel (T3-25).** The one-click Design presets (theme + connector
  style + branch weight + accent, previously in the Toolbar's Canvas menu) now live in the Map panel as
  a **Design** field — a **Choose a preset…** gallery with the same SVG thumbnails, right above Theme
  (applying a design also sets it). The Canvas menu keeps just Free layout + a link to the panel, and
  the Settings dialog's duplicate **Canvas theme** dropdown is gone — the canvas theme has one home now.
  Verified in-browser + unit-tested (gallery hidden when the callback is absent, lists every preset,
  applies on selection).

- **Visual Layout gallery (10c).** The Map panel's **Layout** field is now an SVG-thumbnail gallery
  (reusing the Design gallery's pattern) instead of a text-only `<select>` — each of the 11 layouts
  (Both sides / Right / Left / Radial / Org chart ↓↑ / Timeline / Fishbone / Grid / Swimlane / Brace)
  gets a small schematic diagram showing its shape, grouped exactly like the old dropdown (Radial / Tree
  / Diagram). Disabled (matching the old select) while Free layout is on. The `Menu` primitive gained a
  `disabled` prop to support this. Verified in-browser + unit-tested (the geometry model, and the panel
  wiring).

- **Insert-menu fly-out submenus.** The Insert menu's **Map parts** and **Templates** sections — each a
  long inline list, including a duplicate "SWOT" entry between them — now collapse into **"Map parts ▸"**
  and **"Templates ▸"** fly-out rows, opened by hover, click, or Enter/→ (Escape or selecting a leaf item
  closes the whole menu). A new `MenuSub` primitive (`src/design/primitives.tsx`) provides the fly-out,
  reusable anywhere a `Menu`/`ContextMenu` needs one. Verified in-browser + unit-tested (18 new primitive
  tests + a Toolbar integration test).

- **Status-bar Map / Outline / Board view switcher.** MindManager's "model once, view many ways" status
  bar buttons: the canvas status bar now shows a **Map / Outline / Board** segmented control, so Board
  (previously buried in the Panels menu despite being a full-canvas overlay) is a one-click peer of the
  plain canvas and the Outline dock. Picking one is mutually exclusive with the other two. Verified
  in-browser (each button switches correctly, Board opens/closes the Kanban overlay, Outline opens/closes
  the dock) + unit-tested.

- **Side-aware relate + wrap grips.** The drag-to-relate grip and the on-canvas wrap-width grip used to
  pin to a topic's right edge even on left-growing branches, forcing crossing drags across the map. Both
  now mirror to the topic's outward edge (left for a left-growing branch), matching the add-child ＋ and
  collapse toggle that already did. The clearance geometry (`relateGripGeometry.ts`) is unchanged in
  substance — it was already side-agnostic, just always called for the right edge. Verified in-browser
  (both layouts) + unit-tested.

- **Conditional rules: AND/NOT + a "due soon" trigger.** Rules could only match a single condition; you
  can now add one or more **AND**-ed clauses (each independently **NOT**-negatable) to a rule, e.g. "has
  tag risk AND NOT has attachment". A new **is due soon** trigger kind reuses the existing due-soon window
  from filter/search. The rules-panel builder grew a NOT checkbox on the primary condition and a
  **+ AND condition** button; `describeRule` reads the whole chain back (e.g. "NOT overdue AND has
  attachment"). Also fixed in passing: the Legend's rule swatch now falls back to font colour, then
  branch colour, when a rule sets neither background nor border (previously showed no swatch at all).
  Verified in-browser end-to-end + unit-tested.

- **Full 1–9 task priority.** Priority pickers and the Power Filter used to stop at 1–3 (High/Med/Low)
  even though the model always held MindManager's full 1–9 range — an imported priority of 4–9 rendered
  but couldn't be set, filtered, or cycled to. Every picker (topic inspector, bulk-selection menu, ⌘K
  commands, right-click quick-setter, Power Filter) now offers the full range, each level with its own
  colour (1–3 keep their existing colours; 4–9 continue a red→grey urgency gradient), and **Ctrl/⌘+Shift+
  1…9** sets priority directly from the keyboard (MindManager's own binding). `cyclePriority` now cycles
  through all 9 levels instead of resetting after 3. Verified in-browser (shortcut + picker + clear) +
  unit-tested.

- **On-canvas wrap-width drag handle (10b Layer 2).** Beyond the Style-tab **Wrap** slider (which still
  works on any topic), a **taller selected topic** now shows a slim grip on its **right edge**: drag it
  to set the text-wrap width right on the canvas (snapping to Narrow / Medium / Wide, far end = None), or
  nudge it with the **arrow keys** — the node re-wraps live and the whole drag is one undo step. The grip
  is placed in the clear top-right zone and only appears when the node is tall enough to keep it off the
  add-child ＋ / relate grip / collapse toggle (a unit-tested clearance rule); shorter topics keep the
  slider. Desktop-only — on touch the slider stays the wrap control. Verified in-browser (grip appears on
  a tall node, drag re-wraps + one-step undo, hidden on a short node) and the geometry is unit-tested.

- **Custom theme designer (C3).** Beyond the four built-in canvas themes, you can now define your own:
  the Map panel's **Theme** dropdown gains a **Manage themes…** entry that opens a designer
  — a name, a **6-colour branch palette**, a **background** and **node-fill** colour, a **font**, and a
  **branch weight**, with a **live preview**. Saved themes appear in the dropdown (under *Custom*) after
  the built-ins; selecting one applies its palette + colours (readable ink + light/dark mode derived
  from the background luminance) and its font + branch weight. Themes **export / import** as `.json` to
  share a palette across maps or machines. Stored in localStorage, separate from map data. The four
  built-in themes are untouched. Verified in-browser end-to-end (design → save → apply → the canvas
  background + palette-derived root/ink change); the derivation + storage are unit-tested.

- **Library folders (C2).** The All-maps screen now organises maps into named **folders**: a
  **＋ New folder** button, folder cards you click to drill in (with an *All maps / Folder* breadcrumb
  and rename / delete on the open folder), and a **Move to folder…** action in each map card's ⋯ menu.
  A map lives in one folder or none; deleting a folder orphans its maps back to the top level (never
  destroys them). Membership is `meta.folderId` (rides in the map + its `.json`); the folder list is a
  small JSON blob under a `meta` key (no IndexedDB schema bump). The whole-library backup/restore now
  carries the folder list too. Additive — a library with no folders reads exactly as before. Verified
  in-browser end-to-end (create / drill-in / move / delete-orphans); folder CRUD + backup round-trip
  unit-tested. The **⌘K quick-switcher groups by folder** too: its *Switch to map* / *Insert map as
  branch* rows sort by folder, read `<folder> / <map>`, and match a search for the folder name.

- **Visual map in the interactive HTML export (C1).** The self-contained interactive `.html` export now
  opens on the **actual visual map** — the same faithful SVG render as the image/PDF exports, with
  pan/zoom — and a header toggle drops to the **collapsible, searchable text outline** (the previous
  output, kept as the accessible fallback and the no-canvas path). Searching from the visual view
  auto-switches to the outline so hits are visible. Still one offline, self-contained file with no
  external assets. Verified in a real browser: the SVG renders, the toggle flips modes, and search
  highlights matches.

- **Speaker notes in the exported slide deck + PowerPoint (B5).** The standalone HTML slide-deck export
  now embeds each slide's speaker note (the topic's note, or a per-slide custom-deck override — same
  resolution as the presenter view), rendered from Markdown and **hidden by default**; press **N** or
  the footer **Notes** button to toggle them. The `.pptx` export now emits real PowerPoint **notes
  slides** (their own parts + content-types + rels) for slides that have a note, and switched to the
  custom-deck-aware `resolveSlides` so decks + notes match the HTML export. Verified with python-pptx:
  the notes open correctly in PowerPoint (overview + branch notes present, multi-line preserved).

- **Export a single branch (B4).** Right-click a topic that has children → **Export this branch…** (or
  ⌘K → *Export selected branch…*) opens a format picker scoped to that subtree: PNG, SVG, standalone
  HTML, interactive HTML, PDF, `.json`, or Markdown. Model-backed formats scope via a `subtreeExportDoc`
  helper (keeps the original ids + map meta so styling matches, drops relationships/boundaries that
  leave the subtree); the renderer-backed image/SVG/HTML/PDF render just the branch from the live
  canvas via `exportSvg(rootId)`, framed to its own bounds. Verified: a 4-node branch exports 4 nodes
  vs 23 for the whole map.

- **Typed relationship categories (B3).** A relationship can now carry an optional semantic **type** —
  `relates-to` (the default), `depends-on`, `causes`, `supports`, or `blocks` — set in the
  EdgeInspector, independent of its free text label. A per-map **Show type labels** toggle draws the
  type as a small pill near the arrowhead. Conditional formatting gains a **has relationship** rule
  (`relationshipType`, optionally narrowed to a type) that styles the endpoints, and the Power Filter
  gains a **Has relationship** section (direction — outgoing / incoming / either — plus an optional
  type). Lossless in `.json`; deliberately dropped by the `.mmap` exporter (MindManager has its own
  relationship-type system). Backed by unit tests across the model, ops, inspector, rules, filter, and
  the JSON round-trip.

- **Touch drag-to-reorder in the Outline (A6).** HTML5 drag events never fire on touch, so the Outline
  panel now runs its own long-press → pointer drag on a coarse pointer: press and hold a row for a
  moment to pick it up, slide over other rows (the same before / child / after drop zones), and lift to
  drop. Mouse still uses the native HTML5 drag; a move before the hold is treated as a scroll. Backed by
  a jsdom test that drives the real pointer handlers (mocked layout + fake timers). The marker palette
  already has a touch path — tapping a marker toggles it on the selected topic(s) — so its drag stays a
  mouse convenience (documented, not re-implemented cross-surface).

- **Natural-language date entry (A5).** The Start / Due date fields in the inspector now accept plain
  language — `today`, `tomorrow`, `yesterday`, `+7d`, `next fri`, a weekday name, or an exact ISO date —
  resolved to `YYYY-MM-DD` on blur / Enter. Unparseable input turns the field red and leaves the value
  unchanged; the 📅 button still opens the native calendar picker. Parsing is a dependency-free pure
  `parseNaturalDate(input, today)` (no chrono-node — the offline PWA's tight bundle budget rules out a
  30 KB date library for six expressions), fully unit-tested, plus a `NaturalDateInput` component test.

- **Drag-to-relate now prompts for a label (B1).** Dragging a topic's relate grip onto another topic
  now opens the same optional-label prompt as the right-click **Link to…** path (previously it created
  an unlabelled relationship silently). One consistent relationship-creation flow across all three
  entry points (drag / menu / keyboard).

- **⌘K entry for the relationship shortcut (A4).** The keyboard **Ctrl/⌘+Shift+L** "start a
  relationship" gesture (shipped in UI-5d, in the cheat-sheet) is now also a command-palette entry —
  *Start a relationship from selected topic* — via a new `startLinkFromSelected` handle method, so it's
  discoverable through ⌘K with its key hint (previously keyboard-only).

- **Space-bar pan (A1).** Hold the space bar and left-drag to pan the canvas from anywhere — even when
  the drag starts over a topic (a plain node drag re-parents it in tree mode). While held, topics go
  pointer-inert (a `.mm-space-pan` class → `pointer-events:none`, beating React Flow's inline style +
  `nopan`) so the drag falls through to the pane, and the cursor becomes a grab hand. Guarded against
  the inline editor / any text field so a typed space still types; a window blur clears the mode.
  Added to the Shortcuts cheat-sheet (View) and the USER_GUIDE.

- **`[[` / `@` name-based link autocomplete (UI review — gap group 3).** Type `[[` or `@` while editing
  a topic to open a name picker over the map's topics; pick one to drop its name into the text and
  attach the link. The first link becomes the node's primary `hyperlink` (the canvas 🔗), further ones
  its additional `hyperlinks` (composing with multiple-links-per-topic). Built on a pure, unit-tested
  core (caret-anchored trigger detection — nearest of `[[`/`@` wins, `@` only at a word boundary, no
  cross-line spans — buffer rewrite, candidate matching) and reuses the slash menu's key routing +
  popup; the two menus are mutually exclusive (leading `/` vs mid-text `[[`/`@`). This closes the last
  deferred item from the best-in-class gap review.

- **Slash `/` command menu (UI review — gap group 8).** Type `/` at the start of a topic to open a
  keyboard-driven insert menu: filter as you type, Arrow keys + Enter/Tab to pick, Escape to close (or
  click a row). Commands act on the current node — add child / sibling, mark to-do / done, due today,
  high priority, group in a boundary, add a note, star marker. The `/query` lives only in the editor
  buffer, so picking a command keeps the node's real topic (a fresh node stays empty; an existing one
  is never clobbered). Built on a pure, unit-tested command core (`slashCommands.ts`) routed through
  the extracted editor-key seam so ordinary typing and Enter/Tab editing are unaffected.

- **Multiple hyperlinks per topic (UI review — gap group 3).** A topic can point at more than one
  place. The primary `hyperlink` stays canonical (the canvas 🔗 and every exporter use it); an additive
  `hyperlinks?: string[]` holds the extras, managed in the inspector's Links section ("Additional
  links" — type + Enter to add, per-row open/remove). Extras are picked up everywhere links matter:
  Find searches them (and they satisfy the has-a-link filter), and all four link scans (in-map
  backlinks, outgoing links, cross-map backlinks, the map-wide link layer) treat a multi-link topic
  exactly like a single-link one. Unsafe/blank links are stripped on load and never persist. (v1 shows
  only the primary 🔗 on the canvas; extras are inspector-managed.)

- **High-contrast theme + OS awareness (UI review — gap group 10).** An accessibility high-contrast
  mode for the chrome: Settings ▸ Appearance ▸ High contrast (System / On / Off). "System" follows the
  OS `prefers-contrast: more` or `forced-colors: active`. When on, the neutral `--ed-*` chrome tokens
  go to their extremes — hard black/white borders + dividers, max-contrast text, and a denser accent
  focus ring — while surfaces stay put so the layout is unchanged. Focus rings become always-on and
  bold, chrome links gain underlines, and under forced-colors the canvas keeps its per-topic palette
  (the mind-map colours carry meaning) while focus uses the system `Highlight`.

- **Quick-capture inbox (UI review — gap group 1).** A map-independent "Unfiled" bucket (View ▸
  Inbox): jot a thought from any map — or none — and file it onto the current map later. Filing adds
  it as a floating topic (in one undo step) and drops it from the inbox; captures persist across maps
  and reloads (IndexedDB, under a single `meta` key — no schema bump). Each row can also be discarded,
  and "→ map" is disabled until a map is open.

- **Deferred-backlog wave 2 — capture & touch (UI review — gap groups 1/10).**
  - **Markdown shorthand on paste** — the paste-to-topics parser reads inline markdown per line:
    `- [ ]`/`- [x]` → a 0%/100% task, a whole-line `[text](url)` → a topic with that hyperlink (safe
    schemes only), and `**bold**`/`_italic_`/`` `code` `` capture as plain text. Applies to the Paste
    dialog and multi-line burst quick-capture.
  - **Long-press context menu on touch** — a `useLongPress` hook opens the canvas menu on a stationary
    touch/pen press (a pan cancels), since touch has no right-click.

- **Deferred-backlog wave 1 — cross-map linking (UI review — gap group 3).** Completing the link layer:
  - **Cross-map backlinks** — the inspector's "Linked from other maps" lists topics in other library maps
    that link here (via `#map=` hyperlinks), click-to-navigate. The scan loads other maps lazily (only
    while the inspector is open).
  - **Cross-map topic picker** — when a node links to another map, an "…and a topic" select upgrades the
    whole-map link to a specific topic there (`#map=X&node=Y`), so cross-map links are authorable to a
    node, not just a map.

- **Knowledge-linking, capture & accessibility packs (UI review — gap groups 3/1/10).** A slice of each:
  - **Cross-map topic links** (G3) — a node/note link can open another map *and* focus a specific topic
    there (`#map=<id>&node=<id>`); bare `#map=` links are unchanged.
  - **In-note in-app links** (G3) — `[text](#node=…)` / `[text](#map=…)` in a note render as links that
    route through the canvas (jump to a topic / switch maps) instead of the browser.
  - **Multi-line burst quick-capture** (G1) — pasting a multi-line outline into Quick-add builds a whole
    subtree (indentation/headings → nesting) in one undo step, not a single flat topic.
  - **Keyboard Outline reorder** (G10) — `Shift+↑/↓` reorder a row among its siblings and `Shift+←/→`
    outdent/indent it, the keyboard equivalent of the drag-only ◂ ▸ controls.
  - **Screen-reader overlay lists** (G10) — boundaries, summary brackets, and callouts now have
    SR-only landmark lists (like the existing relationships list), so AT can discover them.

- **Quick-wins pack (UI review — gap groups 8/9/10).** Cheap, high-value singles across areas:
  - **Filter by completion status** (G8) — the Power Filter gains a Completion select (Done / In
    progress / Not done) over each node's rolled-up effective progress; only task-bearing nodes match.
  - **`Ctrl/⌘+,` opens Settings** (G9) — the conventional preferences chord, documented in the
    cheat-sheet (the existing Settings command now shows the shortcut chip).
  - **Reduced motion** (G10) — canvas zoom/fit/centre tweens and the guided walk's cinematic zoom now
    honour the OS `prefers-reduced-motion` (previously only CSS transitions did) plus a new
    Settings → Reduce motion toggle (System / On / Off); the toggle also drops chrome transitions.

- **Search & nav pack (UI review — gap group 2).** Find what you mean and retrace where you've been:
  - **Search beyond topic + note** — Find (in-map and across-every-map) now reaches a node by any text it
    carries: tags, marker (icon) ids, hyperlink, callout bubbles, attachment filenames, and task
    resources, via a single `searchableText` haystack shared by the exact, fuzzy, and library passes.
  - **Scoped / operator search** — the Find box understands operators so a query can target fields, not
    just text: `tag:foo`, `marker:`/`icon:flag-red`, `priority:1`, `due:dated|overdue|soon`,
    `has:note|attachment|link|task|image`, `level:>=2` (depth bounds), `-term` exclusions, and
    `"exact phrases"`. A plain query is unchanged (exact-then-fuzzy substring).
  - **Deep-link to a node** — the URL carries the focused topic as `?node=<id>` alongside `?map=<id>`, so
    the address bar is always a shareable permalink; opening one boots the map and focuses that node. A
    "Copy link to this topic" command + More-menu item copy it (a standalone PWA has no address bar).
  - **Back / forward navigation** — `Alt+←` / `Alt+→` (and ⌘K "Go back" / "Go forward") retrace the
    topics you've visited, across maps too, browser-style.
  - **Search-across-maps result context** — each cross-map hit now shows its ancestor breadcrumb
    (`Root › Branch › …`) and, when the match is in the note, a short snippet — so a bare topic like
    "Tasks" is placeable at a glance. Operators (above) narrow scope in this overlay too.
  - **In-map Find results list** — the Find overlay's "List all (N)" disclosure shows every match as a
    clickable, breadcrumbed list (jump straight to any one, current match highlighted), alongside the
    existing `Enter` / `Shift+Enter` cycler. Reuses the same result-row component as the across-maps
    search.

- **Data-safety pack (UI review — gap groups 9/11).** Local-first durability for a no-backend PWA:
  - **Trash / undo-delete** — deleting a map moves it to a recoverable Trash (a `meta.trashedAt` flag)
    instead of destroying it; a Start-screen Trash view restores or permanently deletes. Emptying the
    Trash is the only permanent delete.
  - **Cross-tab clobber guard** — editor tabs heartbeat on a BroadcastChannel; opening the same map in
    two tabs (which would race the IndexedDB autosave) shows a one-time warning.
  - **External-file conflict detection** — a map bound to a `.mmst` tracks the file's `lastModified`; a
    Save that would overwrite an external change (edited elsewhere / synced) prompts first, and silent
    autosave-to-file pauses rather than clobbering.
  - **Open Recent** — the File menu lists recently-opened disk files; reopening re-binds the persisted
    handle (re-prompting for permission).

- **Wave-1 best-in-class gap fixes (UI review — verified gap map).** The first, cheapest-high-value slice
  of the [features review](docs/UI_REVIEW_2026-06-30_bestinclass.md):
  - **Free colour pickers** (G5): Text / Fill / Branch native colour swatches in the StyleBar, alongside
    the preset rows (the model fields already accepted any CSS colour — only the picker UI was missing).
  - **Paste a lone URL → one titled, linked node** (G1): a single pasted http(s) URL becomes a node titled
    from the path slug (Title Cased), fully offline — no fetch.
  - **Copy map as image** (G11): `⌘K → "Copy map as image"` (+ the Export menu) writes a PNG of the map to
    the clipboard — the fastest map→paste path, no file round-trip.
  - **Presenter pacing timer + blackout** (G7): an elapsed clock with pause/reset, a total-talk budget
    that colours the clock green → amber → red, and `B`/`W` to black/white the screen (any key resumes).
  - **Cross-map quick switcher** (G2): `⌘K` lists "Switch to map: <title>" for every other library map.
  - **Reveal-in-outline** (G2): selecting a node on the canvas scrolls its row into view in the Outline.

- **"Serious maps" pack (UI review — gap groups 2/4).** The cross-map restructure + link-layer verbs:
  - **Sort children** (`⌘K`): reorder a topic's direct children A→Z / by priority / due date / progress.
  - **Multi-branch clipboard**: copying a multi-selection (`⌘C`) now copies every selected branch (minus
    any nested inside another); paste (`⌘⇧V`) grafts them all in one undo step. Cross-map, back-compatible.
  - **"Links to" inspector section**: the outgoing mirror of "Linked from" — the node's hyperlink target
    + relationship edges from it, click-to-jump.
  - **Relationships panel**: a dockable map-wide index of every relationship arrow + in-map topic
    hyperlink, both ends click-to-jump (`⌘K` → "Relationships panel", or the Panels menu).
  - **New map from this topic**: copy the selected branch out into a fresh standalone library map.
  - **Insert map as branch**: graft another library map's tree under the selected topic.

- **Big-map virtualisation + cinematic walkthrough (UI review — gap groups 6/7).**
  - **Big-map virtualisation**: above ~500 nodes the canvas renders only the elements in/near the
    viewport (React Flow `onlyRenderVisibleElements`), keeping pan/zoom/edit fluid on large maps; off on
    smaller maps to avoid pop-in.
  - **Cinematic visual-map walkthrough**: the guided walk gains a 🎬 toggle that frames each step's whole
    branch with an animated zoom (Prezi-style) on the real canvas — the styled map *is* the slide, and the
    camera flies between branches. Remembered across sessions.

### Fixed

- **Docs: the user guide now covers every shipped feature (100% manual coverage), and the book
  caught up with the app.** `USER_GUIDE.md` gains the ~90 features that had shipped undocumented —
  smart Ctrl+V paste routing, the `/` `#` `[[` editor accelerators, the search operators
  (`tag:`/`due:`/`has:`/`level:`…), background shapes & smart containers, the marker library /
  groups / suggestions, tag manager + tag colours, the full conditional-rule trigger set with
  AND/NOT, saved views, back/forward history, deep links, the Inbox, Trash + file-conflict
  safeguards, PNG/PDF export options, live-map slides, the guided walk + cinematic mode, the
  presenter timer, Settings (reduced motion / high contrast), and more. The book (*Thinking in
  Maps*) was reviewed structurally: chapter 1 no longer opens on the retired sample-map first-run
  (it's the Start screen) and no longer teaches a Ctrl+Enter line break that doesn't exist;
  chapter 2's exercise uses a worked example; chapters 3–7 fold in the shipped features that serve
  their narratives (shapes/containers, systematic styling, altitude tools, operator search, files
  on disk, library organisation, guided walk + pacing timer); appendix A is rebuilt as the real
  keyboard card and appendix B matches the actual import/export fidelity. Catalogue: manual
  54.5% → **100%**, book 49% → **75.5%** — flags flipped only for what's genuinely covered.

- **User-guide coverage review: stale statements corrected, catalogue flags trued up.** A review of
  `USER_GUIDE.md` against the shipped app found five statements the code had outgrown — priority is the
  full **1–9** range (not High/Med/Low), the **Board view writes back** (drag re-tags / re-marks /
  re-schedules; groups by tag, marker group, or schedule), a topic can hold **additional links** beyond
  the primary 🔗, right-clicking a **relationship opens the full quick menu** (not just delete), the
  `.mmap` export carries tags / task info / images, and there are **20** worked examples (not 14) — all
  fixed, plus the book's Chapter 1 "there is no Save button" line now acknowledges `.mmst` files. The
  same review found 25 features flagged `manual: false` in `docs/features.json` that the guide already
  documents (breadcrumb bar, drill-in, format painter, detail levels, wrap width, keyboard
  restructuring, …) — flags corrected, so manual coverage reads **64.4%** (was 54.5%); the book flags
  were verified accurate as-is.

- **⌘K command palette was unstyled in the editor.** The palette's `.st-cmdk*` CSS lived in `start.css`,
  which is imported only by the lazily-loaded Start screen — so opening a map straight into the editor
  (the default view) left the palette as an unstyled, full-viewport list of every command. Moved the
  modal styles into a co-located `CommandPalette.css` imported by the component, so they ship in the main
  bundle and load wherever the palette renders.

- **Swimlane layout no longer reverts on reload.** The Toolbar and Map panel offered **Swimlane**, but the
  layout whitelist that vets the persisted choice (and `?layout=` links) didn't include it, so a swimlane
  map silently reopened as *Both sides*. Also registered it in the ⌘K layout commands and the Start
  screen's Layouts gallery, which had the same omission.

- **Relationships & Inbox panels behave on phones; Relationships dock tab activates.** The mobile
  bottom-sheet registry omitted the Relationships and Inbox panels — opening them on a phone showed no
  tap-out scrim and *tap outside to dismiss* didn't close them. The dock's auto-activate list also
  omitted Relationships, so opening that panel never brought its tab to the front.

- **Breadcrumb bar and brainstorm timer follow the chrome theme.** Both hardcoded light-mode colours,
  staying white-on-light under dark chrome and ignoring high contrast. They now use the shared `--ed-*`
  design tokens (the timer's running/finished tints reuse the toast success/error tokens).

- **Reset zoom respects reduced motion.** The status-bar *100%* button and the minimap menu's *Reset
  zoom* hardcoded a 200 ms animation, ignoring the reduced-motion preference every fit/viewport path
  honours; both now use the shared motion token and skip the animation under reduced motion.

- **Mixed shorthand/longhand `border` styles across the chrome.** Several controls set the `Button`
  primitive's `border` shorthand in one state and only `borderColor` in another (the primitive's active
  state, the brainstorm timer's finished state, dialog confirm/danger buttons, the theme designer's
  selected-theme ring, a Presentation-mode toggle) — React warns on this pattern and it can silently drop
  the border on a state change. Every site found now sets a full `border` shorthand in both states.

### Added

- **UI token-scale + a11y tails (UI research — UI-2 / UI-5 tails).** A `motion` scale (`--ed-dur-*` /
  `--ed-ease`, consumed by the editor.css transitions) and a `typeScale` (title/body/label presets,
  consumed in the dialogs) land the deferred UI-2 token work; the NodePopover shadow is tokenised onto
  `--ed-shadow-pop` (now follows dark mode). For UI-5: a free-layout keyboard node-nudge (Ctrl/⌘+arrow
  moves the selected node ±10px — a non-drag reposition, WCAG 2.5.7) and an always-present, read-only
  screen-reader list of the map's relationships (cross-links were non-focusable SVG edges, invisible to
  assistive tech).

- **Contextual action bar on selection (UI research — UI-3).** The on-selection popover grew into a
  transient, selection-anchored action bar above the node — note / priority / link (the mouse twin of
  Ctrl/⌘+Shift+L) plus the existing collapse + "More…", with active state lighting up the note/priority
  buttons. The separate on-hover `.mm-node-bar` pill was removed, so a node is uncluttered at rest and
  the actions appear on selection rather than on every hover. The on-node ＋ add affordances + inline
  badges are unchanged.

- **Tablet inspector docks to a bottom sheet (UI research — UI-4).** On a coarse-pointer tablet
  (641–1024px) the inspector — which auto-opens on every selection — used to be an inline 240px column
  that crushed the canvas to ~33%. It now docks to a full-width bottom sheet (the phone pattern), out of
  flow so the canvas runs full-width behind it (~64%); deselect or the inspector's minimise closes it.

- **Fit-to-view shortcuts (UI research — UI-6).** Shift+1 fits the whole map; Shift+2 fits the current
  selection (clamped to 1.5× so a single node doesn't slam to max zoom). Keyed on `e.code` so they're
  keyboard-layout robust and don't collide with type-to-edit; registered in the cheat-sheet. The
  scattered canvas-animation durations are consolidated into a `motion.dur` token.

- **Guided templates path on the empty library (UI research — UI-7).** The "No maps yet" state now
  offers a "Browse templates →" path alongside "New map", so a returning user who cleared their library
  has a guided start. (The researched first-run intent-picker modal was deliberately skipped — Start's
  capture card + template gallery already cover intent selection.)

- **Canvas accessibility pass (UI research — UI-5).** The canvas keyboard model is now owned end-to-end
  by the app's custom keymap: React Flow's built-in node-keyboard a11y is disabled (`disableKeyboardA11y`
  + `nodesFocusable`/`edgesFocusable` off) so Tab=add-child / Enter=add-sibling / arrows=move-selection
  no longer risk double-handling. The **Outline panel is now a `role="tree"`** screen-reader-primary view
  — `treeitem` rows with `aria-level`/`aria-expanded`/`aria-selected`, a roving tabindex, full keyboard
  nav (↑↓ move, → first child, ← parent, Home/End, Enter focuses the canvas node), and selection synced
  to the canvas. **Relationships are keyboard-creatable** (Ctrl/⌘+Shift+L → arrow to a target → Enter;
  Esc cancels) with a live hint, registered in the cheat-sheet + the "Link to…" menu hint. WCAG 2.2
  fixes: 24px collapse-toggle + task-checkbox hit targets (2.5.8, with the touch escalation that an inline
  width had been silently outranking), `:focus-visible` rings on the node affordances (2.4.7), and
  accessible names on the inline edit field + collapse toggle. A node-fill/label **contrast assertion** is
  now in the gate (`test/contrast.test.ts`): branch/root pills clear WCAG AA-large (3:1), tint swatches AA
  body (4.5:1).

- **Themed prompt/confirm on the canvas (UI research — UI-1).** The editor canvas's eight native
  `window.prompt`/`window.confirm` calls (summary + relationship labels, relationship delete, name-a-view,
  image/link URLs, restore-version, delete-all-data) now use an imperative `editorPrompt`/`editorConfirm`
  on the existing themed `<Dialog>` (one mounted `<DialogHost/>`, promise-based, with a native fallback
  before the host mounts) — so they follow the app theme instead of being white OS boxes in dark mode and
  can't silently return null in some PWAs. Start was already migrated; this finishes the sweep.

- **Token/clarity pass (UI research — UI-2 core).** The floating rich-text edit bar no longer hard-codes a
  white card + dark ink (it was a light box over the dark-mode node surface) — it consumes `--ed-*` tokens.
  The two same-named `Chip`s are disambiguated: the read-only node/board badge becomes `Badge`
  (`src/Badge.tsx`), leaving the interactive toggle `Chip` in `design/primitives.tsx`.

- **Wrap width is a snap slider now (UI review — 10b layer 1).** The Style tab's four-option width dropdown
  (Narrow / Medium / Wide / None) becomes a slider: drag to any wrap width, snapping to the three presets,
  with the far end = None (no cap). It reflects the selected topic and re-wraps it live, and applies across
  a multi-selection. Backed by a pure, tested `wrapWidth` scale (snap / clamp / serialise).

- **Export menu remembers the last format (UI review follow-up).** The Export menu now pins a one-click
  **Last: <format>** row at the top, persisted in localStorage and read fresh each time the menu opens —
  re-exporting the same format (the common case) is one click instead of hunting the grouped list.

- **Topic-node corner de-crowded (UI review follow-up).** On a short, right-growing node with children,
  the drag-to-relate grip could overlap the always-visible collapse toggle. The grip now clamps to ride
  just above the toggle (CSS `min()`, no JS height measurement) while keeping its full below-centre offset
  on taller nodes — extracted as a pure `relateGripGeometry` module with a permanent clearance test
  (verified against a real layout engine).

- **Start radius scale tokenised (UI review follow-up).** The Start screen's two dozen scattered
  `border-radius` literals (5/6/8/9/10/12/14px) now resolve to a four-rung `--st-radius-*` scale on `.start`
  that mirrors the editor's `design/tokens.ts`; the off-scale 9/10/14 values snap to the nearest rung
  (sub-perceptual) so corners read as one consistent system. Pill shapes (search bar, recent chips) stay
  literal `999px`. One source of truth for Start corner radii.

- **Mobile sheet drag-to-resize (UI review — Phase 12).** The bottom sheet's grab handle was decorative
  (`pointer-events:none`) and the sheet was locked at 62dvh. It's now a real, focusable handle: drag to
  resize the sheet — snapping between 62dvh and ~90dvh — drag down past a threshold to dismiss, or focus it
  and use ↑/↓ (Escape closes). A shared `--mm-sheet-h` var (set by a `useSheetDrag` hook; snap/dismiss
  logic unit-tested) drives both the panel host and the inspector. Completes the UI-review remediation.

- **Context-ranked ⌘K (UI review — Phase 11d).** Open the command palette with a topic selected and the
  node-scoped actions (delete, markers, priority, …) now lead the list under a **For the selected topic**
  header — ahead of Recent and All commands — so what you can do to the selection is one keystroke away
  instead of buried. Completes Phase 11. (The palette's section model is now a general list, not just
  recent-vs-rest.)

- **Panels menu grouped (UI review — Phase 11c).** The twelve side-panel toggles were one flat list under
  a single "Side panels" label. They're now sorted into three labelled groups — **Structure** / **Analysis**
  / **Workflow** — and the duplicate leading icons (layers ×2, grid ×2, note ×2) are de-collided to distinct
  glyphs, so the menu scans as three short lists instead of a wall of twelve.

- **Start nav vector icons (UI review — Phase 11b).** The nine left-rail section glyphs were a mix of
  Unicode symbols and one full-colour emoji (🕘) that rendered inconsistently across platforms. They're
  now uniform 18px line icons drawn with `currentColor`, so the active row still tints emerald and every
  platform sees the same crisp set.

- **Visual polish — colours, press feedback, active-rail edge (UI review — Phase 11a).** The Start-screen
  thumbnail node and the mobile browser/PWA `theme-color` move off a legacy indigo (`#26215c`) onto the
  brand tokens — the thumbnail's central node was near-invisible on the dark page. Buttons (editor + Start)
  now give a 1px press-down nudge, the Start card radius matches the editor (12px), and the active
  left-rail tool carries a 3px emerald accent edge so selection reads as the strongest state, not the
  faintest.

- **Node affordance polish (UI review — Phase 10a).** The drag-to-relate grip is bigger (16px, was 11) and
  clearer at rest on a selected node, so "drag to link" is a reliable target instead of a fiddly dot. And
  hovering a collapsed branch's **+N** toggle now peeks the first hidden child titles in a small card — so
  you can decide whether to expand without triggering a full re-layout (mirrors the note hover-peek;
  canvas-only, projected via a new `childTitles`).

- **Empty-pane menu + interactive zoom (UI review — Phase 9b).** Right-clicking the bare canvas now opens a
  menu — **Add topic here**, **Paste branch here** (when a branch is copied), **Fit to view**, **Reset zoom
  (100%)** — the one surface that previously did nothing on right-click. "Paste branch here" finally lets a
  copied branch land as a free-floating topic, not only under a node. And the status-bar zoom % is now a
  button (click → 100%), with the "N selected" count zooming to fit the selection. Completes Phase 9.

- **Keyboard branch copy / duplicate / paste (UI review — Phase 9a).** The canvas gains the muscle-memory
  editing keys: **Ctrl/⌘+C** copies the selected branch, **Ctrl/⌘+D** duplicates it as a sibling, and
  **Ctrl/⌘+Shift+V** pastes a copied branch under the selection (plain Ctrl/⌘+V stays the image paste, so
  there's no collision). The branch was already copyable from the right-click menu; now it's keyboard-driven
  too. The new keys appear in the cheat-sheet and on the Copy/Paste context-menu rows.

- **Custom relationship / boundary colours (UI review — Phase 8c).** The Edge and Overlay inspectors'
  colour rows gain a native colour picker beside the preset swatches, so a relationship or boundary can
  take an exact brand/accent hue (e.g. matching the map accent) instead of being limited to the ~8
  presets. Completes Phase 8 — and with it the **Phases 4–8 UI-review block** (shortcut discoverability,
  mobile/tablet, Start-library scanning & curation, inspector/dock/tabs).

- **Resizable dock + persistent tab state (UI review — Phase 8b).** The left side-panel dock is now
  resizable — a drag handle on its canvas-facing edge with arrow-key nudge and a persisted width — like
  the right inspector already was (it hosts the densest read panels: Outline / Power Filter / Styles /
  History). The active dock tab and dock width persist across reloads (in `usePanels`), as does the topic
  inspector's last tab (Details / Notes / Style) — a reload no longer drops you on the wrong tab. And the
  active tab in both the document-tab strip and the dock scrolls into view when it changes off-screen
  (e.g. switching maps/panels via ⌘K).

- **Map panel scannability (UI review — Phase 8a).** The no-selection Map panel no longer stacks all
  ~11 controls in one wall: Theme / Layout / Background / Accent stay visible and the low-frequency
  styling (Image, Line jumps, Connectors, Branch weight, Font, Text size) tucks behind a collapsed
  **More styling** disclosure (reusing the inspector's `CollapsibleSection`). And when a Power Filter is
  active, the topics stat now reads **"N / M topics match"** instead of silently showing the whole-map
  total that contradicts the dimmed canvas.

- **Themed rename/delete dialogs (UI review — Phase 7c).** Renaming or deleting a map from the Start
  screen now uses an in-app, theme-aware dialog instead of the browser's native `prompt`/`confirm` —
  which ignored the app theme (a stark white box on a warm/dark Start screen) and, in some PWAs, returned
  `null` silently so a rename could fail invisibly. The rename store-op (`renameMapTitle`) and the dialog
  UI (`MapDialogs`, routed through `StartContext`) are kept separate so each is unit-tested. This
  completes Phase 7.

- **Start library curation (UI review — Phase 7b).** Maps can now be **pinned** (★) to the top of every
  library list — All maps, Recent, and "Pick up where you left off" — independent of recency, via the
  card's ⋯ menu; the pinned state is stored in the map (additive `meta.pinned`) so it survives reload and
  round-trips through `.json` export. The "Learn the app" **⌘K** card is now a real button that opens the
  command palette — show, don't just tell.

- **Start library scanning (UI review — Phase 7a).** Map (and template) thumbnails now draw one
  coloured spoke per *real* root branch instead of a random seed-hashed glyph, so two maps look
  different at a glance (the structure was in memory and thrown away before). "All maps" gained a
  **Search your maps…** box with a no-match state — the fixed template/example lists were already
  searchable while the user's own growing library wasn't. The All-maps list view now shows the
  last-edited date next to the node count (so the default "recently edited" sort is legible), and
  Recent groups into finer buckets — Today / Yesterday / Earlier this week / This month / Older —
  instead of collapsing everything older than two days into one "Earlier" wall.

- **Mobile & tablet layout (UI review — Phase 6).** On phones the 56px icon rail is hidden — every one
  of its actions (Home, Paste, Insert image, Getting-started, Settings, Shortcuts) is also reachable from
  the toolbar Row-1 / the More + Insert menus / ⌘K, so the canvas gets back ~14% of a 390px screen. New
  tablet tier (coarse pointer, 641–1024px) narrows the side dock and caps the inspector so iPad portrait
  keeps a usable working area instead of the full desktop chrome (which left almost no canvas).
- **Mobile viewport & touch hardening (UI review — Phase 5).** `viewport-fit=cover` now lets the PWA
  use the full screen on notched iPhones AND switches on the `env(safe-area-inset-*)` values the CSS
  already referenced (they were inert before), so the bottom sheets pad clear of the home indicator.
  Sheet heights moved from `vh` to `dvh` (with a `vh` fallback) so they keep a stable share of the
  screen as the iOS Safari URL bar shows/hides. The React Flow zoom/fit controls are sized up to the
  app's 40px touch target on coarse-pointer devices. Plus global touch hygiene — no grey tap-flash,
  contained over-scroll (no stray pull-to-refresh), and no long-press text-selection on chrome labels.
- **Shortcut discoverability (UI review — Phase 4).** Key bindings now show at the point of use instead
  of only in the cheat-sheet: the ⌘K command palette renders an inline binding chip on every command
  that has one (Undo, Redo, Open/Save/Save-as), and the toolbar "More" menu shows the same chips on its
  File items (the binding moved out of the label text into the right-aligned hint slot). The "More" menu
  also gained **Settings & preferences** and **Keyboard shortcuts** entries — both were reachable only
  from the icon rail / ⌘K before. Bindings come from one keyed source (`SHORTCUT_BINDINGS`) that a test
  pins to the cheat-sheet, so a chip can never claim a binding the cheat-sheet doesn't document.
- **Accessibility & first-run polish (UI review — Phases 1–3).** A multi-dimension UI review surfaced a
  fresh batch of keyboard / screen-reader / first-run gaps; the first three phases shipped:
  - **Visible keyboard focus across the whole chrome.** Only one button class carried a `:focus-visible`
    ring before; now the icon rail, both toolbar rows / menu triggers, the find-bar toggle chips, the
    native selects, and every Start-screen control (nav, tiles, links, pills, tabs, kebab) show the
    emerald keyboard ring — keyboard users can always see where focus is (WCAG 2.4.7).
  - **Skip-to-canvas link.** The first Tab in the editor now offers a "Skip to canvas" link that jumps
    past the rail + both toolbar rows straight to the map (WCAG 2.4.1 Bypass Blocks).
  - **The canvas is named for assistive tech.** The map region carries a role + label ("Mind map:
    &lt;title&gt;") and a polite live region narrates selection changes, so a screen reader no longer
    meets an anonymous, silent SVG. Save-state changes — including the data-loss "Couldn't save" — are
    now announced via a live region too.
  - **Image / Import are keyboard-operable.** The three file pickers (the rail's "Insert image", and the
    "Import files…" / "Image on selected node…" menu items) were a `<label>` wrapping a hidden input —
    unreachable by keyboard and skipped by the menu's arrow-key roving. They're now real button stops
    that open the picker on Enter / Space (WCAG 2.1.1 Keyboard).
  - **Toggle "on" state is no longer colour-only.** Pressed toolbar toggles and the Find Match-case /
    Regex chips gain an inset accent ring, so on ≠ off (and ≠ hover) without relying on hue (WCAG 1.4.1).
  - **⌘K traps Tab.** The command palette advertised `aria-modal` but let Tab escape to the page behind
    it; the options are now out of the tab order and Tab stays inside the modal.
  - **First-run keys work immediately.** On a brand-new map the canvas keymap now falls back to the
    central topic when nothing is selected, so the empty-canvas coachmark's "Press Tab for a child ·
    Enter for a sibling" act on the first keystroke instead of no-op'ing against an empty selection.
    (The fresh-map view is otherwise unchanged — the Map panel still shows until you select a topic.)
- **Relevance-sweep gap closure.** A verification pass over the remaining UX backlog found six residual
  gaps against the as-built app; all are now closed:
  - **Bulk markers live with the rest of Details.** Selecting several topics used to move the markers
    control onto the Style tab while Tags stayed on Details; markers now lead the **Details** tab in
    single- and multi-select alike, so the control set no longer reshuffles between modes.
  - **Heavy inspector sections collapse.** Attachments, Links and "Linked from" are now collapsible and
    start collapsed when empty, so a topic with no metadata doesn't pad the panel.
  - **Roll-up badges name their source.** A mirrored topic's ⤵ badge tooltip now names the bound source
    map (e.g. mirrors "Quarterly OKRs") instead of a generic string.
  - **Open a note in the dock from the inspector.** The Notes tab gained an **⤢ Open in dock** button
    that opens the roomy dockable note editor on the same note.
  - **Presentation Home hint + internals.** The presentation footer now lists the Home-to-first-slide
    key, and the undo-coalescing window is a named constant.
- **Deferred-item polish.** Five follow-ups from the UX-remediation pass:
  - **Right-click menu on overlays.** Boundaries, summaries and callouts now have their own right-click
    menu — recolour (and, for boundaries, shape + outline style), plus Delete — matching the topic and
    relationship menus. Deleting an overlay was keyboard-only before.
  - **"More…" on the selected topic.** The on-node quick-action popover keeps Collapse and adds a
    **More…** button that opens the full right-click menu at the topic, so Rename / Delete / Add callout /
    roll-up and the rest are reachable without right-clicking (friendlier on trackpad + touch).
  - **Bind a roll-up source from the canvas.** The topic right-click menu can now bind — or unbind — a
    roll-up source map directly, alongside the existing Insert-menu binder.
  - **Notes get their own tab.** The topic inspector's note editor moved out of the crowded Details tab
    into a dedicated, roomy **Notes** tab; clicking a topic's 📝 indicator jumps straight to it.
  - **Clearer dockable note.** The dockable Note-editor panel now flags that it shows the same note as
    the inspector's Notes tab, just docked for more room.

- **Feature-specific polish (Phase 9).** Five targeted refinements:
  - **The Kanban board is now interactive.** Drag a card to another column to re-tag that topic — it
    drops the source-column tag and adds the target one in a single undoable edit (the board was a
    read-only view before). It also re-themes for dark mode.
  - **Present mode goes true fullscreen.** Entering the presentation now takes over the whole screen
    (OS fullscreen, graceful fallback if blocked); a key-hint footer (`← → / Space · P · Esc`) is shown
    and **Home** jumps back to the first slide.
  - **Roll-up topics are now visible at a glance.** A node that mirrors another map shows a small **⤵**
    badge on the canvas (with a "refresh to update" tooltip).
  - **Consistent inspectors.** The relationship and overlay (boundary/summary/callout) inspectors now
    show a one-line context under their title (`Relationship: …` / `Boundary around N topics`), matching
    the topic inspector's breadcrumb, and all the colour swatches come from one shared palette.
  - **Calmer undo for chip-spamming.** Rapidly clicking the same topic's priority / progress / task chip
    now collapses into a **single undo step** (within ~0.6s) instead of one undo per click.

- **App-wide dark mode (Phase 8).** A real dark theme for the whole app chrome — toolbar, side panels,
  inspector, dialogs, toasts and the Start screen — not just the canvas. A new **App theme: System /
  Light / Dark** control in Settings drives it, **defaulting to System** (it follows your OS
  `prefers-color-scheme` and updates live when you flip your desktop theme). It's **independent of the
  canvas theme** (which still colours the topics), with one tie: a dark canvas always darkens the chrome
  too, so you never get a bright toolbar around a dark map. Under the hood the chrome's colour palette
  now resolves to the theme-reactive `--ed-*`/`--st-*` tokens, so every panel and dialog re-themes from
  one source.

- **Onboarding & learnability pass (Phase 7).** Help new users get oriented and find the editor's power:
  - **Install MindMap Studio as an app.** When your browser offers it, an "Install" button appears in
    the Start sidebar footer + the About pages; on iOS Safari you get an "Add to Home Screen via Share"
    hint instead. Dismissible, and hidden once it's installed.
  - **"Learn the app" tips on the Start screen** — four cards covering ⌘K, right-click markers, the
    drag-to-relate grip, and exporting to PowerPoint/PDF.
  - **Actionable empty states.** "All maps" / "Recent" with no maps now offer a primary "＋ New map"
    button instead of pointing you elsewhere.
  - **Template & example cards now carry a one-line use-case**, and the Start home leads with a curated
    set of starters rather than whatever happened to be first in the list.
  - **Getting-started tips are re-openable** any time — from Settings, the ⌘K palette, and a new tips
    button in the icon rail (not just once on first run).
  - **A "New here?" banner** greets a brand-new or shared-link visitor on the home screen with a quick
    orientation and a "Start your own" button.
  - **Gesture coaching:** a one-time hint on the drag-to-relate grip, a "Shift-drag to select" line in
    the empty-map coachmark, both gestures added to the Shortcuts sheet, and a selected topic's relate
    grip now rests a little more visible.

### Changed

- **Phase 7 affordance tidy-up.** The drag-to-relate grip now sits just below the add-child ＋ so the two
  no longer overlap; on touch screens the grip is hidden (link via long-press → "Link to…") and the
  collapse toggle is tap-sized.

- **Toolbar information-architecture cleanup (Phase 6).** A pass to make the editor chrome read more
  clearly and stop splitting one job across two places:
  - **Cross-map search is now distinct from in-map Find.** The Row-1 "All maps" button took a maps-grid
    glyph (was a second magnifier, identical to Find); the plain magnifier now means in-map Find only.
    The redundant Find button in the left icon rail is gone — `Ctrl/⌘+F` and the Row-1 Find cover it.
  - **The four view toggles are labelled words, not cryptic icons.** Outline numbering, line jumps,
    legend and spell-check moved out of the ambiguous Row-2 icon strip into the **View menu** as
    labelled checkboxes (desktop) / the Options menu (mobile).
  - **The View menu's Arrange tools hide unless Free layout is on** — no more scrolling past a block of
    greyed-out align/distribute rows that don't apply.
  - **Map styling has one home.** Theme, background, connectors, branch weight, fonts and the diagram
    backdrop now live in the **Map panel** (the right panel shown when no node is selected). The Canvas
    menu keeps just the one-shot **Design presets** + **Free layout**, plus a link that opens the panel.
  - **The Row-1 map switcher reads as an action.** It's now an explicit **"Open a map…"** picker for
    browsing your whole library, visually distinct from the open-document tabs below it.

- **The side panels now share one tabbed dock.** Outline, Markers & tags, Power Filter, Conditional
  styles, Version history, Map statistics, Agenda, Maps, Slide deck and the Note editor used to stack
  as separate 250px columns — open four at once on a 1280px screen and they crushed the map to a sliver.
  They now live in a single ~280px **tabbed dock**: one panel shows at a time, a tab strip switches
  between the open ones (each tab has a × to close it), and the canvas keeps its width no matter how
  many you open.

### Fixed

- **Per-topic wrap width now applies on the canvas.** A flat `maxWidth: 320` on the topic node silently
  overrode the per-topic wrap width, so Narrow / Medium / Wide never actually narrowed a node on screen —
  even though `layout.ts` and the SVG export already wrapped to the set width (a canvas==export mismatch).
  The rendered node now honours its width (capped at 320), so the slider above visibly re-wraps. Guarded by
  a render regression test.

- **Bulk edit explains why per-topic fields disappear.** Selecting several topics quietly removed the
  note / links / attachments editors, which read as a bug. The "N topics selected" banner now adds a
  line: "Per-topic fields (note, links, attachments) are hidden — select one topic to edit them."

### Added

- **Right-click a multi-selection for bulk actions.** Right-clicking used to collapse a multi-selection
  to a single node, so batch work by mouse was impossible. When you right-click one of several selected
  topics you now get a **bulk menu** — Delete N topics, Group in a boundary, and bulk Markers / Priority /
  Branch colour — operating on the whole set in one undo step.
- **Drag a multi-selection to re-parent all of it.** In the tree layout, dragging one of several selected
  topics moved only the grabbed one (a silent surprise). It now moves **every selected branch** to the
  drop target in one undo step (nodes nested under another selected node ride along; the root and cycles
  are skipped).

### Changed

- **Indent / outdent now apply to the whole selection.** Previously only Delete was multi-aware —
  `Alt+Shift+←/→` (and `Tab` / `Shift+Tab`) acted on just the anchor and silently abandoned the rest.
  With several topics selected they now restructure the whole selection in one undo step.

### Fixed

- **Delete removes a selected boundary, summary or callout.** Selecting an overlay then pressing Delete
  was a silent no-op — the most expected gesture did nothing. The Delete (and Backspace) key now removes
  the selected overlay.

- **The inspector is usable on a phone.** It stayed a fixed 300px column (~80% of a ~390px screen),
  so editing a topic left almost no canvas. On phones the inspector now docks as a dismissible
  **bottom sheet** (like the side panels) — ~62vh with a grab handle, leaving the map visible above —
  and a **tap-out scrim** dismisses any open sheet so you can't get stuck with the canvas obscured.
- **First-run tips adapt to touch.** On a phone/tablet the "3 things to try" card showed
  Tab / double-click / `⌘K` — none of which exist on touch. It now shows real gestures (tap a topic,
  tap the ＋ to add a child, drag to pan / pinch to zoom). Desktop is unchanged.
- **"Saved locally" can no longer lie.** The badge was a static label, unbound to the actual autosave —
  and a failed write (browser out of storage, private mode) was silently swallowed. It now reflects real
  state: **Saving…** while a write is pending, **Saved locally** once it lands, and a red **Couldn't
  save** if it fails. The app also asks the browser to keep the local library **persistent** (exempt
  from eviction) on startup.
- **Deleting a map warns when other maps link to it.** Maps that roll-up or `#map=`-link the one you're
  deleting would have been left with broken references and no warning. Delete now confirms first when
  other maps point at it (and names them); an unreferenced map still deletes instantly with Undo.
- **The Version-history panel is honest about its limits.** A one-line note now says auto-snapshots are
  throttled (~3 min) and only the last 30 are kept — so you don't expect to roll back to an arbitrary
  point on a busy map (use **Save version now** to pin one).
- **Image / SVG / HTML / PDF export no longer fails silently.** When there's no live canvas to render
  (e.g. the command runs while the Board is open), these exports used to do nothing at all — no file,
  no message. They now show a hint ("Open a map on the canvas first…") instead of a silent no-op. The
  model-backed formats (JSON / Markdown / Word / Excel / PowerPoint) were never affected.
- **Imports from other apps now say what didn't come across.** Only `.mmap` ever reported lossy
  conversions; importing XMind / Word / Excel / FreeMind / OPML / SimpleMind / iThoughts / MindMeister /
  MindMup / Mermaid / Markdown / TextBundle silently dropped styling, relationships or images and
  reported a clean "success." Each now carries a one-line note so you don't trust a faithful round-trip.
- **A corrupt file in a multi-file import no longer aborts the batch.** One bad file used to stop the
  whole import — leaving the maps that already parsed orphaned in the library with only an "Import
  failed" message. Each file is now imported independently; the banner reports "Imported X of Y maps
  (Z failed)" and lists which files couldn't be read.
- **`Ctrl/⌘+F` no longer hijacks typing.** Pressing it while editing a topic, a note, or any text field
  used to yank focus to Find mid-edit; it now respects the editing context (matching the `/` shortcut).

### Added

- **A Settings screen.** A new ⚙ Settings dialog (left rail + `⌘K` → "Settings & preferences")
  consolidates the bits of app state that previously lived only in scattered `localStorage` keys: pick
  the **canvas theme**, **re-show the getting-started tips**, **clear the command history** or the
  **branch clipboard**, see how much **local storage** the library uses, and **clear all local data**
  (with a confirm). For a local-first app where everything lives in one browser, this is the "what's
  stored / reset it" surface that was missing.
- **The map accent colour is now a one-click control.** The accent (the default tint for relationship
  lines and boundary boxes) could previously only be changed as a side effect of applying a whole Design
  preset — which also rewrote your theme, connectors and branch weight, and only offered the preset's
  fixed colour. The **Map** inspector (no node selected) now has an **Accent** colour picker with Reset,
  so you can set any accent without disturbing the rest of the style.
- **Notes have a Link button.** The note editor rendered markdown links and even advertised "links" in
  its placeholder, but the only way to add one was to hand-type `[text](url)`. There's now a **🔗 Link**
  button (next to Image / Table): with text selected it wraps the selection; with nothing selected it
  appends the URL as a link. `http(s)` / `mailto:` / in-page `#` targets only.
- **Find & Replace gained Next / Prev controls and an announced match count.** Cycling matches was
  Enter-only and undiscoverable, and the "3/12" / "no matches" / "invalid regex" counter was invisible
  to screen readers. There are now **▴ / ▾** buttons (and **Shift+Enter** steps backwards), and the
  counter is a live region that announces as you cycle.
- **The Agenda gained a "Later" bucket.** Tasks due more than 7 days out were dropped entirely — the
  panel even read "empty" when future-dated work existed. They now appear under **Later**, soonest-first.
- **Import notes are dismissible and expandable.** The warning/error strips now have a **×** to dismiss,
  and the notes banner expands from "(+N more)" to the full list.
- **Saved views: delete is undoable and same-name saves are acknowledged.** Deleting a view now shows a
  **Delete + Undo** toast (matching map deletion), and re-using a view name reports "Replaced view …"
  instead of silently overwriting it.
- **The keyboard cheat-sheet now documents the bindings it was missing** — arrow-key tree navigation,
  `Ctrl/⌘+Shift+↑/↓` reorder, `Alt+Shift+←/→` indent/outdent, `Ctrl/⌘+Y` redo, and the file shortcuts
  (`Ctrl/⌘+S` / `Shift+S` / `O`).
- **The command palette supports Home / End / PageUp / PageDown** and keeps the highlighted row scrolled
  into view in long lists.

### Changed

- **Toasts and the import banners are theme-reactive.** They read from `--ed-toast-*` tokens (with the
  old colours as fallbacks) instead of hardcoded hex, so feedback no longer renders as a pale light box
  on a dark canvas — and it's wired up for the upcoming app-wide dark mode.
- **The editor toolbar now fits a phone.** On ≤640px the two rows overflowed — row 2 scrolled with
  controls off-screen and no affordance, and row 1 clipped Find/Export/More entirely. Mobile now uses
  icon-only menu triggers; the view toggles + Layout collapse behind a single **Options** menu (bottom
  sheet), and the lowest-value widgets (the New-map picker, All-maps search, "Saved" badge, Quick-add
  box, Brainstorm Timer) are dropped on phone (all reachable from the Start screen / command palette).
  Panels / View / Insert / Canvas / Options and Find / Export / More all stay visible. Desktop is
  unchanged.
- **The inspector's note formatting toolbar wraps instead of clipping.** The 13 format buttons
  (B / I / S / lists / H1–H3 / highlight / code / image / table) now reflow onto multiple lines within
  the panel, so none are cut off at the default rail width.
- **The command palette stops repeating its category badge.** The kind label (e.g. "map") now shows
  only at the start of each same-kind run, instead of stacking down every row.

- **Editor chrome decluttered — a calmer toolbar.** A UX pass moved occasional/power controls out of
  the always-on top bar so the primary actions read first:
  - **Find & Replace is now a `Ctrl/⌘+F` overlay** (also `/` or the new **🔍 Find** button) anchored
    top-right of the canvas, replacing the inline Find/Replace/Aa/`.*`/Replace-all strip that used to
    camp the top bar. It's non-modal — the map stays visible and editable behind it; **Esc** closes it.
  - **Connector style, branch growth, and type (base font + size) moved into the Canvas menu**,
    alongside Design/Theme/Background. **Layout** stays in the toolbar (it's changed often).
  - **Insert** now carries a subtle accent tint so the core "add content" action stands out from the
    output/overflow controls.
- **First-run "3 things to try" card no longer covers the map.** It's anchored to the top of the
  canvas (dead space below the toolbar) instead of bottom-left over a branch, which also de-clutters
  the bottom edge (minimap + zoom pill).
- **Start screen's narrow-width navigation is a proper drawer.** Below 640px the section nav collapses
  behind a **hamburger** button and slides in over a backdrop (close on select, backdrop click, or
  Esc) — replacing the cut-off horizontal scroller.

### Fixed

- **The first-run tips card is sized for phones.** On a narrow viewport the "3 things to try" card no
  longer dominates the screen — a mobile breakpoint trims its width, padding, and font.
- **Example polish:** the "Product launch plan" example's boundary is now labelled **"Launch window"**
  so it no longer echoes the **"Go-live week"** branch node it wraps (the text appeared twice).

- **Delete now removes the whole multi-selection, not just one node.** Marquee- or Shift/Ctrl/Cmd-select
  several topics and press Delete (or the inspector's Delete) — every selected branch goes in one
  undoable step, re-selecting a surviving neighbour. Previously only the anchor (last-touched) node was
  deleted; the rest stayed. Overlapping selections (a parent + its child) collapse to one deletion; the
  central root is still never deleted.
- **Undo/redo restores the selection, not just the structure.** Each history snapshot now carries the
  anchor that was selected with it, so undoing a delete brings the branch back *and* re-selects it (and
  the inspector follows) — MindManager-style — instead of leaving the selection stranded on a neighbour.
- **Esc / click-away on a brand-new empty topic discards it.** Pressing Tab/Enter to spawn a topic and
  then leaving it without typing no longer strands a blank node on the canvas; the abandoned topic is
  dropped cleanly (and doesn't linger in undo). A topic you actually typed into is kept.
- **The collapse toggle sits on the branch tip, not toward the root.** On the two-sided map's left half
  (and all-left layouts) the −/＋ expand control now hangs off a node's left (leaf-facing) edge instead of
  always the right, matching MindManager. Right-side and downward layouts are unchanged.
- **Modals close on a backdrop click.** Clicking outside the About / Shortcuts / search / paste dialogs
  now dismisses them, the convention every modal follows (Escape and the ✕ still work too).
- **Deleting the central topic explains itself.** Trying to delete the root now shows a brief "The
  central topic can't be deleted." hint instead of silently doing nothing.
- **Updates (and every toast) now work on the Start screen.** The toast surface lived only in the
  editor view, so while a user sat on the Start screen — the most common landing screen — the PWA's
  automatic "A new version is available — Refresh now" prompt was produced but never rendered, and there
  was no manual update control there at all. The single toast surface was extracted into a `ToastBar`
  that now renders in both views (a fixed top-centre overlay on Start), and the Start screen's **About**
  gained a **Check for updates** button mirroring the editor's, so a pending update is both visible and
  actionable without first opening a map.

- **⌘K command palette was unreadable in the editor.** The palette's styles pulled colours from
  `--st-*` tokens defined only on the Start screen (`.start`), so when opened in the editor it had no
  background — the canvas bled through and rows overlapped. The cmdk colours now chain
  `--st-* → --ed-* → a literal`, so the panel is opaque in both places.

- **Selecting a branch buried the map under per-node toolbars.** The on-node action bar (📝/⚑) and the
  ＋ add buttons were shown on every *selected* node, so a branch/marquee select popped them on every
  node at once — unusable. They're now suppressed whenever 2+ nodes are selected (the shared selection
  toolbar covers bulk actions); they still appear on hover and on a single selection.

- **Branch connectors blobbed into thick clumps.** The new "bold" growth weight was too heavy (1.6×)
  and the Midnight/Sunrise designs silently switched it on, so branches — especially where several
  children fan from one parent — merged into dark blobs. Tamed the weights (fine 0.72× / bold 1.3×),
  reverted the Designs to the default "regular" weight (growth stays a manual choice), and added a
  fan-aware trunk taper that thins the shared origin for dense fans (past 3 children) so it stays
  legible. Maps with ≤3 children per node and the default weight render exactly as before.

### Added

- **Insert a template as structure under a topic (A4).** The Insert menu gained a **Template** section: pick SWOT, Brainstorm, Lean Canvas, etc. and its branches graft under the selected topic (fresh ids), alongside the existing Map-part inserter. Pure `templateSubtree` / `insertableTemplates` helpers reuse `addSubtreeToSelected`.

- **Rapid keyboard entry in the Outline panel (A3).** While editing a row inline, **Enter** adds a
  sibling, **Tab** a child, and **Shift+Tab** outdents — each hops the inline editor straight onto the
  new topic, so you can build a whole branch from the keyboard without leaving the panel (mirrors the
  canvas's Enter/Tab/Shift+Tab). The panel was already double-click-rename + drag-reorder + ◂▸ indent.

- **Regex + case-sensitive Replace (A1).** The find/replace bar gained a **Match case** ("Aa") and a
  **Regex** (".*") toggle. With Regex on, the Find box is a pattern (capture groups, `\d+`, etc.);
  Match case drops the case-insensitive default. A malformed pattern reports "invalid regex" instead of
  silently doing nothing. Replace still spans topics / notes / both per the scope dropdown.

- **Ctrl/⌘+T opens the selected topic's note** (in the **installed PWA** only — a normal browser tab
  reserves Ctrl+T for a new tab), and hover callouts now name their keyboard shortcut —
  the ＋ buttons read "Add child (Tab)" / "Add sibling (Enter)", the note quick-action reads "Add/Open
  note (Ctrl/⌘+T)", and the edit hint reads "Double-click or F2 to edit". Added to the shortcuts cheat
  sheet.

- **Theme-driven branch growth weight (theming batch B).** A map-wide **branch "growth"** control
  (Canvas toolbar → Growth: Fine / Regular / Bold) scales every branch line's thickness — the
  MindManager per-theme line-weight dimension, on top of the existing connector *style*. It's a
  map-wide `meta.branchGrowth` (absent = the historical
  "regular" widths — no change for existing maps), threaded through the shared `branchWidths` /
  `branchRender` so the canvas and the SVG/PNG/PDF export render identical line weights. Lossless in
  `.json`.

- **Custom slide deck builder (#3).** The presentation/deck was auto-generated (overview + one slide
  per top branch). A new **Slide deck** panel (View → "Slide deck (custom)") lets you pick which
  topics become slides, **reorder** them, add a **speaker note** per slide, and "Restore default" to
  clear it. The custom deck (`meta.slides`, additive + lossless) is honoured by all three consumers —
  the on-screen presentation, the presenter sidebar (note overrides the topic's own), and the HTML
  deck export — falling back to the auto deck when unset or when every referenced topic has been
  deleted. Pure `resolveSlides` / `deckRows` / `deckEdit` cores.

- **SmartRules actions — rule-applied marker + branch colour (#13).** A conditional-formatting rule can
  now also **auto-apply a marker** and/or a **branch colour** to matching topics (e.g. auto-flag every
  overdue topic 🚩 and tint its branch red), not just a fill/border. Like the existing style overlay
  it's computed **render-time** and never written to the model — markers are unioned onto the node's
  own and a manual `branchColor` still wins. Because the actions merge into the projected node data,
  the canvas and the SVG/PNG/PDF export render them identically. Authored from the Styles panel's rule
  form. (Rule-applied *tags* are intentionally excluded — a virtual tag wouldn't appear in the tag
  index / Power Filter, so it'd mislead.)

- **Categorised, searchable icon & sticker library (#12).** The marker picker's catalog grew (+16
  glyphs — people, flags, status, trend) and the **sticker** picker gained a search box plus
  category-grouped browsing (Status / Symbols / Actions / Objects), mirroring the marker search. Five
  new stickers (25 total) and Person / Calendar / Hot now in the default marker palette (with
  flat-vector bodies, so canvas == export holds). Pure `searchStickers` / `stickerCategories` helpers.

- **Swimlane layout (structure batch C).** A new **Swimlane** layout (Canvas → Layout) arranges the
  root's top branches as one row of vertical lanes — each level-1 topic is a lane header with its
  subtree flowing beneath — for comparison / kanban-style maps. Reuses the grid/matrix machinery (a
  single row) so it flows through the shared layout + export unchanged (canvas == export).

- **Drag to reorder siblings on the canvas (structure batch C).** Dragging a topic now shows an
  **insertion line** at a target's top/bottom edge — drop there to place it *before/after* as a sibling
  (a reorder or cross-parent move), while dropping on the middle still nests it as a child. Reuses the
  outline panel's drop-band rule (`outlineDropWhere`/new `dropWhereInBox`) and the `moveInTree` op.

- **Maps index panel (structure batch C).** A dockable **Maps** panel (View → "Maps (all maps)") lists
  every saved map with a filter box; click a row to switch to it, with the current map marked. The top
  tab strip only shows *open* maps, so this gives an in-editor jump list across the whole library.

- **Focus-mode hotkey (structure batch C).** **Ctrl/⌘ + .** drills the canvas into the selected topic
  (re-rooting the view, with the existing "Drilled into…" breadcrumb to step back out); pressing it
  again — or **Esc** — exits. Ignored while typing. Added to the shortcuts cheat sheet.

- **Raised topic style (theming batch B).** A topic can opt into a soft **drop shadow** for a raised,
  MindManager-style look — toggled from the StyleBar (◰ raised / ◳ flat). It's a persisted `NodeStyle`
  field, so it renders identically on the canvas (CSS) and in the SVG/PNG/PDF export (a shared SVG
  filter), preserving canvas == export.

- **Per-theme relationship & boundary colours (theming batch B).** Applying a **Design** now also sets
  a map-wide **accent** (new `meta.accentColor`) used as the default stroke for relationships and
  boundaries, so a design recolours the whole map coherently instead of leaving them a fixed purple.
  Per-object colours still win, and a map with no accent is pixel-unchanged (canvas == export). New
  fallback in `resolveLinkStyle` / `resolveBoundaryStyle` + a `setAccentColor` op.

- **Design gallery thumbnails (theming batch B).** Each design in the Canvas → Design menu now shows a
  tiny rendered preview — the theme's background + a root dot + three palette branches drawn with the
  design's connector style — so the looks are distinguishable at a glance instead of by an identical
  palette icon. Pure `designPreviewModel`.

- **Notes & links polish (MindManager parity batch A).**
  - **Richer note editor** — the note toolbar gains **H1/H2/H3 headings**, **highlight** (`==text==` →
    `<mark>`), a **code block** (` ``` ` fenced), and **checklists** (`- [ ] / - [x]`), on top of the
    existing bold/italic/strike/lists/links/images/tables. All round-trip through the markdown subset.
  - **Hyperlink parity** — `tel:` links are now allowed (alongside the existing `http(s)`, `mailto:`,
    `#node=`/`#map=`); the link field advertises the supported schemes. (`file:` stays excluded —
    browsers block `file://` from a web context.)
  - **Notes in PDF export** — the print/PDF export now appends a **Notes** section (every topic's note,
    by outline number) after the map page; previously PDF was the map image only. New pure
    `buildNotesAppendix`.

- **Seven new starter templates.** The New-map gallery gains analysis + knowledge/sharing skeletons to
  balance the existing team/meeting set: **PESTLE** (companion to SWOT), **Fishbone / cause & effect**
  (the 6M categories — companion to 5 Whys, pairs with the Fishbone layout), **OKRs**, **Essay outline**,
  **Presentation outline**, **Lean Canvas**, and **Persona**. Each is a data-driven entry in
  `src/templates.ts`, so it auto-appears in the Templates gallery with a live preview.

- **MindManager-inspired UI batch.** A round of canvas/editor affordances brought across from the
  MindManager UX survey:
  - **Click the priority chip to cycle it** (none → High → Med → Low → none) right on the node, like the
    progress pie and task checkbox — no trip to the inspector. New pure `cyclePriority`.
  - **On-topic hover action bar** — hovering/selecting a topic shows a small toolbar with one-click
    *add/open note* and *add/cycle priority* (the actions otherwise only in the inspector).
  - **Style-preset gallery** — saved named styles appear as a **Presets** swatch row on the StyleBar;
    click one to apply it to the selection.
  - **Agenda panel** (View → *Agenda*) — a read-only list of every dated, unfinished task bucketed into
    Overdue / Today / This week, click-to-focus. New pure `agendaBuckets` selector.
  - **Images & simple tables in notes** — the note markdown subset now renders `![alt](url)` images
    (http(s)/data:image only) and GitHub-style pipe tables, with 🖼/▦ editor buttons; both round-trip to
    plain markdown.
  - **Reshape a relationship by dragging its midpoint** — a selected cross-link shows a draggable dot
    that bows the arc (its `curve`), with a live preview and one undo step. New pure `curveFromHandle`.
  - **Drag a desktop file onto a topic** — the first image becomes the topic's picture, anything else
    attaches. New pure `nodeAtPoint` hit-test + id-based `setNodeImage` / `addNodeAttachment`.
  - **Group-drag a multi-selection** in free-canvas mode now moves and *keeps* the whole selection (one
    undo step), instead of only the cursor node. New pure `setNodePositions` batch op.
  - **Animated expand/collapse** — collapsing/expanding a branch eases the surviving nodes to their new
    positions (~240 ms, `requestAnimationFrame`), honouring the OS *reduce-motion* setting. Pure
    `easeInOutCubic` / `lerp`.
  - *(Already shipped, verified this round)* the **minimap** is pannable/zoomable with per-branch node
    colours, and **live spell-check** squiggles toggle on both the topic and note editors.

- **Floating topics are first-class for editing.** A floating topic and the nodes inside it now accept
  the full edit set — **Add child / Add sibling / Indent / Outdent / Move / Delete / Group in boundary /
  Summarize / Paste branch**, plus every inspector edit (rename, note, branch colour, line style,
  hyperlink, task fields, style, image, attachments, collapse, callouts). These ops previously resolved
  only the central tree, so the context-menu actions and inspector edits silently no-op'd on a floating
  topic even though it rendered and could be selected. Add-sibling/indent/outdent cross the
  tree↔floating boundary sensibly (a floating topic's child can outdent to its own top-level floating
  topic; a floating topic can indent under the previous one). Central-tree behaviour is unchanged.

- **Relationship style presets.** The relationship inspector now leads with a **Presets** row — Arrow,
  Dashed, Dotted, Thick, Curved, Double — so one click sets a cross-link's whole look (dash + width +
  curve + arrowhead) in a single undo step. `setLinkStyle` now also accepts `arrow`.

- **Per-map typography.** New **Type** controls (canvas row) set a map-wide base **font family** (Sans /
  Serif / Mono, or Default) and a **size scale** (Compact / Comfortable / Large). Both layer under any
  per-topic font override and thread through the layout estimate, the canvas, and the SVG/image export
  (canvas == export). New `meta.fontFamily` / `meta.fontScale` + `setFontFamily` / `setFontScale` ops.

- **Detach a branch to a floating topic.** Right-click a topic → **Detach to floating topic** pops it
  and its whole subtree out of the hierarchy into a free-floating topic; a floating topic's menu offers
  **Re-attach to centre** (or just drag it back in). New pure `detachBranch` op; re-attach reuses
  `reparent`.

- **Arrow-key topic navigation.** With a topic selected (and not editing), the **arrow keys** move the
  selection through the tree — **←** parent, **→** first child (unless collapsed), **↑ / ↓** previous /
  next sibling — panning the canvas to keep it in view. New pure `nextSelectionId(doc, id, dir)`.

- **Lock a topic's position.** Right-click a topic → **Lock position** to pin it: in free-canvas mode a
  locked node can't be dragged and **Align** / **Distribute** skip it, so a carefully-placed topic stays
  put (a 🔒 badge marks it; unlock from the same menu). New per-node `locked` flag + `toggleLocked` op.

- **Tag → colour mapping.** The **Markers & tags** panel now carries a colour swatch beside each tag:
  pick a colour and every topic with that tag is tinted (⊘ clears it). Implemented as a stable,
  upserted `kind:"tag"` conditional-format rule, so it flows through the existing rule engine, canvas
  tint, and legend. New pure `tagColor` / `setTagColor` helpers.

- **Find / Replace in notes.** The header's **Replace all** now takes a scope — **Topics**, **Notes**,
  or **Both** — so the find text can be swapped inside note bodies, not just topic labels. Each changed
  field is counted; topics-only stays the default. New `scope` arg on the `replaceTopics` op + handle.

- **Inline relationship label editing.** Double-click a relationship line to edit its label **in place**
  on the canvas (Enter / blur commits, Esc cancels) — previously inspector-only. Reuses the
  `setLinkLabel` op via a small link-edit context.

- **Per-topic wrap width.** The topic format bar's **Wrap** control (Narrow / Medium / Wide / None)
  sets a max width so a long label **wraps** instead of stretching across the canvas — MindManager's
  topic-width control. New `NodeStyle.maxWidth`, honoured by the layout estimate, the canvas, and the
  SVG export (canvas == export).

- **Outline numbers in copy / Markdown export.** When outline numbering is on, **Copy outline** and the
  **Markdown export** now bake the numbers (`1.2`, `I.A`, … honouring the chosen scheme) into each
  topic line. Off when numbering is off, so the Markdown still round-trips. `toMarkdown` gains an
  optional numbers map.

- **Spell-check toggle.** A toolbar toggle (and ⌘K) turns on the browser's native spell-check in the
  topic + note editors — **off by default** (no red squiggles in screenshots/exports), persisted when
  on. Threaded through the editing context (topics) and the note editors.

- **Isolate branch (collapse others).** **View ▸ Isolate branch** (and ⌘K) collapses every other top
  branch and reveals the path to the selected topic — a fast "focus on this line" that stays editable
  in place (unlike drill-in, which re-roots the view). New pure `isolateBranch` op.

- **Smart alignment guides (free layout).** Dragging a topic in whiteboard/free-canvas mode now shows
  amber guide lines when its edges or centre line up with nearby topics, and the topic snaps into
  alignment on release — design-tool-style. Pure `computeSnap` (edges + centres, nearest within a
  threshold); guides drawn in flow space via React Flow's ViewportPortal.

- **Saved views.** Bookmark a perspective on a map — its **pan/zoom + drill-in target + active Power
  Filter** — and jump back to it from **View ▸ Saved views**. Persisted per map. New canvas
  `getViewport` / `setViewport` handle methods, a pure `addView` / `removeView` + a `useSavedViews`
  store.

- **Dockable note editor.** A **View ▸ Note editor (dockable)** panel (and ⌘K) puts the selected
  topic's note in a full-height rail editor — more room than the inspector's compact box — reusing the
  same rich note editor + draft pipeline. Handy for knowledge maps with long notes.

- **Auto-marker suggestions.** The inspector's Markers section now offers a **Suggested** row of marker
  chips inferred from the topic's text (e.g. "urgent" → ❗, "why…?" → ❓, "blocker/risk" → 🚩,
  "idea" → 💡) — click to apply, opt-in (only shows when something matches and isn't already on the
  topic). Pure `suggestMarkers` / `suggestNewMarkers`.

- **Group a selection in a boundary.** Beyond "group branch" (a subtree), **Insert ▸ Group selection
  (boundary)** (and ⌘K) now wraps any **2+ selected topics** in one filled boundary box — MindManager
  boundaries around an arbitrary set. New pure `groupNodes`, sharing an extracted `addBoundaryForNodes`
  core with `groupBranch`.

- **Quick task toggle (topic checkbox).** Hovering a topic now shows a checkbox on its left edge —
  click to cycle **not-a-task → to-do → done** (a checked box stays visible) — MindManager's task tick,
  without opening the inspector. Pure `cycleTaskProgress`; the existing progress pie still handles
  fine-grained steps. 

- **Map parts (insert a mini-structure).** A new **Insert ▸ Map part** group (and ⌘K) drops a
  ready-made labelled subtree under the selected topic — **SWOT**, **Pros & cons**, **5W1H**, or a
  **Meeting agenda** — MindManager's map parts. Pure `MAP_PARTS` builders grafted via the existing
  add-subtree path.

- **Copy map as a table (TSV).** A **Copy as table (TSV)** action (Export menu + ⌘K) puts the whole
  map on the clipboard as one row per topic — Topic · Depth · Note · Tags — for pasting straight into
  Excel / Google Sheets. The inverse of the paste-spreadsheet path, so the two round-trip. New pure
  `mapToRows` / `mapToTsv`.

- **Guided walk (presentation tour).** A new **Canvas ▸ Guided walk** (and ⌘K) steps through every
  topic in outline order with a spotlight (the focus dim) + auto-centre + the topic's note shown as
  speaker notes — a lightweight presentation between drill-in and full-screen Present. **←/→** step,
  **Esc** exits; a bottom bar shows position, title, and the note.

- **Drag-to-relate.** Hovering a topic now reveals a small grip on its right edge — drag it onto
  another topic to draw a relationship (cross-link) in one gesture, MindManager-style. The existing
  "Link to…" click flow still works; this just adds the faster drag path (React Flow loose-mode
  connections → the shared `addLink` op, so the link is identical).

- **Paste a spreadsheet selection as topics.** The **Paste text → topics** dialog now recognises a
  table copied from Excel / Google Sheets (or any TSV/CSV block): each **row becomes a topic**, extra
  columns become its **note** (labelled by the header row when present), and a **Tags** column becomes
  the topic's tags. Indented outlines and Markdown still route to the outline parser. New pure
  `parseTable` / `tableToForest` / `parsePaste`.

- **Map legend.** A new toolbar toggle adds an auto-generated **Legend** box (top-left) listing every
  marker, tag, and conditional-format rule in use with its meaning — MindManager's legend. It's drawn
  on the canvas *and* in the SVG/PNG/PDF export from one shared `buildLegend`, so screen == export. New
  `meta.legend` flag + `setLegend` op/handle.

- **Design gallery.** A new **Canvas ▸ Design** menu applies a coordinated one-click "look" — canvas
  theme + branch connector style together (Classic / Blueprint / Midnight / Sunrise / Diagram) —
  MindManager's Design tab. Pure `DESIGNS` data over the existing theme + connector controls (no new
  styling mechanism).

- **Power Filter: hide mode + extract to a new map.** The Power Filter can now **hide** non-matching
  topics (a clean spotlight) instead of only fading them, and **Extract matches to a new map** prunes
  the current matches (plus their ancestors, so the structure holds) into a fresh library map — leaving
  the original untouched. New pure `filterToDoc`; hide mode threads through to the canvas
  (`hideUnmatched`) and `buildFlowState`.

- **Image fill for topics.** A topic can be filled with a picture that covers the whole card (the
  Style tab's **Fill image…**), distinct from the side `image` — MindManager's "fill with image". The
  canvas paints it as a cover background with a readable text scrim; the SVG/PNG/PDF export draws a
  rounded-clipped cover `<image>` + scrim so canvas == export. New `NodeStyle.fillImage` (data URL,
  lossless in `.json`).

- **Marker groups (single-select sets).** Markers are now grouped like MindManager's Map Markers —
  **Priority** (1–9), **Status** (the colour dots), **Mood**, and **Vote** (👍/👎). A topic carries at
  most one marker per group, so picking another in the same group replaces it; markers outside a group
  still multi-toggle. Pure `markerGroupOf` / `toggleMarkerInList`, applied in `toggleIcon` (so bulk
  toggles inherit it).

- **Outline numbering schemes.** When numbering is shown you can switch between **decimal**
  (1, 1.1, 1.1.1) and the **legal outline** (I, I.A, I.A.1, I.A.1.a … cycling I/A/1/a/i by level) from
  the numbering control in the toolbar — MindManager's numbering options. The scheme is a per-map
  property (`meta.numberStyle`, lossless) shared by the canvas, the outline panel, and the inspector.

- **Word count & reading time.** The **Map statistics** panel now totals every topic title + note
  into a word count and an estimated reading time (~200 wpm); the inspector's facts line shows a
  per-topic "~N min read" for longer topics. Pure `countWords` + extended `mapStats`.

- **Map statistics panel.** A new **View ▸ Map statistics** panel (⌘K too) summarises the whole map
  at a glance — topic / leaf / depth counts, task health (tasks, completed %, **overdue**), and content
  tallies (notes, attachments, distinct tags & markers, relationships, boundaries). Numbers come from a
  pure `mapStats()` so they're unit-tested independently.

- **SmartRules-lite — more conditional-format triggers.** Conditional styles can now match **overdue**
  tasks, **priority ≤ N** (1=High), **topic text contains…**, and **has attachment** — alongside the
  existing tag / marker / completed triggers. Extends the pure `matchesRule` / `describeRule` core
  (so canvas == export) and the Styles panel's rule builder.

- **Tag autocomplete + map-wide tag manager.** The inspector's *Add a tag* box now suggests tags
  already used in the map (a `<datalist>`), so naming stays consistent. The **Markers & tags** panel
  becomes a manager for tags: **✎** renames a tag everywhere (rename to an existing name **merges**
  the two) and **✕** deletes it from every topic. New pure `renameTag` / `deleteTag` ops + `renameTag`
  / `deleteTag` on the canvas handle (normal undoable, autosaved edits).

- **Editable outline panel.** The outline rail is no longer read-only navigation: **double-click** a
  row to rename it inline, use the **◂ ▸** controls to promote / demote a topic (the same indent /
  outdent ops as Alt+Shift+←/→), and **drag a row** to restructure the map — drop it before, after, or
  onto another topic (the broad middle nests it as a child). New `moveInTree` op + pure
  `outlineDropWhere`; backed by id-addressed `renameNode` / `indentNode` / `moveOutlineNode` on the
  canvas handle so every change is a normal undoable, autosaved edit.

- **Branch-colour topic fills (tint & gradient).** The topic format bar gains two fill treatments
  derived from a topic's branch colour (or its explicit fill colour): a soft **tint** wash and a
  vertical **gradient** — MindManager's filled-topic look without picking exact colours. Pure
  `resolveTopicFill` resolver shared by the canvas node and the SVG exporter (a gradient emits a
  per-node `<linearGradient>` so canvas == export); the fill reverts the level-based default styling
  to a normal card so the chosen fill always shows.

- **Searchable marker library.** The inspector's marker bar gains a search box that finds markers by
  name, keyword or glyph (e.g. "done" → ✅, "warning" → ⚠️, "budget" → 💰) over a richer catalog
  (`MARKER_CATALOG`) — clear the box to fall back to the curated default palette. New markers are
  free to toggle and drag onto any topic like the existing ones.

- **Find highlights every match on the canvas.** Typing in the **Find** box now rings every matching
  topic (live, as you type), so you can see all hits at once; **Enter** still steps through them with
  the n/total counter. Clearing the box removes the highlights.

- **Keyboard restructuring.** Reorder a topic among its siblings with **Ctrl/⌘+Shift+↑/↓**, and
  promote/demote it with **Alt+Shift+←/→** — MindManager-style move-up/down + outdent/indent without
  the mouse. New `moveSibling` op (reusing the existing `indent`/`outdent`).
- **Paste an image onto a topic.** With a topic selected, **Ctrl/⌘+V** an image from the clipboard to
  set it as that topic's image (ignored while typing in a field/note, so text paste still works).

- **Align & distribute (free-canvas).** In whiteboard/freeform mode, select 2+ topics and align them
  to a shared edge or centre (left / centre / right / top / middle / bottom), or distribute 3+ evenly
  (horizontal / vertical) — view menu + ⌘K. Pure `alignNodes` / `distributeNodes` ops using measured
  node sizes.
- **Status bar.** A slim bar at the bottom of the canvas shows the visible topic count, the current
  selection size, and the live zoom % (complements the existing minimap + zoom controls).

- **Drill in (focus on topic).** Re-root the canvas at the selected topic so its subtree fills the
  view — MindManager's "focus on topic" (view menu / ⌘K "Drill into the selected topic"). A bar shows
  what you're drilled into with **Exit (Esc)**, and the breadcrumb becomes the drill navigator (click
  an ancestor to re-root there, the map root to exit). It's **fully editable** while drilled and
  **non-destructive**: it's a pure view transform (`viewDoc`) — every edit, undo, and autosave still
  operates on the whole map, so exiting restores the full map with all cross-links/boundaries intact.

- **Canvas breadcrumb bar.** When a topic is selected, a thin location bar above the canvas shows its
  path (Root › Branch › …); click any crumb to centre that ancestor — MindManager's breadcrumb,
  handy for navigating big maps. (The path was previously only in the inspector header.)

- **Drag markers onto topics.** The marker chips in the inspector are now draggable — drag one onto any
  topic on the canvas to toggle it there (the topic highlights as a drop target), MindManager's Map
  Markers gesture. Clicking a chip still toggles it on the current selection.

- **Inline rich-text mini-toolbar.** While editing a topic, a small floating **B / I / U + colour**
  bar appears above it (MindManager's inline format bar) — discoverable buttons for the formatting that
  was previously keyboard-only (Ctrl+B/I/U still work). Writes to the existing sanitised `topicRich`.
- **Hover-peek for notes & attachments.** Hovering a topic's 📝 indicator shows the note's text in a
  small card (read it without opening the inspector); the 📎 chip's tooltip now lists the attached file
  names. (Links already show their URL on hover.)

- **Format Painter + Auto-colour branches.** **Copy format** grabs the selected topic's style and
  **Paste format** applies it across the (multi-)selection in one undo step (view menu + ⌘K) — reuse a
  look without the save-a-named-style detour. **Auto-colour branches** repaints each top branch with a
  distinct colour from the theme palette (a one-click restyle). New `assignBranchColors` op +
  `copySelectedStyle`/`shuffleBranchColors` on the canvas handle.

- **Detail levels (expand the map to a depth).** A new **Detail level** group in the view menu (and
  ⌘K) — **Show level 1…5** — collapses everything below the chosen depth, so you can step a large map
  from a top-branch overview to full detail in one click (MindManager's detail-level control).
  Complements the existing Collapse-all / Expand-all. New `setExpandedToLevel` op + `walkTree` helper.

- **Richer MindManager `.mmap` import.** Opening a `.mmap` now recovers a lot more than the bare
  structure — all into existing model fields, so it shows on the canvas and survives a Save-as `.mmst`:
  - **Per-topic task info** — start/due dates, priority (`Prio1..5`→1..5), and progress
    (`TaskPercentage`→0..1). Previously detected-and-dropped with a warning; now imported (the
    inspector, Power Filter, and Kanban board already support these fields). Resources come across too.
  - **Full notes** — the complete `NotesXhtmlData` XHTML body (flattened to text), instead of only the
    truncated `PreviewPlainText`.
  - **User tags** — `TextLabels` import as node tags.
  - **Per-topic colour, font & shape** — explicit fill/line colour, font (family/size/bold/underline/
    colour), and geometric `SubTopicShape` (oval/hexagon/octagon) map to node style (ARGB alpha-first →
    `#rrggbb`; fully-transparent fills are left to the theme).
  - **Rich-text runs** — `Text>FontRange` bold/italic/underline/strike + per-run colour become inline
    rich text (`topicRich`), with the plain topic kept as the fallback.
  - **Embedded images & attachments** — `OneImage` / `AttachmentGroup` binaries (`mmarch://bin/…`) are
    inlined as data URLs (attachments recover their real name from `@FileName`; vector EMF/WMF images
    without a raster fallback are skipped with a warning).
  - **Relationship & boundary styling** — relationship colour/width/dash/arrowheads and boundary
    colour/shape/dash; plus **callouts** (`CalloutFloatingTopicShape`) and the **map background colour**.

  Still intentionally lossy (theme-only/inherited styling, summary brackets, EMF/WMF vector images, and
  the Gantt/resource-scheduling layer) — see `NEXT_STEPS.md`.

- **New worked example: "GTD Areas of Focus."** A filled-in map of David Allen's GTD **Horizon 2**
  (the 20,000-ft view) — standing roles/responsibilities (Professional / Personal / Community) rather
  than projects or next actions, with status markers and a note explaining how the horizon is used.
  Joins the existing "GTD natural planning" example in the **+ New… ▸ Examples** menu.

- **Work with maps as files on disk (`.mmst`).** Beyond the always-on IndexedDB library, a map can now
  be opened from and saved to a real file, like a desktop app: **Open file…** (Ctrl/⌘+O), **Save**
  (Ctrl/⌘+S — writes back to the bound file with no dialog), and **Save as…** (Ctrl/⌘+Shift+S), all in
  the **More ▸ File** menu and the ⌘K palette. Once a map is linked to a file, edits **autosave through
  to it** (debounced, and silently — a background write never pops a permission prompt), the window
  title shows the filename with a ● while the file is behind, and an unsaved-changes guard warns before
  you leave. The bound file handle is remembered (IndexedDB) so the link survives reloads. `.mmst` is
  MindMap Studio's native extension and holds the same lossless schema-v1 JSON as `.json` (so a `.mmst`
  imports anywhere a `.json` does, and vice-versa).
  - **Windows file association.** The PWA manifest now declares a `file_handlers` entry for `.mmst`
    plus `launch_handler: focus-existing`. On Chromium desktop (Chrome/Edge), an **installed** copy can
    be set as the default app for `.mmst`, so double-clicking one in Explorer opens it in the running
    app (handled via `window.launchQueue`).
  - **Graceful fallback.** Browsers without the File System Access API (Firefox/Safari, mobile) fall
    back to a plain download for Save and the existing import picker for Open; IndexedDB autosave is
    unchanged, so nothing is ever lost. New module `src/io/fileSystem.ts` (feature-detected) keeps the
    rest of the app oblivious to which path is live.
  - **Open MindManager `.mmap` files by double-click (import-only).** The manifest also registers
    `.mmap`/`.mmp` as file handlers, and `.mmap` is offered in the **Open file…** picker. Opening one
    runs the existing one-way `.mmap` importer (lossy by design — task/PM data, rich text, images, etc.
    are dropped, and the drops are listed in the import banner) and lands it as an ordinary **library**
    map. There is **no** save-back to `.mmap`; a banner + toast prompt you to **Save as… `.mmst`** to
    keep it as a file. (Chromium desktop only; Windows won't make the PWA the default for `.mmap` over
    an installed MindManager unless you opt in.)

### Changed

- **The gate now enforces a test-coverage floor.** `pnpm gate` runs `vitest run --coverage` against a
  no-regression threshold (`vitest.config.ts`), so a coverage drop fails the build. New unit tests lift
  the previously-untested `useSavedViews` / `useVersionHistory` hooks and cover this session's
  typography / lock / tag-colour render paths.

- **App is now exercised by an integration test.** A jsdom test renders the whole app over a fake
  IndexedDB and drives the editor's wiring (open a map, panels, find/replace, undo/redo, ⌘K, menus,
  inspector edits, Present). This lifted `App.tsx` from 0% → ~51% and **line coverage to ~88%**; because
  the test loads the full module tree, the coverage report is now complete (the floor reflects the whole
  app, not the subset that earlier tests happened to import).

### Removed

- **Retired the sheets / workbook feature.** Maps could be grouped into a workbook via a shared
  `meta.sheetGroup` and switched through an in-canvas sheet strip (**▦ + Sheet**, **⤓ Workbook**
  export). That's gone — each former sheet was already its own standalone map on disk, so they now
  appear as ordinary maps in the library with no data lost (only the grouping). This clears the way
  for the upcoming flat **one-tab-per-document** model.

### Fixed

- **Relationship arrows to/from floating topics.** Dragging a relationship (cross-link) to or from a
  floating topic silently did nothing: `addLink` validated both endpoints against the central tree
  only, so a floating-topic endpoint was rejected even though the canvas offers the gesture and the
  edge renders fine. Endpoint validation is now floating-aware (`findAnyNode`), matching the rest of
  the canvas. Deleting a node already prunes its links across floating topics, so no dangling edges.

- **Version snapshots are repaired on load.** Restoring a version, and timeline playback, returned the
  raw stored snapshot without the `normalizeDoc` salvage that `loadMap` applies. A snapshot predating a
  normalize rule — e.g. a node missing its `children` array — could then crash the projector on
  playback, or be persisted back unrepaired on restore. Both load paths now normalize, and the
  save-time node count tolerates a missing `children` array so a malformed in-memory doc can't drop a
  snapshot.

- **Focus management for the full-screen overlays.** The **Present** overlay and the **⌘K command
  palette** are custom modals that grabbed focus on open but never returned it: dismissing them left
  keyboard focus stranded on `<body>`, so you had to click back into the canvas to regain control.
  Both now restore focus to whatever opened them on exit (the command palette only on cancel — running
  a command lets that command keep the focus it moved to), and Present is exposed as a `role="dialog"`
  `aria-modal` surface. (Every other modal already rides the native `<dialog>` wrapper, which handles
  this for free.)

- **Replace All now reaches floating topics.** Find searched the whole map (tree + floating topics),
  but Replace All walked only the central tree — so it silently skipped matches Find had shown in a
  floating topic, and the changed-count came up short. Replace now walks floating topics too.

- **The board no longer lists a topic twice for a repeated tag.** A topic carrying the same tag more than
  once (from an import or a hand-edited file) appeared — and was counted — twice in that column; tags are
  now de-duplicated when bucketing, and Kanban cards use a stable key.

- **Edits made just before the tab closes are no longer lost.** A library-only map autosaves to
  IndexedDB on a 500ms debounce, while the `beforeunload` guard only covered file-bound dirtiness — so
  an edit made within that window before the tab was hidden/closed vanished on the next open. Any pending
  autosave is now flushed the moment the page is hidden (`visibilitychange`, the reliable persistence
  signal).

- **Markdown export keeps multi-line topics intact.** A topic carrying a newline (from a paste or a
  note→topic conversion) split its bullet across two lines, and re-import dropped the orphaned
  continuation — losing content on round-trip. Topic whitespace is now collapsed to a single space, so
  the bullet stays one line and the tree round-trips.

- **The Power Filter's overdue / due-soon modes work for every caller.** `filterResult` defaulted its
  `today` argument to an empty string, which made every date comparison silently fail for any call site
  that omitted it; it now defaults to the real today.

- **Callout edits reach floating topics.** Adding / editing / recolouring / deleting a callout on a
  floating topic silently no-op'd (the write ops searched only the central tree, though callouts already
  rendered on floating topics); `setCalloutColor` also now stamps the node's modified time like its
  siblings.

- **The import drop zone no longer flickers while dragging.** Moving the cursor over the drop zone's own
  icon/caption fired `dragleave` and cleared the highlight mid-drag; a drag-depth counter keeps it lit
  until the drag truly leaves.

- **The relationship inspector now reflects edits live.** Applying a preset or a direction / width /
  dash / curve control updated the canvas but left the inspector's own highlights showing
  selection-time state until you re-selected the edge. The selected relationship is now re-resolved
  after each edit, so its controls track the change immediately.

- **A corrupt saved map no longer white-screens the app.** A map whose stored structure had drifted (a
  missing or non-array `children`, a non-object node) threw in the projector and blanked the whole
  editor — unrecoverable on the boot-restore path. Docs are now normalised to a projectable shape at
  every load/import boundary (IndexedDB read, `.json` open, library restore), so a damaged map renders
  salvaged (possibly empty) instead of crashing. A well-formed map passes through unchanged.

- **A render crash now shows a recovery panel, not a blank screen.** A top-level error boundary wraps the
  app: any uncaught UI error is caught and replaced with a friendly panel ("your maps are saved safely on
  this device") offering **Reload** and **Start fresh** (which clears the open-tab session + `?map=`
  deep-link to escape a map that crashes on every load), instead of tearing down the tree to a white
  screen. Inline-styled so it can't itself depend on whatever failed.

- **Reparenting works across the floating/tree boundary.** Dragging a *detached* (floating) topic onto
  the tree — or a tree topic onto a floating one — silently snapped back: `reparent` only searched the
  central tree, so it no-op'd whenever a floating topic was the drag source or target, even though the
  drop UI accepted it. It now moves the subtree correctly in both directions (and nests floating-under-
  floating), pruning an emptied floating list. Tree→tree behaviour is byte-identical.

- **Accessibility: ⌘K screen-reader support, readable secondary text, visible keyboard focus.** The ⌘K
  command palette now exposes the ARIA combobox/listbox pattern, so the highlighted command is announced
  as you arrow through it. The muted/faint secondary-text colours were darkened to meet WCAG AA contrast
  (they failed at ~2–3:1 on the light surfaces). And the primitive control button gained a
  `:focus-visible` ring, so keyboard focus is visible across the toolbar, dialogs and inspector.

- **Branch attach side follows the layout orientation.** A branch could enter a topic from *below* in
  a horizontally-oriented map: the fan axis was inferred from the children's spread, so a parent whose
  children carry tall subtrees was mis-read as vertical. The axis is now pinned to the layout's
  orientation (horizontal layouts attach left/right, org-charts top/bottom; radial/timeline still
  infer) — so a child connects on its parent-facing side. Shared by the canvas + SVG export.

- **Duplicate React key warning from the shortcuts cheat-sheet.** The always-mounted `ShortcutsDialog`
  keyed each row by its `action`, but one action ("Add a child topic") has two bindings (`Tab` and
  `Ctrl/⌘ + Enter`) — so every editor session flooded the console with "two children with the same
  key". Rows now key on keys + action.

### Security

- **Security review hardening (5 findings).** A full review of the XSS surface (imported files, pasted
  content, hyperlinks, rich text, notes, SVG) confirmed defense-in-depth across the sanitisers; these
  close the remaining gaps: (1) the typed-hyperlink store (`setHyperlink`) now strips `javascript:` /
  `data:` / `vbscript:` schemes, matching the import + canvas-sync guards, so an unsafe scheme never
  persists or reaches the lossless `.json`; (2) the note editor now **pastes as plain text**, so pasted
  HTML (e.g. `<img onerror=…>`) can't enter the live `contentEditable`; (3) `normalizeDoc` drops a
  script-bearing hyperlink and any non-`data:` attachment from an untrusted/hand-edited doc on load
  (a `javascript:` "attachment" would execute when its download link is clicked); (4) the HTML/print
  exporters document that their SVG input must be pre-sanitised; (5) the production build now ships a
  strict **Content-Security-Policy** (`script-src 'self'`, `object-src/base-uri 'none'`, …) — injected
  at build time so dev/HMR is unaffected, with the inline module-preload polyfill disabled so no inline
  scripts ship.

- **Hardened the SVG export against colour-injection.** Every user-settable colour (boundary, summary,
  callout, backdrop, relationship and per-branch) now passes through the HTML-escaper before landing in
  a quoted SVG attribute — so a hand-edited or imported colour like `"/><script>…` can't break out of
  the attribute and inject markup into an exported file. Defense-in-depth on top of the export sanitiser;
  a no-op for real colours, so canvas == export is unchanged.

### Performance

- **Faster editing on large maps + a lighter entry bundle.** The canvas re-projection (`sync`, run on
  every edit) was O(N²) — a per-node linear scan for measured sizes (invoked many times per layout pass),
  repeated node-box computations, and an un-memoised size estimator; all three are now indexed/memoised,
  with identical geometry (canvas == export untouched). Separately, the Start screen and Presentation
  deck are now lazy-loaded, trimming the initial bundle ~11 kB gz.

### Added

- **Export to MindManager (`.mmap`).** The mirror of the `.mmap` importer — **Export → MindManager
  (`.mmap`)** (also in ⌘K) writes MindManager's own format carrying the topic tree, notes, hyperlinks,
  stock icons, relationships, boundaries, floating topics, and the **two-sided left/right arrangement**,
  so a map you built here can go back to a MindManager user. A map round-trips back into MindMap Studio
  losslessly for those fields (mapping verified by a `parseMmap(toMmap(doc))` round-trip + a real-file
  re-emit test). Project data (task scheduling/resources) is dropped, as on import. Deterministic and
  offline; dangerous hyperlinks are stripped on the way out.

- **Balance map + manual side control (two-sided layout).** Right-click a main branch in the **Both
  sides** layout and pick **Map side → Left / Right / Auto** to pin it to a half (or let it auto-balance);
  the other branches balance around any pins. **View ▾ → Balance map** (also ⌘K) clears every pin and
  redistributes the main branches evenly — MindManager's "Balance map", except the auto-balance now uses
  an optimal Longest-Processing-Time split (a size-5 branch among four size-1 branches lands 5/4, not 7/2).
  The pinned side is lossless in `.json`; canvas == export (one shared layout pass).

- **.mmap import keeps the two-sided arrangement.** A MindManager import now reads each main branch's
  left/right side from the sign of its topic offset (`CX`), so a two-sided MindManager map lands with its
  branches on the same sides they had there. A side is only read for a main branch — deeper topics' offsets
  are layout nudges, not sides — and any branch MindManager left unpinned falls back to auto-balance.

- **Obstacle-aware branch routing (safety net).** A tapered branch now bows around an unrelated topic
  box its straight path would otherwise pass behind — computed once per branch from the node boxes and
  mirrored in the SVG export (canvas == export). Conservative by construction: a branch is either fully
  cleared *or* left straight, never displaced while still crossing a box; only the organic ribbon honours
  it, and a clear branch is byte-identical to before. With the orientation-axis fix above, today's
  layouts rarely graze, so this is a dormant guard for denser maps rather than a constant transform.

- **Open documents as tabs.** Maps you open now appear as a **flat tab strip** under the toolbar —
  one tab per document, the active one underlined — replacing the old map dropdown's lone view.
  Opening a map (from the library, a cross-map link, or **+**) adds a tab; the **×** (or middle-click)
  closes it. The open set + active tab are **persisted**, so a reload reopens the whole workspace.

- **Lossless tab switching.** Switching back to a recently-used tab now keeps its **pan / zoom and
  undo-redo history** — the canvas session (viewport + history stacks) is stashed on switch-away and
  restored on return for the last few tabs (older ones reopen fit-to-view, fresh history). One-shot,
  so a version restore still starts clean.

- **Reorder tabs + shareable map links.** Drag a document tab to reorder it. The active map is now
  reflected in the URL as **`?map=<id>`** (so a map is bookmarkable / shareable), and opening a
  `?map=` link loads that map straight into the editor — even on a first visit.

- **Boundary shapes + styling.** A boundary can now be a **rounded rectangle, sharp rectangle,
  ellipse, scalloped cloud, or polygon** (its outline is real SVG geometry, not a CSS box), with a
  **soft gradient fill**, an optional **dashed / dotted** outline, and its title drawn as a **tab fused
  to the top edge** rather than a floating pill. Pick the shape + line style in the overlay inspector;
  both round-trip in `.json` and render identically on canvas and in every export.

- **Reshape relationship curves.** A relationship's arc now bows **perpendicular to its line** (rather
  than a fixed horizontal axis), so it leaves and enters both topics cleanly instead of looking pinned,
  and the relationship inspector gains a **Curve** control — **Auto / Straight / Bow ± ** — to route a
  link around clutter. The bow round-trips in `.json` and renders the same on canvas and in exports.
  (Per-link colour / width / dash now also round-trip, which they previously dropped.)

- **Connector options — style picker, per-branch colour, dashed branches.** A **Connectors** picker in
  the toolbar sets the whole map's branch style: **organic** (the tapered default), **curved**, **elbow**
  (right-angle), or **straight**. The node right-click menu adds a **branch colour** (recolours that
  branch *and its subtree* — overriding the auto palette) and a **branch line** style (solid / dashed /
  dotted). All render on the canvas and in every export, and round-trip losslessly in `.json`.

- **Flat vector marker icons (replacing emoji).** Topic markers (check, flag, star, priority dots,
  target, idea, …) now render as a crisp **flat icon set** at a fixed size in a tidy row above the
  title — **identical on every machine and in every export** — instead of OS colour emoji that vary by
  platform and rasterizer. Existing maps are unchanged (same marker keys) and the picker shows the new
  icons; an unrecognised imported glyph still falls back to its character.

- **Tighter, MindManager-style layout geometry.** Sibling spacing is now proportional to each topic's
  height (a tall image topic reserves room; one-line siblings pack tight) instead of every row being
  as tall as the biggest node in the map; each branch's columns hang just past its **own** parent, so
  a long label only pushes its own descendants out rather than a whole global column across unrelated
  branches; and the **fishbone** (Ishikawa) layout draws true diagonal bones with sub-causes stepping
  outward along the bone instead of stacking straight down.

- **Floating topics get real branch colours, and relationship arrows scale with line weight.** A
  floating (detached) topic and its branches now cycle the palette like a normal coloured mini-map
  instead of a washed-out grey, and a relationship's arrowhead grows with its line thickness so a thick
  link reads in proportion — on canvas and in every export.

- **Topics now read as a hierarchy, MindManager-style.** The map's depth is legible from shape alone:
  the **central topic** is larger, bold, and centred; **main (level-1) topics are filled** with their
  branch colour (white/auto-contrast text) instead of a thin outline; mid topics keep the bordered
  white card; and **deep (level-3+) leaves drop the box** for the text on a short branch-colour
  underline. **Type shrinks with depth** (root → main → sub → leaf) and **wrapped labels centre**
  within their box, so the structure is legible at a glance. A manual style (a set fill or border)
  always wins and reverts a topic to a normal card. Identical on canvas and in every image / PDF /
  HTML export.

- **Org-chart layouts draw right-angle elbow connectors.** In the Org-chart (down / up) layouts a
  parent now connects to its children with clean uniform right-angle "bus" elbows — the formal
  hierarchy look — instead of the organic tapered trunk (which stays for the mind-map / radial
  layouts). Per-branch layout overrides are honoured, and floating subtrees stay organic.

- **Inline task-info line on topics.** A topic with task scheduling now shows a compact muted line
  (**▶ start · duration · @resources**) beneath the title, surfacing the start date, duration, and
  assigned resources the canvas previously dropped — on canvas and in exports.

- **Organic branch connectors (MindManager-style).** A parent's child branches now spring from a
  **single point** on the side its children sit — one chunky trunk that fans out, tapering to a fine
  tip at each child, **entering each child at its near end** and tucking under both boxes so the line
  **always connects** (no more crossings or gaps). The origin side adapts to the layout (3 o'clock for
  right-growing, 9 for left, 6/12 for org charts, nearest-side for radial), and the centre topic fans
  from a left **and** a right origin. The whole thing is one shared geometry, so the canvas and every
  image / PDF / HTML export stay byte-identical.

- **Examples gallery on the Start screen.** The Start screen now has an **Examples** section (in the
  sidebar, in its ⌘K palette as "Browse examples", and as a featured row on the home view) listing all
  the worked example maps — the **same set as the editor's New-map gallery** — so you can browse and
  open them before you're even in a map. Templates were already there; examples now match.

- **Add topics without the keyboard — hover ＋ and a starter coachmark.** Every topic now shows a
  small **＋** on hover or selection: one adds a **child**, one adds a **sibling**, each dropping
  straight into editing. A fresh map shows a one-time hint under the root (**Tab** = child ·
  **Enter** = sibling · double-click to rename), and topics lift on hover with a "Double-click to
  edit" cue so they read as editable.

- **Direct-manipulation canvas.** **Drag the background to pan**, **scroll / ⌘-scroll to zoom**, and
  **double-click an empty spot** to drop a new floating topic — the +/−/fit controls stay. Off-screen
  branches are now reachable without the buttons (hold **Shift** and drag to rubber-band a selection).

- **Drag-to-reparent shows where it lands.** While you drag a topic onto another, the target lights up
  with a **"↳ Make child of X"** label, so the new structure is obvious before you let go; dropping on
  empty space snaps it back.

- **Richer right-click menu.** The node context menu now also offers **Add note**, an inline **marker**
  row and a **priority** picker (High / Med / Low / clear) alongside add / rename / link / delete —
  every common single-topic action one click away, fully keyboard-drivable. *(Also fixes a duplicate
  React key when a branch carrying a callout was copy-pasted.)*

- **⌘K can do anything.** The command palette now also **jumps to any topic** (fuzzy over the topic
  text **and** its note), runs **selection-scoped actions** (add child, set marker / priority, delete)
  when a topic is selected, and keeps a small **Recent** list.

- **Undo / Redo in the toolbar.** Row 1 has **Undo** and **Redo** buttons that enable / disable with
  the history depth and show a brief toast — no keyboard required.

- **Delete is instant and undoable — no blocking "Are you sure?".** Deleting a topic (and its branch)
  or a whole map happens immediately and shows a **"… deleted — Undo"** toast wired to undo.

- **Note + markers lead the inspector.** The Topic-info **Details** tab now opens with a one-click
  **note** field and the **marker** row at the top (the separate Notes tab is folded in); **Style**
  stays the secondary tab. With nothing selected the inspector shows the **map** panel + "Select a
  topic to edit it" — never blank or stale.

- **Clearer toolbar + a keyboard cheat-sheet.** The view controls (Fit / Collapse all / Expand all /
  Focus) fold into one labelled **View ▾** menu, and the **?** button (and ⌘K → "Keyboard shortcuts")
  opens a **shortcuts cheat-sheet** grouped by Editing / Navigation / View — sourced from one central
  map so tooltips and the sheet can't drift; common right-click rows show their key hint.

- **First-run tips.** A brand-new user sees a one-time **"3 things to try"** card (rename a topic ·
  **Tab** for a child · **⌘K** for anything); it disappears after the first edit and never nags again.

- **Type to edit a topic.** With a topic selected, just **start typing** — the topic opens for editing
  with your first keystroke replacing the old text (caret at the end, so you keep typing straight on).
  Matches MindManager. **F2** and **double-click** still edit in place starting from the existing text
  (all selected), and modifier shortcuts (Ctrl/⌘/Alt) are untouched.

- **Ctrl+Enter adds a child topic.** With a topic selected, **Ctrl/⌘+Enter** now adds a **child**
  (plain Enter still adds a sibling, Tab also adds a child). *(Fixes the keyboard help, which wrongly
  listed Ctrl+Enter as "add a parent".)* *(The brief confirm-before-deleting-a-branch prompt added
  this cycle is superseded by the instant + Undo-toast delete below.)*

- **Command palette in the editor (⌘K / Ctrl-K).** Press **⌘K** anywhere in the editor to fuzzy-search
  and run any toolbar action — present, export to any format, toggle a panel, switch layout, fit,
  group a branch, and more — without hunting through menus. Selection-only actions (Focus / Group /
  Summary) appear only when a topic is selected. (The Start screen's ⌘K is unchanged; both now share
  one palette.)

- **Keyboard-accessible menus + bottom sheets on phones.** Every toolbar dropdown and the canvas
  right-click menu is now a proper WAI-ARIA menu: open with the mouse or **↓**, move with
  **↑ ↓ Home End**, run with **Enter**, close with **Esc** (focus returns to where you were). Menus
  flip / slide to stay on-screen near an edge, and on phone widths they open as a full-width **bottom
  sheet**. The two toolbar rows are also grouped into clearer clusters. (No actions changed — same
  buttons, same results.)

- **Per-overlay colours.** Recolour any individual **boundary**, **summary** bracket, or **callout**
  bubble from its inspector (a swatch row + **Default** to reset), and the map's diagram **backdrop**
  from the Map panel. The picked colour re-tints the whole object coherently — stroke, fill tint, and
  label chip — on the canvas **and** in every image / PDF / HTML export (one shared resolver, so the
  canvas and export stay byte-identical). Colours are saved losslessly in the `.json`; an uncoloured
  overlay keeps the default accent.

- **Click a boundary, summary or callout to edit it.** Overlay objects are now selectable: click a
  **boundary** (its rim or label), a **summary** bracket's label, or a **callout** bubble and the
  inspector becomes an editor for it — rename / retext it and **delete** it — with a highlight on the
  selected overlay. The existing inline gestures still work (double-click a callout / summary to edit
  in place). Boundaries can now be labelled too. Selecting an overlay, a node, or a relationship are
  mutually exclusive.

- **Bulk markers + tags (tri-state).** Select several topics and the inspector now shows their
  **markers** and **tags** with a third state: **lit** = on every selected topic, a **dashed “+”
  chip** = on only some. Clicking adds a marker/tag to the whole selection — or, if every selected
  topic already has it, removes it from all — in a single undo step. (Single-topic editing is
  unchanged.)

- **Per-node timestamps.** Every topic now tracks when it was **created** and **last edited**; both
  show in the inspector's quick-facts line (e.g. *created 2h ago · modified just now*) and are saved
  losslessly in the `.json`. Editing a topic's content (text, note, style, task, tags, markers,
  links, …) updates *modified*; pure restructuring (moving/collapsing) doesn't. They're never drawn
  on the canvas or in image / PDF exports.

- **Diagram-backdrop controls in the inspector.** When the map has an onion / funnel / Venn
  backdrop, the Map panel shows a **Backdrop** section — add or remove a **ring / stage** (onion &
  funnel), set its **colour**, and **Remove** the backdrop — so you can adjust it without opening the
  toolbar's Canvas menu.

- **Map properties in the inspector.** With nothing selected, the right panel is now an editable
  **Map** panel (not just read-only stats): rename the map inline, and set its **theme**, **layout**,
  **background colour / image**, and **line-jumps** right there — the same settings as the toolbar's
  Canvas menu, in one place — above the existing topics / branches / task-progress overview. The
  controls re-theme with the chrome so they stay legible in Dark / Ocean / Sunset.

- **Relationship inspector — style your connectors.** Click a relationship (cross-link) arrow and the
  right panel becomes a dedicated editor: rename its **label**, set its **direction / arrowheads**
  (at the target, the source, both ends, or none), pick a **colour**, **width** (thin / medium /
  thick) and **line style** (dashed / solid / dotted), or **delete** it. The selected relationship
  shows a highlight halo on the canvas, and node vs. relationship selection are mutually exclusive.
  Styling is **lossless in `.json`** and carried into every image / PDF / HTML export (the canvas and
  the export resolve it through one shared helper, so they always match); existing relationships keep
  their original single-arrow dashed look until you change them.

- **"Linked from" backlinks in the inspector.** The Details tab now lists every topic that points
  *at* the selected one — via a **topic-jump link** (`↪`) or an incoming **relationship** edge (`↬`,
  with its label) — and each is a one-click jump that selects and centres that source topic. It
  appears only when something actually links in, complementing the existing outgoing **Links**
  section (so you can navigate a map's connections in both directions).

- **Bulk edit shows "Mixed" instead of one topic's value.** When several selected topics disagree on
  a task field — **progress, dates, or priority** — the inspector now leaves that control blank and
  tags it *Mixed*, rather than silently showing (and, on the next edit, overwriting everything with)
  the anchor topic's value. Fields the selection already agrees on still show their shared value, and
  setting a control applies it to the whole selection in one undo step as before. The "Mixed" state
  clears the moment you set the field. Single-topic editing is unchanged.

- **Resizable inspector + a header breadcrumb & quick-facts.** Drag the inspector's left edge to
  resize it (or nudge with the arrow keys when focused); the width is clamped and **persists** across
  reloads. The header now shows the selected topic's **breadcrumb** (Root › Branch …) and a small
  facts line — outline number, depth, child count, and the note's word/char count. The no-selection
  map panel honours the same persisted width.

- **Click a topic's 📝 to jump to its note** — the on-canvas note indicator is now a button: clicking
  it selects the topic and opens the inspector straight to its **Notes** tab (re-opening the inspector
  if it was closed or minimized). The 📝 still appears only when a topic actually has a note.

- **Multi-select + bulk editing** — select several topics at once (**Shift/Ctrl/⌘-click** to extend,
  or **drag a box** on the empty canvas) and change them together from the inspector: **shape, fill,
  border, font/bold, progress, dates and priority** apply across the whole selection in a single undo
  step. The inspector shows an *"N topics selected"* banner and hides the per-item editors (notes,
  markers, tags, stickers, attachments, links) — those stay single-topic. A plain click (or any
  structural edit) collapses back to one. Because the canvas now rubber-band-selects on left-drag,
  **panning moves to the middle/right mouse button** (scroll still zooms). Built on an anchor + a
  selection set, so existing single-topic keyboard / popover / linking behaviour is unchanged.

- **Minimize / restore the topic inspector** — the right-hand inspector can now collapse to a thin
  strip on the canvas edge (the header's **›** button) and re-expand from that strip's ℹ button,
  reclaiming canvas width without losing the panel. Minimizing is **sticky**: selecting other nodes
  won't pop it back open (re-expanding always shows the currently-selected node). The state persists
  across reloads, and the toolbar's **Topic info** toggle still fully shows/hides it. The no-selection
  map overview can be minimized the same way.

- **WYSIWYG note editor** — the Topic-info **Notes** tab is now a what-you-see-is-what-you-get rich
  editor instead of a raw-markdown textarea with an Edit/Preview toggle: a formatting toolbar
  (**bold**, *italic*, ~~strikethrough~~, bulleted list, numbered list) and inline formatting as you
  type, filling the inspector's full height. Under the hood the note is still stored as the same
  **markdown string** — the editor serialises its HTML to/from markdown on every edit (a
  `contentEditable` div + a small, unit-tested HTML↔markdown round-trip), so every export (JSON /
  docx / FreeMind / interactive-HTML), cross-map search, the presenter view and the 📝 outline
  indicator keep working unchanged. `renderNote` gained strikethrough + numbered-list support (it
  already did bold / italic / code / headings / bullets / links). **0 new dependencies.**

- **Tabbed topic inspector** — the right-hand **Topic info** panel now groups a topic's editors into
  three tabs — **Details** (tags, progress, dates, priority, attachments & links), **Style** (shape /
  fill / border / font bar, markers, stickers) and **Notes** (the Markdown editor) — instead of one
  long scroll. Built on a new reusable `Tabs` primitive (a `role="tablist"` segmented control, the
  start-screen tab pattern shared into `design/primitives`). Pure regroup: every field and handler is
  unchanged, the panel's props/API are untouched, and the canvas/exports are unaffected.

- **Inline node popover (redesign phase 2, complete)** — selecting a topic now shows a small
  quick-action toolbar floating just above it (via React Flow's `NodeToolbar`, so it tracks the node
  through pan/zoom): **Add child**, **Add sibling**, **Rename**, **Collapse/expand**, **Delete** —
  sibling/delete hidden on the root, collapse only when the node has children. It calls the exact same
  internal handlers as the keyboard shortcuts and the right-click menu (no new model surface), and
  hides while a node is being inline-edited. This completes the editor redesign (chrome + canvas).

- **Canvas palette → brand (redesign phase 2, start)** — the default **Light** and **Dark** canvas
  themes are retuned to the warm-cream + **emerald** brand language: emerald **root** node and the
  warm support branch palette (amber / blue / emerald / magenta / olive / violet) shared with the
  chrome, replacing the old indigo-root + MindManager-red palette. Because `exportSvg` is handed the
  same palette + cssVars as the live canvas, every PNG / SVG / PDF / Office export stays
  byte-faithful (**canvas == export** — verified: the exported SVG carries the emerald root and warm
  branch colours, no stale palette). Ocean / Sunset themes are unchanged. **Node cards** are also
  detailed to match the mock — the root is a rounded **card** (radius 14, not a pill) with a soft
  emerald elevation, branch/leaf cards get a lighter 1.5px branch border + warm shadow and a tighter
  radius (11) — with the radii and border mirrored in `exportSvg.ts` so the screen and exports stay
  identical (verified: root rx 14 = canvas 14px, branch rx 11 = canvas 11px, border 1.5 = 1.5).
  A **branded selection ring** (the node's branch colour, emerald for the root, + a soft glow)
  replaces React Flow's faint default — canvas-only, so no export impact. The priority / progress /
  due badges and tapered branch ribbons already matched the mock. (The inline contextual popover —
  which needs new add-child/delete canvas handles — is a deferred, separately-scoped increment.)

- **Editor chrome redesign (phase 1 of 2)** — the editor adopts the warm-cream + emerald visual
  language already shipped on the Start screen. A new **56px icon rail** (brand → Start, find, insert
  image, paste, about) sits beside a **two-row top bar**: row 1 is file/identity (Start, map switcher,
  **+ New**, **All maps**, find/replace, **Export**, **More**), row 2 is view/edit/canvas grouped into
  labelled dropdown menus (**Panels**, **Insert**, **Canvas**) plus the structure cluster, layout
  picker, quick-add and the brainstorm timer. The chrome is **theme-reactive** — surfaces and ink
  track the active canvas theme (Light / Dark / Ocean / Sunset) via `editorThemeVars()` → `--ed-*`
  custom properties, mirroring the Start screen's `--st-*` system, with a fixed emerald accent. Every
  control the previous toolbar had was **re-homed, not removed** (all 16 export formats, all 10
  layouts, all 7 side panels, backdrops, roll-ups, group/summary/sticky-note, free layout, line-jumps,
  numbering, focus, sheets, backup, copy-outline, import). The **Topic inspector** moves to a
  **right-side panel** that **auto-opens when a node is selected** and shows a **map overview**
  (topics / branches / task progress) when nothing is — and the side panels (Outline / Filter /
  Styles / History / Index / Info) are retuned to the same warm-cream + emerald palette. The canvas
  renderer is unchanged (its restyle is phase 2). No web fonts are loaded (offline-first); the mono
  stack prefers JetBrains Mono if installed.
- **Line-jumps on crossing connectors** — a per-map **⌒ Line jumps** toolbar toggle (off by default,
  stored as `meta.lineJumps`, lossless in `.json`). When on, wherever two **relationship** arrows
  cross, exactly **one** of them draws a small semicircular **hop** over the other — so a busy concept
  map reads as lines *passing over*, not joining (the MindManager convention). The hopper is chosen
  deterministically (one bump per crossing, never two), crossings are detected on each relationship's
  straight endpoint **chord**, and a line crossed several times gets a hop at each crossing in order.
  The hop geometry comes from one shared pure helper (`flow/lineJumps.ts`) used by **both** the live
  canvas relationship edge and the SVG exporter, so the same crossings produce the same hops on screen
  and in every PNG / SVG / PDF / HTML export (canvas == export).
- **Presenter view (map + slides)** — the **▶ Present** overlay gains a **Presenter view** toggle (a
  button in the control bar, or press **P**) that opens a presenter sidebar beside the live slide
  without changing what the audience sees. The sidebar shows three things: the current branch's
  **speaker notes** (its `note`, rendered as Markdown through the same safe note renderer — escaped,
  no XSS — with a muted "No notes for this slide." when empty), a **Next up** peek at the next slide's
  heading (or "End of map" on the last slide), and an **Agenda** — a compact list of every slide (the
  overview plus each branch) with a **3 / 8**-style position indicator, the current slide highlighted,
  and **click-to-jump** to any slide. Single-screen by design (no second-monitor popup); the toggle is
  presenter-only chrome and defaults off each session.
- **Sticker / illustration library** — the **ℹ Info** panel gains a built-in **Stickers** grid: 20
  curated, single-accent inline-SVG glyphs (star, heart, check / cross badge, flag, idea, warning,
  info, speech bubble, thumbs up / down, target, rocket, lock, key, clock, pin, fire, question,
  arrow) you can drop on the selected node without supplying your own file. Picking one sets that
  node's **image** to the sticker's data URL, so it reuses the existing node-image pipeline — it
  paints on the canvas and carries into every SVG / PNG / PDF / HTML export (canvas == export) and is
  lossless in `.json`.
- **Interactive HTML export** — a new **.html (interactive)** option saves the whole map as a single
  self-contained file you can email or open locally: a **collapsible, searchable outline** with an
  inlined vanilla-JS runtime (no app, no backend, no CDN — fully offline). Click a topic (or its ▾
  toggle) to fold a branch, **Expand all / Collapse all**, type in the **filter** box to highlight and
  narrow to matching topics, and **Ctrl/⌘ + scroll** to zoom / drag to pan. Notes render inline; topic
  text and the embedded tree JSON are escaped, so a map can't inject script. Unlike the existing
  **.html (standalone)** (an embedded SVG picture), this one is *navigable*.
- **Larger node-shape vocabulary** — the **Shape** picker adds six more vector shapes: **trapezoid**
  (manual operation), **octagon** (stop / limit), **document** (a page with a wavy bottom edge),
  **callout** (a rounded speech bubble), **star** (highlight), and **cloud** (idea / external system).
  Like the existing diamond / oval / hexagon / cylinder, each is drawn from the one shared path builder,
  so it looks identical on the canvas, in the picker icon, and in the SVG / PNG / PDF / Office exports
  (canvas == export); concave shapes (star, cloud, document, callout) inset their text so labels stay
  inside the outline.
- **Per-map canvas background image** — the **Canvas** control gains a **🖼** picker: choose an image
  and it fills the canvas behind every topic (on top of the background colour), downscaled and stored
  inline so the map stays offline + portable. It's saved with the map and carries into the
  SVG / PNG / PDF / HTML exports (canvas == export); the **✕** removes it.
- **Version-history timeline playback** — the **🕔 History** panel gains a **▶ Play timeline**
  button: step, scrub, or auto-play through a map's saved snapshots and watch it evolve on the
  canvas (read-only), then **Restore this** at any frame, or **Exit** (Esc) back to the live map.
- **Per-topic font family** — the **🎨 Styles** bar gains a **Font** picker (Sans / Serif / Mono);
  it applies to the selected topic and carries into the SVG / PNG / PDF / Office exports.
- **TextBundle / TextPack import** — open a `.textpack` (Bear, Ulysses, iA Writer) and its Markdown
  (`text.md`) becomes a map via the Markdown importer.
- **Automated multi-map roll-ups** — bind a node to another library map with **⤵ Roll-up**, then
  **🔄 Roll-ups** pulls that map's branches in as the node's children (a re-id'd mirror, refreshed on
  demand). One map can aggregate several others — the automated cousin of cross-map branch paste.
- **Mobile-friendly layout** — on phone-width screens the editor toolbar becomes a single compact,
  swipeable strip (instead of a wall of wrapped rows), so the canvas fills the screen; the side
  panels (Outline, Info, Filter, …) open as **bottom sheets** over a full-width canvas instead of
  squeezing it; and the start screen's side rail folds into a top nav with full-width content. The
  PWA is now genuinely usable on a phone.
- **Cross-map branch copy/paste** — right-click a branch → **Copy branch**, then right-click any node
  in *any* map → **Paste branch here** (it grafts a re-id'd copy as a child, or drops it in as a
  floating topic when there's no tree parent). The clipboard lives in the browser, so it survives
  switching maps — move a branch from one map into another, or assemble a roll-up by pasting branches
  from several maps into one.
- **Sticky-note topics** — **🗒 Note** drops a free-floating amber note onto the canvas; it's a
  floating topic underneath, so it edits, drags (in free-canvas mode), exports, and round-trips like
  any other topic.
- **Start screen** — a dedicated home that opens when no map is showing (and any time via **⌂ Start**
  in the toolbar). A left rail navigates **Start / All maps / Recent / Templates / Layouts / Import /
  Learn / About**; the hero captures a new map three ways (type a topic, paste an outline, or a blank
  canvas), **Recent** groups your maps by last-edited (Today / Yesterday / Earlier), and **Templates**
  lists every starter with a thumbnail and **computed** node count + branch pills. **⌘K** opens a
  command palette over maps and actions. Theme-aware (Light / Dark / Ocean / Sunset) and fully local
  — the editor canvas is untouched.
- **Multiple sheets per file** — group several maps as **sheets** of one workbook. **▦ + Sheet**
  turns the current map into a workbook and adds a sheet; a **sheet tab strip** appears above the
  canvas to switch between them, and **⤓ Workbook** exports all the sheets to a single `.json`
  (re-importing keeps them grouped). Each sheet is a full map — its own layout, history, and export.
- **Per-branch layout** — right-click a branch → **Branch layout** to lay out just that subtree with
  a different layout (e.g. an org-chart branch inside a radial map). The override subtree is sized as
  one blob in the main pass so it doesn't collide with its siblings, and nested overrides compose.
  Stored on the node, lossless in `.json`; the export matches the screen.
- **Diagram backdrops — Funnel + Venn** — the **◎ Diagram** builder now also draws a **funnel**
  (stacked stages narrowing to a conversion; **−/+** changes the stage count) and **Venn** frames
  (**2** or **3** overlapping circles). Like the onion, they're pure geometry shared by the canvas
  and the image export, and topics drop into the regions. **Funnel** and **Venn (3 circles)** examples
  ship in **+ New…**. This completes the dedicated diagram builders (onion / funnel / Venn).
- **Diagram backdrops — Onion** — a new **◎ Diagram** builder draws a geometric **backdrop** behind
  your topics and switches to free-canvas mode so you drop topics into its regions. First up: the
  **onion** (concentric rings) for stakeholder maps and layered models — use **−/+** to change the
  ring count and **✕ Backdrop** to remove it. The frame is pure geometry shared by the canvas and the
  image export (canvas == export); region labels are just topics you place on each ring. An **Onion
  diagram** example ships in **+ New…**.
- **Brace map layout** — a new **Brace map** layout (under *Diagram*) lays the map as a left-to-right
  tree where each parent joins its children with a **`{` fork brace** — the Thinking-Maps part-whole
  diagram — instead of the tapered branches. The forks are drawn from one geometry shared by the
  canvas and the image export (canvas == export).
- **Free-canvas (whiteboard) mode** — a **🧲 Free layout** toggle turns any map into a free canvas:
  drag topics **anywhere** and they stay put (the auto-layout pauses). Combined with node shapes and
  directional arrows, this gives place-anywhere **flowcharts**, **concept maps**, and **whiteboards**.
  Enabling **seeds each node's position from where it already sits** (a seamless switch); disabling
  returns to the auto-layout and **keeps the positions**, so you can flip back and forth. Positions
  live on the node (`pos`), lossless in `.json`. A new **Whiteboard (free layout)** example ships in
  **+ New… → Examples**.
- **Diagram starter templates** — two new entries in **+ New… → Examples** showcase the new
  structures: a **Flowchart** (node shapes mark step types — oval start/end, diamond decision,
  parallelogram I/O — with directional links labelling the branches) and a **Concept map** (ideas
  linked across branches by labelled, directional arrows, built around the water cycle). Open one to
  explore the shapes + arrows, or use it as a starting point.
- **Grid / matrix layout** — a new layout (under **Diagram** in the layout picker) that **tiles the
  root's first-level branches into a grid** — four branches become a **2×2**, the shape of a SWOT,
  Eisenhower, or any matrix frame. Each branch keeps its own subtree laid out beneath it, with the
  root as a title centred above. Like the other layouts it's a pure view (the model is untouched) and
  persists per session.
- **Directional relationships** — relationship arrows now carry a **filled arrowhead at the target**,
  so a link reads as flow (the flowchart / concept-map connector). The arrowhead is built from one
  shared path helper used by the canvas edge **and** the image export, so the direction shows on
  screen and in exports alike. No model change — every existing and imported relationship gains it.
- **Node shapes (flowchart vocabulary)** — the **Shape** row in the style bar now offers, beyond
  box / rounded / pill, five true geometric shapes: **diamond** (decision), **oval** (start/end),
  **parallelogram** (input/output), **hexagon** (preparation), and **cylinder** (data store). They're
  painted from one shared SVG path builder used by the canvas, the image export, **and** the picker
  icons — so the screen, the export, and the button always match (the canvas == export invariant).
  Text gets per-shape padding so it stays inside the narrowing outline. Stored on `style.shape`,
  lossless in `.json`. The foundation for flowcharts and concept maps.
- **Summary topics** — select a branch and **⊐ Summary** (or right-click → *Summarize branch*) draws
  a labelled **bracket** beside it (the classic MindManager summary). The bracket auto-sizes to the
  branch and sits on the correct side (left-branch → `[` on the left, right-branch → `]` on the
  right); **double-click its label** to rename (or empty it to remove). Summaries persist with the
  map and are drawn into image exports. The last of the renderer-era structural gaps.
- **More import formats — MindMup (`.mup`) and Markmap.** MindMup's JSON tree imports (rank-ordered
  children, notes, links — dangerous schemes dropped). Markmap files are Markdown, so they import via
  **Open files** (`.md`), stripping any `---` frontmatter (its `title:` becomes the map title). As part
  of this, **Markdown import now understands multi-level headings** (`#` / `##` / `###`) with bullets
  nested under them — so heading-structured outlines (and Markmap maps) import with their full
  hierarchy, not just a flat bullet list. (Schema-verified against the documented formats, not yet
  against real app exports — same caveat as `.smmx`/`.mind`.)
- **Task priority** — set a topic's priority (**High / Med / Low**) in the **ℹ Info** panel; a small
  coloured chip shows on the node, and the **🎚 Power Filter** can filter by priority. Distinct from
  the emoji priority markers in that it's a structured, filterable value. Stored on `task.priority`.
- **Styles organizer** — in the **🎨 Styles** panel, save the selected topic's look as a **named
  style** and reuse it on any topic with one click. Presets persist locally and travel between maps.
- **Conditional formatting** — a **🎨 Styles** panel where you set rules that **auto-style topics**
  by **tag**, **marker**, or **completion** (e.g. *completed → green*, *#risk → red border*). Rules
  are a **view-only overlay** layered *under* a topic's own styling (manual styling always wins), so
  nothing is baked into the model; they're per-map, lossless in `.json`, and carried into image
  exports.
- **Board view (Kanban)** — a new **▦ Board** toggle shows your topics grouped into **columns by tag**
  (a read-only visualisation of the same map — cards don't move or write back). Each card carries its
  rolled-up **progress pie** and **due date** (red when overdue); **click a card to jump** to that
  topic on the canvas. Untagged topics gather in a final column. A fast status wall over a tagged map.
- **File attachments on topics** — attach any file to a topic from the **ℹ Info** panel; a **📎 chip**
  shows on the node and the panel lists each file with its size, a one-click **download**, and a
  remove (✕). Files are stored inline (a data URL, capped at 5 MB each) so they travel with the
  map — lossless in `.json`, fully offline, ignored by flat exports.
- **Faster capture** — three quick-input additions: a **Quick add** box in the header (type a topic,
  press Enter to add it under the selected node — or the central topic — keeping focus for rapid
  fire); **drop a link** (or text) from your browser onto the canvas to create a floating topic
  (URLs become a clickable link, dangerous schemes refused); and a **⏱ brainstorm timer** for
  timeboxing an idea sprint (3 / 5 / 10 / 15 min, with a clear "time's up").
- **Due & start dates on topics** — set a topic's **start** and **due** date in the **ℹ Info** panel
  and a **📅 date chip** appears on the node; it turns **red when overdue** (past due and not yet
  100%). The **🎚 Power Filter** gains a **Due date** option — *Has a date · Overdue · Due ≤ 7 days* —
  so you can dim everything except what needs attention (and save it as a preset). Dates show in image
  exports too and are lossless in `.json`. Together with task progress, that's the core of a topic's
  task info.
- **Task progress + roll-up** — mark a topic's completion (0 / 25 / 50 / 75 / 100%) from the **ℹ Info**
  panel and a small **completion pie** (MindManager-style — empty / wedge / full, with a ✓ at 100%)
  appears on the node. **Click a node's pie to step its completion** (0 → 25 → 50 → 75 → 100 → 0). Parents
  **roll up automatically**: a branch's pie shows the average across all its sub-tasks plus a done/total
  count (e.g. *75% · 1/2*) in the Info panel, updating live as you tick items off. The completion also
  shows in the **Outline** and in image exports (PNG/SVG). It's a clean way to track a plan's status
  right on the map — lossless in `.json`, ignored by flat (outline) exports.
- **Saved filters** — name the current Power Filter and reuse it across maps. The **🎚 Filter** panel
  grows a **Saved filters** list: type/pick criteria, give it a name, **Save**; click a saved name to
  re-apply it on any map, or **✕** to remove it. Presets persist locally (browser storage) and travel
  with you between maps. Fully local — nothing leaves the browser.
- **Typo-tolerant Find** — **Find** now rescues near-misses. If an exact match isn't found, it falls
  back to a fuzzy pass (bounded edit-distance per word) so `Launhc` still finds **Launch** and
  `markteing` still finds **Marketing**. Exact matches always win and short queries (< 4 chars) stay
  strict, so precise searches are unaffected.
- **Paste text → map** — a **📋 Paste text** action turns a pasted outline, bullet list, or
  Markdown into topics: indentation (or `#` heading levels) sets the hierarchy, and `-`/`*`/`+`/`•`
  and numbered (`1.`) markers are all understood. Drop it in as a **new map**, or **Add under
  selected** to graft it onto the current map. Fully local — the fast, private way to bring an
  outline (including one you generated elsewhere) into a map without any upload.
- **Version history** — a **🕔 History** panel keeps per-map snapshots in IndexedDB, so you can roll
  a map back to an earlier state. Snapshots are captured automatically while you edit (throttled to
  ~one per few minutes) and on demand via **Save version now**; **Restore** loads a snapshot back in
  place (your current state is checkpointed first, so a restore is itself undoable). Capped at 30
  per map (oldest pruned); a map's history is deleted with the map. Fully local — nothing leaves
  the browser.
- **More import formats — iThoughts `.itmz`, MindMeister `.mind`, and legacy XMind `content.xml`.**
  iThoughts (a ZIP of `mapdata.xml`) brings in the topic tree, notes, web links, relationships, and
  floating topics; MindMeister (a ZIP of `map.json`) brings in the tree, notes, and links;
  and the XMind importer now falls back to the older `content.xml` layout when there's no
  `content.json`. All in **Open files**. (Schema-verified against community specs, not yet against
  real app exports — the same caveat as `.mmap`/`.smmx`; dangerous-scheme links are dropped.)
- **Import Word `.docx` and Excel `.xlsx`** — round out the Office story (export already shipped).
  `.docx` reads the document's outline — heading styles (Title / Heading 1/2/3 …) **or** paragraph
  indentation — into the topic tree (our own `.docx` export round-trips exactly). `.xlsx` reads an
  indented-outline sheet: each row's first non-empty column sets its depth, a trailing column
  becomes the note; it decodes inline **and** shared strings, so it reads real Excel files too.
  Both are in **Open files**. (Caveat: `.xlsx` is outline-based, so a node with an empty topic has
  no cell to anchor it and isn't imported; styling/images aren't carried.)
- **Unified topic info panel** — one **ℹ Info** side panel now holds everything you can set on the
  selected node: its **note** (Markdown editor + preview), **markers** (with the active ones
  highlighted), **tags** (add/remove — a new editor; tags were previously import-only), **style**
  (shape/fill/border/bold), and **links** (web / link-to-a-map / jump-to-a-topic). It replaces the
  separate Notes, Markers, and Style toggles and the Link / Jump toolbar dropdowns.
- **Per-map canvas background** — a **Canvas** colour control in the toolbar sets the background
  for the current map (overrides the theme); it persists with the map (stored in `meta.background`,
  lossless in `.json`) and carries into the image/PDF export.
- **Focus a branch** — a **◎ Focus** button isolates the selected node's branch: everything except
  that branch and its path back to the root dims (Esc or "Show all" exits). Read-only — it reuses
  the Power Filter's dim pipeline, changing nothing in the map.
- **In-map jump links + clickable hyperlinks** — link a node to **another topic in the same map**
  via the new **↪ Jump to…** toolbar picker (stored as a `#node=` hyperlink); clicking the node's
  **🔗** leaps to and selects that topic. The 🔗 is now a real button, which also restores following
  **cross-map links** (`#map=`, previously inert on the React Flow engine) and opens external URLs
  in a new tab — dangerous schemes are refused by the app-wide XSS guard. Link routing is a pure,
  unit-tested `classifyLink()`.
- **Read-only Power Filter** — a **🎚 Filter** panel that dims every topic *except* the ones
  matching your criteria (free text in topic/note, plus toggle chips for any marker or tag in the
  map) and the paths leading to them, with a live match count. It's strictly a view: nothing is
  hidden or deleted (pure `filterResult()` computes the lit set; the canvas only changes opacity),
  and closing the panel restores the full map. Marker/tag criteria AND across categories.
- **Auto-numbering** — a **1. Numbering** toolbar toggle that prefixes every topic with its
  hierarchical outline number (1, 1.2, 1.2.3 …) on the canvas *and* in the Outline panel, and
  carries through to image/PDF/Office exports. Purely a view: the numbers are computed from the
  tree (pure `outlineNumbers()`), never written into the model, so topics, search, and the flat
  exporters stay clean. The root (central topic) is the implicit "0" and isn't numbered. Persisted.
- **Marker & tag index panel** — a new **📑 Index** side panel listing every marker and tag
  used in the map, each grouped with the topics carrying it (with a count); click any entry to
  centre + select that node. A read-only navigation companion to the per-node **Markers** palette,
  mirroring the **Outline** panel. The collection logic is the pure, unit-tested `markerTagIndex()`.
- **SimpleMind interop (`.smmx`)** — import *and* export SimpleMind's `.smmx` (a ZIP of
  `document/mindmap.xml`): the topic tree, notes, web links, and relations↔cross-links, plus
  floating topics. Now in **Open files** + the **⬆ Export…** menu.
- **Export to XMind (`.xmind`)** — write the modern (2020+) `content.json` ZIP
  (topic tree, notes, web links, tags, plus floating topics + relationships),
  completing two-way XMind interop (import already shipped). `.xmind` is now in the
  **⬆ Export…** menu.
- **Polish** — a proper **favicon** for browser tabs + bookmarks (the mind-map glyph,
  `icon.svg` + a PNG/apple-touch fallback), and a **collapsible minimap** (a "Minimap ▾/▴"
  toggle that hides the corner overview when it's in the way; the choice persists).
- **Draw relationships on the canvas** — right-click a node → **Link to…** → click a
  target to add a labelled cross-link (double-click a relationship to relabel, right-click
  to delete). Restores interactive relationship-drawing on the React Flow engine.
- **Canvas engine → React Flow.** Replaced the mind-elixir renderer with
  **@xyflow/react** (MIT), unlocking first-class, editable **alternate layouts**
  (org-chart down/up, radial, timeline, fishbone), **organic tapered branches**,
  **anchored callouts**, **inline rich-text topics** (Ctrl+B/I/U), and a
  branch-coloured **minimap + zoom controls**. The canvas is model-first (pure ops
  on the canonical doc → re-project → re-layout → onChange), and the SVG export is
  authored natively from the model (it now carries arrow + boundary labels and
  rasterises without canvas-taint). The migration ran behind a flag across phases
  0/A–I; mind-elixir and its `foreignObject` export shim are removed, and the entry
  + lazy bundle shrank (the engine chunk dropped ~37 kB).
- **Phase 0 scaffold** — local-first mind-map PWA on React 19 + Vite 6 + TS,
  built on the mind-elixir core (MIT, since replaced — see above) with a
  format-agnostic canonical model (`src/model/types.ts`) as the single source of truth.
- **MindManager-style render** — theme with a per-branch colour palette,
  two-sided radial layout, and rounded topics (`src/mindmap/`).
- **One-way `.mmap` importer** (`src/import/mmap.ts`) — recovers the full common
  feature set, field-mapped from the bundled MindManager XSD (authoritative, not
  guessed): topic tree + text, notes (`NotesXhtmlData@PreviewPlainText`), stock
  icons (`Icon@IconType`), hyperlinks (`Hyperlink@Url`), relationships →
  cross-links (`ConnectionGroup > Connection > ObjectReference@OIdRef`),
  boundaries (`Topic > OneBoundary`, over the subtree), and floating topics.
  Out-of-scope task data is warned not imported, and a left-behind check warns on
  any unreached topics. Validated against a real export (25-topic map, zero loss)
  plus 9 synthetic unit tests and a CI-safe, env-gated (`MMAP_FILE`) integration
  test.
- **The "green before done" gate** — `pnpm gate` runs typecheck → lint/format
  (Biome) → dead-code (knip) → tests (vitest) → build (vite) → bundle-size
  budget, fail-fast. Mirrored in GitHub Actions CI (`.github/workflows/ci.yml`).
- **Working agreement** captured in `CLAUDE.md`.
- **Feature catalogue** (`docs/features.json`) — the curated list of user-facing
  capabilities that serves as the denominator for documentation coverage; a
  `check-feature-coverage` gate validates its integrity (ids, areas, dates,
  flags) and warns when the CHANGELOG advances past the catalogue's reviewed
  watermark.
- **Stats pipeline** (`scripts/build-stats.mjs`) — distils the repo's own tooling
  (Vitest coverage, git history, file + build scan) into `public/stats.json` plus
  a rolling `public/stats-history.json` for trend sparklines: lines of code by
  category, coverage, test counts, a high-churn×low-coverage risk map, code
  hygiene counters, domain richness, footprint and gzip bundle size. A **Stats**
  workflow (`.github/workflows/stats.yml`) regenerates and commits them back on
  every push to `main`, loop-guarded by `[skip ci]` + `paths-ignore`.
- **Project dashboard** (`public/dashboard.html`) — a standalone, backend-free page
  with two halves: a **live repo pulse** (commit frequency, conventional-commit
  types, authorship, day/hour rhythm and merged-PR activity, pulled client-side
  from the unauthenticated GitHub REST API on each open) and **project metrics from
  CI** (everything from `stats.json`, including the documentation-coverage map and
  the risk map). Chart.js from a pinned, SRI-checked CDN.
- **Dual licensing** — the software is licensed under the **Apache License 2.0**
  ([`LICENSE`](LICENSE); also `package.json`'s `license` field), while the
  forthcoming practitioner book in `docs/guide/` is **CC BY-NC 4.0**
  ([`LICENSE-BOOK`](LICENSE-BOOK)). Third-party trademark + open-source dependency
  notices live in [`NOTICE.md`](NOTICE.md), rendered to `/notices.html`, and the
  split is documented in the README "## License" section.
- **In-app About dialog** — a native `<dialog>` (modal semantics, focus management
  and Escape-to-close handled by the browser) reachable from the header, surfacing
  the copyright, the dual-license summary, and links to the third-party notices,
  the live dashboard, and the source repository.
- **User manual rendered to `/user-guide.html`** — the comprehensive `USER_GUIDE.md`
  is rendered to a styled, standalone page at build time by a small Vite plugin
  (`marked`, with GitHub-style heading slugs so the guide's own in-page anchors
  resolve) and served on demand in dev. Reachable from the in-app **About** dialog.
  One canonical source — never a hand-maintained second copy that can drift.
- **The book — _Thinking in Maps_** — a longer-form guide to mind mapping under
  [`docs/guide/`](docs/guide/), built from one Markdown source to **both** a
  reflowable EPUB (Kindle-friendly) and a fixed-A4 PDF (cover, clickable TOC,
  chapter bookmarks, document metadata + a stable book id) by pure-Node builders
  (`jszip` + `marked`, and `pdf-lib`). Its diagram is generated from a source
  constant — rendered as SVG for the EPUB and drawn natively for the PDF. Both
  builds are byte-deterministic. The artifacts deploy with the site
  (`/Thinking-in-Maps.epub`, `/Thinking-in-Maps.pdf`); a **Rebuild book** workflow
  regenerates and commits them when the manuscript changes (bot-actor loop guard),
  with opt-in send-to-Kindle. The catalogue's `book` flag now tracks coverage (97.7%).
- **`.mmap` import wired into the app** — an Open-file control runs `parseMmap`
  and renders the result on the canvas, surfacing importer warnings and parse
  errors inline.
- **Markdown I/O** (`src/io/markdown.ts`) — open `.md` outlines as maps and export
  any map to `.md` (H1 root + nested bullets, round-trippable); wired into the open
  dialog (accepts `.md` and `.mmap`) and an Export .md button.
- **Edit capture** (`src/mindmap/sync.ts`) — canvas edits flow back into the
  canonical model (mind-elixir `operation` → `fromMindElixir`), preserving
  canonical-only fields (notes/tasks/images) by id, so Export .md reflects live edits.
- **Local-first persistence** (`src/store/mapStore.ts`) — the current map autosaves
  to IndexedDB (debounced) and reloads on startup, so work survives a refresh.
- **Multi-map library** — many named maps in IndexedDB keyed by id, with the
  last-opened map restored on startup. The header gains a map switcher (dropdown)
  plus New and Delete; each import becomes its own library entry.
- **PNG / SVG export** — export the current map as a PNG or SVG image via
  mind-elixir's built-in renderers, exposed through a `MindMapHandle` ref
  (`.png` / `.svg` buttons in the header).
- **Installable PWA** — `vite-plugin-pwa` adds a web manifest, an on-brand app
  icon, and a Workbox service worker that precaches the app shell, so MindMap
  Studio installs to the home screen / desktop and runs fully offline.

- **Node editing UI** — `@mind-elixir/node-menu` adds an inline editor panel
  (icons, tags, font size/color, link, and memo) when a node is selected. Edits
  flow through the capture seam into the canonical model; the memo maps to the
  node's `note`, so notes persist and round-trip with imported maps.
- **Walk-Through presentation mode** — a "▶ Present" button opens a fullscreen
  slide view: an overview (title + branches), then one slide per branch with its
  nested bullets, navigated with Prev/Next, arrow keys, and Esc.
- **Relationship arrows** — imported `.mmap` relationships (`doc.links`) render as
  curved arrows between nodes, and arrows drawn on the canvas round-trip back into
  the model and persist.
- **Self-contained HTML export** — a `.html` button exports the map as a single
  standalone HTML file with the SVG embedded; opens anywhere, offline, no deps.
- **HTML slide-deck export** — a `.html (slide deck)` export turns the map into a
  standalone, navigable slide presentation — the Walk-Through as a shareable file:
  an overview slide plus one slide per branch, navigated by arrow keys / click /
  Prev-Next buttons, with embedded styling and no dependencies. Reuses the same
  slide model the in-app presentation renders (`src/io/deck.ts`, lazy-loaded so it
  stays out of the entry bundle); topic text is HTML-escaped, and the nav script is
  static, so map content has no scripting surface.
- **Word (.docx) export** — a `.docx (Word)` export saves the map as an editable
  outline document (a title, then indented bulleted topics, with notes as italic
  lines). It writes the minimal valid Open-XML package by hand
  (`[Content_Types].xml`, `_rels/.rels`, `word/document.xml`) via `fflate`, using
  direct run formatting rather than named styles so it renders identically in Word,
  LibreOffice, Pages, and Google Docs. Pure + deterministic (`src/io/docx.ts`,
  lazy-loaded); topic and note text is XML-escaped.
- **PowerPoint (.pptx) export** — a `.pptx (PowerPoint)` export turns the map into a real,
  editable slide deck — an overview slide, then one per branch with its subtree as bullets —
  reusing the same slide model as the in-app Walk-Through. It writes the full minimal
  PresentationML package by hand (presentation, slide master, layout, theme, and one part per
  slide, each wired through its own `.rels`) via `fflate`; slides are positioned text boxes, so
  they're self-describing. Pure + deterministic (`src/io/pptx.ts`, lazy-loaded); topic text is
  XML-escaped. Verified by opening the output with python-pptx (a real PowerPoint-class reader)
  plus well-formedness + referential-integrity unit tests.
- **Excel (.xlsx) export** — a `.xlsx (Excel)` export saves the map as an indented outline
  worksheet: each topic in the column matching its depth, plus a Notes column and a bold
  header. Minimal SpreadsheetML written by hand via `fflate` (inline strings, no
  sharedStrings part); pure + deterministic (`src/io/xlsx.ts`, lazy-loaded), topic/note text
  XML-escaped. Verified by opening the output with openpyxl (a real Excel-class reader) plus
  well-formedness + content unit tests.
- **Copy outline** — a `⧉ Copy outline` button copies the map as a Markdown outline straight
  to the clipboard (no file download), for pasting into an email, chat, or doc.
- **More starter templates** — the New menu gains five structured-thinking starters:
  **5 Whys** (a nested root-cause chain), **Decision** (pros & cons), **Retrospective**
  (Start / Stop / Continue), **Meeting notes**, and **Pre-mortem** (`src/templates.ts`).
- **Find nodes** — a header search box matches node topics _and notes_
  (case-insensitive), focuses and selects the match on the canvas, and cycles through
  multiple hits on repeated Enter (with an `n/total` counter). Matching is a pure,
  unit-tested helper (`src/search.ts`).
- **Library-wide search** — a **🔎 All maps** button opens a dialog that searches *every* map
  in the library (topics + notes, floating topics included) and jumps to the chosen map and
  node: a same-map hit focuses in place, another map switches then focuses. Pure, unit-tested
  matcher (`searchLibrary` in `src/search.ts`); the dialog loads the library with the live
  current map merged over its saved copy, so it sees unsaved edits.
- **Print / PDF export** — a `.pdf` button renders the map into a hidden iframe and
  opens the browser's print dialog ("Save as PDF"), laid out landscape to fit wide
  maps. Dep-free and fully local; the print document is a pure helper
  (`buildPrintDoc` in `src/io/html.ts`).
- **Batch import** — the Open control now accepts multiple files at once; each
  `.mmap`/`.md` becomes its own library entry, the last one opens on the canvas, and
  a one-line summary reports how many were imported (with per-map import notes).
  Serves migrating a folder of existing MindManager maps in one go.
- **Boundaries** — imported MindManager boundaries (`doc.boundaries`) draw on the
  canvas as labelled, shaded boxes around their subtree (see the filled-enclosure entry
  above), via mind-elixir summaries (`toSummaries`/`fromSummaries` in `src/mindmap/sync.ts`).
  Boundaries you draw on the canvas round-trip back into the model and persist, and imported
  ones survive edits — all keyed by stable node ids, so the boxes re-derive correctly after
  structural edits.
- **Native `.json` import/export** — a `.json` button saves the full canonical model
  (notes, links, boundaries, icons, tags) and an imported `.json` restores it exactly.
  Unlike the lossy/derived formats, this is a lossless round-trip — the format to use
  for backup or moving a map between machines. Malformed files are rejected with a clear
  message. Pure helpers (`serializeDoc`/`parseDoc` in `src/io/json.ts`).
- **Fit button** — re-scales and centers the map to the viewport (MindManager's "Fit
  Map"), handy after importing a large map or panning around. Exposed via the
  `MindMapHandle` ref (`fitView` is also reused for the initial auto-fit).
- **Image/document exports render everywhere** (`src/io/svgText.ts`) — mind-elixir
  emits topic labels as `<foreignObject>` (HTML-in-SVG), which only renders inline in a
  browser: opened as a file, rasterized to PNG, or placed in Office the labels vanished
  (and foreignObject *taints* the canvas, so the PNG path produced a blank/failed image).
  `inlineSvgText` rewrites those labels to native SVG `<text>`, reusing each label's
  existing x/y so it lands inside its box, and now runs in the `.svg`/`.png`/`.html`/`.pdf`
  pipeline (after `sanitizeSvg`). The PNG export rasterizes the cleaned SVG itself
  (`useMapExports.svgToPng`), replacing mind-elixir's taint-prone `exportPng`. Verified by
  a canvas-taint + text-pixel render check; the library's own `exportSvg(true)` was
  rejected because it mispositions every label. Covered by `test/svgText.test.ts`.
- **Multi-line topic labels in exports** — `inlineSvgText` now splits a topic on its
  explicit line breaks and emits one `<text>` with a `<tspan>` per line, distributed over
  the box height (single-line topics stay a plain `<text>`). Previously a multi-line topic
  collapsed onto one line in the exported image/document. Verified by a real multi-line
  render. An **export-fidelity regression test** (`test/exportFidelity.test.ts`) now pins
  the whole `sanitizeSvg → inlineSvgText` chain: topics (incl. multi-line), marker icons,
  node images, and connector/arrow/boundary `<path>` geometry all survive, while scripts,
  inline handlers, and dangerous URL schemes are stripped. (Known gap: mind-elixir's export
  omits arrow/boundary *text* labels — their geometry exports, the labels don't.)
- **Book — _Thinking in Maps_ grown to full feature coverage.** The two previously
  un-booked features now have prose: **Copy outline** (clipboard, Chapter 6) and the
  **remembered-workspace** panel persistence (Chapter 5) — `book` coverage is now 100%.
  The Chapter 5 & 6 "Now you try" exercises gained concrete worked examples for **Fit**,
  **PNG/SVG**, **PDF**, **Excel**, **Copy outline**, and the remembered workspace, lifting
  `bookExample` coverage to 54%. The PDF builder's `pdfText` now also strips the
  Misc-Math-Symbols-B block (so a toolbar glyph like `⧉` named in prose can't break the
  WinAnsi draw); both books still build byte-deterministically.
- **More book worked examples (Chapters 2–7).** The "Now you try" exercises gained
  concrete, hands-on steps for editing-into-the-model, images, per-topic styling/font,
  themes, layout direction, floating topics, cross-map links, duplicate/switch maps,
  walk-through Present, library backup, and PWA install — lifting `bookExample` coverage
  **54% → 82%**. Flags flipped only for features the prose genuinely walks the reader through.
- **Example gallery — 13 pre-built maps** (`src/examples.ts`). An **Examples** group in the
  **+ New…** menu (alongside the empty templates) opens complete, worked maps to explore and
  adapt: Product launch, Meeting notes, Decision log, Quarterly OKRs, Retrospective, a worked
  SWOT, Incident runbook, GTD natural planning, Talk/content outline, Personal knowledge map,
  Study/revision map, Trip plan (with a small embedded image), and a Cross-map atlas. Between
  them they exercise every major feature — notes, markers, boundaries, relationships, floating
  topics, per-topic styling, images, deep nesting, hyperlinks. Each is canonical-model data
  (opening one mints a fresh, editable copy) and covered by `test/examples.test.ts` (every
  example builds with unique ids and no dangling link/boundary references).
- **⬚ Group button — MindManager-style filled boundary enclosures.** A toolbar **⬚ Group**
  button draws a shaded, rounded box around the selected branch and its whole subtree
  (`MindMapHandle.groupBranch`); it's captured into the model (`doc.boundaries`) and persists
  like any edit. The box is a **custom overlay** (`renderBoundaryOverlay` in `MindMap.tsx`):
  it lives inside mind-elixir's transformed canvas, so it pans and zooms with the map, and
  its bounds are recomputed from the live node rects on every edit, init, and layout change.
  mind-elixir's own bracket summaries are suppressed (`hideNativeBrackets`) so only the filled
  box shows, with a single label chip; the canonical label round-trips by id even though the
  underlying summary's label is blanked (`toSummaries`/`fromSummaries`). This lifts filled
  boundary enclosures out of the renderer-ceiling list — **callouts** remain there (the engine
  has no callout primitive), tracked in `NEXT_STEPS.md`.
- **PWA self-update — "New version available — Refresh now."** The service worker now uses
  `registerType: "prompt"` (was `"autoUpdate"`, which reloaded silently): a new deploy parks
  the new worker and surfaces a non-intrusive toast with a **Refresh now** action that swaps
  to the new build and reloads — never a silent reload that could drop an in-flight edit. The
  update service (`src/pwa/pwaUpdate.ts`) also powers a **Check for updates** action in the
  About dialog (re-surfaces the prompt if one's already waiting). The toast surface gained an
  optional action button + duration; `navigateFallbackDenylist: [/\.html$/]` keeps the
  standalone pages out of the SPA shell. Verified offline end-to-end (kill the server → the
  app still loads from the SW cache); covered by `test/pwaUpdate.test.ts` (callbacks, the
  Refresh-now → `updateSW(true)` path, idempotency, and the four manual-check outcomes).
  Adds `workbox-window` as a direct devDep (strict pnpm doesn't expose it to the app).
- **Corner minimap + integrated zoom controls** (`src/mindmap/minimap.ts`). A bottom-right
  panel draws a schematic overview of the whole map — one branch-coloured rect per topic —
  with a viewport rectangle you can **click or drag to pan** the main canvas; below it sit
  zoom **−/+** buttons, a live percentage, and a **fit** button. mind-elixir has no built-in
  minimap (verified), so the schematic is custom: node rects are projected from the live DOM
  into the panel by a pure, unit-tested layout (`computeMinimapLayout`), redrawn on data
  edits and re-aligned on pan/zoom via the engine's `move`/`scale` events. mind-elixir's own
  bottom-right zoom widget is hidden so there's a single, integrated control, and the engine's
  zoom range is widened (`scaleMin 0.2` / `scaleMax 3`) so the buttons and wheel zoom in
  meaningfully. Covered by `test/minimap.test.ts` (projection, centring, viewport, inverse).
- **Interop with other mind-mapping tools — FreeMind/Freeplane, Mermaid, XMind.** New thin
  adapters to/from the canonical model widen the round-trip beyond `.mmap`/OPML/Markdown/JSON:
  **FreeMind/Freeplane `.mm`** (`src/io/freemind.ts`, import + export — topic tree, links,
  folded state, and notes), **Mermaid `mindmap`** (`src/io/mermaid.ts`, import + export — the
  text format you embed in Markdown/docs; topic tree), and **XMind `.xmind`** (`src/io/xmind.ts`,
  import — unzips `content.json`, mapping titles, notes, web links, and labels→tags). Wired into
  the **⬆ Export…** menu (`.mm`, `.mmd`) and **Open files** (`.mm`, `.mmd`/`.mermaid`, `.xmind`);
  dangerous-scheme links are dropped on both directions, as everywhere. Covered by
  `test/freemind.test.ts`, `test/mermaid.test.ts`, and `test/xmind.test.ts` (round-trips, shape/
  indentation parsing, malformed-input rejection). _(Update: XMind **export** and legacy `.xmind`
  `content.xml` **import** both shipped shortly after — see the entries above.)_
- **MindManager gap-analysis doc** (`docs/mindmanager-gap-analysis.md`). A systematic audit of
  MindManager's full current feature set (desktop 2023–2025, Web, Teams, Snap) mapped to
  MindMap Studio's status — shipped / partial / renderer-ceiling / out-of-scope — with a
  prioritized list of buildable gaps. It's the roadmap signal behind `NEXT_STEPS.md`: it shows
  the alternate-layouts/callouts/rich-text cluster all share one root cause (the renderer), and
  confirms the PM and collaboration/enterprise layers stay deliberately out of scope.

### Changed

- **Denser inspector rows + keyboard-accessible tabs.** The Details tab's single-value fields
  (**Progress, Dates, Priority**) now render as compact *label-left / control-right* rows instead of a
  full-width section header above a stacked control block, so more fits without scrolling (the control
  cluster wraps under the label only when it's too wide, e.g. the two date pickers in a narrow panel).
  The inspector's **Details / Style / Notes** tab strip is now a proper WAI-ARIA tablist with a
  **roving tab-stop** and **←/→ + Home/End** keyboard navigation, and each tab is tied to its panel
  via `aria-controls` / `aria-labelledby`. Purely a layout + a11y change — the controls themselves are
  unchanged.

- **The Topic-info inspector now matches the rest of the chrome and re-themes.** It was a light-only
  280px panel with a right-hand border (a left-rail idiom) that stayed white in Dark / Ocean / Sunset;
  it now uses the same themed `.mm-inspector` shell as the map-overview panel — 300px, border on the
  left, surface + controls driven by the editor's `--ed-*` tokens — so selecting/deselecting a node no
  longer makes the right edge jump width or flip its border, and the whole panel (tabs, inputs,
  buttons, notes editor, markers, stickers) reads correctly in every theme. Purely visual: the shared
  control primitives gained additive class hooks that only the inspector-scoped CSS targets, so the
  left-rail panels are byte-for-byte unchanged; priority chips keep their semantic colours.

- **Canvas + Present component tests (internal).** The two biggest untested components now have a net:
  `test/flowmindmap.test.tsx` mounts the real `FlowMindMap` (React Flow) canvas and drives it through
  the imperative `MindMapHandle` ref + `document` keyboard events — covering the contract surface the
  upcoming UX redesign depends on (every handle action, undo/redo, the keyboard tree-building, the
  drop-to-floating-topic path, and the brace/filter/numbering re-sync) plus the lazy `MindMap` seam.
  A scoped jsdom viewport shim (the documented React Flow test mock) makes the canvas render its nodes
  + edges, so the test also drives the right-click **context menu** (every action + the branch-layout
  override), node/pane clicks, the quick-action popover, the **Link to…** relationship gesture,
  **inline editing** (commit / add-sibling / add-child / cancel), the node affordances (follow link /
  step task pie / collapse), relationship-edge edit & delete, and the minimap toggle.
  `test/presentation.test.tsx` mounts the ▶ Present overlay and drives navigation, the keyboard, and
  the presenter sidebar. Lifts `FlowMindMap.tsx` 0 → 91%, `Presentation.tsx` 0 → 100%, the `mindmap/`
  area 8.5 → 91.5%, and overall line coverage ~67 → ~81%. Tests only — no behaviour change.
- **Dashboard load + contract tests (internal).** `public/dashboard.html` (the live GitHub + CI-metrics
  page built from `public/stats.json` / `public/stats-history.json`) had no automated coverage;
  `test/dashboard.test.ts` now guards that it loads, in three passes: **structure** (every id the inline
  script drives exists in the markup, Chart.js stays SRI-pinned, both data sources are wired to
  `window` `load`), **contract** (the committed `stats.json` / `stats-history.json` carry every field the
  dashboard reads — so a `build-stats.mjs` key rename fails CI instead of silently rendering "—"), and
  **behaviour** (the real inline script runs in jsdom against the real DOM — filling the metrics from the
  committed data, rendering the live repo pulse from stubbed GitHub responses, and degrading to the
  pending banner + "live fetch unavailable" note when the network is down).
- **Panel/filter state extracted into `usePanels()` + tech-debt sweep (internal).** The eight
  side-panel open/close toggles (outline / index / info / filter / styles / history / board /
  numbered) with their `mindmap-panels` persistence, the read-only Power Filter (text / markers /
  tags / due / priority + the clear/toggle rules and the "closing Filter clears it" behaviour), and
  the saved-filter presets (`mindmap-saved-filters`, add / apply / delete) all moved out of `App.tsx`
  into a single `src/hooks/usePanels.ts`, returned as a grouped `{ panels, filter, savedFilters }`
  object and unit-tested with `renderHook`. Behaviour-preserving — the persistence keys, defaults, and
  every rule are unchanged. Alongside it: the **callout** inline editor swapped its `autoFocus`
  attribute for a `useRef` + mount `useEffect(focus)` (same UX, one fewer a11y lint suppression), and
  the repeated d3-hierarchy tidy-tree placement in `mindmap/flow/layout.ts` was folded into one
  `layoutTidyTree(…)` helper shared by the side / left / right / org-down / org-up / brace layouts
  (verified byte-identical positions against the prior code). `App.tsx` drops to ~1,520 lines; this
  closes the foundation-hardening run (coverage **~44% → ~55%**, `App.tsx` **2,165 → ~1,520**, design
  tokens + primitives + `<Toolbar>`/`<Dialog>` extracted, the canvas memoised) ahead of the UX
  redesign.
- **Toolbar extracted from `App.tsx` (internal).** The ~580-line editor `<header>` (the ~50 nav /
  panel / map / canvas / layout / find / export controls) moved into a single prop-driven
  `src/components/Toolbar.tsx`, grouped into logical prop buckets (`nav` / `panels` / `map` /
  `canvas` / `find` / `io`) plus the canvas handle ref. The inline `controlStyle` / `inputStyle`
  buttons were swapped onto the Phase-C `Button` / `Select` / `Input` primitives where the swap is
  pixel-identical. Strictly behaviour-preserving — every control renders and behaves the same;
  `App.tsx` drops ~500 lines and the toolbar is now one self-contained component the upcoming UX
  redesign can restructure in isolation.
- **Controlled `<Dialog>` wrapper (internal).** The three native `<dialog>` modals (About, Search-all,
  Paste-text) now render through one controlled `src/components/Dialog.tsx` that owns the
  `showModal()` / `close()` mechanic, the native `close` event, and Escape-to-close — replacing the
  three hand-rolled `useEffect`s in `App.tsx`. Each dialog passes `open` / `onClose`, with its on-open
  side effects (focus the first field, lazy-load the searchable library) supplied via an `onOpen`
  callback. Behaviour-identical — same modal open/close, same content, same per-dialog look (the Paste
  sheet keeps its shadow-less surface).
- **Design-token + UI-primitive layer (internal).** The editor chrome's ad-hoc inline styles now
  draw from a single named palette + scales (`src/design/tokens.ts`: `colors`, `space`, `radius`,
  `fontSize`, `fontWeight`) through a small set of reusable primitives (`src/design/primitives.tsx`:
  `Button` with an `active`/`disabled` variant, `Input`, `Select`, `Chip`, `Panel`, `PanelSection`).
  `src/ui.ts` (`controlStyle`/`inputStyle`), `src/Panels.tsx` (the rail panels + style/marker bars),
  and the `src/mindmap/FlowMindMap.tsx` context menu were migrated onto them. Strictly
  behaviour-preserving — the values are the exact current ones, so every panel, control, and menu
  renders pixel-identical; this is the building-block layer the upcoming UX redesign sits on.
- **Canvas render perf (internal).** The React Flow building blocks are now wrapped in `React.memo`
  — `TopicNode`, `BranchEdge`, `CrosslinkEdge`, and the `ViewportPortal` overlays (`Boundaries`,
  `Callouts`, `Summaries`, `BraceConnectors`, `DiagramBackdrop`) — so a large map stops re-rendering
  every node/edge/overlay on unrelated state changes (selection, hover, menus, panning). Selection
  highlight, Power-Filter dimming, drag, and inline editing still update correctly (the producer mints
  fresh `data` only when content changes; editing flows through context, which memo never blocks). The
  per-item bbox math in the overlays is `useMemo`'d on `(nodes, items)`, and `CrosslinkEdge`'s
  **line-jump** crossing scan (an O(relationships²) pass that previously re-ran on every render) is
  memoised on the real inputs `(nodes, edges, id, lineJumps)` — it still recomputes the moment a node
  moves or a relationship is added/removed, but caches every other render. Behaviour-preserving;
  canvas == export is unchanged.
- **Component/hook test safety net (internal).** Added `@testing-library/react` (+ `/dom` +
  `/user-event`) and a jsdom test setup (`test/setup.ts`, polyfilling `ResizeObserver`,
  `matchMedia`, `IntersectionObserver`) wired through `vitest.config.ts` — `node` stays the default
  environment; component/hook specs opt into jsdom per-file. New **render + interaction smoke tests**
  for every left-rail panel (`Outline`, `Marker/tag index`, `Filter`, `Styles`, `Info`, `History`,
  `StyleBar`) assert user-visible text/roles (so they survive a later panel refactor), and
  **`renderHook` tests** cover `useFind`, `useMapExports`, `useTheme`, and `useIsMobile`. The pure
  relationship-arrowhead geometry is extracted from `CrosslinkEdge.tsx` into
  `mindmap/flow/arrowhead.ts` (behaviour-preserving — the canvas edge and the SVG exporter share the
  one byte-identical builder) and unit-tested alongside `taperedRibbonPath` + `floating.ts`. Coverage
  fill for `io/attachment.ts`, `io/image.ts` (`fileToMapImage` via mocked Image + canvas),
  `store/mapStore.ts` (`getAllMaps`/`listMaps`/cold-boot/concurrency), and the remaining `flow/ops.ts`
  branches. Statement/line coverage **~44% → ~55%**; suite now 742 tests. No behaviour change.
- **Hardening pass.** The PDF book builder now measures text through a `safeWidth`
  helper (mirroring `safeDraw`), so a glyph that slips past `pdfText` can never throw at
  the width step — the build degrades to the ASCII fallback instead of failing. The pure
  image-scale math is extracted from `src/io/image.ts` into a unit-tested `imageSizing`
  helper, and the shared OOXML infra (`escapeXml` + the deterministic `zipOoxml`) gains a
  direct test. Suite now 182 tests; no behavior change (books rebuild byte-for-byte).
- Upgraded the mind-elixir rendering core **4.6.2 → 5.12.2** (behavior-preserving —
  render, edit-capture, persistence, and export all re-verified in-browser).
  Unblocks the node-menu editing UI; the production bundle shrank slightly.
- The `.mmap` importer (`fast-xml-parser` + `fflate`) is now **code-split** into an
  on-demand chunk, trimming the initial JS bundle to ~99 kB gz (from ~114 kB). The
  size gate now budgets the entry chunk and reports lazy chunks separately.
- Bumped the GitHub Actions (checkout, setup-node, pnpm/action-setup) to **v6**
  (node24 runtimes), clearing the Node 20 deprecation annotation on CI.
- Bumped the GitHub **Pages** actions (`configure-pages` v6, `upload-pages-artifact` v5,
  `deploy-pages` v5) to their node24 majors, clearing the last Node-20 deprecation warning
  (on the Deploy workflow), and dropped the no-op `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` env
  that never actually suppressed it.
- Added a build-time guard (in the size-budget gate step) that asserts mind-elixir's core
  CSS is in the bundle — a `me-tpc` selector check — so the "canvas renders unstyled"
  regression can never ship silently again.
- **Deployed to GitHub Pages** — a `deploy.yml` workflow runs the gate, builds, and
  publishes on every push to `main`, served from the custom domain
  <https://mindmap-studio.struktureretsundfornuft.dk/> (HTTPS, with a `CNAME` baked into the
  build). The app is now live, installable, and offline-capable from a real URL.
- Extracted the six export handlers + the download helper out of `App` into a focused
  `useMapExports` hook (`src/useMapExports.ts`), so the component reads as orchestration
  rather than I/O plumbing (behavior-preserving — all formats re-verified in-browser).
- Further slimmed `App` by extracting the dark-mode preference (`useDarkMode`) and the
  Find behaviour (`useFind`) into self-contained hooks (behavior-preserving).
- Extracted the Outline, Notes, and Markers panels into presentational components
  (`src/Panels.tsx`) and the shared toolbar styles into `src/ui.ts`, so `App` reads as
  orchestration rather than markup (behavior-preserving — all three re-verified in-browser).
- The toolbar now **wraps** instead of overflowing, and the seven export buttons collapsed
  into one **⬆ Export…** menu to cut the clutter (all formats unchanged).
- The **⬆ Export…** menu is now grouped into labelled sections (Data & outline, Image,
  Document, Presentation) so the nine export formats stay scannable.
- In-map **Find** now searches floating topics too, not just the central tree, matching the
  newly-editable floating branch (`findDocMatches` in `src/search.ts`).
- Upgraded the build toolchain to **Vite 8** (6.4.3 → 8.0.16) with `@vitejs/plugin-react`
  6, matching TP Studio. Behavior-preserving — full gate green and the app re-verified
  in-browser (render, search, exports, no console errors); the production bundle even
  shrank (~100.6 → ~96.8 kB gz entry).
- Imported **floating topics render and are editable** on the canvas, in a labelled
  "Floating topics" branch (mind-elixir has no detached nodes, so this is the honest
  representation; the import banner notes their separate placement). Edits to the branch —
  rename, add, remove, nest, or drag a topic in/out of the tree — are captured back into
  `doc.floatingTopics` (with notes/images preserved by id) and persist; emptying or deleting
  the branch clears them. Pure round-trip in `fromMindElixir` (`src/mindmap/sync.ts`).
- **Node images** — an "Image" button attaches a picture to the selected node. The file
  is downscaled and stored as a self-contained data URL (so maps stay offline and a `.json`
  export carries its images), rendered on the node, and round-tripped through the model
  (`fileToMapImage` in `src/io/image.ts`; image sync in `src/mindmap/sync.ts`).
- **Canvas theme gallery** — a Theme picker swaps the whole map style live (Light, Dark,
  Ocean, Sunset — each its own branch palette + surfaces), for on-screen presentation;
  image exports inherit it. Switching is live (no reload, no lost edits) and the choice
  persists across sessions.
- **Per-topic styling** — a 🎨 Style bar applies shape (box / rounded / pill), fill, border,
  and bold to the selected node, with ✕ to clear and Reset for all. Styles persist and
  round-trip through the model and `.json` (`NodeStyle` extended with `borderRadius` /
  `border`). Complements node-menu's font size/colour controls.
- **Notes editor** — a 📝 Notes panel docks below the canvas and edits the selected node's
  note in a comfortable textarea (debounced autosave + commit on blur), replacing the
  cramped node-menu memo. Notes persist and round-trip through the model and `.json`. A
  **Preview** toggle renders a safe Markdown subset (headings, bold/italic, lists, code,
  http(s) links) — `renderNote` in `src/noteFormat.ts` (HTML-escaped, unit-tested).
- **Outline view** — a ☰ Outline side panel lists the map as an indented, live outline;
  click a row to focus that node on the canvas, and noted nodes show a 📝 marker. A filter
  box narrows the outline by topic. Pure flattener in `src/outline.ts`.
- **New-map templates** — the New menu offers starter maps (Blank, Brainstorm, SWOT,
  Project plan) instead of only a blank map (`src/templates.ts`).
- **Cross-map links** — link a node to another map in the library (🔗 Link… picker); the
  node shows a 🔗 that navigates to the linked map in-app. Stored as a `#map=<id>` hyperlink
  and intercepted on click (so it doesn't open a blank tab). Turns the library into a
  connected knowledge base.
- **Duplicate map** — copy the current map into a new library entry ("… (copy)").
- **Remembered workspace** — which panels (Outline / Notes / Markers / Style) you have open
  is persisted, so the layout is restored next time.
- **Layout direction** — a picker switches the map between both-sides, right-only, and
  left-only layouts (applied live, edits preserved); the choice persists across sessions.
- **Collapse / Expand all** — ⊟ / ⊞ toolbar buttons collapse every branch to a level-1
  overview or expand the whole tree (MindManager's detail-level control).
- **Marker palette** — a 🏷 Markers bar of common markers (priority/flag/status/etc.);
  click one to toggle it on the selected node. Markers render on the node and persist.
- **Find & Replace** — the Find bar gains a replace field + "Replace all" that rewrites the
  search text in every matching topic (case-insensitive, literal). Pure `replaceInTopic`
  helper in `src/search.ts`. Press `/` to jump to Find from anywhere (ignored while typing).
- **OPML import/export** — open and save `.opml` (the standard outline-interchange format
  used by Freeplane, OmniOutliner, Workflowy, …); topics + notes round-trip. The parser is
  lazy-loaded (`src/io/opml.ts`), so it stays out of the entry bundle.
- **Library backup & restore** — a ⬇ Backup button saves *every* map to one
  `mindmap-library.json`; opening that file restores them all. Pure helpers
  (`serializeLibrary`/`parseLibrary` in `src/io/library.ts`); restore is auto-detected when
  you open a backup via Open files.

### Fixed

- **Canvas-fidelity bug-hunt fixes (post-merge sweep of the MindManager rendering pass).** A review
  of the just-landed markers/layouts/connectors/relationships/boundaries code surfaced a cluster of
  defects, now fixed with tests: the **fishbone layout** now positions sub-causes at **any depth**
  (depth-3+ nodes used to get no position and stack on the spine head at the origin); an **organic
  branch that runs perfectly axis-aligned** (a child dragged directly in line with its parent) no
  longer collapses to an invisible zero-area ribbon (falls back to the chord normal); the export
  **due-date chip keeps its 📅 glyph** to match the canvas; `fromFlow` now carries a node's **roll-up
  binding and attachments** through the round-trip (they were silently dropped); `boundaryPath`
  **clamps its corner radius** so a small rounded-rect box can't invert; an imported empty-string
  branch colour now **falls back to the palette** instead of emitting an empty stroke; and the export
  root-background fallback colour matches the canvas. A follow-up pass cleared the remaining reviewed
  findings: an **emoji / unknown marker** (e.g. an imported 👍) now draws in the marker row above the
  title in exports — matching the canvas — instead of being prepended to the title text; **bulk marker /
  tag toggles reach a selected floating topic** (the single-node `toggleIcon` / `setTags` now resolve
  floating topics too, so the decision and the mutation agree); the export's **outline number** is drawn
  de-emphasised (opacity 0.55) like the canvas; an **underline leaf** wraps at its true 8px padding;
  and a topic **image with no stored size** uses the same fallback + aspect handling on canvas and in
  export. All canvas==export-invariant or round-trip correctness fixes — no behaviour change to normal
  maps.

- **Exports now match the canvas for wrapped text, callouts, indicators, collapsed branches and
  images.** Several things rendered on screen but were dropped or distorted in the SVG / PNG / PDF
  export; they now render identically (canvas == export): long topic labels **word-wrap** inside their
  box instead of overflowing; a **multi-line callout** grows to fit instead of clipping to one strip;
  the **note / hyperlink / attachment** indicators are drawn (they used to vanish); a **collapsed
  branch** shows a circled hidden-subtopic count instead of looking like a leaf; and a topic **image**
  uses the same size cap on both. The always-on dot **grid** is gone (clean paper, like MindManager),
  and topics are flat at rest (the soft shadow was a screen-only affordance) — so the screen and the
  exported deliverable agree.

- **Relationship lines now bow the same way on screen and in exports.** The live canvas drew a
  relationship with React Flow's default bottom/top handles (a *vertical* bow) while the SVG/PNG/PDF
  exporter drew a *horizontal* S-curve — so the same link could curve the opposite way in a deliverable.
  Both now build the curve from one shared helper (`crosslinkBezier`), restoring canvas == export.

- **An imported task priority of 4–9 no longer renders as a grey "?".** `TaskInfo.priority` is modelled
  1..9 (MindManager's range), but the badge only defined 1–3 (High/Med/Low) and fell back to "?" for
  anything higher. Priorities 4–9 (which arrive via import) now show their number on a neutral badge,
  on the canvas and in exports alike.

- **A new topic is now focused for typing immediately.** Adding a topic (Enter / Tab / Ctrl+Enter)
  opens it in edit mode, but a freshly-created node is briefly `visibility:hidden` while React Flow
  measures it — so the one-shot `focus()` was a no-op and the new node sat in edit mode *unfocused*,
  forcing a click before you could type. The editor now retries focus across a few frames until it
  lands (an existing node, e.g. via F2, still focuses on the first try).

- **Toolbar dropdown menus (Panels / Insert / Canvas) no longer open as an invisible sliver.**
  Row 2 of the toolbar sets `overflow-x: auto` for horizontal scrolling, which per CSS coerces
  `overflow-y` too — so the absolutely-positioned dropdown was clipped to the ~50px toolbar row and
  effectively didn't show. The shared `Menu` now renders the dropdown as `position: fixed` with
  coordinates computed from the trigger button's rect, so it escapes the row's overflow clip on both
  desktop and mobile. Not a z-index issue (the menu already sat at z-index 60); clipping ignores
  z-index. The close-on-outside-click logic is unchanged — the menu stays a DOM child of its wrapper.
- **The 📝 note indicator now disappears for empty notes.** A note containing only whitespace
  cleared the icon in the Outline (which judges notes by trimmed content) but still showed 📝 on
  the canvas. `setNote` now treats a blank/whitespace-only note as "no note" (cleared), and the
  canvas indicator is gated on trimmed content too, so the two surfaces agree.
- **Boundaries / the ⬚ Group button now actually work on the canvas.** The first cut shipped
  on a verified *data* round-trip but the live render was never visually confirmed (it leaned
  on mind-elixir's bracket summary, which only drew a faint `{` on the outer edge, not the
  shaded box the user wanted — and a self-grouped node sometimes left a stray duplicate label).
  Replaced with the custom filled-box overlay above and verified by a real headless-Chrome
  render: a clean rounded shaded box encloses the branch + subtree with even padding, a single
  label chip, no stray duplicate, and arrow labels intact. Pan/zoom and layout-direction
  changes keep the box aligned.
- **Canvas styling restored — the map no longer collapses into inline text.** The mind-elixir
  v4→v5 upgrade moved the core stylesheet from JS-injected to a separate file, but the import
  was never added — so in production the node wrappers lost their `position:absolute` and the
  whole map flowed as one run of inline topics (the toolbar, which has its own CSS, still looked
  fine, which masked it). `src/mindmap/MindMap.tsx` now imports `mind-elixir/style.css`
  directly, so the stylesheet is always bundled (entry CSS ~1.8 kB → ~12.6 kB). Caught by
  headless-rendering the live site, fixed, and re-verified the same way.
- **No first-frame layout flash on load.** The canvas is hidden (`opacity:0`, kept measurable
  so the fit still works) until mind-elixir has laid out and fit the map, then revealed — so a
  fresh load or map switch no longer flashes the un-positioned nodes as one line before the
  tree appears. The reveal is unconditional (a `finally`), so the canvas can never stay hidden
  (`src/mindmap/MindMap.tsx`).
- **Imported `.mmap` icons render as glyphs.** Stock-icon names (e.g.
  `urn:mindjet:ThumbsUp`) used to show as literal text on nodes; common ones now map to
  emoji (👍, 🚩, 1️⃣, …) via `src/icons.ts`, which also backs the marker palette. Unknown
  names are kept as-is so nothing is lost.
- **Undo/redo now sync the model.** mind-elixir's `undo`/`redo` revert the canvas via
  `refresh()` without firing an `operation` event, so the canonical doc (and thus
  autosave + export) used to drift out of sync with what's displayed after a Ctrl+Z.
  `MindMap` now wraps `undo`/`redo` to re-capture, so the model always matches the canvas.

### Fixed

- **Dashboard "last push"** read `repo.updated_at`, which GitHub bumps on stars, issue
  comments, or any attribute change; it now uses `repo.pushed_at` (the actual last push).
- **EPUB byte-determinism** — JSZip stamped every entry, including the `META-INF/` and
  `OEBPS/` folder entries it auto-creates, with the wall-clock time, so each rebuild differed
  and the Rebuild-book workflow committed a no-op timestamp churn. Every entry's date is now
  pinned to date-only (midnight UTC), matching the PDF; the build is reproducible.
- **Book PDF code blocks** now paginate cleanly — a block taller than a page draws a
  background per page segment instead of spilling later lines onto the next page without one
  (latent: the manuscript has no fenced code blocks yet).

### Security

- **Stored XSS in the SVG / HTML / PDF export is fixed.** mind-elixir builds the export SVG by
  re-injecting each node topic as live HTML inside an SVG `<foreignObject>` (and each hyperlink
  as a raw `href`), and `src/io/html.ts` embeds that SVG as live markup — so a topic like
  `<img src=x onerror=…>` or a `javascript:` link (typed, or carried in by a malicious import)
  executed when the exported `.svg`/`.html` was opened or the map was printed to PDF. A new
  namespace-aware sanitiser (`src/io/svgSanitize.ts`) now runs on every SVG/HTML/PDF export:
  it strips `<script>`/`<iframe>`/`<object>`/… , every `on*` handler, and any URL scheme outside
  a strict allowlist, while **preserving** the foreignObject node topics — which DOMPurify
  cannot, as it deletes foreignObject content in every profile. As defence-in-depth, the
  hyperlink input boundaries (`setSelectedHyperlink`, the model↔canvas sync in
  `src/mindmap/sync.ts`, and the `.mmap` importer) reject `javascript:`/`data:`/`vbscript:`
  links at the source (`src/io/urlSafety.ts`). Verified against a real export render — no script
  executes and every node topic still renders — plus jsdom unit tests (`test/svgSanitize.test.ts`,
  `test/urlSafety.test.ts`). The XML/JSON importers were reviewed and are safe.
- **Stored XSS in the note renderer is fixed.** `src/noteFormat.ts` escaped `&`/`<`/`>` but not
  quotes, so a Markdown link whose URL contained a `"` broke out of the generated `href="…"` and
  injected a live attribute (e.g. an event handler) into the `<a>`. Notes render via
  `dangerouslySetInnerHTML` and can arrive from an imported map, so this was a stored vector, not
  just a self-XSS. `escapeHtml` now also escapes `"`/`'`, so no user character survives as a raw
  quote in the generated markup; the link transform still accepts only `http(s)` URLs. Regression
  test in `test/noteFormat.test.ts`.
