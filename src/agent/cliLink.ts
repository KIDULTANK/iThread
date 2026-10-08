import type { CliBridgeCommand, CliExecutionOptions } from "./executeCliCommand";

export type CliBridgeBindings = [
  CliExecutionOptions["activeDoc"],
  CliExecutionOptions["openDoc"],
  CliExecutionOptions["replaceActive"],
  CliExecutionOptions["refreshMaps"],
  CliExecutionOptions["listMaps"],
  CliExecutionOptions["loadMap"],
  CliExecutionOptions["saveMap"],
  CliExecutionOptions["parseImport"],
  CliExecutionOptions["serializeDoc"],
  CliExecutionOptions["toMarkdown"],
];

async function postBrowserResult(id: string, payload: unknown): Promise<void> {
  await fetch(`/__ithread_cli/v1/commands/${encodeURIComponent(id)}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** Start the optional CLI transport after first paint and return a synchronous disconnect handle. */
export function connect(bindings: CliBridgeBindings): () => void {
  const [
    activeDoc,
    openDoc,
    replaceActive,
    refreshMaps,
    listMaps,
    loadMap,
    saveMap,
    parseImport,
    serializeDoc,
    toMarkdown,
  ] = bindings;
  const options: CliExecutionOptions = {
    activeDoc,
    openDoc,
    replaceActive,
    refreshMaps,
    listMaps,
    loadMap,
    saveMap,
    parseImport,
    serializeDoc,
    toMarkdown,
  };
  const desktop = window.iThreadDesktop;
  const desktopCli = desktop?.cliNextCommand && desktop.cliPostResult ? desktop : undefined;
  if (!desktopCli && !import.meta.env.DEV) return () => {};
  let stopped = false;
  const execute = async (command: CliBridgeCommand): Promise<unknown> => {
    const { executeCliCommand } = await import("./executeCliCommand");
    return executeCliCommand(command, options);
  };
  const nextCommand = desktopCli
    ? async () => (await desktopCli.cliNextCommand?.()) as CliBridgeCommand | null
    : async () => {
        const response = await fetch("/__ithread_cli/v1/commands/next", { cache: "no-store" });
        return response.status === 200 ? ((await response.json()) as CliBridgeCommand) : null;
      };
  const postResult = desktopCli
    ? (id: string, payload: unknown) => desktopCli.cliPostResult?.(id, payload)
    : postBrowserResult;
  const poll = async () => {
    while (!stopped) {
      try {
        const command = await nextCommand();
        if (command) {
          try {
            await postResult(command.requestId, { ok: true, result: await execute(command) });
          } catch (error) {
            await postResult(command.requestId, {
              ok: false,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      } catch {
        // The dev server may be restarting. The next poll reconnects automatically.
      }
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  };
  void poll();
  return () => {
    stopped = true;
  };
}
