import type { SETTINGS_EN } from "../components/settingsMessages";
import type { StartKey } from "../components/start/messages";
import type { ThemeKey } from "../components/themeDesignerMessages";
import type { IoKey } from "../io/messages";
import type { CanvasKey } from "../mindmap/flow/messages";
import type { PresentKey } from "../present/presentMessages";
import type { PwaKey } from "../pwa/messages";
import type { CoreKey } from "./core";

// The union of every message key any catalogue declares — what `t()` accepts, so a typo or a key that
// was deleted from a catalogue fails `tsc --noEmit` (which the gate runs) instead of rendering blank.
//
// These are TYPE-ONLY imports. They erase completely at build time, so listing a lazy chunk's catalogue
// here does NOT pull that chunk into the entry bundle — which is the whole reason the catalogues can be
// chunk-local while the key type stays global. Keep them `import type`; a value import would undo it.
//
// As each catalogue is added (io, …) add its key type to this union.
export type MessageKey =
  | CoreKey
  | CanvasKey
  | StartKey
  | ThemeKey
  | PresentKey
  | IoKey
  | PwaKey
  | keyof typeof SETTINGS_EN;
