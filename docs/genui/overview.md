# Generative UI — Overview

`@chativa/genui` lets connectors **stream UI components** inline inside a chat message. The bot can decide _at generation time_ to render a form, a chart, a list, or your own custom widget — and Chativa builds it incrementally as chunks arrive.

| Topic | Page |
|---|---|
| The streaming protocol (`AIChunk`) | [streaming.md](./streaming.md) |
| Built-in components | [built-in.md](./built-in.md) |
| Register your own component | [custom-component.md](./custom-component.md) |

## Big picture

```
connector.onGenUIChunk(cb)
   ↓ chunks (text, ui, event)
ChatEngine assembles a synthetic { type: "genui", data: { streamId } } IncomingMessage
   ↓
GenUIMessage component renders the chunks in order, resolving each `ui` chunk via GenUIRegistry
   ↓
Components receive a GenUIComponentAPI injection (sendEvent, listenEvent, tFn, onLangChange)
```

A single GenUI message can mix Markdown text, several UI components, and event chunks that target a specific component (e.g. mark a form submission as successful).

## Why use it

- **Bot-driven UI without code deploys.** Add a new component to the registry once; bots can render it forever after.
- **Backed by the same connector you already use.** No extra transport.
- **Round-trippable.** Components can `sendEvent("form_submit", payload)` back to the connector via `IConnector.receiveComponentEvent`.
- **i18n-aware.** Components receive a `tFn` and `onLangChange` so they re-render with the right language.

## Example chunk stream

```ts
connector.genUICallback("stream-1", { type: "text", content: "Here is your weather:", id: 1 }, false);
connector.genUICallback("stream-1", {
  type: "ui",
  component: "weather",
  props: { city: "Istanbul", temp: 22, condition: "Partly Cloudy" },
  id: 2,
}, true);
```

The user sees a typing indicator, then a markdown line, then a weather card — all in the same message bubble.

## Where to start

- The DummyConnector ships with a dozen ready-made demo streams. Try `/genui-form`, `/genui-weather`, or open the GenUI section in the [sandbox](../sandbox.md).
- Read the [streaming protocol](./streaming.md) to wire your own backend.
- Skim the [built-in components](./built-in.md) to see what's available out of the box.
