import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chatStore,
  conversationStore,
  messageStore,
  ChatEngine,
  SlashCommandRegistry,
  type Conversation,
} from "@chativa/core";
// The package entry registers the `text` message type; AgentPanel alone does not.
import "../DefaultTextMessage";
import "../AgentPanel";
import {
  $,
  flush,
  registerFakeConnector,
  resetGlobals,
  type FakeConnector,
  type LitLike,
} from "../../__tests__/testUtils";

type Panel = LitLike & { connector: string; sidebarWidth: string };

const convs: Conversation[] = [
  { id: "c1", title: "Alice", status: "open" },
  { id: "c2", title: "Bob", status: "pending" },
];

let connector: FakeConnector;

async function mountPanel(conversations: Conversation[] | undefined = convs): Promise<Panel> {
  connector = registerFakeConnector("agent", { conversations });
  const el = document.createElement("agent-panel") as Panel;
  el.connector = "agent";
  el.sidebarWidth = "300px";
  document.body.appendChild(el);
  await flush();
  await el.updateComplete;
  return el;
}

function fire(el: Panel, type: string, detail?: unknown) {
  ($(el, ".panel") ?? el).dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
}

describe("AgentPanel (<agent-panel>)", () => {
  beforeEach(() => resetGlobals());
  afterEach(async () => {
    vi.restoreAllMocks();
    resetGlobals();
    await flush();
  });

  it("connects immediately and activates the first open conversation", async () => {
    const el = await mountPanel();
    expect(connector.connect).toHaveBeenCalledTimes(1);
    expect(conversationStore.getState().activeConversationId).toBe("c1");
    expect($(el, ".sidebar conversation-list")).not.toBeNull();
    expect($(el, ".sidebar")!.getAttribute("style")).toContain("300px");
    expect($(el, "chat-header")).not.toBeNull();
    expect($(el, "chat-message-list")).not.toBeNull();
    expect($(el, "chat-input")).not.toBeNull();
  });

  it("shows a placeholder when no conversation is active", async () => {
    const el = await mountPanel([]);
    expect($(el, ".no-conv-text")!.textContent).toBe("Select a conversation");
    expect($(el, "chat-input")).toBeNull();
  });

  it("logs a failing init", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    connector = registerFakeConnector("agent");
    connector.connect.mockRejectedValueOnce(new Error("down"));
    const el = document.createElement("agent-panel") as Panel;
    el.connector = "agent";
    document.body.appendChild(el);
    await flush();
    expect(err).toHaveBeenCalledWith("[AgentPanel] Engine init failed:", expect.any(Error));
  });

  it("routes conversation events to the connector", async () => {
    const el = await mountPanel();
    fire(el, "conversation-select", { id: "c2" });
    await flush();
    expect(connector.switchConversation).toHaveBeenCalledWith("c2");
    expect(conversationStore.getState().activeConversationId).toBe("c2");

    fire(el, "new-conversation");
    await flush();
    expect(connector.createConversation).toHaveBeenCalled();

    fire(el, "conversation-close", { id: "c1" });
    await flush();
    expect(connector.closeConversation).toHaveBeenCalledWith("c1");
  });

  it("sends messages from the input and chat-action events", async () => {
    const el = await mountPanel();
    $(el, "chat-input")!.dispatchEvent(new CustomEvent("send-message", { detail: " hi " }));
    $(el, "chat-input")!.dispatchEvent(new CustomEvent("send-message", { detail: "  " }));
    fire(el, "chat-action", "/menu");
    fire(el, "chat-action", "");
    await flush();
    expect(connector.sendMessage.mock.calls.map((c) => c[0].data.text)).toEqual(["hi", "/menu"]);
  });

  it("forwards feedback, retry, files, history and GenUI events", async () => {
    const spy = vi.spyOn(ChatEngine.prototype, "receiveComponentEvent");
    const el = await mountPanel();
    const f = new File(["x"], "x.txt");

    fire(el, "chativa-feedback", { messageId: "m1", feedback: "like" });
    fire(el, "chat-retry");
    fire(el, "send-file", { files: [f], text: "cap" });
    fire(el, "send-file", { files: [f], text: "" });
    fire(el, "chat-load-history");
    fire(el, "genui-send-event", { msgId: "g1", eventType: "click", payload: 1, scope: "global", component: "btn" });
    await flush();

    expect(connector.sendFeedback).toHaveBeenCalledWith("m1", "like");
    expect(connector.connect).toHaveBeenCalledTimes(2);
    expect(connector.sendFile.mock.calls).toEqual([[f, { caption: "cap" }], [f, undefined]]);
    expect(connector.loadHistory).toHaveBeenCalledTimes(2); // init + explicit
    expect(spy).toHaveBeenCalledWith("g1", "click", 1, { scope: "global", component: "btn" });
  });

  it("logs failures from every forwarded action", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const el = await mountPanel();
    for (const fn of [
      connector.switchConversation,
      connector.createConversation,
      connector.closeConversation,
      connector.sendMessage,
      connector.sendFeedback,
      connector.connect,
      connector.sendFile,
      connector.loadHistory,
    ]) {
      fn.mockRejectedValue(new Error("x"));
    }
    chatStore.getState().setIsLoadingHistory(false);
    fire(el, "conversation-select", { id: "c2" });
    fire(el, "new-conversation");
    fire(el, "conversation-close", { id: "c1" });
    fire(el, "chat-action", "a");
    $(el, "chat-input")!.dispatchEvent(new CustomEvent("send-message", { detail: "b" }));
    fire(el, "chativa-feedback", { messageId: "m", feedback: "like" });
    fire(el, "chat-retry");
    fire(el, "send-file", { files: [new File([""], "f")], text: "" });
    fire(el, "chat-load-history");
    await flush();

    const messages = err.mock.calls.map((c) => c[0]);
    expect(messages).toEqual(
      expect.arrayContaining([
        "[AgentPanel] switchTo failed:",
        "[AgentPanel] createNew failed:",
        "[AgentPanel] close failed:",
        "[AgentPanel] Action send failed:",
        "[AgentPanel] Send failed:",
        "[AgentPanel] Feedback failed:",
        "[AgentPanel] Reconnect failed:",
        "[AgentPanel] sendFile failed:",
        "[AgentPanel] loadHistory failed:",
      ]),
    );
  });

  it("re-renders on message changes and registers /clear", async () => {
    const el = await mountPanel();
    const spy = vi.spyOn(el as unknown as { requestUpdate(): void }, "requestUpdate");
    messageStore.getState().addMessage({ id: "x", type: "text", from: "bot", data: { text: "x" } });
    expect(spy).toHaveBeenCalled();

    expect(SlashCommandRegistry.execute("clear", "")).toBe(true);
    expect(messageStore.getState().messages).toHaveLength(0);
  });

  it("tears down the engine and stops listening when removed", async () => {
    const el = await mountPanel();
    el.remove();
    await flush();
    expect(connector.disconnect).toHaveBeenCalled();

    connector.sendFeedback.mockClear();
    el.dispatchEvent(new CustomEvent("chativa-feedback", { detail: { messageId: "m", feedback: "like" } }));
    await flush();
    expect(connector.sendFeedback).not.toHaveBeenCalled();
  });
});
