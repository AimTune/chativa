---
sidebar_position: 2
title: Message actions
description: Copy, regenerate and edit-and-resend under chat messages, shown only when the connector and its backend support them, plus MessageActionRegistry for your own actions.
---

# Message actions

A small action bar sits under each message. It holds the built-in actions (copy, regenerate and edit) as icon buttons, and the actions you register yourself in a "⋮" (more actions) menu at its end. Like the [feedback buttons](./message-types/overview.md#feedback-buttons), `chat-message-list` renders it for every message type, so custom renderers and GenUI messages get it without implementing anything.

| Action | Appears on | What it does |
|---|---|---|
| **Copy** | Every bot message that has text (`data.text`) | Copies the message as plain text. Hold <kbd>Shift</kbd> while clicking to copy the raw Markdown instead. |
| **Copy code** | Each fenced code block in a bot text message | Copies the code inside the block. |
| **Copy tool input / output** | The Parameters, Result and Error sections of an expanded [tool-call card](#tool-call-cards) | Copies that section as shown: pretty-printed JSON, or the error text. |
| **Regenerate** | The last bubble of the latest bot reply | Removes the reply and asks the backend for a new one. |
| **Edit** | The latest user text message | Opens an inline editor. Saving replaces the message and re-runs the turn from it. |
| Custom | Wherever your action's `appliesTo` and `isVisible` allow | Calls your `execute()`. By default they sit in a "⋮" menu at the end of the bar. See [Custom actions](#custom-actions). |

The bar appears on hover and keyboard focus, like the feedback buttons. On touch devices it is always visible. Regenerate and edit are hidden while the bot is typing or a reply is still streaming.

## Layout

Under a bot message the row reads, from the start of the line to the end:

```text
╭───────────────────────────────╮
│ Here is the query you asked … │
╰───────────────────────────────╯
 👍 👎   ⧉  ↻  ✎   📌          ⋮
 ╰─┬─╯   ╰───┬───╯ ╰┬╯          ╰┬╯
 feedback  built-in  placement:   placement: "menu"
                     "inline"     (the default)
                                  ╭──────────────╮
                                  │ 📤 Share     │
                                  │ 🚩 Report    │
                                  │ 🌐 Translate │
                                  ╰──────────────╯
```

| Slot | Contents | Order |
|---|---|---|
| Feedback | Like / dislike, when the message allows feedback | Always first |
| Built-in | Copy, regenerate, edit, each only when it applies | After feedback |
| Inline | Custom actions with `placement: "inline"`, as icon buttons | After the built-in buttons, sorted by `order` |
| Menu | Custom actions with `placement: "menu"` (the default), listed with icon and label | The "⋮" button is always last |

The order uses logical directions, so in a right-to-left language the row mirrors: feedback on the right, "⋮" on the left. User messages have no feedback buttons; their row holds edit, then inline actions, then "⋮".

## Configuration

Set it under `theme.messageActions`. Every field is optional. The schema is [`schemas/theme.schema.json`](https://github.com/AimTune/chativa/blob/main/schemas/theme.schema.json) → `messageActions`.

```ts
import { chatStore } from "@chativa/core";

chatStore.getState().setTheme({
  messageActions: {
    copy: true,           // copy button on bot messages
    codeBlockCopy: true,  // copy button on code blocks and tool-call sections
    regenerate: true,     // regenerate, when the connector supports it
    edit: true,           // edit, when the connector supports it
    fallback: false,      // emulate regenerate / edit for connectors without them
  },
});
```

| Field | Default | Notes |
|---|---|---|
| `copy` | `true` | Copy button on bot messages with text. |
| `codeBlockCopy` | `true` | Copy button on each fenced code block (it appears once the text has finished streaming), and on the sections of tool-call cards. |
| `regenerate` | `true` | Shown only when the connector supports it. See below. |
| `edit` | `true` | Shown only when the connector supports it. See below. |
| `fallback` | `false` | Emulate regenerate and edit for connectors that don't implement them. See [Fallback](#fallback). |

## When regenerate and edit appear

Regenerate and edit change what the backend has stored, so the widget only offers them when the backend can actually do it. Two things decide this:

1. **The connector implements the method.** A connector advertises support by implementing `IConnector.regenerate(messageId)` or `IConnector.editMessage(messageId, message)`, the same way `sendFile` turns on the attach button.
2. **The backend allows it.** A connector can also implement `onCapabilities(callback)` and report what the server permits, for example from a handshake frame. A reported `false` hides the action even when the method exists, so a server can switch the action off per tenant or per conversation. Each report replaces the previous one, and the widget updates right away.

| Connector implements the method | Backend reports | `fallback: false` | `fallback: true` |
|---|---|---|---|
| yes | nothing, or `true` | shown, native | shown, native |
| yes | `false` | hidden | hidden |
| no | nothing, or `true` | hidden | shown, emulated |
| no | `false` | hidden | hidden |

A backend's `false` always wins. `fallback` never overrides it.

The resolved state is in `chatStore.getState().messageActionSupport`, as `{ regenerate, editMessage }`. Each value is `"supported"`, `"unsupported"` or `"denied"`.

### Fallback

With `fallback: true`, connectors that implement neither method still get both buttons:

- **Regenerate** removes the reply and sends the user's last message again as a new turn, under a fresh id.
- **Edit** removes the original message and the reply after it, then sends the edited text as a new message.

The server sees a new turn, not a replacement, so the earlier exchange stays in its history and context. Only turn this on when that is acceptable. Connectors with `addSentToHistory: false` (DirectLine) echo the re-sent message back, so the user's message appears twice.

## What happens on regenerate and edit

Both run in `ChatEngine` and work only on the **latest turn**: the last user message and the bot messages after it. If the latest turn is still being produced, nothing happens.

**Regenerate** removes every bot message of the latest reply, then calls `connector.regenerate(messageId)`, where `messageId` is the id of the bubble the user clicked. The new reply arrives through the usual `onMessage` / `onGenUIChunk` paths. Afterwards the engine emits `message_regenerated`.

**Edit** removes every message after the user's message, updates the bubble in place (it keeps its id and goes back to "sending"), then calls `connector.editMessage(messageId, message)`. `message` is the original id with the edited `data`, after your extensions' `onBeforeSend` hooks have run. If an extension blocks the message, nothing changes. Afterwards the engine emits `message_edited`.

You can trigger both from code. Each resolves to `false` when it did nothing (not supported, not the latest turn, or still streaming):

```ts
const ok = await engine.regenerate(botMessageId);
await engine.editMessage(userMessageId, "What about tomorrow?");
```

In the inline editor, <kbd>Enter</kbd> saves, <kbd>Shift</kbd>+<kbd>Enter</kbd> adds a new line, and <kbd>Escape</kbd> cancels without closing the chat.

## Supporting them in a connector

Implement the methods your backend supports. If the server decides at runtime, also implement `onCapabilities`:

```ts
import type {
  IConnector,
  OutgoingMessage,
  CapabilitiesHandler,
  ConnectorCapabilities,
} from "@chativa/core";

export class MyConnector implements IConnector {
  private capabilities: ConnectorCapabilities = {};
  private onCaps: CapabilitiesHandler | null = null;

  // ... connect / sendMessage / onMessage ...

  async regenerate(messageId: string): Promise<void> {
    await this.post("/regenerate", { messageId });
  }

  async editMessage(messageId: string, message: OutgoingMessage): Promise<void> {
    await this.post("/edit", { messageId, text: message.data.text });
  }

  onCapabilities(callback: CapabilitiesHandler): void {
    this.onCaps = callback;
    callback({ ...this.capabilities }); // replay what we already know
  }

  // e.g. called when the server's handshake arrives
  private handleHandshake(features: { regenerate: boolean; edit: boolean }) {
    this.capabilities = { regenerate: features.regenerate, editMessage: features.edit };
    this.onCaps?.({ ...this.capabilities });
  }
}
```

`ChatEngine` subscribes to `onCapabilities` during `init()`, before `connect()`. A connector that knows nothing yet can either report nothing (the methods it implements stay available) or report `false` until the server confirms. The [mekik connector](./connectors/mekik.md#regenerate-and-edit) does the latter.

Built-in support:

| Connector | Regenerate / edit |
|---|---|
| [Dummy](./connectors/dummy.md) | Both. The `capabilities` option and `setCapabilities()` simulate a server turning them off. |
| [Mekik](./connectors/mekik.md#regenerate-and-edit) | Both, once the server's `welcome` frame advertises them. |
| Others | Not implemented. Use `fallback: true` to emulate them. |

## Custom actions

Register your own actions with `MessageActionRegistry`. It follows the same pattern as the other registries: `register()`, `unregister()`, `get()`, `has()`, `list()` and `clear()`.

Custom actions go into a "⋮" (more actions) menu at the end of the bar by default, listed with their icon and label, so the bar stays short however many you register. Set `placement: "inline"` to pin an action to the bar as an icon button after the built-in ones. See [Layout](#layout) for where each one lands. The menu opens upwards and works from the keyboard: <kbd>↓</kbd> / <kbd>↑</kbd> on the button opens it, arrow keys, <kbd>Home</kbd> and <kbd>End</kbd> move between items, and <kbd>Escape</kbd> closes it and returns focus to the button.

```ts
import { MessageActionRegistry } from "@chativa/core";

MessageActionRegistry.register({
  name: "share",
  label: "Share",                                  // fallback label (or a function, e.g. () => t("myApp.share"))
  translations: { tr: "Paylaş", de: "Teilen" },    // per-locale labels
  icon: "📤",                                      // emoji, or inner SVG markup like '<path d="…"/>'
  appliesTo: "bot",                                // "bot" (default) | "user" | "all" | ["bot", "user"]
  messageTypes: ["text"],                          // only these message types (omit = every type)
  placement: "menu",                               // "menu" (default) | "inline"
  order: 10,                                       // lower renders first
  isVisible: ({ message }) => typeof message.data.text === "string",
  execute: ({ message }) => navigator.share?.({ text: String(message.data.text) }),
});
```

| Field | Notes |
|---|---|
| `name` | Unique. Registering the same name again replaces the action. |
| `label` | Accessible name and tooltip, and the item text in the menu. An inline action without an `icon` shows it as the button text. Also the fallback when `translations` has no entry for the active language. A function is called on every render, so it can return `t("…")` from your own i18n keys. |
| `translations` | Per-locale labels keyed by language code, e.g. `{ tr: "Paylaş", "pt-BR": "Compartilhar" }`. The widget picks the active i18next language: exact match first, then the base language (`pt` for `pt-BR`), then `label`. Language switches apply live. |
| `icon` | An emoji or short text (`"📤"`), shown as is. Or inner SVG markup (anything starting with `<`, no outer `<svg>`), drawn in a 24×24 box with `currentColor`. |
| `appliesTo` | Whose messages get the action: `"bot"`, `"user"`, `"all"` or a list like `["bot", "user"]`. Default `"bot"`. |
| `excludeSenders` | Senders whose messages never get it, e.g. `["user"]`. Wins over `appliesTo`. |
| `messageTypes` | Only messages of these types: `IncomingMessage.type`, such as `"text"`, `"card"`, `"buttons"`, `"genui"` or a custom renderer's type. Omit for every type. |
| `excludeMessageTypes` | Message types that never get it, e.g. `["genui"]`. Wins over `messageTypes`. |
| `placement` | `"menu"` (default) puts it in the "⋮" menu, the last item of the row. `"inline"` pins it to the bar as an icon button after the built-in actions. See [Layout](#layout). |
| `order` | Sort key. Default `0`. |
| `isVisible(context)` | Optional per-message filter, for anything the fields above can't express (message data, `isLatest` …). Runs only on messages that pass the sender and type filters. |
| `execute(context)` | Called on click. It may be async. Errors are caught and logged. |

Both callbacks receive a `MessageActionContext`: `{ message, sender, isLatest }`. `isLatest` is `true` on the latest bot reply and on the latest user message.

### Which messages get an action

An action shows on a message when all of these hold, checked in this order:

1. The sender is in `appliesTo` and not in `excludeSenders`.
2. The message type is in `messageTypes` (when set) and not in `excludeMessageTypes`.
3. `isVisible(context)`, if given, returns `true`.

Exclusions always win, so `{ appliesTo: "all", excludeSenders: ["user"] }` is the same as `appliesTo: "bot"`, and `{ excludeMessageTypes: ["genui"] }` shows the action on every type except GenUI widgets.

```ts
// On text replies only
MessageActionRegistry.register({ name: "speak", label: "Read aloud", icon: "🔊", messageTypes: ["text"], execute: speak });

// On everything the bot sends except GenUI widgets
MessageActionRegistry.register({ name: "report", label: "Report", icon: "🚩", excludeMessageTypes: ["genui"], execute: report });

// On both sides, but only where there is prose to translate
MessageActionRegistry.register({
  name: "translate",
  label: "Translate",
  icon: "🌐",
  appliesTo: ["bot", "user"],
  messageTypes: ["text", "buttons", "quick-reply"],
  execute: translate,
});
```

`messageActionMatches(action, sender, type)` from `@chativa/core` runs steps 1 and 2 on their own, if you need the same check elsewhere.

Register actions before the widget renders messages. The bar reads the registry when a message renders.

## Events

| Event | Payload | When it fires |
|---|---|---|
| `message_copied` | `{ messageId, format: "text" \| "markdown" \| "code" }` | A message or a code block was copied. |
| `message_regenerated` | `{ messageId, mode: "native" \| "fallback" }` | `ChatEngine.regenerate()` finished. |
| `message_edited` | `{ messageId, text, mode: "native" \| "fallback" }` | `ChatEngine.editMessage()` finished. |

See the [EventBus reference](./events.md) for the full list.

## DOM events

These events bubble out of `<chat-iva>` and `<agent-panel>` and are `composed`:

| Event | Detail | Dispatched by |
|---|---|---|
| `chativa-regenerate` | `{ messageId }` | The Regenerate button. The widget calls `ChatEngine.regenerate`. |
| `chativa-edit-start` | `{ messageId }` | The Edit button. `chat-message-list` opens its inline editor. |
| `chativa-edit-message` | `{ messageId, text }` | The editor's Send. The widget calls `ChatEngine.editMessage`. |

## Tool-call cards

When a reply carries a tool-call trace (from `IConnector.onToolCall`), each call expands into a card with **Parameters**, **Result** or **Error** sections. Every section has a small **Copy** button at the end of its heading:

- Parameters and Result are copied as the pretty-printed JSON the card shows (a string result is copied as is).
- Error copies the error text.
- The button reads "Copied" for a moment afterwards, and the `tool_call_copied` event fires with `{ toolCallId, part: "params" | "result" | "error" }`.

`codeBlockCopy: false` hides these buttons together with the code-block ones.

## Clipboard

Copy uses the async Clipboard API, which needs a secure context (HTTPS or `localhost`). Where that API is unavailable or refused, for example in some embedded webviews, the widget falls back to `document.execCommand("copy")`.
