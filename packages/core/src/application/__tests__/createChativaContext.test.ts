import { describe, it, expect, vi, beforeEach } from "vitest";
import { createChativaContext } from "../createChativaContext";
import messageStore from "../stores/MessageStore";
import chatStore from "../stores/ChatStore";
import { EventBus } from "../EventBus";
import { DEFAULT_THEME } from "../../domain/value-objects/Theme";

describe("createChativaContext", () => {
  beforeEach(() => {
    messageStore.getState().clear();
    EventBus.clear();
    chatStore.setState({
      isOpened: false,
      isRendered: false,
      isFullscreen: false,
      isTyping: false,
      typingMessage: null,
      connectorStatus: "idle",
      theme: DEFAULT_THEME,
    });
  });

  it("exposes message operations backed by the message store", () => {
    const ctx = createChativaContext();
    ctx.messages.add({ id: "m1", type: "text", data: { text: "a" }, timestamp: 1 });
    ctx.messages.add({ id: "m2", type: "text", data: { text: "b" }, timestamp: 2 });
    expect(ctx.messages.getAll().map((m) => m.id)).toEqual(["m1", "m2"]);

    ctx.messages.update("m1", { data: { text: "edited" } });
    expect(messageStore.getState().messages[0].data.text).toBe("edited");

    ctx.messages.remove("m2");
    expect(ctx.messages.getAll().map((m) => m.id)).toEqual(["m1"]);

    ctx.messages.clear();
    expect(ctx.messages.getAll()).toEqual([]);
  });

  it("exposes chat UI operations backed by the chat store", () => {
    const ctx = createChativaContext();
    expect(ctx.chat.isOpened()).toBe(false);

    ctx.chat.open();
    expect(ctx.chat.isOpened()).toBe(true);
    ctx.chat.close();
    expect(chatStore.getState().isOpened).toBe(false);
    ctx.chat.toggle();
    expect(chatStore.getState().isOpened).toBe(true);

    ctx.chat.setTyping(true);
    expect(chatStore.getState().isTyping).toBe(true);
    ctx.chat.setTyping(false);
    expect(chatStore.getState().isTyping).toBe(false);

    ctx.chat.setFullscreen(true);
    expect(chatStore.getState().isFullscreen).toBe(true);

    chatStore.getState().setConnectorStatus("connected");
    expect(ctx.chat.getStatus()).toBe("connected");
  });

  it("exposes theme get/set", () => {
    const ctx = createChativaContext();
    expect(ctx.theme.get()).toBe(chatStore.getState().theme);
    ctx.theme.set({ colors: { primary: "#000001" } });
    expect(ctx.theme.get().colors.primary).toBe("#000001");
  });

  it("exposes the application EventBus", () => {
    const ctx = createChativaContext();
    const handler = vi.fn();
    ctx.events.on("widget_opened", handler);
    EventBus.emit("widget_opened", undefined);
    expect(handler).toHaveBeenCalledOnce();
    expect(ctx.events).toBe(EventBus);
  });
});
