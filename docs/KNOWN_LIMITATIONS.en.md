# iThread known limitations

[简体中文](KNOWN_LIMITATIONS.zh-CN.md) | **English**

iThread is a public preview. Use backup copies for evaluation and do not make it the sole storage
location for important material.

## iThoughts compatibility

- `.itmz` files can be imported and exported as new iThoughts-compatible copies. The original is
  never overwritten.
- Use `.ithread` for daily editing. iThoughts does not understand this native format, so export an
  `.itmz` copy when interchange is required.
- Legacy iThread `.mmst` files remain losslessly readable.
- Topic hierarchy, text, notes, links, collapsed state, relationships and some images can be imported.
  Certain styles, fonts, positions, attachments or proprietary metadata may not be preserved.
- Export round trips have been structurally tested with five real files containing 31,389 topics and
  opened in the original iThoughts application. Proprietary styles, summaries, boundaries, rare icons
  or metadata may still be downgraded, so keep the source and spot-check important content.
- Before `.itmz` export, iThread shows a compatibility report describing preserved, converted or
  unsupported content. It does not guarantee identical rendering in every third-party version.

## Windows distribution

- Windows 11 x64 installer and portable builds are available. The installer can register `.ithread`,
  `.mmst` and `.itmz`; the portable build does not change system file associations.
- The SignPath open-source signing application is still under review. Current files may be unsigned
  and trigger SmartScreen.
- Update checks only open the GitHub Releases page after user confirmation. iThread does not silently
  download or install updates.

## Data and sync

- There are no accounts or telemetry, and maps stay local by default.
- Local autosave is supplemented by a short-interval recovery draft, but neither replaces an external
  backup.
- iThread does not currently provide its own cloud account. Native `.ithread` files can be placed in
  OneDrive, Dropbox or another OS-synchronised folder. Concurrent editing may still create conflicts.
- Browser data lives in that browser's local storage. Clearing browser data may remove maps that were
  never exported.

## Public reports

Sanitise maps before opening a public issue. Do not upload identity documents, client information,
legal case material, trade secrets or any other sensitive content.
