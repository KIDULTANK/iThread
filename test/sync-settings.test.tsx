// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SyncSettings } from "../src/components/SyncSettings";
import { setLocale } from "../src/i18n";
import "../src/i18n/zh-CN";
import { clearAllData, saveMap } from "../src/store/mapStore";
import { IndexedDbSyncLocal, syncEndpoint } from "../src/sync/localStore";

const endpoint = "https://example.test/maps/";
beforeEach(async () => {
  await clearAllData();
  setLocale("en");
  await saveMap({
    schemaVersion: 1,
    id: "map-1",
    title: "Private test map",
    root: { id: "root", topic: "Test", children: [] },
  });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("No network in this test")));
});
afterEach(() => vi.unstubAllGlobals());
async function configure() {
  fireEvent.change(screen.getByLabelText("WebDAV directory URL"), { target: { value: endpoint } });
  fireEvent.click(screen.getByRole("button", { name: "Save directory" }));
  await screen.findByText("Directory saved locally. No network request was made.");
}
describe("manual sync settings", () => {
  it("does not contact a server on mount, configuration or map selection", async () => {
    render(<SyncSettings />);
    await screen.findByRole("checkbox", { name: "Private test map" });
    await configure();
    fireEvent.click(screen.getByRole("checkbox", { name: "Private test map" }));
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Sync selected maps" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("clears credentials when changing server or closing the settings session", async () => {
    const first = render(<SyncSettings />);
    await configure();
    fireEvent.change(screen.getByLabelText("WebDAV username"), { target: { value: "test-user" } });
    fireEvent.change(screen.getByLabelText("WebDAV password"), {
      target: { value: "test-secret" },
    });
    fireEvent.change(screen.getByLabelText("WebDAV directory URL"), {
      target: { value: "https://other.test/maps/" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save directory" }));
    await waitFor(() =>
      expect((screen.getByLabelText("WebDAV password") as HTMLInputElement).value).toBe(""),
    );
    fireEvent.change(screen.getByLabelText("WebDAV password"), {
      target: { value: "session-only" },
    });
    first.unmount();
    render(<SyncSettings />);
    await waitFor(() =>
      expect((screen.getByLabelText("WebDAV directory URL") as HTMLInputElement).value).toBe(
        "https://other.test/maps/",
      ),
    );
    expect((screen.getByLabelText("WebDAV password") as HTMLInputElement).value).toBe("");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("defers the active editor without making a network request", async () => {
    await syncEndpoint(endpoint);
    await new IndexedDbSyncLocal(endpoint).select("map-1", true);
    render(<SyncSettings activeMapId="map-1" />);
    await waitFor(() =>
      expect(
        (screen.getByRole("button", { name: "Sync selected maps" }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: "Sync selected maps" }));
    await screen.findByText("Checked 0; conflicts 0; deferred/retry 1.");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("provides Chinese sync controls when the interface is Chinese", async () => {
    setLocale("zh-CN");
    render(<SyncSettings />);
    expect(screen.getByLabelText("WebDAV 目录地址")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "同步已选导图" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    await screen.findByRole("checkbox", { name: "Private test map" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
