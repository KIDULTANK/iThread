# iThread quick start

[简体中文](QUICKSTART.zh-CN.md) | **English**

iThread v0.6.1 is a public preview for Windows 11. It can import iThoughts `.itmz` files and export
edited maps as new iThoughts-compatible `.itmz` files. Keep the original file and test with a copy.

## 1. Download and launch

1. Open [GitHub Releases](https://github.com/KIDULTANK/iThread/releases).
2. Download `iThread-0.6.1-Windows-x64-Setup.exe`, or use the no-install
   `iThread-0.6.1-Windows-x64-Portable.exe`.
3. Compare the file with the SHA-256 value in `SHA256SUMS.txt` on the same release.
4. The current build is unsigned. If SmartScreen reports an unknown publisher, verify the download
   URL and checksum before deciding whether to run it.

## 2. Import an iThoughts map

1. On the Start screen, choose **Import files**.
2. Select a backup copy of the `.itmz` file.
3. Check the topic hierarchy, notes, links, images, collapsed state and task progress.
4. Importing is a conversion operation and never modifies the source `.itmz`.

## 3. Save your work

- Use `.ithread` for daily editing. It is iThread's lossless native format.
- Legacy `.mmst` files still open without loss.
- Use JSON for complete backups and formats such as Markdown, `.mm`, `.opml` or `.mmap` for exchange;
  some styling or metadata may not survive those conversions.
- To reopen a copy in iThoughts, use **Export → `.itmz` (iThoughts compatible)**.

## 4. Essential keyboard commands

- `Enter`: finish editing; when not editing, create a sibling topic.
- `Tab`: create a child topic.
- `F2` or `Ctrl+Enter`: edit the selected topic.
- `Alt+Arrow`: move the selected topic or branch.
- `P` / `Shift+P`: increase or decrease task progress.
- Hold `Alt`: display the paged shortcut reference.

While the shortcut reference is visible, Left/Right only turn pages and never move branches.
Release `Alt` or press `Esc` to close it.

Open **Settings** from the library's left navigation, the editor's gear button, or `Ctrl+,`.
Use **Appearance → Language** to switch between Chinese and English. Settings also include app
theme, reduced motion, high contrast, Alt-hold hints and delay, and wheel pan/zoom mode and pan
speed. Preferences are saved locally.

On first launch, the Windows app uses the preferred system language: Chinese selects Simplified
Chinese; other languages select English. The web app follows browser language preferences.
No location lookup or separate language download is needed. A language you select in Settings
is remembered and takes priority over automatic detection.

The template library groups reusable structure templates and complete worked examples in one
place. Opening either creates your own editable map without changing the built-in content.

## 5. Report a problem

Use the bilingual [GitHub issue templates](https://github.com/KIDULTANK/iThread/issues/new/choose)
and include the iThread and Windows versions, exact reproduction steps, expected and actual results,
and screenshots or a sanitised minimal sample when possible.

Never upload maps containing personal data, client material, legal case files, trade secrets or other
sensitive information to a public issue.
