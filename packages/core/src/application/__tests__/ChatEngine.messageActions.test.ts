import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatEngine } from "../ChatEngine";
import { MessageTypeRegistry } from "../registries/MessageTypeRegistry";
import { ExtensionRegistry } from "../registries/ExtensionRegistry";
import messageStore from "../stores/MessageStore";
import chatStore from "../stores/ChatStore";
import { EventBus } from "../EventBus";
import type {
  IConnector,
  MessageHandler,
  CapabilitiesHandler,
} from "../../domain/ports/IConnector";
import { DEFAULT_THEME } from "../../domain/value-objects/Theme";

type MockConnector = IConnector & {
  reply: (text: string, id: string) => void;
  announce: (caps: Parameters<CapabilitiesHandler>[0]) => void;
};

function createConnector(opts: { regenerate?: boolean; edit?: boolean; announces?: boolean } = {}): MockConnector {
  let onMsg: MessageHandler | null = null;
  let onCaps: CapabilitiesHandler | null = null;
  const connector: MockConnector = {
    name: "mock",
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage(cb) { onMsg = cb; },
    reply(text, id) { onMsg?.({ id, type: "text", from: "bot", data: { text }, timestamp: Date.now() }); },
    announce(caps) { onCaps?.(caps); },
  };
  if (opts.regenerate) connector.regenerate = vi.fn().mockResolvedValue(undefined);
  if (opts.edit) connector.editMessage = vi.fn().mockResolvedValue(undefined);
  if (opts.announces) connector.onCapabilities = (cb) => { onCaps = cb; };
  return connector;
}

/** One finished exchange: user "hello" → bot "first" + "second". */
async function setup(connector: MockConnector): Promise<ChatEngine> {
  const engine = new ChatEngine(connector);
  await engine.init();
  await engine.send({ id: "u1", type: "text", data: { text: "hello" }, timestamp: 1 });
  connector.reply("first", "b1");
  connector.reply("second", "b2");
  return engine;
}

const ids = () => messageStore.getState().messages.map((m) => m.id);

