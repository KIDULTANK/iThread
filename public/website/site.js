const repo = "https://github.com/KIDULTANK/iThread";
const english = {
  skip: "Skip to content",
  features: "Features",
  start: "Get started",
  eyebrow: "OPEN SOURCE · LOCAL FIRST · MADE FOR FOCUS",
  headline: "Room for<br>your ideas.",
  lead: "From a passing thought to a clear map. Organize what you know, shape what comes next, and give complex ideas a place to belong.",
  download: "Download for Windows ↗",
  try: "Try in your browser →",
  version: "v0.6.1 preview · Windows 11 x64 · No account required",
  releaseEyebrow: "WINDOWS PREVIEW",
  demoFile: "My next step.ithread",
  local: "Local first",
  demoRoot: "A good idea",
  demoA: "Find direction",
  demoA1: "Goals & boundaries",
  demoB: "Connect ideas",
  demoB1: "Build a structure",
  demoC: "Take action",
  demoC1: "One step at a time",
  demoLabel: "Illustrative map",
  principle1: "Your files belong to you.",
  principle2: "Work without an account.",
  principle3: "Open code. Portable formats.",
  featuresEyebrow: "LESS FRICTION. MORE THINKING.",
  featuresTitle: "Follow your thinking.<br>Not the software.",
  f1Title: "Keep your maps moving",
  f1Body:
    "Import and export iThoughts .itmz, plus Markdown, XMind, FreeMind, OPML and other formats. Use native .ithread files for everyday saves and backups.",
  compatibility: "Explore compatibility limits ↗",
  f2Title: "Keep up with your keyboard",
  f2Body:
    "Build a structure with Enter and Tab. Move branches with Alt + Arrow. Set task progress with P. Hold Alt for a paged shortcut reference.",
  f3Title: "Edit locally, without the cloud",
  f3Body:
    "Offline editing, autosave and recovery drafts. Make ideas clearer with typography, Markdown formatting, notes and cross-links.",
  f4Title: "An open door to automation",
  f4Body:
    "The local CLI can create, read, batch-edit and export maps. Connect your own scripts or agents; no built-in AI account or model service is required.",
  cliDocs: "Read the CLI guide ↗",
  roadmapEyebrow: "WHAT COMES NEXT",
  roadmapTitle: "One train of thought.<br>More devices.",
  roadmapBody:
    "Windows and the web experience are available today. Single-person multi-device sync is in development; Mac, iPad and Android clients are not yet released. Sync should never be a requirement for offline editing.",
  available: "Available",
  planned: "Planned",
  startEyebrow: "GIVE YOUR FIRST IDEA A HOME",
  startTitle: "Start with a single thought.",
  startBody:
    "Try it in your browser, then bring it to your desktop. Keep a backup of important files and check exports in the destination app.",
  guide: "Quick start ↗",
  releaseBody:
    "A refreshed interface and seal-style icon, a unified template library, richer Settings, and a bilingual UI that follows your system language.",
  unsigned:
    "Windows builds are currently unsigned. SmartScreen may show an “Unknown publisher” warning. Download from the official Releases and verify SHA-256.",
  release: "Release notes & downloads ↗",
  tagline: "Local-first, open-source mind mapping.",
  credit: "Maintained by Zack Chen · Built on Mind Map Studio · Software Apache-2.0",
  feedback: "Report an issue ↗",
  privacy: "Privacy policy ↗",
  signing: "Code signing policy ↗",
  source: "Explore the source ↗",
};
const chinese = Object.fromEntries(
  [...document.querySelectorAll("[data-copy]")].map((el) => [el.dataset.copy, el.innerHTML]),
);
function setLanguage(lang) {
  document.documentElement.lang = lang;
  document.title = lang === "en" ? "iThread — Room for your ideas" : "iThread — 想法，自在展开";
  document.querySelector('meta[name="description"]').content =
    lang === "en"
      ? "iThread — Local-first, open-source mind mapping. Windows 11, Chinese and English UI, iThoughts file compatibility and a local CLI."
      : "iThread — 本地优先的开源思维导图软件。Windows 11、中英文界面、iThoughts 文件兼容与本地 CLI。";
  document
    .querySelector("nav")
    .setAttribute("aria-label", lang === "en" ? "Main navigation" : "主导航");
  document
    .querySelector(".map-demo")
    .setAttribute("aria-label", lang === "en" ? "Illustrative mind map" : "导图结构示意");
  const copy = lang === "en" ? english : chinese;
  for (const el of document.querySelectorAll("[data-copy]")) {
    // Only bundled, trusted translation strings reach innerHTML; no user or network input.
    el.innerHTML = copy[el.dataset.copy];
  }
  for (const button of document.querySelectorAll("[data-lang]"))
    button.setAttribute("aria-pressed", String(button.dataset.lang === lang));
  const suffix = lang === "en" ? "en" : "zh-CN";
  const docs = {
    quickstart: `docs/QUICKSTART.${suffix}.md`,
    limitations: `docs/KNOWN_LIMITATIONS.${suffix}.md`,
    cli: lang === "en" ? "docs/CLI.en.md" : "docs/CLI.md",
    privacy: lang === "en" ? "PRIVACY.md" : "PRIVACY.zh-CN.md",
    signing: lang === "en" ? "CODE_SIGNING_POLICY.md" : "CODE_SIGNING_POLICY.zh-CN.md",
  };
  for (const el of document.querySelectorAll("[data-doc]")) {
    el.href = `${repo}/blob/main/${docs[el.dataset.doc]}`;
    el.target = "_blank";
    el.rel = "noopener noreferrer";
  }
}
function browserLanguage() {
  const preferences = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const preference of preferences) {
    const primary = String(preference || "")
      .trim()
      .toLowerCase()
      .replaceAll("_", "-")
      .split("-")[0];
    if (primary === "zh") return "zh-CN";
    if (primary === "en") return "en";
  }
  return "en";
}
let saved;
try {
  saved = localStorage.getItem("ithread-site-language");
} catch {
  /* Storage may be unavailable. */
}
setLanguage(saved === "en" || saved === "zh-CN" ? saved : browserLanguage());
for (const button of document.querySelectorAll("[data-lang]"))
  button.addEventListener("click", () => {
    setLanguage(button.dataset.lang);
    try {
      localStorage.setItem("ithread-site-language", button.dataset.lang);
    } catch {
      /* Language still changes for this visit. */
    }
  });
