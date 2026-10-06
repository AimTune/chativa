# Svelte & SvelteKit

`@chativa/svelte` wraps the Chativa web components in typed **Svelte 5** components, mirrors the core zustand stores as Svelte stores, and loads the widget on the client only — so it drops into a server-rendered or prerendered SvelteKit route without any `browser` checks of your own.

Svelte can already render `<chat-iva>` directly (see [Getting started](./getting-started.md)); the wrapper adds what plain custom elements can't give you:

- typed props and callback props for `<ChatIva>`, `<ChatBotButton>`, `<GenUIMessage>` and `<ChativaProvider>`;
- `$chatState` / `$messages` stores backed by `chatStore` / `messageStore` from `@chativa/core`;
- an SSR guard: `@chativa/ui` (which defines custom elements at import time) is only ever imported in the browser.

## Install

```bash
pnpm add @chativa/svelte @chativa/core @chativa/connector-dummy
```

Peer dependencies: `svelte ^5`, `@chativa/core`. `@chativa/ui` is a regular dependency. `@chativa/genui` is an optional peer, needed only if you use `<GenUIMessage>` outside of `<ChatIva>`.

> **Svelte 5 only.** The components are written with runes (`$props`, `$state`, `$effect`) and ship as `.svelte` source, so a Svelte 4 compiler can't consume them. Inside a Svelte 5 app, components that still use the legacy (non-runes) syntax can listen with `on:message` etc. — see [Legacy `on:` events](#legacy-on-events).

## Quick start

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { ChativaProvider, ChatIva, ChatBotButton } from "@chativa/svelte";
  import { DummyConnector } from "@chativa/connector-dummy";

  const dummy = new DummyConnector({ replyDelay: 500 });
</script>

<ChativaProvider connector={dummy} theme={{ colors: { primary: "#ff3e00" } }}>
  <ChatBotButton />
  <ChatIva onmessage={(m) => console.log("bot said", m)} />
</ChativaProvider>
```

`<ChatIva>` is only the chat **panel**; `<ChatBotButton>` is the floating launcher that toggles it. Both render nothing on the server and appear once `@chativa/ui` has loaded in the browser.

You can skip the provider and hand the connector to the widget directly:

```svelte
<ChatIva connector={dummy} onmessage={onMessage} />
```

An `IConnector` instance is registered in `ConnectorRegistry` automatically (once); a string is treated as the name of a connector you registered yourself.

## Components

### `<ChativaProvider>`

Registers a shared connector and extensions, and applies theme / locale / i18n overrides, for every widget inside it — the component equivalent of `window.chativaSettings`.

| Prop | Type | Description |
| --- | --- | --- |
| `connector` | `string \| IConnector` | Connector name, or an instance to auto-register and activate. |
| `extensions` | `IExtension[]` | Installed once (skipped if already installed). |
| `theme` | `DeepPartial<ThemeConfig>` | Deep-merged over the default theme. Reactive, including deep mutations of a `$state` object. |
| `locale` | `string` | Initial language (e.g. `"tr"`), skipping browser detection. |
| `i18n` | `Record<string, unknown>` | Flat translation overrides applied to every registered language. |
| `children` | `Snippet` | Content. |

Registration runs while the provider initialises — before any nested widget initialises — so the widgets always find the connector already active.

### `<ChatIva>`

Wraps `<chat-iva>`.

| Prop | Type | Description |
| --- | --- | --- |
| `connector` | `string \| IConnector` | Overrides the provider's / `window.chativaSettings`' connector. |
| `fullscreenOnly` | `boolean` | Start fullscreen and hide the fullscreen toggle (the `fullscreen-only` attribute). `false` means "no opinion", not "disable". |
| `class`, `style` | `string` | Forwarded to the element. |
| `children` | `Snippet` | Rendered into the element's light DOM. |
| `element` | `HTMLElement \| null` | Bindable — `bind:element` gives you the `<chat-iva>` node once mounted. |

Callback props (Svelte 5 style — plain function props, not `on:` directives). They are fed by the core `EventBus`:

| Prop | Payload | `EventBus` event |
| --- | --- | --- |
| `onmessage` | `IncomingMessage` | `message_received` |
| `onmessagesent` | `OutgoingMessage` | `message_sent` |
| `onconnect` | — | `connector_status_changed` → `"connected"` |
| `ondisconnect` | `{ status: ConnectorStatus }` | `connector_status_changed` → `"disconnected"` / `"error"` |
| `onsurveysubmit` | `SurveyPayload` | `survey_submitted` |
| `onwidgetopen` | — | `widget_opened` |
| `onwidgetclose` | — | `widget_closed` |

The latest handler is always the one called — passing a new inline arrow function on every render never re-subscribes.

### `<ChatBotButton>`

Wraps `<chat-bot-button>`. Props: `class`, `style`, `element` (bindable) and `children`. Children replace the default gradient-circle icon; the element keeps handling positioning and the open/close click:

```svelte
<ChatBotButton>
  <button class="my-launcher">💬 Ask Iva</button>
