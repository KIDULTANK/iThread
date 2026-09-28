# Code signing policy

## Provider and status

iThread has applied for the SignPath Foundation open-source code-signing programme. Free code
signing provided by [SignPath.io](https://signpath.io/), certificate by
[SignPath Foundation](https://signpath.org/).

The application is pending. Until approval and activation of the signing pipeline, official
release notes identify Windows binaries as unsigned and publish a SHA-256 checksum. After approval,
only artifacts produced by the public release workflow and approved under this policy will be
submitted for signing.

## Source and build provenance

- Source repository: <https://github.com/KIDULTANK/iThread>
- Release workflow: [`.github/workflows/desktop-release.yml`](.github/workflows/desktop-release.yml)
- Official downloads: <https://github.com/KIDULTANK/iThread/releases>
- License: Apache License 2.0

Release artifacts must be built from a tagged commit in the public repository by GitHub Actions.
Dependencies are installed from the committed lockfile. The workflow runs the project's quality
gate before packaging the Windows executable and retains the unsigned build artifact for signing.

## Roles

- Committer and reviewer: [KIDULTANK](https://github.com/KIDULTANK)
- Signing approver: [KIDULTANK](https://github.com/KIDULTANK)

The signing approver must verify the source tag, workflow result, artifact name, version metadata
and expected SHA-256 checksum before approving a signing request. No locally modified binary may be
submitted for signing.

## Privacy and security

iThread's privacy commitments are described in [PRIVACY.md](PRIVACY.md). Security concerns and
suspected release-integrity problems should be reported through the repository's
[issue tracker](https://github.com/KIDULTANK/iThread/issues). A compromised or incorrectly signed
release will be withdrawn, investigated and reported to SignPath when applicable.
