const path = require("node:path");

const NATIVE_EXTENSIONS = ["ithread", "mmst", "json"];
const IMPORT_EXTENSIONS = ["itmz", "md", "markdown", "mmap", "mmp"];

function isOpenableFile(filePath) {
  return (
    typeof filePath === "string" &&
    [...NATIVE_EXTENSIONS, ...IMPORT_EXTENSIONS].includes(
      path.extname(filePath).slice(1).toLowerCase(),
    )
  );
}

function isWritableFile(filePath) {
  return (
    typeof filePath === "string" &&
    NATIVE_EXTENSIONS.includes(path.extname(filePath).slice(1).toLowerCase())
  );
}

function openFileFilters(locale) {
  const zh = locale === "zh-CN";
  return [
    {
      name: zh ? "所有支持的导图" : "All supported maps",
      extensions: [...NATIVE_EXTENSIONS, ...IMPORT_EXTENSIONS],
    },
    { name: zh ? "iThread 导图" : "iThread maps", extensions: NATIVE_EXTENSIONS },
    { name: zh ? "iThoughts 导图（导入）" : "iThoughts maps (import)", extensions: ["itmz"] },
    {
      name: zh ? "Markdown 大纲（导入）" : "Markdown outlines (import)",
      extensions: ["md", "markdown"],
    },
    {
      name: zh ? "MindManager 导图（导入）" : "MindManager maps (import)",
      extensions: ["mmap", "mmp"],
    },
  ];
}

module.exports = { isOpenableFile, isWritableFile, openFileFilters };
