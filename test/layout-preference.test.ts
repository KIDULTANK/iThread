import { describe, expect, it } from "vitest";
import { resolveInitialLayout } from "../src/layoutPreference";

describe("resolveInitialLayout", () => {
  it("defaults a new profile to an all-right layout", () => {
    expect(resolveInitialLayout("", () => null)).toBe("right");
  });

  it("keeps an explicit URL or saved user choice", () => {
    expect(resolveInitialLayout("?layout=left", () => "side")).toBe("left");
    expect(resolveInitialLayout("", () => "radial")).toBe("radial");
  });

  it("falls back to right when storage fails or contains an invalid value", () => {
    expect(resolveInitialLayout("", () => "unknown")).toBe("right");
    expect(
      resolveInitialLayout("", () => {
        throw new Error("blocked");
      }),
    ).toBe("right");
  });
});
