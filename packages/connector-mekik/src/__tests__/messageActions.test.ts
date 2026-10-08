import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ConnectorCapabilities } from "@chativa/core";
import { MekikConnector } from "../index";

/** Minimal WebSocket stub — tests drive open/message transitions by hand. */
class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: { reason: string }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }
}

function makeConnector() {
  const connector = new MekikConnector({ url: "ws://actions-test", reconnect: false });
  const route = (frame: Record<string, unknown>) =>
    (connector as unknown as { routeFrame(raw: string): void }).routeFrame(JSON.stringify(frame));
  return { connector, route };
}

async function openConnection(connector: MekikConnector): Promise<MockWebSocket> {
  const connecting = connector.connect();
  const ws = MockWebSocket.instances.at(-1)!;
  ws.open();
  await connecting;
  return ws;
}

const welcome = (extra: Record<string, unknown> = {}) => ({
  type: "welcome",
  data: { protocol: "mekik/2", conversationId: "c1", userId: "u1", connectionId: "x", watermark: 0, ...extra },
});

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("message actions — server capabilities", () => {
  it("announces both actions off before any welcome", () => {
    const { connector } = makeConnector();
    const seen: ConnectorCapabilities[] = [];
    connector.onCapabilities((c) => seen.push(c));
    expect(seen).toEqual([{ regenerate: false, editMessage: false }]);
  });

  it("a welcome without capabilities keeps both off", async () => {
    const { connector, route } = makeConnector();
    const seen: ConnectorCapabilities[] = [];
    connector.onCapabilities((c) => seen.push(c));
    await openConnection(connector);
    route(welcome());
    expect(seen.at(-1)).toEqual({ regenerate: false, editMessage: false });
  });

  it("a welcome advertising them switches them on, and a later welcome can switch them off", async () => {
    const { connector, route } = makeConnector();
    const seen: ConnectorCapabilities[] = [];
    connector.onCapabilities((c) => seen.push(c));
    await openConnection(connector);

    route(welcome({ capabilities: { regenerate: true, edit: true } }));
    expect(seen.at(-1)).toEqual({ regenerate: true, editMessage: true });

    route(welcome({ capabilities: { regenerate: true } }));
    expect(seen.at(-1)).toEqual({ regenerate: true, editMessage: false });
  });

  it("a handler registered after the welcome gets the current state", async () => {
    const { connector, route } = makeConnector();
    await openConnection(connector);
    route(welcome({ capabilities: { edit: true } }));
    const seen: ConnectorCapabilities[] = [];
    connector.onCapabilities((c) => seen.push(c));
    expect(seen).toEqual([{ regenerate: false, editMessage: true }]);
  });
});

describe("message actions — frames", () => {
  it("regenerate sends a regenerate frame", async () => {
    const { connector } = makeConnector();
    const ws = await openConnection(connector);
    await connector.regenerate("bot-7");
    expect(JSON.parse(ws.sent.at(-1)!)).toEqual({ type: "regenerate", messageId: "bot-7" });
  });

  it("editMessage sends an edit frame with the new data", async () => {
    const { connector } = makeConnector();
    const ws = await openConnection(connector);
    await connector.editMessage("u-3", { id: "u-3", type: "text", data: { text: "fixed" } });
    expect(JSON.parse(ws.sent.at(-1)!)).toEqual({ type: "edit", messageId: "u-3", data: { text: "fixed" } });
  });
});
