---
sidebar_position: 2
title: Streaming protocol
description: AIChunk — text, ui, event chunks. How connectors emit streams and how component events round-trip back.
---

# GenUI streaming protocol

A connector advertises GenUI support by implementing `onGenUIChunk(callback)`. The engine then renders any chunks the connector emits as a single synthetic `genui` message.

## The chunk types

```ts
type AIChunk =
  | { type: "text";  content: string;       id: number; }
  | { type: "ui";    component: string;     props: Record<string, unknown>; id: number; }
  | { type: "event"; name: string;          payload: unknown; id: number; for?: number; };
```

Schema: [`schemas/genui/ai-chunk.schema.json`](https://github.com/AimTune/chativa/blob/main/schemas/genui/ai-chunk.schema.json).

| Chunk | Behaviour |
|---|---|
| `text` | Appends a Markdown line. Useful for "intro text" before a component. |
| `ui` | Mounts a registered component. `component` is the name in `GenUIRegistry`. `id` becomes the component's identity within this stream. |
| `event` | Sent by the bot to update an already-mounted component. If `for` is set, only the component with that `id` receives it. Otherwise it's broadcast to all listeners in the message bubble. |

## Emitting chunks from a connector

```ts
import type { IConnector, GenUIChunkHandler, AIChunk } from "@chativa/core";

class MyAIConnector implements IConnector {
  // ...required methods...

  private genUICallback: GenUIChunkHandler | null = null;

  onGenUIChunk(callback: GenUIChunkHandler): void {
    this.genUICallback = callback;
  }

  private async streamAnswer(streamId: string) {
    const cb = this.genUICallback!;
    cb(streamId, { type: "text", content: "Here are your options:", id: 1 }, false);

    cb(streamId, {
      type: "ui",
      component: "genui-card",
      props: { title: "Pro Plan", description: "Unlimited" },
      id: 2,
    }, false);

    // … later, after the user submits the form …
    cb(streamId, { type: "event", name: "form_success", payload: { code: "OK" }, id: 3, for: 2 }, true);
  }
}
```

`done = true` flips the message's `streamingComplete` flag. Components can use that to swap a "submitting…" state for a final success view.

## SSE / fetch helper

For OpenAI-style or LangChain-style streaming endpoints, `@chativa/genui` ships a tiny helper:

```ts
import { streamFromFetch } from "@chativa/genui";

await streamFromFetch("/api/chat/stream", (chunk: AIChunk) => {
  this.genUICallback?.(streamId, chunk, false);
});
```

It expects a `text/event-stream` body where each `data:` line is one JSON-encoded `AIChunk`.

## Receiving events back from a component

When a registered component fires `sendEvent(name, payload)` (for example `form_submit`), the engine routes it to the connector via `receiveComponentEvent`:

```ts
class MyAIConnector implements IConnector {
  receiveComponentEvent(streamId: string, eventType: string, payload: unknown): void {
    if (eventType === "form_submit") {
      this.persistFormSubmission(payload).then((code) => {
        this.genUICallback?.(streamId, {
          type: "event",
          name: "form_success",
          payload: { code },
          id: 99,
          for: 2,                  // target the form by its chunk id
        }, true);
      });
    }
  }
}
```

This round-trip pattern is how built-in components like `genui-form` and `genui-rating` close the loop.
