import { describe, it, expect, beforeAll } from "vitest";
import "../GenUITextBlock";

describe("GenUITextBlock", () => {
  beforeAll(() => {
    if (!customElements.get("genui-text-block")) {
      throw new Error("Custom element not registered");
    }
  });

  it("renders the content inside the shared bubble", async () => {
    const el = document.createElement("genui-text-block") as HTMLElement & {
      content: string;
    };
    el.content = "Hello from the stream";
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));

    const bubble = el.shadowRoot?.querySelector(".chativa-bubble");
    expect(bubble).not.toBeNull();
    expect(bubble?.textContent).toContain("Hello from the stream");
    el.remove();
  });

  it("preserves newlines via pre-wrap without inheriting template whitespace", async () => {
    const el = document.createElement("genui-text-block") as HTMLElement & {
      content: string;
    };
    el.content = "line 1\nline 2";
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));

    // The bubble must contain exactly the content — no leading indentation
    // leaked from the Lit template (the div is white-space: pre-wrap).
    expect(el.shadowRoot?.querySelector(".chativa-bubble")?.textContent).toBe(
      "line 1\nline 2",
    );
    el.remove();
  });
});
