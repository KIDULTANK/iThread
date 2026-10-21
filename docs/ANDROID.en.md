# Android tablet · development preview

[简体中文](ANDROID.zh-CN.md) | **English**

Targets Android 10 / API 29+ tablets with Android System WebView 124+, portrait/landscape, touch and external keyboards. The debug
application ID is `com.ithread.android.preview`, separate from the future production app. This is not
a stable mobile release and does not replace Windows v0.7.0 downloads.

The goal is a broad public beta, not a device-specific port. Target brands are not claims of verified
compatibility. APK-capable Android devices need WebView 124+; native HarmonyOS NEXT requires separate
client work. CI covers tablet emulators on API 29, 35 and 36, distinguishing an old-engine upgrade
prompt from a running editor. Runtime checks exercise bridge roundtrips, host rejection, rotation,
local-data recreation and document-export cancellation where the engine is supported.

Before public beta distribution: stable backed-up signing keys, non-destructive upgrade verification,
several vendor devices, real-file roundtrips, IME/keyboard/large-map checks, offline recovery and
Windows↔Android sync acceptance. Emulator checks alone do not meet those criteria; debug artifacts
are not automatically promoted to public Releases.

The APK bundles the shared editor and existing iThread icon for offline use. System document pickers
handle import/export without broad storage permissions. Drag the canvas to pan, pinch to zoom,
double-tap topics to edit, and long-press for actions. Chinese/English and saved language preferences
are shared with the editor. Native Nutstore requests use the same immutable history protocol as Windows.

Only the bundled document's main frame can access the origin-restricted native message listener.
External links leave the app; arbitrary native URLs, redirects, cleartext traffic, TLS bypass and
`addJavascriptInterface` are not used. Credentials remain in memory, with native sessions closed on
background/expiry/destruction. System app-data backups are disabled.

Preview limits: 16 MiB per imported/exported file or sync response, 2 MiB directory listings and eight
files per import. Nutstore history remains limited to 256 revisions / 128 MiB per map, with no automatic
merge/pruning. Uninstalling or clearing app data removes unexported local maps. Keep independent backups.
There is no system-file save-back, file association, background sync, handwriting or mobile CLI yet.
Emulator/physical-tablet validation of gestures, keyboard, process recovery and Windows↔Android sync
remains outstanding.

Build with Node.js 22, pnpm 11, JDK 17, Gradle 8.13, Android SDK 36 and Build Tools 35.0.0:

```text
pnpm install --frozen-lockfile
pnpm android:prepare
gradle -p android testDebugUnitTest assembleDebug
```

Configure `ANDROID_HOME` or ignored `android/local.properties`. The APK is at
`android/app/build/outputs/apk/debug/app-debug.apk`. The Android workflow uploads build artifacts,
not a public Release. Debug certificates may differ between build machines; export maps before any
reinstall. A stable, backed-up Android signing key is required before ongoing public distribution;
Windows SignPath signing is unrelated.

Implementation follows Android's [local asset loading](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content)
and [origin-restricted bridge](https://developer.android.com/develop/ui/views/layout/webapps/native-api-access-jsbridge) guidance.
