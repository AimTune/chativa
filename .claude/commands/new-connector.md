---
description: Scaffold a new Chativa connector as its own monorepo package under packages/connector-[name]/, including its schema, tests and doc pages.
argument-hint: <PascalCase name, e.g. MyApi>
---

# New Connector Scaffold

Create a new Chativa connector. The argument is the connector name in PascalCase.

Usage: `/new-connector MyApi`

**Done means all seven steps.** The package, its schema, its tests **and its documentation** — a connector that isn't in the docs and the capability matrix is invisible to everyone but its author. Don't stop at a green `pnpm test`.

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

Optional capabilities (`sendFile`, `loadHistory`, `onMessageStatus`, `sendFeedback`, `onTyping`, `onToolCall`, `onGenUIChunk`, `receiveComponentEvent`) are feature-detected by `ChatEngine` — only implement what you need.

### Rich frames — tool calls, GenUI, typing and HITL

If the connector speaks JSON, **do not re-derive these rules**. They are identical on every transport and live in exactly one place: `parseChatFrame` in `@chativa/core/frames`. Mirror `packages/connector-websocket/src/WebSocketConnector.ts` — it is the reference implementation.

```ts
import type { IncomingMessage, TypingHandler, ToolCallHandler, GenUIChunkHandler } from "@chativa/core";
// Value import — from the `frames` subpath, NOT the package root (see the rule below).
import { parseChatFrame, createGenUIEventFrame } from "@chativa/core/frames";

/** Returns true when the frame was handled and is not a chat message. */
private routeFrame(data: unknown): boolean {
  const frame = parseChatFrame(data, { idPrefix: "[name]" });
  switch (frame.kind) {
    case "tool_call":   this.toolCallHandler?.(frame.toolCall); return true;
    case "genui":       this.genUIChunkHandler?.(frame.streamId, frame.chunk, frame.done); return true;
    case "typing":      this.typingHandler?.(frame.isTyping); return true;
    case "quick_reply": this.messageHandler?.(frame.message); return true;
    case "other":       return false; // not a rich frame — the connector decides
  }
}
```

Call it from wherever payloads arrive, falling through to the connector's own handling:

```ts
if (this.routeFrame(data)) return;
this.messageHandler?.(data as IncomingMessage);
```

The outbound half is `receiveComponentEvent`, sending `createGenUIEventFrame(streamId, eventType, payload)` over the transport (fire-and-forget — a UI event must not block the chat).

**Import rule — this one bites.** Value imports must come from `@chativa/core/frames`, never `@chativa/core`. The subpath is pure and dependency-free (~1 kB); the package root drags in the store, i18n and Lit, which inflated a connector's standalone CDN bundle from **2.4 kB to 64 kB**. `import type { … } from "@chativa/core"` stays on the root — types are erased and cost nothing.

Two bits of plumbing go with a value import (both already done for existing connectors — copy them):

- `tsconfig.json` → add `"@chativa/core/frames": ["../core/src/frames.ts"]` next to the `@chativa/core` path.
- `vite.config.ts` → `external: [/^@chativa\/core/]` (a regex, so subpaths are externalised too — a plain `"@chativa/core"` string does **not** match `@chativa/core/frames`).
- `vitest.config.ts` → alias `@chativa/core/frames` **before** `@chativa/core`, using the array form so order is preserved. Without this, tests silently run against core's prebuilt `dist` instead of its source.

Only skip `parseChatFrame` when the backend's wire format isn't Chativa's JSON frames (e.g. DirectLine activities). Then map your own format onto the same handlers by hand — see `docs/connectors/custom.md`.

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

## Step 6 — Documentation (not optional)

A connector nobody can find is unfinished. Docs live in **two parallel trees** and both must be updated in the same change — `docs/` is the in-repo copy, `website/docs/` is the published Docusaurus site. Read `docs/connectors/websocket.md` and its `website/` twin first; they are the shortest complete example.

### 6a. The page — `docs/connectors/[name].md`

Mirror the structure the other connector pages use:

```md
# $ARGUMENTS_Connector

One-paragraph summary: what backend it adapts, and the one reason you'd pick it.

​```ts
import { $ARGUMENTS_Connector } from "@chativa/connector-[name]";
import { ConnectorRegistry, chatStore } from "@chativa/core";

ConnectorRegistry.register(new $ARGUMENTS_Connector({ /* … */ }));
chatStore.getState().setConnector("[name]");
​```

> **Tool calls, GenUI and human-in-the-loop chips** work over this connector via the shared JSON frame vocabulary — see [Rich frames](./frames.md).   ← only if it routes rich frames

## Options

Schema: [`schemas/connectors/[name].schema.json`](../../schemas/connectors/[name].schema.json).

| Field | Default | Description |
|---|---|---|
| `url` _(required)_ | — | … |

## Wire format

### Inbound (server → client)   — a real JSON example
### Outbound (client → server)  — a real JSON example

## Server example

A short, runnable server snippet in whatever language that backend speaks.

## Limitations

What it deliberately doesn't implement, and where to go instead.
```

Rules that matter:

- **Every claim must be true of the code you just wrote.** Don't copy a "Limitations" list from a sibling — say what *this* connector doesn't implement. A stale capability claim is worse than no doc.
- Examples must be real: option names as typed in the `Options` interface, JSON shaped as the connector actually parses it.

### 6b. The website twin — `website/docs/connectors/[name].md`

Same body, with exactly two differences:

1. **Frontmatter** on top (`sidebar_position` must be unique — bump the pages that come after it, and keep the numbers in step with the order in `website/sidebars.ts`):

```md
---
sidebar_position: <n>
title: <Short name>
description: <One line — shown in search results and cards.>
---
```

2. **Repo-relative links become GitHub URLs**, because the site isn't served from the repo: `](../../X)` → `](https://github.com/AimTune/chativa/blob/main/X)`. Sibling page links (`./frames.md`) stay relative.

### 6c. Register the page everywhere it's indexed

- `website/sidebars.ts` — add `"connectors/[name]"` to the Connectors category, in the same order as the `sidebar_position` values.
- `docs/connectors/overview.md` **and** `website/docs/connectors/overview.md`:
  - a row in the **Built-in connectors** table;
  - a **column** in the capability matrix. This is a column, not a row — every existing row needs a new cell, and the header separator (`|:-:|`) needs one more too. Tick **only** what the class actually implements; leave the rest blank.
- Root `README.md` — **two** places: the connector list in the "Pluggable connectors" capability row, and the `packages/` tree under "Monorepo layout".
- `schemas/README.md` — the schema row (Step 5).

Grep before you declare this done — `grep -ril "[name]" README.md docs/ website/ schemas/` should hit every index above. It's the cheapest way to catch the one you forgot.

## Step 7 — Verify

1. Run `pnpm install` from the repo root if this is a brand-new package (so pnpm picks up the workspace member).
2. Run `pnpm --filter @chativa/connector-[name] typecheck` and `pnpm --filter @chativa/connector-[name] test`.
3. Run `pnpm -r --filter './packages/**' build` to confirm the workspace builds end-to-end.
4. If the connector imports from `@chativa/core/frames`, check the CDN bundle size in the build output — a connector's `*.global.js` should be a few kB. Tens of kB means core leaked in through a root import.
5. Build the site — `pnpm --dir website build`. It fails loudly on a bad sidebar id and lists broken links. Ignore the pre-existing `-> linking to /sandbox` warnings (they appear on every page); anything else pointing at your new page is yours.
