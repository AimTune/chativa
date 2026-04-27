---
description: Scaffold a new Chativa connector as its own monorepo package under packages/connector-[name]/.
argument-hint: <PascalCase name, e.g. MyApi>
---

# New Connector Scaffold

Create a new Chativa connector. The argument is the connector name in PascalCase.

Usage: `/new-connector MyApi`

> Mirror `packages/connector-dummy/` exactly for `package.json`, `tsconfig.json`, `vite.config.ts`, and `vitest.config.ts`. Those files are non-trivial and must match the rest of the monorepo or `pnpm -r build` will break.

---

Given the connector name `$ARGUMENTS` (PascalCase), use the lowercase form for `[name]` and the connector's `.name` property.

## Step 1 — Create the package directory

Create the package skeleton at `packages/connector-[name]/`. Read `packages/connector-dummy/` first and copy the structure:

```
packages/connector-[name]/
├── package.json          # rename to @chativa/connector-[name]
├── tsconfig.json         # extends ../../tsconfig.base.json + paths to @chativa/core
├── vite.config.ts        # lib build, externals @chativa/core
├── vite.config.cdn.ts    # CDN bundle (only if needed)
├── vitest.config.ts
└── src/
    ├── index.ts
    └── $ARGUMENTS_Connector.ts
```

`package.json` highlights to update from the template:
- `"name": "@chativa/connector-[name]"`
- `"description"` — one line
- `"keywords"` — include `chativa`, `chat`, `connector`, plus protocol-specific terms

## Step 2 — Implement the connector

Create `packages/connector-[name]/src/$ARGUMENTS_Connector.ts` implementing `IConnector` from `@chativa/core`:

```ts
import type {
  IConnector,
  MessageHandler,
  ConnectHandler,
  DisconnectHandler,
  OutgoingMessage,
} from "@chativa/core";

export interface $ARGUMENTS_ConnectorOptions {
  // Connection options here.
}

export class $ARGUMENTS_Connector implements IConnector {
  readonly name = "[name]";
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
}
```

Optional capabilities (`sendFile`, `loadHistory`, `onMessageStatus`, `sendFeedback`, `onGenUIChunk`, `receiveComponentEvent`) are feature-detected by `ChatEngine` — only implement what you need.

## Step 3 — Tests

Create `packages/connector-[name]/src/__tests__/$ARGUMENTS_Connector.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { $ARGUMENTS_Connector } from "../$ARGUMENTS_Connector";

describe("$ARGUMENTS_Connector", () => {
  let connector: $ARGUMENTS_Connector;

  beforeEach(() => {
    connector = new $ARGUMENTS_Connector({} as never);
  });

  it("has the correct name", () => {
    expect(connector.name).toBe("[name]");
  });

  it("connects without throwing", async () => {
    await expect(connector.connect()).resolves.toBeUndefined();
  });

  it("disconnects without throwing", async () => {
    await connector.connect();
    await expect(connector.disconnect()).resolves.toBeUndefined();
  });

  it("calls onConnect callback when connected", async () => {
    const cb = vi.fn();
    connector.onConnect(cb);
    await connector.connect();
    expect(cb).toHaveBeenCalledOnce();
  });
});
```

## Step 4 — Re-export

`packages/connector-[name]/src/index.ts`:

```ts
export { $ARGUMENTS_Connector } from "./$ARGUMENTS_Connector";
export type { $ARGUMENTS_ConnectorOptions } from "./$ARGUMENTS_Connector";
```

## Step 5 — Schema pairing

Mirror `$ARGUMENTS_ConnectorOptions` in `schemas/connectors/[name].schema.json` (copy `schemas/connectors/dummy.schema.json` as a template). Add a row to `schemas/README.md`. Hand off to the `chativa-schema-sync` agent if non-trivial.

## Step 6 — Document and verify

1. Add the connector to the README under "Connectors".
2. Run `pnpm install` from the repo root if this is a brand-new package (so pnpm picks up the workspace member).
3. Run `pnpm --filter @chativa/connector-[name] typecheck` and `pnpm --filter @chativa/connector-[name] test`.
4. Run `pnpm -r --filter './packages/**' build` to confirm the workspace builds end-to-end.
