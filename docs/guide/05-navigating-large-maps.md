# Navigating large maps

### Outline, find, collapse, and links between maps

A map with thirty nodes fits on a screen. A map with three hundred does not, and the
features that felt optional at small scale become the difference between a map you use
and a map you abandon. This chapter is about staying oriented.

## Collapse and expand

Every branch can be **collapsed** to hide its children behind its parent, and expanded
again to reveal them. Collapsing is how you control altitude: fold everything down to
the top two levels to see the shape of the whole plan, then open just the branch you're
working in. The toolbar's **collapse all** and **expand all** controls do it to the
whole map at once -- collapse-all then open one branch is the fastest way to present a
large map without overwhelming the room.

Three refinements make altitude precise. **Detail levels** ("Show level 1", "level 2", ...)
expand the map to an exact depth in one command -- the step-wise version of collapse-all.
**Isolate branch** collapses every *other* top branch and opens the path to the topic you're on:
"fold everything else away" as a single, undoable move. And **Drill in** goes further than
folding -- it *re-roots* the view at the selected topic so its subtree fills the screen; you keep
editing as usual (it's just a view), and a bar or **Esc** brings the whole map back. While you're
deep in a branch, a **breadcrumb** above the canvas shows the path from the root -- click any
ancestor to climb back up without scrolling.

## Fit

Lost? The **Fit** button reframes the entire map to the viewport in one click. It's the
"take me home" of the canvas, and worth wiring into muscle memory: zoom in to work, hit
Fit to see where you are.

**View → Auto zoom** follows the current selection with a smooth fit, capped at 125%.
Try selecting two far-apart topics, then a single topic: the first needs a wider view, the second
can be read closer up. Pan manually to keep your chosen framing until the next selection.

**View → Focus mode** dims unrelated branches and keeps the path to the root. Enable it
with a selection to lock those branches, or clear the selection first so the focus follows
your next choice. Use the banner or **Esc** to leave focus mode.

## The minimap and zoom

In the bottom-right corner sits a **minimap** -- a shrunk-down overview of the whole map,
with a highlighted rectangle showing the slice you're currently looking at. On a big map
it answers the question "where am I, and what else is out there?" at a glance. Click or
drag inside it to jump the main view somewhere else: the rectangle follows your pointer
and the canvas pans to match, so the minimap doubles as a fast way to travel across a map
too large to scroll comfortably.

Below it are the **zoom controls** -- minus, a live percentage, plus, and a fit button.
They do the same job as the mouse wheel but give you a precise readout and a deliberate
step, which matters when you're lining a map up for a screenshot or a screen-share. The
percentage tells you exactly how far in you are; the fit button is the same "take me home"
as **Fit** above, kept within thumb's reach of the zoom buttons.

## Layouts: the same map, different shape

The map's default shape -- a two-sided radial -- isn't the only way to read it. The **Layout**
dropdown re-flows the *same* nodes into a different arrangement, and which one reads best
depends on what the map *is*:

- An **org-chart** (top-down or bottom-up) suits a hierarchy: a team, a taxonomy, a decomposition.
- A **timeline** lays the first level out as a left-to-right sequence -- a roadmap, a process, the steps of an argument.
- A **fishbone** (the Ishikawa diagram) angles branches into a spine, the classic shape for cause-and-effect analysis.
- **Radial** fans every branch evenly around the root when you want the pure, balanced bloom.
- A **grid / matrix** tiles the top branches into cells -- four branches make a 2x2, the natural
  shape of a SWOT or an Eisenhower box.
- A **swimlane** runs the top branches as parallel lanes -- a process split by owner or stage.
- A **brace map** joins each parent to its children with a `{` fork -- the part-whole diagram,
  read left to right.

The picker itself is a **gallery**: each layout shows as a small schematic thumbnail in the Map
panel, so you choose by shape, not by name.

Switching layout never changes your content -- only its geometry -- so it costs nothing to try
a few and keep the one that makes the structure obvious. A backlog that felt tangled as a radial
map can read as a clean timeline; a muddled list of problems snaps into focus as a fishbone.

## The outline panel

The **Outline** panel shows your map as an indented list -- the same tree, read top to
bottom instead of radiating outward. It's invaluable for three things: seeing the whole
structure linearly, jumping straight to a node (click it in the outline and the canvas
focuses it), and spotting structural problems a radial layout can hide, like a branch
that's gone six levels deep while its siblings stayed shallow.

It's also a full **editor**, not just a table of contents. **Double-click** a row to rename it
inline -- and while you're editing, **Tab** adds a child and **Enter** a sibling, exactly like
the canvas. The **◂ ▸** buttons on a row promote and demote it; **drag** a row to reorder or
re-parent (on a touchscreen, hold a row a beat and slide it); **Shift+Up / Down** reorder among
siblings and **Shift+Left / Right** promote and demote from the keyboard, focus staying on the
moved row. A long restructuring session is often *faster* here than on the canvas -- linear is
the better shape for triage -- and the two views stay in step both ways: select a node on the
canvas and the outline scrolls its row into view.

The outline has its own **filter** box: type a few letters and it narrows to matching
topics, so a long map becomes a short list you can scan.

## The marker and tag index

The outline answers "where is this *topic*?" The **Index** panel (the **📑 Index** button)
answers a different question: "where is everything I *flagged*?" It collects every marker and
tag used anywhere in the map and lists them grouped by symbol -- a ❗ heading with the three
topics you marked urgent under it, a ⭐ heading with your favourites, and so on, each with a
count. Click a topic in the index and the canvas jumps to it, exactly like the outline.

This is the read-only twin of the **Markers** palette. The palette is how you *put* a marker on
the selected node; the index is how you *find* every node that already carries one. On a map with
a hundred topics, that's the difference between scanning the whole thing for red flags and reading
them off a list. Each row also offers a **Quick Filter**: one click and the canvas shows just the
topics carrying that marker or tag -- the flag-then-ask loop closed in a single gesture. Markers
earn their keep precisely because the index makes them queryable after the fact -- so flag
deliberately, and the index becomes a live status board.

## Numbering the branches

A radial map is wonderful for thinking and terrible for *pointing*. "Look at the third sub-point
of the second branch" is a sentence no one wants to say. The **1. Numbering** toggle fixes that:
it stamps every topic with its outline number -- `1`, then `1.1`, `1.2`, then `1.2.1` -- on the
canvas and down the outline at once, so now you can just say "see 2.3" and everyone's eyes land in
the same place. The numbers follow into the PNG, PDF, and Office exports too, which is exactly when
you need them: a printed map handed round a meeting, or a slide that references a node by number.

It's worth being clear about what numbering *isn't*. It doesn't change your map. The numbers are
computed from the tree's shape the instant you switch it on and forgotten the instant you switch
it off -- they never touch your topic text, so search still finds "Budget" and not "4.2 Budget".
Reorder a branch and the numbers renumber themselves, because they were never really yours to
begin with -- they belong to the structure. They do follow you *out*, though, and further than
the images: while numbering is on, **⧉ Copy outline** and the **Markdown export** bake the
numbers into each line too, so the reference you say out loud ("see 2.3") is the same one in the
minutes; switch numbering off and the same exports come out clean. A **Numbering style** item
under the toggle picks the scheme -- **decimal** (1, 1.1) or **outline** (I, A, 1) -- so the map
can match the document it's headed into. Turn it on when you need to talk *about* the map; turn
it off when you just want to look *at* it.

## The legend: your conventions, on the page

Chapter 4's advice was to keep a small marker vocabulary -- but a reader who wasn't there when
you agreed it still needs the key. Toggle **Legend** (in the View menu, under Display) and a
quiet box appears in the map's corner listing exactly the conventions *this map actually uses*:
each marker with its name, each coloured tag, each conditional-formatting rule with its colour.
Nothing in use, nothing listed. It's drawn on the canvas, so it rides into the SVG and image
exports unchanged -- the handed-out PNG explains its own symbols. Turn it on for maps that
travel; leave it off while the only reader is you.

## Filtering without losing the forest

There's a moment with every large map where you stop wanting to *see everything* and start wanting
to *see one thing*: every red flag, every node tagged `q3`, every topic that mentions "budget". The
**Filter** panel does that without throwing anything away. Type some text, or click the marker and
tag chips for what you're hunting, and the map answers by **fading everything that doesn't match** --
leaving the matches, and the branches that lead to them, at full strength. A count tells you how
many topics qualified.

The phrase to hold onto is *read-only*. A filter here is a spotlight, not a pair of scissors: by
default everything else is only dimmed, and the instant you hit **Clear** or close the panel the
whole map comes back. When even the dimmed context is noise -- a screenshot meant for one team, a
map too dense to read faded -- tick **Hide non-matches** and the rest leaves the canvas entirely:
still the same spotlight, the map itself untouched (the panel's footer says so), just with the
house lights fully off. That read-only rule is deliberate. The fastest way to lose trust in a
tool is to have it quietly remove something you needed; a filter that never edits the map -- only
what's shown of it -- can't. The context stays too -- because the path from the centre to each
match keeps its colour, you never get the disorienting "lone highlighted node floating in grey"
that makes you forget where you are.

It pairs naturally with markers. Flag the risks as you build the map (Chapter 4), then, when the
map is big and the meeting is short, filter to ❗ and read the risks straight off the lit branches.
The markers are the *input*; the filter is the *question you ask of them later*.

A filter you build often, you shouldn't have to rebuild. **Save** one as a named **preset** and it
joins a list you re-apply in a click -- "❗ risks", "due this week", "tagged `q3`" -- and because
presets are kept app-wide, a filter that proves useful on one map is waiting on the next. The Power
Filter stops being something you set up each time and becomes a set of saved questions you can ask
of any map.

Two more controls round it out. A **completion** selector -- *Done*, *In progress*, *Not done* --
makes "what's genuinely finished?" a click instead of an audit. And when a filtered view turns out
to be a *thing in its own right* -- the risk register hiding inside the programme map -- **Extract
matches to a new map** copies the matching topics, with the branches that lead to them, into a
fresh map of their own and leaves the original untouched: the spotlight, promoted to a document.

The filter answers "where is everything matching X?" Its close cousin, **◎ Focus**, answers "show
me just *this*." Select a node, click Focus, and the map dims to that node's branch and the single
path back to the centre -- the same spotlight-not-scissors idea, aimed at one branch instead of a
query. It's how you walk a meeting through section 3 of a forty-node map without the other thirty-odd
nodes competing for attention; **Esc** brings them back. Reach for Focus when you know *which* branch
you mean, and the filter when you're asking the map a question across all of them.

## Board view: the map as columns

A map is a tree; sometimes the question you have is a *board* question -- "what's in each bucket?"
The **▦ Board** button answers it without duplicating your map. It lays the topics out as
**Kanban columns**, grouped by whichever source you pick in its header: **tags** (one column per
tag -- `todo` / `doing` / `done`, or `backlog` / `now` / `next`), a single-select **marker group**
(Priority, Status, Mood, Vote), or the **schedule** (Overdue / Today / This week / Later). Each
card shows the topic with its rolled-up completion and due date.

The board is a *lens on the same map*, and it writes back through the lens: **drag a card to
another column** and the topic itself is re-tagged, re-marked, or re-scheduled -- the tree is
updated, not a copy. Click a card and the canvas jumps to that topic. Like the filter and the
index, it's the same data asked a different question: the tree is how the work is *organised*,
the board is how it's *progressing* -- except here the answer is also a control.

## Find and replace

Press **/** anywhere to jump straight to **Find**. It searches everything a topic carries --
its text, its note, its tags and markers, even attachment names and links -- so a term you only
mentioned in a note is still findable. Matches are highlighted and you can step between them, or
open **List all** for a clickable list with each match's breadcrumb. Find is also **forgiving**:
if what you typed matches nothing exactly, it quietly falls back to a typo-tolerant pass, so a
half-remembered spelling -- *recieve* for *receive* -- still lands you on the node instead of an
empty result. **Replace** turns find into a tidy-up tool: rename a project that got called three
slightly different things, fix a term you decided to change, all in one pass. Two conveniences
ride along: the Find box remembers your **last ten queries** (start typing and they're offered
back), and Replace has a **scope** -- *Topics*, *Notes*, or *Both* -- so renaming a project
everywhere doesn't have to mean rewriting the prose behind the nodes, or vice versa.

When the question is sharper than a word, the same box speaks **operators**: `tag:q3`,
`marker:flag-red`, `priority:1`, `due:overdue`, `due:soon`, `has:note`, `has:attachment`,
`level:>=2`, `-exclude`, `"exact phrase"` -- combinable, and understood by the across-maps search
too. "Every overdue topic tagged `q3` that has a note" stops being a scan and becomes a query.

> The `/`-to-find shortcut is the single most useful key on a big map. When you can't
> remember where something is, don't hunt -- press `/` and type.

## The command palette: do anything by name

Find locates a *topic*; the **command palette** locates an *action*. Press **Ctrl/Cmd + K** anywhere in the editor and a single search box opens over the map. Type a few letters of what you want -- `fit`, `collapse`, `board`, `outline`, `timeline`, `export pdf` -- and the list narrows to matching commands; arrow down to one and press **Enter** to run it. Every button on the toolbar is in here, so you never have to remember which row or menu hides a control: you just name it. The match is *fuzzy* -- it accepts a subsequence, so `cllpse` still finds **Collapse all branches** and `xpdf` still finds **Export .pdf** -- and the palette remembers your last few choices under a **Recent** heading, so the things you do often are one keystroke and Enter away the next time you open it.

The palette is selection-aware. Select a node first and a band of commands appears that act on *it* -- add a child, set a marker or priority, focus its branch, delete it -- so a node's whole context menu is reachable by name without touching the mouse. With nothing selected, those commands quietly drop off the list rather than offering you an action with no target.

## Jump to any topic from the palette

The same **Ctrl/Cmd + K** box is also the fastest way to *travel*. Alongside the actions, every topic in the map sits in the list as **Go to: <topic>**; type part of its text, press Enter, and the canvas selects and centres that node. The trick that makes it worth the keystroke is what it searches: each topic's row quietly folds in its **note text** as well, so a term you only wrote in a note -- never in a topic title -- still surfaces the right node. It is the `/`-to-Find idea widened to the whole map at once: one box that finds both the thing you want to *do* and the place you want to *be*. The list even reaches past the current map: every other map in your library sits there as a **Switch to map:** row, so changing documents is a few keystrokes, not a trip to the dropdown.

## The keyboard shortcuts cheat-sheet

When you forget a binding, you don't have to leave the map to look it up. Click the **? (help)** button in the icon rail -- or open the command palette and run **Keyboard shortcuts** -- and a cheat-sheet lists every editing, navigation, and view shortcut: Tab for a child, Enter for a sibling, `/` for Find, **Ctrl/Cmd + K** for the palette itself, and the pan-and-zoom gestures. The sheet is generated from the same shortcut table the app actually binds, so what it shows is always what the keys really do. Skim it once and the moves in this chapter stop being things you memorise and start being things you reach for.

## Keyboard-reachable menus, and the same map on a phone

None of this assumes a mouse. The toolbar's dropdown menus and a node's right-click context menu are fully keyboard-driven: open one and the arrow keys walk the items, Home and End jump to the ends, Enter runs the highlighted one, and Escape closes without choosing. On a narrow screen the layout adapts rather than breaking: the side panels -- Outline, Index, Filter, Info -- slide up as a **bottom sheet** over a full-width canvas instead of crushing it into a sliver, so the same map you build at a desk stays usable on a phone.

## Links: doorways between topics and maps

A radial map is a tree, but real subjects aren't: the risk you noted on one branch is the
same risk that constrains a plan three branches away. Drawing a relationship line between
them is one answer (Chapter 3); a **link** is the lighter one. Give a node a link and it
grows a small **🔗** -- click it and you travel.

A link can point three ways, all set from the **ℹ Info** panel. **Jump to a topic** points it at
another *topic in the same map*, so "see also: Budget" becomes one click instead of a hunt -- the
canvas leaps to that topic and selects it, no line cluttering the picture. **Link to a map** points
it at *another map* in your
library (Chapter 7): a node in your *Strategy* map can open your *Q3 Plan* map -- and, with the
topic picker that appears once a map link is set, land on a *specific topic* inside it. That's how
you build a small **atlas** instead of one unreadable continent -- a high-level map whose nodes
are doorways into the detailed maps beneath them, with a **Linked from other maps** section in the
inspector showing the doorways that point back. And a plain web URL points it at a page, which
opens in a new tab. The 🔗 carries one primary link; further URLs live in an **Additional links**
list on the same topic. Fastest of all, while *typing* a topic: `[[` or `@` autocompletes any
topic or map by name and attaches the link as you pick it.

The inspector keeps the ledger for a single topic: alongside **Linked from other maps** (the
doorways pointing in), a **Links to** section lists the outgoing side -- the topic's own
hyperlink plus every relationship leaving it, click-to-jump. And placed one by one, the whole
map's connections can be read back all at once: the **🔗 Relationships** panel (Panels menu,
under Analysis) lists every relationship arrow and every in-map topic link, both ends
click-to-jump, labels shown. On a map where the arrows carry the real story -- a dependency web,
a risk map -- the panel *is* the story, in rows; it's also the fastest way to find the arrow you
meant to delete.

Its neighbour in the Analysis section, **📊 Map statistics**, is the map's vital signs: topics,
leaves and depth; task counts with done-so-far and overdue; the content tally -- words, notes,
attachments, tags, relationships -- and a **reading time** estimate. The number worth watching is
the word count: when a "map" passes a few thousand words it has usually become a document wearing
a map's clothes (Chapter 2 said when not to map; the statistics panel is where you catch it
happening).

## Search every map

Find searches the map you're in. Once your library grows into an atlas, **🔎 All maps**
searches *all* of them at once -- every topic and note, floating topics included -- and
picking a result opens that map and lands on the node. It's the companion to cross-map
links: links are the doorways you placed on purpose, library search is for when you can't
remember which map a thing is in.

## Roll-ups: a node that mirrors another map

Cross-map links are *doorways* -- you click through to the other map. A **roll-up** brings the
other map's content *to you*. Select a node, pick a source map from the **⤵ Roll-up** menu, and
that node becomes a live mirror of the source: the source's top-level branches are copied in
beneath it. Click **🔄 Roll-ups** whenever you like and every roll-up node re-pulls the latest from
its source, so a high-level map can *aggregate* the maps below it instead of merely pointing at
them.

This is the automated cousin of copy-paste (Chapter 3): a paste is a one-time snapshot you then own
and edit; a roll-up stays **bound** to its source and refreshes on command. It's how you build a
genuine **dashboard map** -- one overview whose branches are the current state of half a dozen
detail maps -- and keep it current with a click rather than re-copying by hand. Treat a roll-up
node as a window onto the source, not a place to edit: the mirrored branches are refreshed
wholesale, so do the editing in the source map and roll it up again.

## Retracing your steps, and views worth keeping

Every jump in this chapter -- a Find hit, an outline click, a link -- adds to a browser-style
**history**: **Alt+←** goes back to the topic you came from, **Alt+→** forward again, across maps.
It's the antidote to "where was I before I chased that link?"

And when a *view* itself is the asset -- zoomed to one corner, drilled into a branch, a filter
applied -- save it: **View -> Save current view...** names the exact combination of pan, zoom,
drill and filter, and re-applies it from the same menu in one click. A weekly review can open on
precisely the view you triage from. Need to point someone else at a spot instead? **Copy link to
this topic** puts a URL on the clipboard that opens the app on that map with that topic focused.

## The strip at the bottom

A slim **status bar** sits bottom-centre of the canvas and answers the small questions before
you ask them: how many topics are in view, how many are selected (click that count to zoom to
the selection), and the live zoom percentage (click it to snap back to 100%). At its left end
sits a three-way **view switcher** -- **Map / Outline / Board** -- one click between the canvas
and its two other faces, no menu required. And one quiet scale note belongs here: past roughly
five hundred nodes the canvas starts rendering only what's near the viewport, so a big map stays
fluid to pan and edit. You'll never see the seam -- it's simply why the three-hundred-node map
doesn't wade.

## A working rhythm for big maps

Put together, the loop looks like this: **collapse all** to see the shape, open the
branch you need, **/** to jump to a specific node, work, **Fit** to re-orient, repeat.
The outline panel stays open on the side as a table of contents. None of these moves is
clever on its own; the habit of using them together is what keeps a three-hundred-node
map feeling as manageable as a thirty-node one.

## Your workspace, remembered

The panels you work with -- the **Outline** on the side, the **Notes** editor -- stay how
you left them. Close the app with the outline open and it's open when you come back; the app
remembers your panel layout between sessions, so you don't rebuild your workspace every
morning. It's a small thing, but it's the difference between a tool that settles into your
habits and one you have to re-arrange every time you sit down.

## Now you try

Find (or build) a map big enough that it doesn't fit on screen. **Collapse all**, then open
just one branch and talk yourself through it. Press **/** and jump to a node you only
mentioned in a *note* -- prove to yourself that Find searches notes, not just topics. Open
the **Outline** panel and use its filter to narrow a long map to a short list. Zoom right in
on one node, then press **Fit** -- watch the whole map snap back into view; that's your
"take me home". If you keep more than one map, open **🔎 All maps** and search for a term you
know lives in a *different* one -- watch it open that map and land on the node. While you have
two maps, add a **cross-map link**: point a node in one at the other, then click it and watch
the app hop maps -- that's how a high-level map becomes a set of doorways into the detailed
ones beneath it. While you're here, flip the **Layout** dropdown between the radial default, an
org-chart, and a timeline -- same nodes, three readings -- and keep whichever makes the
structure clearest. Then **reload the page**: the Outline panel is exactly where you left it,
because the app remembered your workspace. The goal isn't to memorise the controls; it's to
feel how much calmer a big map gets when you drive it at the right altitude instead of staring
at the whole thing at once. Two more lenses: tag a handful of nodes `todo` / `doing` / `done` and
hit **▦ Board** to read the same map as columns; and, if you keep an overview map, bind a node to
another via the **⤵ Roll-up** menu and click **🔄 Roll-ups** to pull its branches in -- a dashboard
that refreshes itself. Save any filter you liked as a preset while you're at it.

A few more ways to cut a big map down to what matters. Open the **marker and tag index** and
click a tag -- it lists every node carrying it and jumps you there, no scrolling. Turn on
**auto-numbering** and the branches read 1, 1.2, 1.3 like a document outline, so you can talk
someone through the map by reference. When a single branch is all that matters for the moment,
**focus** it and the rest dims to quiet context. The **Power Filter** does the same by rule rather
than by hand -- dimming (or, with **Hide non-matches** ticked, removing from view) everything
that lacks a marker, tag, or word, so the matches stand out while the map keeps its shape. Keep the **corner minimap** in view to hold your bearings while
you are zoomed in. And put Find's forgiveness to the test on purpose: pick a long topic on your
map and search for it *misspelled* -- drop a letter, swap two (`recieve` for `receive`) -- and
watch the typo-tolerant pass still land you on the node. Once you've felt that, you'll stop
composing careful queries and just type.

One more lens, the keyboard one. Press **Ctrl/Cmd + K** and first *do* something by name: type
`collapse` and run **Collapse all branches**, then open the palette again and notice it now sits
under **Recent**. Now *go* somewhere: type the text of a node you only mentioned in a *note* and
watch **Go to:** land you on it, proving the palette searches notes too. Select a node and reopen
the palette -- see the band of actions that act on just that node, and watch them vanish when
nothing is selected. Then click the **?** button (or run **Keyboard shortcuts** from the palette)
and skim the cheat-sheet once. If you have a phone handy, open the same map there and toggle the
**Outline** panel -- it rises as a bottom sheet over a full-width canvas instead of squeezing the map.

Two altitude moves to feel before you go: run **Show level 1** and step the map open one level
at a time, then **drill in** to a single branch, edit a node while you're inside, and press
**Esc** -- the whole continent comes back with your edit in place. Ask a sharper question while
you're at it: type `due:overdue tag:q3` into Find and watch a scan become a query. And when you've
set up a view you'll want again -- a drill plus a filter -- **save it** from the View menu and
re-apply it in one click.

This chapter grew a second toolbox; give it one pass too. In the **Outline**, double-click a row
and rename it, then **Shift+Down** it past a sibling -- structure work without touching the
canvas. Open **📊 Map statistics** and read your map's word count and reading time; open
**🔗 Relationships** and jump an arrow end to end. Filter to something real, tick **Hide
non-matches** to feel the lights-off version, then **Extract matches to a new map** and watch a
filtered view become its own document. Turn on the **Legend** and export a PNG that explains its
own symbols. And on the way out, glance at the **status bar**: topic count, zoom, and the
Map / Outline / Board switcher were under your cursor all chapter.

Part 3 turns outward: getting the map off your screen and in front of other people.
