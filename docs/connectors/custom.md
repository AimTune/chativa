# Writing a custom connector

A connector is a class that implements [`IConnector`](../../packages/core/src/domain/ports/IConnector.ts). It owns the connection lifecycle and translates between your wire format and Chativa's `IncomingMessage` / `OutgoingMessage` shape.

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
| `onToolCall(cb)` | Tool-call activity rows (upserted by `id`). |
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

## Handling tool calls, GenUI and HITL

If your backend speaks JSON, **don't hand-roll these rules** — reuse the parser the built-in connectors use. Tool-call traces, GenUI streams and human-in-the-loop chips are the same frames on every transport, so `parseChatFrame` classifies one decoded payload and you decide what to do with it. See [Rich frames](./frames.md) for the wire format itself.

```ts
import type {
  IConnector,
  IncomingMessage,
  MessageHandler,
  TypingHandler,
  ToolCallHandler,
  GenUIChunkHandler,
} from "@chativa/core";
import { parseChatFrame, createGenUIEventFrame } from "@chativa/core/frames";

export class MyConnector implements IConnector {
  readonly name = "my-api";

  private messageHandler: MessageHandler | null = null;
  private typingHandler: TypingHandler | null = null;
  private toolCallHandler: ToolCallHandler | null = null;
  private genUIChunkHandler: GenUIChunkHandler | null = null;

  /** Call this for every payload your transport delivers. */
  private handlePayload(data: unknown): void {
    if (this.routeFrame(data)) return;
    this.messageHandler?.(data as IncomingMessage); // your own handling
  }

  /** Returns true when the frame was handled and is not a chat message. */
  private routeFrame(data: unknown): boolean {
    const frame = parseChatFrame(data, { idPrefix: this.name });
    switch (frame.kind) {
      case "tool_call":
        this.toolCallHandler?.(frame.toolCall);
        return true;
      case "genui":
        this.genUIChunkHandler?.(frame.streamId, frame.chunk, frame.done);
        return true;
      case "typing":
        this.typingHandler?.(frame.isTyping);
        return true;
      case "quick_reply":
        this.messageHandler?.(frame.message);
        return true;
      case "other":
        return false; // not a rich frame — your connector decides
    }
  }

  onTyping(cb: TypingHandler): void { this.typingHandler = cb; }
  onToolCall(cb: ToolCallHandler): void { this.toolCallHandler = cb; }
  onGenUIChunk(cb: GenUIChunkHandler): void { this.genUIChunkHandler = cb; }

  /** The outbound half: a mounted component fired an event. */
  receiveComponentEvent(streamId: string, eventType: string, payload: unknown): void {
    void fetch("/api/chat/genui-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createGenUIEventFrame(streamId, eventType, payload)),
    }).catch(() => {}); // fire-and-forget: a UI event must not block the chat
  }
}
```

That's the whole integration — the four `case` arms are all a connector adds. Anything the parser doesn't recognise comes back as `other`, so your existing message handling stays untouched.

> **Import from `@chativa/core/frames`, not `@chativa/core`.** The subpath is a pure, dependency-free module. The package root pulls in the store, i18n and the Lit elements: importing `parseChatFrame` from there inflated a connector's standalone CDN bundle from **2.4 kB to 64 kB**. Type-only imports (`import type { ... } from "@chativa/core"`) stay on the root — those are erased at compile time and cost nothing.

Two bits of plumbing that go with the value import:

```ts
// tsconfig.json — resolve the subpath from source
{ "compilerOptions": { "paths": {
  "@chativa/core":        ["../core/src/index.ts"],
  "@chativa/core/frames": ["../core/src/frames.ts"]
} } }
```

```ts
// vite.config.ts — externalise every @chativa/core subpath, not just the root
export default defineConfig({
  build: { rollupOptions: { external: [/^@chativa\/core/] } },
});
```

In `vitest.config.ts`, alias the subpath **before** the bare package name (array form, which preserves order) so tests exercise core's source instead of a stale `dist`:

```ts
resolve: {
  alias: [
    { find: "@chativa/core/frames", replacement: path.resolve(__dirname, "../core/src/frames.ts") },
    { find: "@chativa/core",        replacement: path.resolve(__dirname, "../core/src/index.ts") },
  ],
},
```

### If your backend doesn't speak these frames

Map your own wire format onto the same handlers — the parser is a convenience, not a requirement. The handlers are the actual contract:

```ts
// Your backend's shape → Chativa's tool-call lifecycle
if (payload.event === "function_started") {
  this.toolCallHandler?.({ id: payload.callId, name: payload.fn, status: "running", params: payload.args });
}
if (payload.event === "function_done") {
  // Same id as "running" → the row is upserted in place, not appended.
  this.toolCallHandler?.({ id: payload.callId, name: payload.fn, status: "completed", result: payload.output });
}

// Your backend's suggestions → native HITL chips
if (payload.suggestions?.length) {
  this.messageHandler?.({
    id: payload.id,
    type: "quick-reply",
    data: {
      text: payload.text,
      actions: payload.suggestions.map((s) => ({ label: s.title, value: s.payload })),
      keepActions: true, // leave the chips visible after the tap
    },
  });
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

`ChativaContext` is a curated facade — it doesn't leak the raw stores. See [`packages/core/src/application/ChativaContext.ts`](../../packages/core/src/application/ChativaContext.ts).

## Checklist for a publishable connector

1. Class in `packages/connector-<name>/src/<Name>Connector.ts`, exported from `index.ts`.
2. `Options` interface exported alongside the class.
3. Schema in `schemas/connectors/<name>.schema.json` matching the options 1:1.
4. Tests in `src/__tests__/<Name>Connector.test.ts` (use the registry tests as templates).
5. Doc page under `docs/connectors/<name>.md` (this folder).
6. Row added to the capability matrix in [overview.md](./overview.md).
7. If it speaks JSON: route payloads through `parseChatFrame` rather than re-deriving the rules, importing it from `@chativa/core/frames`.

See the [AGENTS.md](../../AGENTS.md) for the full conventions.