</ChatBotButton>
```

### `<GenUIMessage>`

Wraps `<genui-message>` to render one streaming Generative UI message outside the chat panel. Props: `messageData`, `sender`, `messageId`, `timestamp`, `hideAvatar`, `status`, `debug`, `class`, `style`, `element` (bindable). Props you don't pass keep the element's own defaults. Requires `@chativa/genui`.

## Stores

```svelte
<script lang="ts">
  import { chatState, messages } from "@chativa/svelte";
  import { chatStore } from "@chativa/core";
</script>

<p>Status: {$chatState.connectorStatus} — {$messages.length} messages</p>
<button onclick={() => chatStore.getState().open()}>Open chat</button>
```

| Export | Type | Mirrors |
| --- | --- | --- |
| `chatState` | `Readable<ChatStoreState>` | the whole `chatStore` state (`isOpened`, `connectorStatus`, `isTyping`, `unreadCount`, `theme`, …) |
| `messageState` | `Readable<MessageStoreState>` | the whole `messageStore` state |
| `messages` | `Readable<StoredMessage[]>` | `messageStore`'s `messages` |
| `toReadable(store, select?)` | `Readable<T>` | any zustand vanilla store, e.g. `conversationStore` |

The stores are read-only views — call actions on the core stores themselves (`chatStore.getState().open()`). Each store only subscribes to zustand while something subscribes to it, and only notifies when the selected value changes:

```ts
import { conversationStore } from "@chativa/core";
import { toReadable } from "@chativa/svelte";

export const conversations = toReadable(conversationStore, (s) => s.conversations);
```

On the server the stores yield the default state once and never subscribe.

## Events without a component

`onChativaEvent(event, handler)` subscribes to any `EventBus` event and returns the unsubscribe function, so it can be returned straight from an `$effect`:

```svelte
<script lang="ts">
  import { onChativaEvent } from "@chativa/svelte";

  $effect(() => onChativaEvent("history_loaded", ({ count }) => console.log(count)));
</script>
```

It is a no-op on the server.

## SvelteKit and SSR

Every component, store and helper is safe to import and render on the server:

- the components render nothing during SSR and load `@chativa/ui` from `onMount`, which Svelte never runs on the server;
- connector registration, theme and locale effects only run in the browser;
- the stores serve the default state on the server.

Prerendered routes (`export const prerender = true`) work too. If you render the raw `<chat-iva>` / `<chat-bot-button>` tags yourself instead of the wrapper components, register the elements with `registerChativa()`:

```svelte
<script lang="ts">
  import { onMount } from "svelte";
  import { registerChativa } from "@chativa/svelte";

  onMount(() => {
    void registerChativa();
  });
</script>

<chat-bot-button></chat-bot-button>
<chat-iva></chat-iva>
```

`registerChativa()` resolves `true` once the elements are defined in the browser, and `false` (without importing anything) on the server. It is memoized, so calling it more than once is harmless.

## Legacy `on:` events

Svelte 5 components that still use the legacy syntax (no runes) can attach Svelte 4-style listeners. The payload is in `event.detail`, and the event names match the callback props without the `on` prefix:

```svelte
<svelte:options runes={false} />

<ChatIva connector={dummy} on:message={(e) => console.log(e.detail)} />
```

Available: `message`, `messagesent`, `connect`, `disconnect`, `surveysubmit`, `widgetopen`, `widgetclose`. Prefer the callback props in new code — `on:` on components is deprecated in Svelte 5.

## Types

The package re-exports the commonly used core types, so you don't need a separate type import from `@chativa/core`: `IConnector`, `IExtension`, `ExtensionContext`, `MessageTransformer`, `ThemeConfig`, `ThemeColors`, `LayoutConfig`, `AvatarConfig`, `ButtonPosition`, `ButtonSize`, `SpaceLevel`, `WindowMode`, `DeepPartial`, `EndOfConversationSurveyConfig`, `IncomingMessage`, `OutgoingMessage`, `MessageSender`, `MessageStatus`, `SurveyPayload`, `ConnectorStatus`, `EventBusEventName`, `EventBusPayloadMap`, `ChatStoreState`, `MessageStoreState`, `StoredMessage`. Prop types are exported as `ChatIvaProps`, `ChatBotButtonProps`, `GenUIMessageProps` and `ChativaProviderProps`.

## Example

[`examples/sveltekit`](https://github.com/AimTune/chativa/tree/main/examples/sveltekit) is a prerendered SvelteKit app using `<ChativaProvider>`, a custom `<ChatBotButton>` launcher, `<ChatIva>` callbacks and the `$chatState` / `$messages` stores:

```bash
pnpm install
pnpm --filter chativa-example-sveltekit dev
```
