const { isTrustedSyncSender } = require("./sync-transport.cjs");

function registerSyncIpc({ ipcMain, transport, getContents, documentUrl }) {
  for (const [channel, method] of [
    ["connect", "connect"],
    ["request", "request"],
    ["disconnect", "close"],
  ]) {
    ipcMain.handle(`ithread:sync-${channel}`, (event, ...args) => {
      if (!isTrustedSyncSender(event, getContents(), documentUrl))
        throw new Error("Untrusted sync caller");
      return transport[method](event.sender.id, ...args);
    });
  }
}
module.exports = { registerSyncIpc };
