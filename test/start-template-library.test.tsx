// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StartScreen } from "../src/components/start/StartScreen";
import { loadLocaleMessages, setLocale } from "../src/i18n";

vi.mock("../src/components/start/useLibrary", () => ({
  useLibrary: () => [],
  useFolders: () => [],
}));

describe("unified template library", () => {
  beforeEach(() => setLocale("en"));
  afterEach(() => setLocale("en"));

  it("has one navigation entry, switches categories and opens an editable example", () => {
    const onOpen = vi.fn();
    render(<StartScreen dark={false} onOpen={onOpen} onImportFiles={vi.fn()} />);
    const library = screen.getByRole("button", { name: "Template library" });
    expect(screen.queryByRole("button", { name: "Examples" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Product launch plan/i })).toBeNull();
    fireEvent.click(library);
    expect(screen.getByPlaceholderText("Search templates…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Worked examples" }));
    expect(library.getAttribute("aria-current")).toBe("true");
    expect(screen.queryByPlaceholderText("Search templates…")).toBeNull();
    expect(screen.getByPlaceholderText("Search examples…")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Product launch plan/i }));
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ meta: expect.objectContaining({ source: "example" }) }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Structure templates" }));
    expect(screen.getByPlaceholderText("Search templates…")).toBeTruthy();
  });

  it("uses Chinese library labels and accurate project attribution", async () => {
    setLocale("zh-CN");
    await loadLocaleMessages();
    render(<StartScreen dark={false} onOpen={vi.fn()} onImportFiles={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "模板库" }));
    expect(screen.getByRole("button", { name: "结构模板" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "完整示例" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "关于" }));
    expect(screen.getByText(/iThread 维护者：Zack Chen/)).toBeTruthy();
    expect(screen.getByText(/基于 Dann Bleeker Pedersen 的 Mind Map Studio/)).toBeTruthy();
    expect(screen.getByText(/iThoughts .itmz 文件导入与导出/)).toBeTruthy();
    expect(screen.queryByText(/MindManager 的可自行托管替代方案/)).toBeNull();
  });
});
