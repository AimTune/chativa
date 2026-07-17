---
sidebar_position: 9
title: Rich frames (GenUI / HITL)
description: The shared JSON frame vocabulary — tool calls, Generative UI and human-in-the-loop chips work the same over WebSocket, SignalR, SSE, HTTP and Botiva.
---

# Rich frames — tool calls, GenUI and HITL over any connector

Tool-call traces, Generative UI and human-in-the-loop chips are **not transport features**. A `{ "type": "genui", ... }` frame means the same thing whether it arrives over a WebSocket, a SignalR hub, an SSE stream or an HTTP poll — so your backend speaks one dialect and you can swap transports without touching it.

Every JSON-frame connector — [WebSocket](./websocket.md), [SignalR](./signalr.md), [SSE](./sse.md), [HTTP](./http.md) and [Botiva](./botiva.md) — routes these frames through the same parser, [`parseChatFrame`](https://github.com/AimTune/chativa/blob/main/packages/core/src/domain/entities/ChatFrame.ts) in `@chativa/core`. There is one implementation of the rules, so the transports cannot drift apart.

> DirectLine is the exception: it speaks Bot Framework activities, not these frames, and maps them separately (see [DirectLine](./directline.md)).

## The frames

Send any of these to the client wherever your connector delivers messages — the WebSocket socket, the SignalR `receiveMethod`, an SSE `data:` line, or an item in an HTTP poll batch.

| Frame | Direction | Effect |
|---|---|---|
| `{ type: "tool_call", data: {...} }` | server → client | Tool activity row. Re-send the same `id` to advance it. |
| `{ type: "genui", streamId, chunk, done }` | server → client | Streams a GenUI component into the bubble. |
| `{ type: "typing", isTyping }` | server → client | Typing indicator on/off. |
| `{ type: "text", actions: [...] }` | server → client | Bot question with chips — the HITL interrupt. |
| `{ type: "genui_event", streamId, eventType, payload }` | client → server | A mounted GenUI component fired an event. |

Anything else is passed through untouched as a normal message, so an existing backend that only sends plain messages keeps working exactly as before.

## Tool calls

A `tool_call` is a **lifecycle, not a log**: re-send the same `id` as the call progresses and Chativa upserts the row in place rather than appending a second one.

```json
{ "type": "tool_call", "data": { "id": "c1", "name": "get_weather", "status": "running", "params": { "city": "Ankara" } } }
{ "type": "tool_call", "data": { "id": "c1", "name": "get_weather", "status": "completed", "result": "18°C" } }
```

`status` is `running` | `completed` | `error`. The payload may also be flattened onto the frame itself (`{ type: "tool_call", id: "c1", ... }`) — both shapes are accepted. A frame missing `id`, `name` or `status` is ignored rather than rendered as a half-built trace.

## Generative UI

A `genui` frame carries one [`AIChunk`](../genui/streaming.md) of the stream identified by `streamId`. Chunks accumulate into a single message bubble; `done: true` closes the stream.

```json
{ "type": "genui", "streamId": "s1", "chunk": { "type": "text", "content": "Here's the forecast:", "id": 1 }, "done": false }
{ "type": "genui", "streamId": "s1", "chunk": { "type": "ui", "component": "weather", "props": { "city": "Ankara", "temp": 18 }, "id": 2 }, "done": true }
```

`component` is looked up in the `GenUIRegistry`, so it must be registered on the client first — see [custom GenUI components](../genui/custom-component.md).

### Rendering GenUI from a SignalR hub

The hub pushes frames through the **same method it already uses for messages** (`receiveMethod`, default `ReceiveMessage`) — no new hub method, no client changes beyond registering the component:

```csharp
// C# hub — stream a GenUI component to one caller
await Clients.Caller.SendAsync("ReceiveMessage", new {
    type     = "genui",
    streamId = "s1",
    chunk    = new {
        type      = "ui",
        component = "weather",
        props     = new { city = "Ankara", temp = 18 },
        id        = 1
    },
    done     = true
});
```

On the client, register the component and the connector — nothing else:

```ts
import { GenUIRegistry } from "@chativa/genui";
import { SignalRConnector } from "@chativa/connector-signalr";
import { ConnectorRegistry, chatStore } from "@chativa/core";

GenUIRegistry.register("weather", "weather-card"); // your LitElement tag

ConnectorRegistry.register(new SignalRConnector({ url: "https://my-server/chathub" }));
chatStore.getState().setConnector("signalr");
```

Stream it in pieces by sending several frames with the same `streamId`, ending with `done: true`.

### Events back from a component

When a mounted component fires an event (a form submit, a card action), Chativa sends it back as a `genui_event` frame. Where it goes depends on the transport:

| Connector | Component event travels as |
|---|---|
| WebSocket / Botiva | A `genui_event` frame on the socket |
| SignalR | An invoke of `genUIEventMethod` (default `SendGenUIEvent`) with the frame |
| SSE | `POST` of the frame to `sendUrl` (the stream is receive-only) |
| HTTP | `POST` of the frame to `{url}/messages` |

```csharp
// C# hub — receive the component event
public Task SendGenUIEvent(GenUIEvent frame) {
    // frame.streamId, frame.eventType, frame.payload
    return Task.CompletedTask;
}
```

## Human-in-the-loop

HITL is a bot **question with chips**. Send a `text` frame carrying `actions`, and the connector maps it to Chativa's native quick-reply so the chips render without a custom component:

```json
{
  "type": "text",
  "id": "m1",
  "from": "bot",
  "data": { "text": "Deploy to production?" },
  "actions": [{ "label": "Approve" }, { "label": "Cancel", "value": "reject" }]
}
```

Tapping a chip sends its `value` (falling back to `label`) as an ordinary user message — which is how a paused run gets resumed. Your backend doesn't need a special resume channel; it just reads the next user message.

The chips stay visible after the tap, so the transcript still reads as a record of what was asked and answered.

Two rules worth knowing:

- **`from: "user"` frames are never remapped.** Those are the replay or multi-tab fan-out of the user's *own* message; re-offering the chips there would invite answering the same question twice.
- **An empty `actions` array is left alone** — it renders as a plain text bubble.

### The full HITL round trip

```
1. user: "Deploy the release"
2. server → { type: "run",  data: { status: "started" } }      (typing on, Botiva)
   or     → { type: "typing", isTyping: true }                  (other connectors)
3. server → { type: "tool_call", data: { id: "c1", name: "deploy", status: "running" } }
4. server → { type: "text", data: { text: "Deploy to production?" },
              actions: [{ label: "Approve" }, { label: "Cancel" }] }   ← run pauses
5. user taps "Approve"  →  client sends it as a normal user message
6. server resumes the run, finishes the tool
   server → { type: "tool_call", data: { id: "c1", name: "deploy", status: "completed" } }
   server → { type: "text", data: { text: "Deployed ✅" } }
```

Step 4 is the only unusual part, and it's just a text frame with `actions`.

## Typing

```json
{ "type": "typing", "isTyping": true }
```

Botiva servers use their own `run` lifecycle frame instead (`{ type: "run", data: { status: "started" } }`) — see [Botiva](./botiva.md).

## Trying it without a backend

The [`DummyConnector`](./dummy.md) replays a scripted GenUI stream and tool-call lifecycle locally, which is the fastest way to see the rendering before wiring a server.
