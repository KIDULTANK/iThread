// Use the first OS language, not Chromium's packaged language or the user's location.
function selectSystemLocale(languages) {
  return /^zh(?:[-_]|$)/i.test(languages[0] ?? "") ? "zh-CN" : "en";
}

module.exports = { selectSystemLocale };
