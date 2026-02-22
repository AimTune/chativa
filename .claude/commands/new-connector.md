# New Connector Scaffold

Create a new Chativa connector. The argument is the connector name in PascalCase (e.g. `MyApi`).

Usage: `/new-connector MyApi`

---

Given the connector name `$ARGUMENTS`, do the following steps **in order**:

## Step 1 — Create the connector file

Create `src/infrastructure/connectors/$ARGUMENTS_Connector.ts` implementing `IConnector`:

```ts
import type {
  IConnector,
  MessageHandler,
  ConnectHandler,
  DisconnectHandler,
} from "../../domain/ports/IConnector";
import type { OutgoingMessage } from "../../domain/entities/Message";

export interface $ARGUMENTS_ConnectorOptions {
  // Add your connection options here
}

export class $ARGUMENTS_Connector implements IConnector {
  readonly name = "$ARGUMENTS_lowercase";
  readonly addSentToHistory = true;

  private messageHandler: MessageHandler | null = null;
  private connectHandler: ConnectHandler | null = null;
  private disconnectHandler: DisconnectHandler | null = null;

  constructor(private options: $ARGUMENTS_ConnectorOptions) {}

  async connect(): Promise<void> {
    // TODO: establish connection
    this.connectHandler?.();
  }

  async disconnect(): Promise<void> {
    // TODO: teardown
    this.disconnectHandler?.("manual disconnect");
  }

  async sendMessage(message: OutgoingMessage): Promise<void> {
    // TODO: send message.data to your backend
    void message;
  }

  onMessage(callback: MessageHandler): void {
    this.messageHandler = callback;
  }

  onConnect(callback: ConnectHandler): void {
    this.connectHandler = callback;
  }

  onDisconnect(callback: DisconnectHandler): void {
    this.disconnectHandler = callback;
  }

  /** Helper: simulate an incoming message (useful for testing). */
  simulateIncoming(text: string): void {
    this.messageHandler?.({
      id: `sim-${Date.now()}`,
      type: "text",
      data: { text },
      timestamp: Date.now(),
    });
  }
}
```

## Step 2 — Create the test file

Create `src/infrastructure/connectors/__tests__/$ARGUMENTS_Connector.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { $ARGUMENTS_Connector } from "../$ARGUMENTS_Connector";

describe("$ARGUMENTS_Connector", () => {
  let connector: $ARGUMENTS_Connector;

  beforeEach(() => {
    connector = new $ARGUMENTS_Connector({});
  });

  it("has the correct name", () => {
    expect(connector.name).toBe("$ARGUMENTS_lowercase");
  });

  it("connects without throwing", async () => {
    await expect(connector.connect()).resolves.toBeUndefined();
  });

  it("disconnects without throwing", async () => {
    await connector.connect();
    await expect(connector.disconnect()).resolves.toBeUndefined();
  });

  it("registers a message handler and delivers messages", async () => {
    await connector.connect();
    const handler = vi.fn();
    connector.onMessage(handler);
    connector.simulateIncoming("hello");
    await vi.waitFor(() => expect(handler).toHaveBeenCalledOnce());
    expect(handler.mock.calls[0][0]).toMatchObject({
      type: "text",
      data: { text: "hello" },
    });
  });

  it("calls onConnect callback when connected", async () => {
    const cb = vi.fn();
    connector.onConnect(cb);
    await connector.connect();
    expect(cb).toHaveBeenCalledOnce();
  });

  it("calls onDisconnect callback when disconnected", async () => {
    const cb = vi.fn();
    connector.onDisconnect(cb);
    await connector.connect();
    await connector.disconnect();
    expect(cb).toHaveBeenCalledOnce();
  });
});
```

## Step 3 — Register the export

Open `src/index.ts` (or create it if missing) and add:
```ts
export { $ARGUMENTS_Connector } from "./infrastructure/connectors/$ARGUMENTS_Connector";
```

## Step 4 — Update README

Add a section under "Connectors" in `README.md` documenting the new connector.

## Step 5 — Run tests

Run `npm test` and make sure the new tests pass.