describe("ChatEngine — message actions", () => {
  beforeEach(() => {
    messageStore.getState().clear();
    MessageTypeRegistry.clear();
    ExtensionRegistry.clear();
    MessageTypeRegistry.setFallback(class extends HTMLElement {} as typeof HTMLElement);
    EventBus.clear();
    chatStore.setState({ isTyping: false, theme: DEFAULT_THEME, activeToolCalls: [] });
  });

  // ── capability resolution ─────────────────────────────────────────

  describe("capabilities", () => {
    it("reports unsupported when the connector implements neither method", async () => {
      await new ChatEngine(createConnector()).init();
      expect(chatStore.getState().messageActionSupport).toEqual({
        regenerate: "unsupported",
        editMessage: "unsupported",
      });
    });

    it("reports supported when the connector implements the methods", async () => {
      await new ChatEngine(createConnector({ regenerate: true, edit: true })).init();
      expect(chatStore.getState().messageActionSupport).toEqual({
        regenerate: "supported",
        editMessage: "supported",
      });
    });

    it("a backend announcement of false denies an implemented action", async () => {
      const connector = createConnector({ regenerate: true, edit: true, announces: true });
      await new ChatEngine(connector).init();
      connector.announce({ regenerate: false });
      expect(chatStore.getState().messageActionSupport).toEqual({
        regenerate: "denied",
        editMessage: "supported",
      });
    });

    it("each announcement replaces the previous one", async () => {
      const connector = createConnector({ regenerate: true, announces: true });
      await new ChatEngine(connector).init();
      connector.announce({ regenerate: false });
      connector.announce({});
      expect(chatStore.getState().messageActionSupport.regenerate).toBe("supported");
    });

    it("an announcement of true cannot add an action the connector lacks", async () => {
      const connector = createConnector({ announces: true });
      await new ChatEngine(connector).init();
      connector.announce({ regenerate: true, editMessage: true });
      expect(chatStore.getState().messageActionSupport).toEqual({
        regenerate: "unsupported",
        editMessage: "unsupported",
      });
    });
  });

  // ── regenerate ────────────────────────────────────────────────────

  describe("regenerate", () => {
    it("native: drops the whole reply and calls connector.regenerate", async () => {
      const connector = createConnector({ regenerate: true });
      const engine = await setup(connector);
      const events: unknown[] = [];
      EventBus.on("message_regenerated", (e) => events.push(e));

      await expect(engine.regenerate("b2")).resolves.toBe(true);

      expect(ids()).toEqual(["u1"]);
      expect(connector.regenerate).toHaveBeenCalledWith("b2");
      expect(connector.sendMessage).toHaveBeenCalledTimes(1); // only the original send
      expect(events).toEqual([{ messageId: "b2", mode: "native" }]);
    });

    it("does nothing without connector support when fallback is off", async () => {
      const connector = createConnector();
      const engine = await setup(connector);
      await expect(engine.regenerate("b2")).resolves.toBe(false);
      expect(ids()).toEqual(["u1", "b1", "b2"]);
    });

    it("fallback: re-sends the user's message as a new turn under a fresh id", async () => {
      chatStore.getState().setTheme({ messageActions: { fallback: true } });
      const connector = createConnector();
      const engine = await setup(connector);
      const events: unknown[] = [];
      EventBus.on("message_regenerated", (e) => events.push(e));

      await expect(engine.regenerate("b1")).resolves.toBe(true);

      expect(ids()).toEqual(["u1"]);
      const resent = vi.mocked(connector.sendMessage).mock.calls[1][0];
      expect(resent.data).toEqual({ text: "hello" });
      expect(resent.id).not.toBe("u1");
      expect(events).toEqual([{ messageId: "b1", mode: "fallback" }]);
    });

    it("fallback never overrides a backend denial", async () => {
      chatStore.getState().setTheme({ messageActions: { fallback: true } });
      const connector = createConnector({ regenerate: true, announces: true });
      const engine = await setup(connector);
      connector.announce({ regenerate: false });
      await expect(engine.regenerate("b2")).resolves.toBe(false);
      expect(connector.regenerate).not.toHaveBeenCalled();
    });

    it("refuses a message that is not part of the latest reply", async () => {
      const connector = createConnector({ regenerate: true });
      const engine = await setup(connector);
      await engine.send({ id: "u2", type: "text", data: { text: "again" }, timestamp: 2 });
      connector.reply("third", "b3");
      await expect(engine.regenerate("b2")).resolves.toBe(false);
      expect(connector.regenerate).not.toHaveBeenCalled();
    });

    it("refuses while the bot is typing or the reply is still streaming", async () => {
      const connector = createConnector({ regenerate: true });
      const engine = await setup(connector);

      chatStore.setState({ isTyping: true });
      await expect(engine.regenerate("b2")).resolves.toBe(false);
      chatStore.setState({ isTyping: false });

      messageStore.getState().updateById("b2", { data: { text: "sec", streaming: true } });
      await expect(engine.regenerate("b2")).resolves.toBe(false);
      expect(connector.regenerate).not.toHaveBeenCalled();
    });

    it("refuses when there is no user message (a greeting is not a reply)", async () => {
      const connector = createConnector({ regenerate: true });
      const engine = new ChatEngine(connector);
      await engine.init();
      connector.reply("Welcome!", "g1");
      await expect(engine.regenerate("g1")).resolves.toBe(false);
    });
  });

  // ── editMessage ───────────────────────────────────────────────────

  describe("editMessage", () => {
    it("native: updates the bubble in place, drops the reply and calls connector.editMessage", async () => {
      const connector = createConnector({ edit: true });
      const engine = await setup(connector);
      const events: unknown[] = [];
      EventBus.on("message_edited", (e) => events.push(e));

      await expect(engine.editMessage("u1", "  hi there ")).resolves.toBe(true);

      expect(ids()).toEqual(["u1"]);
      const stored = messageStore.getState().messages[0];
      expect(stored.data.text).toBe("hi there");
      expect(stored.status).toBe("sent");
      expect(connector.editMessage).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({ id: "u1", data: { text: "hi there" } }),
      );
      expect(events).toEqual([{ messageId: "u1", text: "hi there", mode: "native" }]);
    });

    it("fallback: replaces the bubble with a freshly sent message", async () => {
      chatStore.getState().setTheme({ messageActions: { fallback: true } });
      const connector = createConnector();
      const engine = await setup(connector);

      await expect(engine.editMessage("u1", "hi there")).resolves.toBe(true);

      const messages = messageStore.getState().messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].id).not.toBe("u1");
      expect(messages[0].data.text).toBe("hi there");
      expect(vi.mocked(connector.sendMessage).mock.calls[1][0].data).toEqual({ text: "hi there" });
    });

    it("runs onBeforeSend extensions and aborts when one blocks the edit", async () => {
      const connector = createConnector({ edit: true });
      const engine = await setup(connector);
      ExtensionRegistry.install({
        name: "block",
        version: "1",
        install(ctx) { ctx.onBeforeSend(() => null); },
      });

      await expect(engine.editMessage("u1", "changed")).resolves.toBe(false);
      expect(ids()).toEqual(["u1", "b1", "b2"]);
      expect(connector.editMessage).not.toHaveBeenCalled();
    });

    it("refuses an empty edit, an older message, or an unsupported connector", async () => {
      const connector = createConnector({ edit: true });
      const engine = await setup(connector);
      await expect(engine.editMessage("u1", "   ")).resolves.toBe(false);
      await expect(engine.editMessage("b1", "x")).resolves.toBe(false);

      messageStore.getState().clear();
      const plain = createConnector();
      const plainEngine = await setup(plain);
      await expect(plainEngine.editMessage("u1", "x")).resolves.toBe(false);
    });
  });
});
