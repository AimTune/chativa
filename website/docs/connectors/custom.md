---
sidebar_position: 8
title: Custom
description: Write your own connector — the IConnector contract, optional capability hooks, and the publishing checklist.
---

# Writing a custom connector

A connector is a class that implements [`IConnector`](https://github.com/AimTune/chativa/blob/main/packages/core/src/domain/ports/IConnector.ts). It owns the connection lifecycle and translates between your wire format and Chativa's `IncomingMessage` / `OutgoingMessage` shape.

## Minimal connector

```ts
import type {
  IConnector,
  MessageHandler,
  OutgoingMessage,
  IncomingMessage,
} from "@chativa/core";

export class MyConnector implements IConnector {
  readonly name = "my-api";
  readonly addSentToHistory = true;

  private messageHandler: MessageHandler | null = null;

  async connect(): Promise<void>    { /* open connection */ }
  async disconnect(): Promise<void> { /* close connection */ }

  async sendMessage(msg: OutgoingMessage): Promise<void> {
    await fetch("/api/chat", { method: "POST", body: JSON.stringify(msg) });
  }

  onMessage(callback: MessageHandler): void {
    this.messageHandler = callback;
  }
}
```

That's enough to send and receive text. Register it the same way as built-ins:

```ts
ConnectorRegistry.register(new MyConnector());
chatStore.getState().setConnector("my-api");
```

## Adding optional capabilities

Each optional method automatically advertises a feature to the widget:

| Implement | Unlocks |
|---|---|
| `onConnect` / `onDisconnect` | Lifecycle callbacks (engine wires reconnect). |
| `onTyping(cb)` | Typing indicator in the chat panel. |
| `sendFile(file)` | File-upload button in the chat input. |
| `loadHistory(cursor)` | Scroll-to-top pagination. |
| `onMessageStatus(cb)` | Sending / sent / read tick indicators. |
| `sendFeedback(id, "like" \| "dislike")` | Like/dislike on bot messages. |
| `sendSurvey(payload)` | End-of-conversation survey. |
| `onGenUIChunk(cb)` | Streaming GenUI components. |
| `receiveComponentEvent(streamId, name, payload)` | Echo GenUI events back to the bot. |
| `listConversations` / `createConversation` / `switchConversation` / `closeConversation` / `onConversationUpdate` | Multi-conversation mode. |

```ts
import type {
  IConnector,
  MessageHandler,
  HistoryResult,
  SurveyPayload,
  GenUIChunkHandler,
} from "@chativa/core";

export class MyConnector implements IConnector {
  readonly name = "my-api";
  readonly addSentToHistory = true;

  // ...required methods...

  async sendFile(file: File): Promise<void> {
    const form = new FormData();
    form.append("file", file);
    await fetch("/api/upload", { method: "POST", body: form });
  }

  async loadHistory(cursor?: string): Promise<HistoryResult> {
    const res = await fetch(`/api/chat/history?cursor=${cursor ?? ""}`);
    return res.json() as Promise<HistoryResult>;
  }

  onMessageStatus(cb: (id: string, status: "sent" | "read") => void): void {
    this.statusCallback = cb;
  }

  async sendSurvey(payload: SurveyPayload): Promise<void> {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  onGenUIChunk(cb: GenUIChunkHandler): void {
    this.genUICallback = cb;
    // Call cb(streamId, chunk, done) as chunks arrive from your backend.
  }
}
```

## Use `setContext` to read/write Chativa state from the connector

```ts
import type { IConnector, ChativaContext } from "@chativa/core";

export class MyConnector implements IConnector {
  readonly name = "my-api";
  private ctx: ChativaContext | null = null;

  setContext(ctx: ChativaContext): void {
    this.ctx = ctx;
  }

  async connect(): Promise<void> {
    // Now you can call: this.ctx?.messages.add(...), this.ctx?.theme.set(...),
    // this.ctx?.events.on("widget_opened", ...), etc.
  }
}
```

`ChativaContext` is a curated facade — it doesn't leak the raw stores. See [`packages/core/src/application/ChativaContext.ts`](https://github.com/AimTune/chativa/blob/main/packages/core/src/application/ChativaContext.ts).

## Checklist for a publishable connector

1. Class in `packages/connector-<name>/src/<Name>Connector.ts`, exported from `index.ts`.
2. `Options` interface exported alongside the class.
3. Schema in `schemas/connectors/<name>.schema.json` matching the options 1:1.
4. Tests in `src/__tests__/<Name>Connector.test.ts` (use the registry tests as templates).
5. Doc page under `website/docs/connectors/<name>.md` (this folder).
6. Row added to the capability matrix in [overview](./overview.md).

See [AGENTS.md](https://github.com/AimTune/chativa/blob/main/AGENTS.md) for the full conventions.

## Tip — use the scaffolder

The `/new-connector` slash command in [`.claude/commands/new-connector.md`](https://github.com/AimTune/chativa/blob/main/.claude/commands/new-connector.md) creates the package directory, package.json, vite/vitest configs, source file, and tests in one go. The [`chativa-scaffolder`](https://github.com/AimTune/chativa/blob/main/.claude/agents/chativa-scaffolder.md) Claude subagent does the same for AI-driven workflows.
