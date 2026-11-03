import { t } from "../i18n";
import { CommandPalette } from "./CommandPalette";
import type { ToolbarProps } from "./Toolbar";
import { buildEditorCommands } from "./editorCommands";

export function EditorCommandPalette({
  toolbar,
  onClose,
}: { toolbar: ToolbarProps; onClose: () => void }) {
  return (
    <CommandPalette
      commands={buildEditorCommands(toolbar)}
      onClose={onClose}
      placeholder={t("palette.placeholder")}
      contextKinds={["node", "marker", "priority"]}
    />
  );
}
