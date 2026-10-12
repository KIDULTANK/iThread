# Privacy policy

[简体中文](PRIVACY.zh-CN.md) | **English**

Effective date: 2026-10-12

iThread is a local-first mind-mapping application. It does not require an account and does not
include advertising, analytics or telemetry. The application does not transmit map contents,
attached files, usage history or personal information to the iThread maintainer.

## Data stored by the application

Maps and application settings are stored locally in the application's browser storage or in files
that the user explicitly opens or saves. Attached files may be embedded in a map. Removing the
application does not automatically remove map files that the user saved elsewhere.

## Network access

The desktop application is designed to work without a mandatory online service. Network access can
occur when the user follows an external link, downloads or updates the application through a
hosting service, or explicitly uses optional experimental WebDAV sync. Sync is off by default.
Saving a server directory does not contact it. Finding remote maps reads that directory's listing;
manual sync transfers only selected maps (including embedded attachments) and versioned deletion
markers to the user's chosen service. The service also receives the user's credentials and normal
connection metadata. Its own privacy terms apply; iThread operates no sync server.

The directory URL, per-map sync choices, common snapshots and conflict copies are stored locally
in IndexedDB. WebDAV credentials are held only in memory for the settings session and are not
stored in preferences or map exports. Closing Settings or changing directories clears them.
The bilingual website saves only a language preference locally and includes no tracking scripts
or registration forms. Access to GitHub Pages is still subject to GitHub's hosting logs.

GitHub may process ordinary website and download logs when users visit the source repository or
download a release. Those services are governed by GitHub's own privacy statement and are not
controlled by iThread.

## Contact

Privacy questions can be submitted through the project's public issue tracker:
<https://github.com/KIDULTANK/iThread/issues>
