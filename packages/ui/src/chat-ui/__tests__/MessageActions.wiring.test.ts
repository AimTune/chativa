import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatStore, messageStore, ChatEngine, type CapabilitiesHandler } from "@chativa/core";
// The package entry: registers every element, like a host page loading @chativa/ui.
import "../../index";
import {
  $,
  flush,
  registerFakeConnector,
  resetGlobals,
  type FakeConnector,
  type LitLike,
} from "../../__tests__/testUtils";

let connector: FakeConnector;

function fire(el: Element, type: string, detail?: unknown) {
  const source = el.shadowRoot?.querySelector(".widget, .panel") ?? el;
  source.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
}

/** Mount and open <chat-iva>, then play one exchange: user "hi" → bot "Hello!". */
async function openWithExchange(): Promise<LitLike> {
  const el = document.createElement("chat-iva") as LitLike;
  el.setAttribute("connector", "fake");
  document.body.appendChild(el);
  await el.updateComplete;
  chatStore.getState().open();
  await el.updateComplete;
  await flush();

  $(el, "chat-input")!.dispatchEvent(new CustomEvent("send-message", { detail: "hi" }));
  await flush();
  connector.emitMessage({ id: "b1", from: "bot", data: { text: "Hello!" } });
  await el.updateComplete;
  const list = $<LitLike>(el, "chat-message-list")!;
  await list.updateComplete;
  return el;
}

function actionButton(el: LitLike, selector: string): HTMLButtonElement | null {
  const list = $<LitLike>(el, "chat-message-list")!;
  for (const bar of list.shadowRoot!.querySelectorAll("message-actions")) {
    const btn = bar.shadowRoot!.querySelector<HTMLButtonElement>(selector);
    if (btn) return btn;
  }
  return null;
}

async function settle(el: LitLike) {
  await flush();
  const list = $<LitLike>(el, "chat-message-list")!;
  await list.updateComplete;
  await Promise.all(
    [...list.shadowRoot!.querySelectorAll<LitLike>("message-actions")].map((a) => a.updateComplete),
  );
}

describe("message actions — <chat-iva> wiring", () => {
  beforeEach(() => {
    resetGlobals();
    connector = registerFakeConnector("fake");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetGlobals();
  });

  it("a connector with regenerate(): the button shows and reaches the connector", async () => {
    connector.regenerate = vi.fn().mockResolvedValue(undefined);
    const el = await openWithExchange();
    await settle(el);

    actionButton(el, ".regenerate")!.click();
    await flush();

    expect(connector.regenerate).toHaveBeenCalledWith("b1");
    expect(messageStore.getState().messages.map((m) => m.from)).toEqual(["user"]);
  });

  it("a connector with editMessage(): editing inline reaches the connector", async () => {
    connector.editMessage = vi.fn().mockResolvedValue(undefined);
    const el = await openWithExchange();
    await settle(el);

    actionButton(el, ".edit")!.click();
    const list = $<LitLike>(el, "chat-message-list")!;
    await list.updateComplete;
    const ta = list.shadowRoot!.querySelector<HTMLTextAreaElement>(".edit-input")!;
    ta.value = "hi again";
    ta.dispatchEvent(new Event("input"));
    ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    await flush();

    const userId = messageStore.getState().messages[0].id;
    expect(connector.editMessage).toHaveBeenCalledWith(
      userId,
      expect.objectContaining({ data: { text: "hi again" } }),
    );
  });

  it("a plain connector shows neither regenerate nor edit", async () => {
    const el = await openWithExchange();
    await settle(el);
    expect(actionButton(el, ".regenerate")).toBeNull();
    expect(actionButton(el, ".edit")).toBeNull();
    expect(actionButton(el, ".copy")).not.toBeNull();
  });

  it("a backend that reports regenerate: false hides it, then re-enabling shows it", async () => {
    let announce: CapabilitiesHandler | null = null;
    connector.regenerate = vi.fn().mockResolvedValue(undefined);
    connector.onCapabilities = (cb) => { announce = cb; };
    const el = await openWithExchange();
    announce!({ regenerate: false });
    await settle(el);
    expect(actionButton(el, ".regenerate")).toBeNull();

    announce!({ regenerate: true });
    await settle(el);
    expect(actionButton(el, ".regenerate")).not.toBeNull();
  });

  it("logs engine failures instead of throwing", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(ChatEngine.prototype, "regenerate").mockRejectedValue(new Error("r"));
    vi.spyOn(ChatEngine.prototype, "editMessage").mockRejectedValue(new Error("e"));
    const el = await openWithExchange();
    fire(el, "chativa-regenerate", { messageId: "b1" });
    fire(el, "chativa-edit-message", { messageId: "u", text: "x" });
    await flush();
    expect(err).toHaveBeenCalledWith("[ChatWidget] Regenerate failed:", expect.any(Error));
    expect(err).toHaveBeenCalledWith("[ChatWidget] Edit failed:", expect.any(Error));
  });
});

describe("message actions — <agent-panel> wiring", () => {
  beforeEach(() => resetGlobals());
  afterEach(async () => {
    vi.restoreAllMocks();
    resetGlobals();
    await flush();
  });

  it("forwards regenerate / edit to the active conversation's engine and logs failures", async () => {
    registerFakeConnector("agent", { conversations: [{ id: "c1", title: "A", status: "open" }] });
    const regen = vi.spyOn(ChatEngine.prototype, "regenerate").mockResolvedValue(true);
    const edit = vi.spyOn(ChatEngine.prototype, "editMessage").mockRejectedValue(new Error("e"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const el = document.createElement("agent-panel") as LitLike & { connector: string };
    el.connector = "agent";
    document.body.appendChild(el);
    await flush();
    await el.updateComplete;

    fire(el, "chativa-regenerate", { messageId: "b9" });
    fire(el, "chativa-edit-message", { messageId: "u9", text: "new" });
    await flush();

    expect(regen).toHaveBeenCalledWith("b9");
    expect(edit).toHaveBeenCalledWith("u9", "new");
    expect(err).toHaveBeenCalledWith("[AgentPanel] Edit failed:", expect.any(Error));
  });
});
