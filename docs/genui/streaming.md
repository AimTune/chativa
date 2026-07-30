# GenUI Streaming Protocol

A connector advertises GenUI support by implementing `onGenUIChunk(callback)`. The engine then renders any chunks the connector emits as a single synthetic `genui` message.

## The chunk types

```ts
type AIChunk =
  | { type: "text";  content: string;       id: number; }
  | { type: "ui";    component: string;     props: Record<string, unknown>; id: number; }
  | { type: "event"; name: string;          payload?: unknown; id: number; for?: number; };
```

Schema: [`schemas/genui/ai-chunk.schema.json`](../../schemas/genui/ai-chunk.schema.json).

| Chunk | Behaviour |
|---|---|
| `text` | Appends a Markdown line. Useful for "intro text" before a component. |
| `ui` | Mounts a registered component. `component` is the name in `GenUIRegistry`. `id` becomes the component's identity within this stream — re-send the same id to [update it in place](#updating-a-component-in-place). |
| `event` | Sent by the bot to update an already-mounted component. If `for` is set, only the component with that `id` receives it. Otherwise it's broadcast to all listeners in the message bubble. |

## Updating a component in place

`id` is the component's identity within the stream, and re-sending a `ui` chunk
under an id already on screen **replaces** it — same element, new props. That is
how a progress bar advances, a form flips to its success state, or an order card
moves from *Preparing* to *Delivered* without stacking three cards in the bubble.

```ts
// one element, three renders
onChunk({ type: "ui", component: "order-card", id: "card-1", props: { status: "Preparing" } });
onChunk({ type: "ui", component: "order-card", id: "card-1", props: { status: "In transit" } });
onChunk({ type: "ui", component: "order-card", id: "card-1", props: { status: "Delivered" } });
```

What the client does with that:

1. **ChatEngine** merges the chunk into the message's chunk list. A `ui` chunk
   whose id is already there overwrites that entry *in position*; a new id is
   appended. Event chunks always append — they are a log, not a thing on screen.
2. **GenUIMessage** keeps one element instance per chunk id and assigns the
   latest props to it, so the DOM node survives the update: focus, scroll
   position and internal component state stay put. Only what changed re-renders.
3. If an id is reused for a *different* `component`, the element is rebuilt at
   the same position rather than having another component's props assigned onto
   it.

### Two elements, interleaved

Ids are per stream, so distinct elements update independently and keep their
order of first appearance:

```
ui card-1  { status: "Preparing" }        → card mounted
ui card-1  { status: "In transit" }       → card updated
ui strip-1 { step: "Picked up" }          → strip mounted below it
ui strip-1 { step: "Out for delivery" }   → strip updated
```

Result: two elements, four renders. Not four elements.

### Pace it, or you won't see it

An update that arrives in the same millisecond as the mount is invisible — the
element simply appears in its final state. If you are demoing or debugging an
in-place update, put a real delay between the emissions on the server; the
client has no animation of its own to slow it down.

### Ids and pauses

If your backend pauses mid-turn for a human (mekik's interrupts), keep two things
in mind:

- **Mounted components outlive the pause.** They stay on screen while the chips
  render, and the answer can update them — an approval that edits a widget
  already in the transcript.
- **Use explicit, stable ids across the pause.** A resume replays the node, so an
  id minted from a counter can drift; a literal like `"card-1"` cannot. In mekik,
  wrap the pre-pause emissions in `ctx.step` so the replay doesn't re-send states
  the user already watched.

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
