# Appendix A -- Keyboard reference

The fastest way to build a map is to keep your hands on the keys. This is the full set,
grouped by what you're doing. (Ctrl reads as Cmd on a Mac throughout. The same list lives
in the app -- the **?** button, or run "Keyboard shortcuts" from the command palette -- and
is generated from the bindings themselves, so it can't drift.)

## Building structure

- **Enter** -- add a sibling (a node at the same level as the selected one).
- **Tab** -- add a child (a node one level deeper); **Ctrl+Enter** does the same.
- **Shift+Tab** -- outdent: promote the node one level back toward the root.
- **Delete** (or Backspace) -- remove the selected node and everything beneath it.
- **Ctrl+Shift+Up / Down** -- move the node up / down among its siblings.
- **Alt+Shift+Left / Right** -- promote / demote the node.
- **Ctrl+C** -- copy the selected branch (or every selected branch); **Ctrl+Shift+V** --
  paste them under the selection (the branch clipboard survives switching maps);
  **Ctrl+D** -- duplicate the branch as a sibling.

## Editing

- **Double-click** a node, press **F2**, or just start typing on a selected node to edit it.
- **Ctrl+B / I / U** (while editing) -- bold / italic / underline the selection.
- While editing: **/** at the start opens the command menu, **#** picks a tag, **[[** or
  **@** links to a topic or map by name.
- **Ctrl+V** (node selected, not typing) -- smart paste: an image, an outline, a URL, or a
  spreadsheet selection, routed automatically.
- **Ctrl+Shift+1..9** -- set the node's task priority (1 = highest).
- **Ctrl+Z** -- undo (model-aware: it reverses the real edit); **Ctrl+Y** or
  **Ctrl+Shift+Z** -- redo.

## Finding and moving around

- **/** or **Ctrl+F** -- open Find and Replace (searches every field a topic carries;
  operators like `tag:`, `priority:`, `due:overdue`, `has:note`, `-exclude` sharpen it).
- **Enter / Shift+Enter** (in Find) -- next / previous match.
- **Arrow keys** -- walk the selection: Left = parent, Right = child, Up/Down = siblings.
- **Alt+Left / Alt+Right** -- back / forward through the topics you've visited.
- **Ctrl+K** -- the command palette: run any action, jump to any topic, switch to any map.
- **Ctrl+Shift+L** -- start a relationship from the selected node (Enter completes it).
- **Drag a node** onto another to re-parent it; **Shift-drag to empty canvas** detaches it;
  **Ctrl-drag onto a node** drops a copy.

## Viewing

- **Ctrl+Plus / Ctrl+Minus / Ctrl+0** -- zoom in / out / reset to 100%.
- **Shift+1 / Shift+2** -- fit the whole map / fit the selection.
- **Space+drag** -- pan from anywhere, even over a topic.
- **Drag the background** to pan; **scroll / pinch** to zoom; **Esc** -- exit focus, drill,
  a walk, or Present.

## Files and app

- **Ctrl+O** -- open an `.ithread` / legacy `.mmst` / `.json` / `.mmap` file; **Ctrl+S** -- save to the linked
  file; **Ctrl+Shift+S** -- save as.
- **Ctrl+,** -- Settings and preferences.

## Presenting

- **Arrow keys / Space** -- move between slides; **Home** -- first slide.
- **P** -- presenter view (notes, next-up, timer, agenda); **B / W** -- black / white
  curtain; **Esc** -- exit.

> If you only memorise three things: **Tab** goes deeper, **Enter** stays level, and
> **Ctrl+K** does anything by name. Everything else you can reach from the toolbar while
> you learn.
