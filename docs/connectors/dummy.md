# DummyConnector

Local mock connector for development and tests. No network, no backend required. Implements **every** `IConnector` capability — including history pagination, GenUI streaming, multi-conversation, file upload, message status, and survey — so the sandbox can demo each feature in isolation.

```ts
import { DummyConnector } from "@chativa/connector-dummy";
import { ConnectorRegistry, chatStore } from "@chativa/core";

ConnectorRegistry.register(
  new DummyConnector({ replyDelay: 500, connectDelay: 2000 })
);
chatStore.getState().setConnector("dummy");
```

## Options

Schema: [`schemas/connectors/dummy.schema.json`](../../schemas/connectors/dummy.schema.json).

| Field | Default | Description |
|---|---|---|
| `name` | `"dummy"` | Override the connector identifier (lets you register multiple dummies side by side). |
| `replyDelay` | `500` | Milliseconds before the echo reply is returned after a message is sent. |
| `connectDelay` | `2000` | Milliseconds to wait before `connect()` resolves — simulates a real handshake. Set to `0` in tests. |
| `rules` | `[]` | Declarative response rules (`DummyRule[]`) — see [Scripted rules](#scripted-rules). |

The options object is exported as the `DummyConnectorOptions` type.

## Scripted rules

`rules` lets you script the dummy's replies without forking the connector — for backend-less demos, deterministic E2E fixtures, or showing a tailored flow before the real bot exists. Rules are plain data (pattern matching only, no executable code), so a rule set can live in a JSON config file.

```ts
import { DummyConnector, type DummyRule } from "@chativa/connector-dummy";
import { ConnectorRegistry } from "@chativa/core";

const rules: DummyRule[] = [
  {
    when: { textMatches: "^/(help|yardım)$" },
    then: {
      id: "help-menu",
      type: "buttons",
      from: "bot",
      data: {
        text: "How can I help?",
        buttons: [{ label: "Order status" }, { label: "Talk to a human" }],
      },
    },
  },
  {
    when: { textMatches: "(cancel|iptal)" },
    then: {
      kind: "genui",
      chunks: [
        { type: "text", content: "Sorry to see you go — which order?", id: 1 },
        {
          type: "ui",
          component: "genui-form",
          props: { title: "Cancel order", fields: [{ name: "order", label: "Order number", type: "text" }] },
          id: 2,
        },
      ],
    },
    delay: 300,
  },
];

ConnectorRegistry.register(new DummyConnector({ replyDelay: 500, rules }));
```

### `DummyRule`

| Field | Type | Description |
|---|---|---|
| `when.type` | `string?` | Matches the outgoing message `type` exactly (e.g. `"text"`). |
| `when.textMatches` | `string?` | Regular-expression **source** (no slashes, no flags) tested against `data.text`. |
| `then` | `IncomingMessage` \| `{ kind: "genui"; chunks: AIChunk[] }` | A static message delivered through `onMessage`, or a GenUI chunk script (`DummyGenUIResponse`) streamed through `onGenUIChunk`. |
| `delay` | `number?` | Milliseconds before `then` is emitted. Defaults to `replyDelay`. |

### Matching

- Rules are evaluated **in order** against every message you send; the **first match wins**.
- Every `when` field that is set must match (logical AND). An empty `when: {}` matches every message.
- No match falls through to the built-in slash commands below and then to the default echo.
- Rules run **before** the built-in demo commands (`/genui`, `/tools`, …), so a rule can override them. `/disconnect` is the exception — it is handled first so a catch-all rule can't lock you out of it.
- A `textMatches` that is not a valid regular expression doesn't throw: that rule is skipped and a `console.warn` names its index.
- A GenUI rule is skipped (falls through) while no `onGenUIChunk` handler is registered.

### What gets emitted

- **Message rules** — the `then` message is deep-copied, gets a `timestamp` if it has none, and keeps its `id` on the first emission. Later emissions of the same rule (or a template without an `id`) get a fresh unique id, so repeated matches never collide.
- **GenUI rules** — every chunk is delivered in order under a fresh stream id per emission; the last chunk is flagged `done`.
- Both behave like the echo reply: the typing indicator shows during the delay and the user's message flips to **read** when the reply lands.

The rule set an instance was built with is readable through the `rules` getter. Rules are fixed at construction — to change them, build a new `DummyConnector` and register it (that is what the sandbox **Rules** tab does).

## Demo helpers

`DummyConnector` exposes a few non-`IConnector` helpers for sandbox demos:

| Method | Purpose |
|---|---|
| `injectMessage(msg)` | Push a bot message directly into the UI without going through the extension pipeline. |
| `triggerGenUI(name)` | Fire one of the demo streams: `weather`, `form`, `alert`, `quick-replies`, `list`, `table`, `rating`, `progress`, `date-picker`, `chart`, `steps`, `image-gallery`. |

Both helpers keep working when `rules` are configured — rules only apply to messages the user sends.

## Built-in slash commands recognised by the connector

A matching [rule](#scripted-rules) takes precedence over every command here except `/disconnect`.

| Input | Effect |
|---|---|
| `/disconnect` | Calls `disconnect()` — useful for testing reconnect flows. |
| `/genui` | Triggers the multi-component demo stream (text + card + form + event). |
| `/genui-weather` | Streams a custom `weather` GenUI component (registered in the sandbox). |
| `/genui-form` | Streams an appointment form. |
