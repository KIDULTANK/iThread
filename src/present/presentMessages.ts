import { type Catalogue, registerMessages } from "../i18n/registry";

// English messages for PRESENTATION mode. Chunk-local: presentation is its own lazy chunk
// (Presentation-*.js), so these cost the entry bundle nothing.
//
// Imports `registerMessages` from `../i18n/registry`, NOT the `../i18n` barrel.

export const PRESENT_EN = {
  "present.presenterViewP": "Presenter view (P)",
  "present.elapsedNamed": "Elapsed {time}",
  "present.blackScreenHint": "Black screen — click or press any key to resume",
  "present.whiteScreenHint": "White screen — click or press any key to resume",
  "present.presenterView": "Presenter view",
  "present.decreaseBudget": "Decrease budget",
  "present.increaseBudget": "Increase budget",
  "present.elapsedTimeSetABudget":
    "Elapsed time (set a budget in presenter view for pacing colour)",
  "present.resetTimer": "Reset timer",
  "present.togglePresenterViewP": "Toggle presenter view (P)",
  "present.pauseTimer": "Pause timer",
  "present.resumeTimer": "Resume timer",
  "present.noNotesForThisSlide": "No notes for this slide.",
  "present.homeSpacePBW": "← → · Home · Space · P · B/W · Esc",
  "present.speakerNotes": "Speaker notes",
  "present.nextUp": "Next up",
  "present.endOfMap": "End of map",
  "present.budget": "Budget",
} as const satisfies Catalogue;

export type PresentKey = keyof typeof PRESENT_EN;

registerMessages("en", PRESENT_EN);
