import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatEngine } from "../ChatEngine";
import { MessageTypeRegistry } from "../registries/MessageTypeRegistry";
import { ExtensionRegistry } from "../registries/ExtensionRegistry";
import messageStore from "../stores/MessageStore";
import type { IConnector, MessageHandler } from "../../domain/ports/IConnector";

/** Create a controllable mock connector. */
function createMockConnector(): IConnector & {
  simulateIncoming: (text: string) => void;
} {
  let handler: MessageHandler | null = null;
  return {
    name: "mock",
    addSentToHistory: true,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage(cb) {
      handler = cb;
    },
    simulateIncoming(text: string) {
      handler?.({
        id: `sim-${Date.now()}`,
        type: "text",
        data: { text },
        timestamp: Date.now(),
      });
    },
  };
}

const FallbackComponent = class extends HTMLElement {} as typeof HTMLElement;

describe("ChatEngine", () => {
  beforeEach(() => {
    messageStore.getState().clear();
    MessageTypeRegistry.clear();
    ExtensionRegistry.clear();
    MessageTypeRegistry.setFallback(FallbackComponent);
  });

  it("calls connector.connect() on init", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    expect(connector.connect).toHaveBeenCalledOnce();
  });

  it("adds incoming messages to the message store", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateIncoming("Hello!");
    expect(messageStore.getState().messages).toHaveLength(1);
    expect(messageStore.getState().messages[0].data.text).toBe("Hello!");
  });

  it("adds sent messages to store when addSentToHistory is true", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    await engine.send({ id: "1", type: "text", data: { text: "Hi" }, timestamp: 0 });
    expect(messageStore.getState().messages).toHaveLength(1);
    expect(connector.sendMessage).toHaveBeenCalledOnce();
  });

  it("does NOT add to store when addSentToHistory is false", async () => {
    const connector = { ...createMockConnector(), addSentToHistory: false };
    const engine = new ChatEngine(connector);
    await engine.init();
    await engine.send({ id: "2", type: "text", data: { text: "Hi" }, timestamp: 0 });
    expect(messageStore.getState().messages).toHaveLength(0);
    expect(connector.sendMessage).toHaveBeenCalledOnce();
  });

  it("drops incoming message when extension blocks it", async () => {
    ExtensionRegistry.install({
      name: "blocker",
      version: "1.0.0",
      install(ctx) {
        ctx.onAfterReceive(() => null);
      },
    });
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    connector.simulateIncoming("blocked");
    expect(messageStore.getState().messages).toHaveLength(0);
  });

  it("drops outgoing message when extension blocks it", async () => {
    ExtensionRegistry.install({
      name: "send-blocker",
      version: "1.0.0",
      install(ctx) {
        ctx.onBeforeSend(() => null);
      },
    });
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    await engine.send({ id: "3", type: "text", data: { text: "Hi" }, timestamp: 0 });
    expect(messageStore.getState().messages).toHaveLength(0);
    expect(connector.sendMessage).not.toHaveBeenCalled();
  });

  it("calls connector.disconnect() on destroy", async () => {
    const connector = createMockConnector();
    const engine = new ChatEngine(connector);
    await engine.init();
    await engine.destroy();
    expect(connector.disconnect).toHaveBeenCalledOnce();
  });
});
