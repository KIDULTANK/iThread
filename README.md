# iThread

<img src="public/icon-192.png" alt="iThread" width="96" height="96">

**[简体中文](README.zh-CN.md) | [English](README.en.md)**

Windows 11 思维导图应用 / A Windows 11 mind-mapping app<br>
本地优先 · iThoughts `.itmz` 兼容 · 中英文界面 · Apache-2.0<br>
Local-first · iThoughts `.itmz` compatibility · Chinese and English UI · Apache-2.0

> iThread 是独立社区项目，与 iThoughts 及其原作者不存在隶属、授权或背书关系。<br>
> iThread is an independent community project and is not affiliated with or endorsed by iThoughts.

[在线体验 / Try online](https://kidultank.github.io/iThread/) ·
[Windows 下载 / Downloads](https://github.com/KIDULTANK/iThread/releases) ·
[问题反馈 / Issues](https://github.com/KIDULTANK/iThread/issues/new/choose)

![iThread Windows interface / Windows 界面](docs/images/ithread-windows.png)

## 中文

iThread 是一款面向 Windows 11 的本地优先思维导图软件，重点延续 iThoughts 用户的文件和
键盘操作习惯。它支持导入、编辑并导出 iThoughts `.itmz`，也支持 Markdown、XMind、
FreeMind、OPML、MindManager 等常见格式。软件无需账号，不要求持续联网，导图默认保存在本机。

- [完整中文介绍](README.zh-CN.md)
- [中文快速上手](docs/QUICKSTART.zh-CN.md)
- [已知限制](docs/KNOWN_LIMITATIONS.zh-CN.md)
- [CLI 控制桥](docs/CLI.md)
- [贡献指南](CONTRIBUTING.zh-CN.md)

首次测试请保留原始 `.itmz`，日常编辑优先使用无损的 `.ithread` 格式。当前 Windows 构建尚未
完成代码签名，SmartScreen 可能提示“未知发布者”，请只从 Releases 页面下载并核对 SHA-256。

## English

iThread is a Windows-first, local-first mind-mapping application for people who want to keep using
their iThoughts maps and keyboard-oriented workflows. It imports, edits and exports iThoughts `.itmz`
files and also works with Markdown, XMind, FreeMind, OPML, MindManager and other common formats. No
account or permanent internet connection is required, and maps stay on the local device by default.

首次启动跟随 Windows 首选语言（中文 → 简体中文，其他 → 英文）；手动选择优先且会保留。
The first-launch UI follows the Windows language (Chinese → Simplified Chinese; otherwise English).
Your saved language choice takes priority. The web app follows browser language preferences.

- [Full English overview](README.en.md)
- [Quick start](docs/QUICKSTART.en.md)
- [Known limitations](docs/KNOWN_LIMITATIONS.en.md)
- [CLI control bridge](docs/CLI.en.md)
- [Contributing](CONTRIBUTING.md)

Keep the original `.itmz` when testing and prefer the lossless `.ithread` format for daily editing.
Windows builds are currently unsigned, so SmartScreen may show an “Unknown publisher” warning. Only
download from Releases and verify the published SHA-256 checksum.

## Download / 下载

The current preview is **v0.6.1**. / 当前公开测试版为 **v0.6.1**。

- `iThread-0.6.1-Windows-x64-Setup.exe` — 安装版 / installer
- `iThread-0.6.1-Windows-x64-Portable.exe` — 便携版 / portable

[打开 v0.6.1 发布页 / Open the v0.6.1 release](https://github.com/KIDULTANK/iThread/releases/tag/v0.6.1)

## Build / 构建

Requires Node.js 22+ and pnpm 11. / 需要 Node.js 22+ 与 pnpm 11。

```powershell
pnpm install --frozen-lockfile
pnpm gate
pnpm desktop:dist
```

Licensed under [Apache-2.0](LICENSE). Derived from
[MindMap Studio](https://github.com/dannbleeker/mindmap-studio); upstream notices are preserved.

[隐私政策 / Privacy](PRIVACY.md) · [安全政策 / Security](SECURITY.md) ·
[代码签名 / Code signing](CODE_SIGNING_POLICY.md)
