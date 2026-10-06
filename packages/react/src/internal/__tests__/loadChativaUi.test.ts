import { describe, it, expect } from "vitest";
import { loadChativaUi, loadChativaGenUi } from "../loadChativaUi";

describe("loadChativaUi / loadChativaGenUi", () => {
  it("memoises the @chativa/ui import", async () => {
    const first = loadChativaUi();
    expect(loadChativaUi()).toBe(first);
    const ui = await first;
    expect(ui.ChatWidget).toBeDefined();
    expect(customElements.get("chat-iva")).toBeDefined();
  });

  it("memoises the @chativa/genui import", async () => {
    const first = loadChativaGenUi();
    expect(loadChativaGenUi()).toBe(first);
    const genui = await first;
    expect(genui.GenUIMessage).toBeDefined();
    expect(customElements.get("genui-message")).toBe(genui.GenUIMessage);
  });
});
