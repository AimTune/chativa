import { describe, it, expect, vi, afterEach } from "vitest";
import type { ConnectorCapabilities, IncomingMessage } from "@chativa/core";
import { DummyConnector } from "../DummyConnector";

function setup(options: ConstructorParameters<typeof DummyConnector>[0] = {}) {
  vi.useFakeTimers();
  const connector = new DummyConnector({ replyDelay: 10, connectDelay: 0, ...options });
  const replies: IncomingMessage[] = [];
  connector.onMessage((m) => replies.push(m));
  return { connector, replies };
}

const msg = (id: string, text: string) => ({ id, type: "text", data: { text }, timestamp: 1 });

afterEach(() => {
  vi.useRealTimers();
});

describe("DummyConnector — message actions", () => {
  it("announces no restrictions by default, or the configured capabilities", () => {
    const seen: ConnectorCapabilities[] = [];
    new DummyConnector().onCapabilities((c) => seen.push(c));
    new DummyConnector({ capabilities: { regenerate: false } }).onCapabilities((c) => seen.push(c));
    expect(seen).toEqual([{}, { regenerate: false }]);
  });

  it("setCapabilities re-announces at runtime", () => {
    const connector = new DummyConnector();
    const seen: ConnectorCapabilities[] = [];
    connector.onCapabilities((c) => seen.push(c));
    connector.setCapabilities({ editMessage: false });
    expect(seen.at(-1)).toEqual({ editMessage: false });
  });

  it("regenerate replays the last user message with a marked echo", async () => {
    const { connector, replies } = setup();
    await connector.sendMessage(msg("u1", "hello"));
    await vi.advanceTimersByTimeAsync(20);
    await connector.regenerate("any");
    await vi.advanceTimersByTimeAsync(20);
    expect(replies.map((r) => r.data.text)).toEqual(["Echo: hello", "Echo (regenerated): hello"]);
  });

  it("regenerate replays the history's last user message (transcript order) before the user has typed", async () => {
    const { connector, replies } = setup();
    const page = connector.loadHistory();
    await vi.advanceTimersByTimeAsync(500);
    const { messages } = await page;
    const lastUser = [...messages].reverse().find((m) => m.from === "user")!;

    // Loading an older page must not move it.
    const older = connector.loadHistory("1");
    await vi.advanceTimersByTimeAsync(500);
    await older;

    await connector.regenerate("any");
    await vi.advanceTimersByTimeAsync(20);
    expect(replies.map((r) => r.data.text)).toEqual([`Echo (regenerated): ${lastUser.data.text}`]);
  });

  it("a live message wins over the history one", async () => {
    const { connector, replies } = setup();
    await connector.sendMessage(msg("u1", "hello"));
    await vi.advanceTimersByTimeAsync(20);
    const page = connector.loadHistory();
    await vi.advanceTimersByTimeAsync(500);
    await page;
    await connector.regenerate("any");
    await vi.advanceTimersByTimeAsync(20);
    expect(replies.at(-1)!.data.text).toBe("Echo (regenerated): hello");
  });

  it("regenerate does nothing before the user has said anything", async () => {
    const { connector, replies } = setup();
    await connector.regenerate("any");
    await vi.advanceTimersByTimeAsync(20);
    expect(replies).toEqual([]);
  });

  it("editMessage answers the edited text, and regenerate then replays the edit", async () => {
    const { connector, replies } = setup();
    await connector.sendMessage(msg("u1", "helo"));
    await vi.advanceTimersByTimeAsync(20);
    await connector.editMessage("u1", msg("u1", "hello"));
    await vi.advanceTimersByTimeAsync(20);
    await connector.regenerate("any");
    await vi.advanceTimersByTimeAsync(20);
    expect(replies.map((r) => r.data.text)).toEqual([
      "Echo: helo",
      "Echo: hello",
      "Echo (regenerated): hello",
    ]);
  });
});
