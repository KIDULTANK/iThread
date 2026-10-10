// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsDialog, applyLocaleChoice } from "../src/components/SettingsDialog";
import { LOCALE_PREF_KEY, getLocale, setLocale } from "../src/i18n";
import { INTERACTION_PREF_KEY, readInteractionPrefs } from "../src/store/interactionPrefs";

// SettingsDialog renders inside the shared native-<dialog> wrapper; guard-stub the modal methods
// (jsdom may lack them) the same way the other dialog tests do.
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false;
    };
  }
});

beforeEach(() => {
  setLocale("en");
  localStorage.removeItem(INTERACTION_PREF_KEY);
});

function setup(over: Partial<Parameters<typeof SettingsDialog>[0]> = {}) {
  const props = {
    open: true,
    onClose: vi.fn(),
    appearance: "system" as const,
    setAppearance: vi.fn(),
    motionPref: "system" as const,
    setMotionPref: vi.fn(),
    contrastPref: "system" as const,
    setContrastPref: vi.fn(),
    onReShowGettingStarted: vi.fn(),
    onClearRecents: vi.fn(),
    onClearBranchClipboard: vi.fn(),
    onExportSettings: vi.fn(),
    onImportSettings: vi.fn(),
    onClearAllData: vi.fn(),
    ...over,
  };
  render(<SettingsDialog {...props} />);
  return props;
}

describe("SettingsDialog", () => {
  it("persists real keyboard and canvas preferences and resets their defaults", () => {
    setup();
    fireEvent.change(screen.getByLabelText("Alt hold delay"), { target: { value: "800" } });
    fireEvent.change(screen.getByLabelText("Scroll pan speed"), { target: { value: "1.2" } });
    fireEvent.change(screen.getByLabelText("Mouse wheel"), { target: { value: "zoom" } });
    fireEvent.change(screen.getByLabelText("Hold Alt for shortcuts"), { target: { value: "off" } });
    expect(readInteractionPrefs()).toEqual({
      altHelp: false,
      altDelay: 800,
      wheelMode: "zoom",
      panSpeed: 1.2,
    });
    expect((screen.getByLabelText("Alt hold delay") as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByLabelText("Scroll pan speed") as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Reset keyboard & canvas defaults" }));
    expect(readInteractionPrefs()).toEqual({
      altHelp: true,
      altDelay: 550,
      wheelMode: "pan",
      panSpeed: 0.85,
    });
  });
  it("offers Chinese and English and persists a language switch", () => {
    setup();
    const language = screen.getByLabelText("Language") as HTMLSelectElement;
    expect([...language.options].map((option) => option.value)).toEqual(["zh-CN", "en"]);

    const reload = vi.fn();
    applyLocaleChoice("zh-CN", reload);
    expect(getLocale()).toBe("zh-CN");
    expect(localStorage.getItem(LOCALE_PREF_KEY)).toBe("zh-CN");
    expect(reload).toHaveBeenCalledOnce();
  });

  it("renders the sections", () => {
    setup();
    expect(screen.getByText("Settings")).toBeTruthy();
    expect(screen.getByText("Appearance")).toBeTruthy();
    expect(screen.getByText("Preferences file")).toBeTruthy();
    expect(screen.getByText("Local data")).toBeTruthy();
  });

  // Preferences are app-wide and don't live on any document (saved filter presets deliberately so), so
  // a settings file is the only way they reach a second machine.
  it("exports preferences on demand, and picks a file to import", () => {
    const props = setup();
    fireEvent.click(screen.getByText("Export preferences…"));
    expect(props.onExportSettings).toHaveBeenCalled();

    // The Import button proxies to a hidden file input; picking a file hands it straight to App.
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    const file = new File(["{}"], "prefs.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(props.onImportSettings).toHaveBeenCalledWith(file);
  });

  // Design-surface consolidation (T3-25): the canvas-theme select used to live here too, duplicating
  // the Map panel's. Removed — this guards against it silently reappearing, and that the copy still
  // points users to where it now lives (the one home for the map's look).
  it("no longer duplicates the canvas-theme picker (moved to the Map panel)", () => {
    setup();
    expect(screen.queryByLabelText("Canvas theme")).toBeNull();
    expect(screen.getByText(/canvas theme.*lives in the map panel/i)).toBeTruthy();
  });

  it("drives the app-appearance select (System / Light / Dark)", async () => {
    const p = setup();
    await userEvent.selectOptions(screen.getByLabelText("App theme"), "dark");
    expect(p.setAppearance).toHaveBeenCalledWith("dark");
  });

  it("drives the reduce-motion select", async () => {
    const p = setup();
    await userEvent.selectOptions(screen.getByLabelText("Reduce motion"), "reduced");
    expect(p.setMotionPref).toHaveBeenCalledWith("reduced");
  });

  it("drives the high-contrast select", async () => {
    const p = setup();
    await userEvent.selectOptions(screen.getByLabelText("High contrast"), "high");
    expect(p.setContrastPref).toHaveBeenCalledWith("high");
  });

  it("shows the local-storage usage line when an estimate is available", async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "storage");
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { estimate: async () => ({ usage: 2 * 1024 * 1024, quota: 100 * 1024 * 1024 }) },
    });
    setup();
    expect(await screen.findByText(/used of/i)).toBeTruthy();
    if (original) Object.defineProperty(navigator, "storage", original);
    else Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "storage");
  });

  it("formats small storage sizes in B / KB", async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, "storage");
    Object.defineProperty(navigator, "storage", {
      configurable: true,
      value: { estimate: async () => ({ usage: 500, quota: 2048 }) },
    });
    setup();
    expect(await screen.findByText(/500 B used of 2 KB/i)).toBeTruthy();
    if (original) Object.defineProperty(navigator, "storage", original);
    else Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, "storage");
  });

  it("fires each reset / clear action from its button", async () => {
    const p = setup();
    await userEvent.click(screen.getByRole("button", { name: /getting-started tips/i }));
    expect(p.onReShowGettingStarted).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: /clear command history/i }));
    expect(p.onClearRecents).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: /clear branch clipboard/i }));
    expect(p.onClearBranchClipboard).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: /clear all local data/i }));
    expect(p.onClearAllData).toHaveBeenCalledTimes(1);
  });
});
