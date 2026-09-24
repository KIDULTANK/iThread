import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InstallButton } from "../src/components/InstallButton";
import {
  __resetInstallPromptForTest,
  __setInstallDeferredForTest,
} from "../src/pwa/useInstallPrompt";

// Stub matchMedia so isStandalonePwa() reads "not installed" by default; individual tests override.
function stubMatchMedia(standalone = false) {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.includes("display-mode: standalone") ? standalone : false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => {
  localStorage.clear();
  __resetInstallPromptForTest();
  stubMatchMedia(false);
});
afterEach(() => {
  cleanup();
  __resetInstallPromptForTest();
  vi.unstubAllGlobals();
});

describe("InstallButton / useInstallPrompt (O2)", () => {
  it("renders nothing until the browser offers installation", () => {
    const { container } = render(<InstallButton />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the Install button after a beforeinstallprompt and runs prompt() on click", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const fakeEvent = { prompt, userChoice: Promise.resolve({ outcome: "accepted" }) };
    __setInstallDeferredForTest(fakeEvent);
    render(<InstallButton />);
    const btn = screen.getByRole("button", { name: /install ithread/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(prompt).toHaveBeenCalled();
  });

  it("dismiss hides the button and persists the choice", () => {
    __setInstallDeferredForTest({
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    render(<InstallButton />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss install prompt/i }));
    expect(localStorage.getItem("mindmap-install-dismissed")).toBe("1");
    expect(screen.queryByRole("button", { name: /install ithread/i })).toBeNull();
  });

  it("renders nothing when already running as an installed PWA", () => {
    stubMatchMedia(true); // display-mode: standalone → installed
    __setInstallDeferredForTest({
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    const { container } = render(<InstallButton />);
    expect(container.firstChild).toBeNull();
  });
});
