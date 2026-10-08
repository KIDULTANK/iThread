# Contributing to iThread

[简体中文](CONTRIBUTING.zh-CN.md) | **English**

Thank you for helping improve iThread. Bug reports, reproducible compatibility samples and focused
pull requests are welcome.

## Before reporting a bug

1. Check the [known limitations](docs/KNOWN_LIMITATIONS.zh-CN.md).
2. Confirm the problem occurs in the latest preview release.
3. Remove confidential or personal data from sample maps.
4. Use the repository's structured issue templates and include exact reproduction steps.

## Development

The project requires Node.js 22 and pnpm 11.

```powershell
pnpm install --frozen-lockfile
pnpm gate
```

Pull requests should keep the quality gate green and include tests for behavior changes. Do not add
telemetry, mandatory cloud services or code that uploads map contents without an explicit user action.

## iThoughts compatibility samples

Only submit files you are legally allowed to share. Prefer a minimal synthetic `.itmz` sample. If a
real map is necessary, replace names, notes, links, images and attachments with non-sensitive test
data before attaching it to a public issue.
