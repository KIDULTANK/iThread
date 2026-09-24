# iThoughts keyboard compatibility baseline

Source of truth: [toketaWare — FAQ: Keyboard shortcuts](https://www.toketaware.com/ithoughts-faq-keyboard-shortcuts), checked 2026-09-08. Product decision: prefer the iPadOS/Mac interaction model where it is better than the legacy Windows app, but use the more comfortable `Alt` modifier for branch movement on Windows.

The first compatibility milestone prioritises the muscle-memory shortcuts used while navigating and
building a map:

| Shortcut | iThoughts Windows behaviour | Status |
|---|---|---|
| `Tab` | New child | Implemented |
| `Enter` | Finish edit / new sibling | Implemented |
| `Ctrl+Enter` or `F2` | Edit selected topic | Implemented |
| `Shift+Enter` | New sibling before (or newline while editing) | Implemented |
| `Shift+Tab` | New parent / promote | Implemented as promote/outdent |
| `.` | Collapse or expand selected branch | Implemented |
| `0…9` | Show a chosen number of topic levels (`0` = all) | Implemented |
| `Arrow keys` | Navigate topic to topic | Implemented |
| `Alt+Arrow` | Move a branch while the modifier is held | Implemented: up/down reorder siblings; left/right outdent/indent in the right-facing layout; key-repeat is allowed |
| `Ctrl+1…5` | Set priority | Implemented |
| `Delete` / `Backspace` | Delete topic and descendants | Implemented |
| `Ctrl+Delete` / `Ctrl+Backspace` | Delete selected topics but retain descendants | Pending |
| `F4` | Show/hide notes | Implemented (`Ctrl+T` is also available in the installed PWA) |
| `Space` | Quick Look for images/attachments | Pending; Space is currently canvas-pan modifier |
| `Ctrl+F` | Find/filter | Implemented |
| `Ctrl+0` | Fit/centre toggle | Partial: currently reset to 100% |
| `Ctrl+PgUp` / `Ctrl+PgDn` | Zoom in/out | Implemented; Ctrl +/- is also available |

Where the official shortcut conflicts with an existing editor behaviour, compatibility will be
introduced deliberately rather than silently replacing the existing command. The two known conflicts
is `Space`.
