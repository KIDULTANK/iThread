# iThread CLI

[简体中文](CLI.md) | **English**

The local CLI lets scripts and agents create, inspect and modify maps in a running iThread instance.
It works with the Windows desktop application and the development preview. The production bridge
listens only on the loopback interface, requires a random per-launch token and does not need an
internet connection, cloud account or built-in AI provider.

## Start

Open iThread for Windows, then run the two release files from the same folder:

```powershell
.\ithread-cli.cmd status
.\ithread-cli.cmd maps
```

The launcher requires Node.js 18 or newer. In a source checkout, use `pnpm ithread` instead:

```powershell
pnpm ithread status
pnpm ithread maps
```

The Windows app is discovered automatically. For a development preview on another port, add
`--url http://127.0.0.1:PORT`. Every command returns JSON.

## Create, inspect and open

```powershell
pnpm ithread create --title "Case analysis" --root "Issues"
pnpm ithread get --map MAP_ID
pnpm ithread open --map MAP_ID
```

`create` opens the map by default. Add `--no-open` to create it without switching the canvas.

## Import and export

```powershell
pnpm ithread import --file "C:\Maps\example.itmz"
Get-Content .\generated.md -Raw | pnpm ithread import --stdin --name generated.md
pnpm ithread export --map MAP_ID --file "C:\Maps\example.ithread"
pnpm ithread export --map MAP_ID --file "C:\Maps\example.md"
```

Import uses the same format support as the application. It creates a new library map and never
modifies the source file. `.ithread` is the lossless native backup format; Markdown is a hierarchical
exchange format.

## Modify topics

```powershell
pnpm ithread add --map MAP_ID --parent PARENT_ID --topic "Evidence"
pnpm ithread update --map MAP_ID --node NODE_ID --topic "Verified evidence"
pnpm ithread move --map MAP_ID --node NODE_ID --parent NEW_PARENT_ID --index 0
pnpm ithread delete --map MAP_ID --node NODE_ID --confirm
```

Omit `--map` to target the open map. Deletion requires `--confirm`; the central topic cannot be moved
or deleted, and a topic cannot be moved into its own descendant.

## Atomic batch edits

For large generated trees, submit one JSON plan instead of thousands of individual calls:

```json
[
  { "action": "addTopic", "parentId": "root-id", "id": "facts", "topic": "Facts" },
  { "action": "addTopic", "parentId": "facts", "id": "fact-1", "topic": "Contract signed" },
  { "action": "addTopic", "parentId": "root-id", "id": "law", "topic": "Law" }
]
```

```powershell
pnpm ithread batch --map MAP_ID --file .\operations.json --dry-run
pnpm ithread batch --map MAP_ID --file .\operations.json
```

`--dry-run` validates and returns the expected structure without saving. A real batch is saved once
and forms one undo step. If any operation fails, none of the batch is written. The limit is 10,000
operations per batch.

## Recommended agent workflow

1. Run `status --compact` and confirm that the application is connected.
2. Run `maps` or `get` to obtain current map and topic IDs.
3. Prepare changes without deleting content unless the user explicitly requested deletion.
4. For large changes, run `batch --dry-run` before the real batch.
5. Run `get` again to verify the final hierarchy and export a native backup when appropriate.

CLI edits use iThread's structural checks and remain visible and undoable in the application.
