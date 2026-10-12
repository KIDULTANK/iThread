# Single-person device sync — experimental

[简体中文](SYNC.zh-CN.md) | **English**

The development source and web app include optional, manual WebDAV sync. The v0.6.1 Windows
installer does not include this addition. No real cloud service or cross-platform client has
been validated yet: use synthetic test maps and keep separate backups. This is not a production
cloud service. Mac, iPad and Android clients have not been released.

## No account or mandatory cloud

iThread does not operate a sync server or require registration. You supply an existing dedicated
WebDAV directory. Saving its URL does not contact the server; only explicitly finding remote maps
or syncing selected maps sends requests. GitHub Pages hosts the public website, not private maps.
This implementation creates no service subscription. Your own storage provider may charge for
storage or traffic.

## Try it with test maps

1. Create a dedicated directory in your own service. It must support HTTPS, PROPFIND, strong ETags,
   and conditional PUT using `If-Match` and `If-None-Match` correctly.
2. In Settings → Device sync, save the directory URL without credentials or query parameters.
3. Enter the service credentials. Check the maps to include, then run manual sync.
4. On another device, use the same directory, find remote maps, select them, and sync.
5. Credentials stay in memory for this Settings session. Closing Settings or changing directories
   clears them. Prefer dedicated credentials restricted to this directory.

Web requests, including the current Chromium-based desktop transport, may require server CORS
configuration. Permit the application's origin, GET/PUT/PROPFIND and Authorization/Depth/
If-Match/If-None-Match headers, and expose ETag. Do not disable browser security to bypass errors.
Test conditional-write correctness on the actual server before using important maps.

## Data protection and current limitations

- Only checked maps participate. Unchecking does not delete local or remote content.
- A common base snapshot distinguishes one-sided edits from divergent edits. Timestamps do not
  decide which copy wins. Divergent copies are persisted locally and downloadable together as
  a JSON review bundle; this bundle is not a native map export. Automatic merging is not implemented.
- IndexedDB transactions detect autosave and CLI changes and reject stale responses. Active
  editors and pending recovery drafts are deferred. Replacements first preserve version history.
- Remote deletion uses a versioned tombstone and moves local content into recoverable Trash.
  Physical absence from a previously synced server is not treated as an authorised deletion.
- Network/authentication errors, weak ETags, oversized or malformed responses do not get applied
  locally. Earlier successful transfers may remain saved when a later map fails.
- Protocol v1 stores whole-map JSON snapshots, including embedded attachments. It is not topic-level
  incremental sync. There is no background queue, automatic conflict resolution or end-to-end
  encryption. HTTPS protects transport; the chosen service can read uploaded maps.
- Directory URLs, choices, common snapshots and conflict copies persist locally. Credentials do not.
  See [Privacy](../PRIVACY.md) for network and storage details.

## Verification and next steps

`test/cloud-sync.test.ts` uses synthetic devices and a mock WebDAV service to exercise offline retry,
concurrent writes, lost responses, deletions, protocol errors and path boundaries.
`test/sync-local-store.test.ts` uses fake IndexedDB for persistence, migration, edit protection,
history and conflict checks. `test/sync-settings.test.tsx` verifies opt-in networking and credential
lifetime. These tests are not proof of compatibility with a real provider.

Next: actual-provider conformance testing; platform-owned secure credentials and transport;
persistent retry/backoff/cancellation; conflict review and resolution; large-file handling;
cross-device testing before a stable desktop release.
