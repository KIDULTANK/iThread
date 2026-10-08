# Security policy

[简体中文](SECURITY.zh-CN.md) | **English**

## Supported versions

Security fixes are applied to the latest preview release and the `main` branch.

## Reporting a vulnerability

Do not open a public issue for a vulnerability that could expose user data, execute untrusted code or
compromise release integrity. Use GitHub's private vulnerability reporting feature when it is
available for this repository. If private reporting is unavailable, open a minimal public issue that
contains no exploit details and asks the maintainer to establish a private contact channel.

Never attach a confidential mind map to a public report. Provide a synthetic reproduction whenever
possible.

## Release integrity

Official binaries are published only through <https://github.com/KIDULTANK/iThread/releases>.
Compare downloads against the published `SHA256SUMS.txt`. Code-signing status is documented in
[CODE_SIGNING_POLICY.md](CODE_SIGNING_POLICY.md).
