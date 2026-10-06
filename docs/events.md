# EventBus reference

`EventBus` is Chativa's typed pub/sub channel for **read-only** hooks: analytics, logging, observability, syncing your own UI with the widget. It lives in `@chativa/core` and is keyed by the `EventBusPayloadMap` interface, so every handler gets a correctly typed payload.

```ts
import { EventBus } from "@chativa/core";

const onSent = (msg) => analytics.track("chat_message_sent", { id: msg.id });

EventBus.on("message_sent", onSent);
EventBus.on("widget_opened", () => analytics.page("chat_opened"));

// later
EventBus.off("message_sent", onSent);
```

| Method | Description |
|---|---|
| `EventBus.on(event, handler)` | Subscribe. `handler` receives `EventBusPayloadMap[event]`. |
| `EventBus.off(event, handler)` | Unsubscribe — pass the same function reference you passed to `on`. |
| `EventBus.emit(event, payload)` | Fire an event. Chativa calls this internally; you normally don't. |
| `EventBus.clear()` | Remove every listener. Intended for tests only. |

The types are exported too: `EventBusEventName` (the union of event names) and `EventBusPayloadMap`.

> **EventBus or extension?** If you only need to **observe** what happens, use `EventBus` — there is no lifecycle to install and nothing you return can block or rewrite a message. If you need to **transform or drop** messages, write an [extension](./extensions.md) instead (`onBeforeSend` / `onAfterReceive`).

## Events

| Event | Payload | When it fires |
|---|---|---|
| `widget_opened` | `undefined` | The chat panel was opened — `chatStore.getState().open()`, or `toggle()` from a closed state (the launcher button, `ChativaContext.chat.open()`, …). |
| `widget_closed` | `undefined` | The chat panel was closed — `chatStore.getState().close()`, or `toggle()` from an open state. |
| `message_sent` | `OutgoingMessage` | `ChatEngine.send()` handed a message to the connector and `connector.sendMessage()` resolved. The payload is the message **after** the extension `onBeforeSend` pipeline; a message an extension blocked never fires this. |
| `message_received` | `IncomingMessage` | The connector delivered a message through `onMessage`, it passed the extension `onAfterReceive` pipeline, and it was added to `messageStore`. Streamed GenUI / text chunks (`onGenUIChunk`) and history pages do **not** fire this — see `genui_stream_*` and `history_loaded`. |
| `file_uploaded` | `{ name: string; size: number }` | `ChatEngine.sendFile()` finished `connector.sendFile()`. Fires once per file. Never fires for connectors without `sendFile`. |
| `connector_status_changed` | `{ status: ConnectorStatus }` | The engine changed the connection state: `"connecting"` on `init()` and each reconnect attempt, `"connected"` on success, `"disconnected"` when the connector reports a drop or on `destroy()`, `"error"` when `connect()` throws or the 3 reconnect attempts are exhausted. |
| `genui_stream_started` | `{ streamId: string }` | The first chunk of a GenUI stream arrived through `onGenUIChunk` (`text`, `ui` or `event`). |
| `genui_stream_completed` | `{ streamId: string }` | The connector sent a chunk with `done = true` (or the closing `stream_done` event). Every message the stream opened is closed at this point. |
| `history_loaded` | `{ count: number }` | `ChatEngine.loadHistory()` prepended a page of history — on connect for connectors that implement `loadHistory`, and on each "load more" scroll. `count` is the number of messages in that page. |
| `search_query_changed` | `{ query: string }` | The in-chat search query changed via `chatStore.getState().setSearchQuery()`. An empty string means search was cleared (`clearSearch()`, or `resetSession()` while a query was active). |
| `survey_submitted` | `SurveyPayload` | The user submitted the [end-of-conversation survey](./survey.md) and `ChatEngine.sendSurvey()` returned. Fires even if the connector has no `sendSurvey`. |
| `genui_components_registered` | `{ definitions: GenUIComponentDefinition[] }` | The connector announced server-defined GenUI components via `onGenUIComponents` and at least one was new. `definitions` holds only the newly published ones. |
| `tool_call_updated` | `ToolCall` | The connector reported a tool-call lifecycle update via `onToolCall` (upsert by `id`: `running` → `completed` / `error`). Fires for calls still in the live buffer and for calls already attached to a delivered message. |

`ConnectorStatus` is `"idle" | "connecting" | "connected" | "error" | "disconnected"`. `"idle"` is the store's initial value and is never emitted.

The payload types are all exported from `@chativa/core`: `OutgoingMessage` and `IncomingMessage` ([JSON Schemas](../schemas/messages)), `SurveyPayload`, `ToolCall`, `GenUIComponentDefinition`.

## Where to subscribe

- **Your app code** — `import { EventBus } from "@chativa/core"`. With the CDN build (`chativa.global.js`) core is bundled inside, so use `window.Chativa.EventBus` — a second copy of core would have its own, silent bus.
- **Inside a connector** — the `ChativaContext` that `ChatEngine` injects through `setContext()` exposes the same bus as `context.events`. Extensions import `EventBus` from `@chativa/core` like app code does.
- **React** — `@chativa/react` ships `useChativaEvent(event, handler)`, which subscribes for the component's lifetime. `<ChatIva>`'s `onMessage`, `onMessageSent`, `onConnect`, `onDisconnect`, `onSurveySubmit`, `onWidgetOpen` and `onWidgetClose` props are thin wrappers over the events above.

## Notes

- **Handlers run synchronously**, inside the code path that emitted the event. Keep them cheap and never throw — a throwing handler bubbles into the engine call that fired it. Defer heavy work (`queueMicrotask`, `requestIdleCallback`).
- **The bus is a module-level singleton.** In [multi-conversation](./multi-conversation.md) mode every conversation's engine emits on the same bus; correlate by message id if you need to tell them apart.
- **Don't emit Chativa's own events from app code** — listeners (including `@chativa/react`'s callbacks) would treat them as real.

The source of truth is [`packages/core/src/application/EventBus.ts`](../packages/core/src/application/EventBus.ts).
