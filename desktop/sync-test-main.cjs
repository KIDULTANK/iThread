// Dedicated portable test entry: keep the normal application's library and sessions untouched.
const { app } = require("electron");
const path = require("node:path");
app.setPath("userData", path.join(path.dirname(app.getPath("exe")), "sync-test-profile"));
app.on("browser-window-created", (_event, window) => {
  window.on("page-title-updated", (event) => {
    event.preventDefault();
    window.setTitle("iThread · 同步测试版");
  });
});
require("./main.cjs");
