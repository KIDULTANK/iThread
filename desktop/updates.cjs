const RELEASES_URL = "https://github.com/KIDULTANK/iThread/releases";

function versionParts(value) {
  if (typeof value !== "string") return null;
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  return parts.every(Number.isSafeInteger) ? parts : null;
}

function compareVersions(left, right) {
  const a = versionParts(left);
  const b = versionParts(right);
  if (!a || !b) return 0;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function desktopUpdate(releases, currentVersion) {
  const unavailable = { status: "unavailable", currentVersion, url: RELEASES_URL };
  if (!Array.isArray(releases) || !versionParts(currentVersion)) return unavailable;
  const available = releases
    .filter((release) => {
      if (!release || release.draft || !versionParts(release.tag_name)) return false;
      const version = release.tag_name.replace(/^v/, "");
      return (
        Array.isArray(release.assets) &&
        release.assets.some((asset) => {
          if (!asset || asset.state !== "uploaded" || !(asset.size > 0)) return false;
          const names = ["Setup", "Portable"].map(
            (kind) => `iThread-${version}-Windows-x64-${kind}.exe`,
          );
          return (
            names.includes(asset.name) &&
            asset.browser_download_url ===
              `https://github.com/KIDULTANK/iThread/releases/download/${release.tag_name}/${asset.name}`
          );
        })
      );
    })
    .sort((a, b) => compareVersions(b.tag_name, a.tag_name))[0];
  if (!available) return unavailable;
  const latestVersion = available.tag_name.replace(/^v/, "");
  return {
    status: compareVersions(latestVersion, currentVersion) > 0 ? "available" : "up-to-date",
    currentVersion,
    latestVersion,
    url: `${RELEASES_URL}/tag/${available.tag_name}`,
  };
}

module.exports = { desktopUpdate };
