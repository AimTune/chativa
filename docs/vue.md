# Vue 3

`@chativa/vue` wraps the Chativa Web Components in idiomatic Vue 3 components. You get typed props, `v-on` event binding with camelCase emits, a plugin that configures the connector once for the whole app, and composables that expose the shared `chatStore` / `messageStore` as reactive refs. Every import is SSR-safe, so it works in Nuxt 3 without extra setup.

The wrapper is thin on purpose: `<ChatIva>` still renders the real `<chat-iva>` element from `@chativa/ui`, so every connector, message type, GenUI component, extension and theme option works exactly as it does on a plain HTML page.

## Install

```bash
pnpm add @chativa/vue @chativa/core @chativa/connector-dummy
```

Peer dependencies: `vue >= 3.3` and `@chativa/core`. `@chativa/ui` is a regular dependency and is loaded lazily on the client. `@chativa/genui` is an optional peer: `@chativa/ui` already brings it in, and you only need it as a direct dependency if you import from it yourself (for example to register a custom GenUI component).

You **don't** need `compilerOptions.isCustomElement`. Your templates only use the wrapper components, never the raw `<chat-iva>` tag.

## Quick start

```ts
// main.ts
import { createApp } from "vue";
import { ChativaPlugin } from "@chativa/vue";
import { DummyConnector } from "@chativa/connector-dummy";
import App from "./App.vue";

createApp(App)
  .use(ChativaPlugin, {
    connector: new DummyConnector(),
    theme: { colors: { primary: "#42b883" } },
  })
  .mount("#app");
```

```vue
<!-- App.vue -->
<script setup lang="ts">
import type { IncomingMessage } from "@chativa/vue";

function onMessage(message: IncomingMessage) {
  console.log("bot said", message);
}
</script>

<template>
  <ChatBotButton />
  <ChatIva @message="onMessage" />
</template>
```

`<ChatIva>` is only the chat panel. It has no launcher of its own, so a normal popup setup renders `<ChatBotButton>` next to it. Both read the same `chatStore`, which keeps them in sync.

You don't have to use the plugin. Import the components where you need them and pass the connector as a prop:

```vue
<script setup lang="ts">
import { ChatIva, ChatBotButton } from "@chativa/vue";
import { DummyConnector } from "@chativa/connector-dummy";

const dummy = new DummyConnector();
</script>

<template>
  <ChatBotButton />
  <ChatIva :connector="dummy" @message="(m) => console.log(m)" />
</template>
```

## Components

### `<ChatIva>`

Wraps `<chat-iva>`.

| Prop | Type | Description |
|---|---|---|
| `connector` | `string \| IConnector` | A registered connector name, or an `IConnector` instance. Instances are registered in `ConnectorRegistry` automatically. Defaults to whatever `ChativaPlugin` or `window.chativaSettings` activated. |
| `fullscreenOnly` | `boolean` | Start in fullscreen and hide the fullscreen toggle (same as the `fullscreen-only` attribute). `false` means "no opinion", so it never turns a toggle back on that your theme disabled. |

| Event | Payload | Fired when |
|---|---|---|
| `message` | `IncomingMessage` | A bot/connector message was delivered (`EventBus` `message_received`). |
| `messageSent` | `OutgoingMessage` | The user sent a message (`message_sent`). |
| `connect` | — | The connector status became `"connected"`. |
| `disconnect` | `{ status: ConnectorStatus }` | The connector status became `"disconnected"` or `"error"`. |
| `surveySubmit` | `SurveyPayload` | The end-of-conversation survey was submitted. |
| `widgetOpen` / `widgetClose` | — | The panel opened / closed. |
| `chativaReset` | — | `<chat-iva>`'s `chativa-reset` DOM event: the conversation is about to be rebuilt after a survey. |

In templates, use either spelling: `@message-sent` and `@messageSent` both work. Default-slot content goes into the element.

### `<ChatBotButton>`

Wraps `<chat-bot-button>`, the floating launcher. Put your own markup in the default slot to replace the built-in gradient circle. `<chat-bot-button>` still takes care of positioning and the open/close click:

```vue
<ChatBotButton>
  <button class="my-launcher">💬 Ask us</button>
</ChatBotButton>
```

### `<GenUIMessage>`

Wraps `<genui-message>` so you can render a streaming Generative UI message outside `<ChatIva>`'s message list.

| Prop | Type |
|---|---|
| `messageData` | `Record<string, unknown>` (a `GenUIStreamState`: `{ chunks, streamingComplete }`) |
| `sender` | `"user" \| "bot"` |
| `messageId` | `string` |
| `timestamp` | `number` |
| `hideAvatar`, `debug` | `boolean` |
| `status` | `string` |

Inside `<ChatIva>`, the widget forwards component events to the connector itself. A standalone `<GenUIMessage>` has nothing behind it, so the element's `genui-send-event` DOM event is re-emitted as `genuiSendEvent`, with a `GenUISendEventDetail` (`{ msgId, eventType, payload, sourceId?, scope?, component? }`) for you to handle.

### How props and events reach the element

- Props are set as **DOM properties**, not attributes, so objects, numbers and booleans arrive unchanged. Vue reactive proxies are unwrapped with `toRaw` first.
- Kebab-case DOM events from the element become camelCase Vue emits (`genui-send-event` → `genuiSendEvent`).
- Widget activity (`message`, `connect`, …) comes from the shared `EventBus`, the same source `@chativa/react` uses.
- `connector` and `fullscreenOnly` are written to `chatStore` in `setup()`, **before** the element exists, because `<chat-iva>` reads both while it connects.
- Each component exposes the underlying element as `element` on its template ref, e.g. `chatRef.value?.element`.

## `ChativaPlugin`

```ts
app.use(ChativaPlugin, {
  connector,            // string | IConnector
  extensions,           // IExtension[] (each installed once)
  theme,                // DeepPartial<ThemeConfig>
  locale,               // e.g. "tr"
  i18n,                 // flat translation overrides, applied to every language
  registerComponents,   // default true
});
```

The plugin is the Vue counterpart of `@chativa/react`'s `<ChativaProvider>` and of `window.chativaSettings`. It runs before any component mounts, so the registries are filled by the time `<chat-iva>` connects. With `registerComponents: true` (the default) it registers `ChatIva`, `ChatBotButton` and `GenUIMessage` as global components and adds them to Vue's `GlobalComponents` type, so Volar and `vue-tsc` type-check them in templates. Set it to `false` to import the components where you use them, and keep the plugin only for configuration.

The same configuration step is exported as `applyChativaOptions(options)` for code that runs outside `app.use`.

## Composables

All composables work anywhere in the app, not only below a `<ChatIva>`, because the stores are shared. Call them from `setup()` or inside an `effectScope()`. Their subscriptions are released when that scope is disposed.

### `useChat()`

A reactive view of `chatStore`, plus its actions:

```ts
const {
  state,            // ComputedRef<ChatStoreState>
  isOpened, isFullscreen, activeConnector, connectorStatus,
  isTyping, typingMessage, unreadCount, reconnectAttempt,
  theme, searchQuery, activeToolCalls,
  open, close, toggle, setFullscreen, setTheme,
  setConnector,     // name or IConnector instance
  setSearchQuery, clearSearch, resetUnread,
} = useChat();
```

Sending messages is not available here. Outgoing messages go through the widget's internal `ChatEngine`, which owns the connector, and no store exposes a send action.

### `useMessages()`

```ts
const { messages, version, lastMessage, clear, removeById, updateById } = useMessages();
```

`messages` is the live `StoredMessage[]` from `messageStore`. It includes streamed text bubbles and GenUI messages as they grow. Message objects keep their identity because the composable does not wrap them in deep reactive proxies.

### `useGenUIStream(messageId?)`

`@chativa/core` has no separate GenUI stream store. `ChatEngine` folds every `onGenUIChunk` call into a `type: "genui"` message in `messageStore`, whose `data` is a `GenUIStreamState`. It also announces each stream's lifetime on the `EventBus` with `genui_stream_started` and `genui_stream_completed`. `useGenUIStream` combines both:

```ts
const {
  streams,          // ComputedRef<GenUIStream[]> — every GenUI message, typed
  stream,           // the one for `messageId` (ref, getter or string), else the newest
  chunks,           // stream's AIChunk[]
  activeStreamIds,  // connector stream ids started and not yet completed
  isStreaming,      // any reply stream in flight, or any GenUI message incomplete
} = useGenUIStream();
```

Each `GenUIStream` is `{ messageId, chunks, streamingComplete, message }`. You can pass one straight to `<GenUIMessage :message-data="stream.message.data" :message-id="stream.messageId" />` to render it somewhere else.

### `useChativaEvent(event, handler)`

Subscribes to any `EventBus` event for the lifetime of the current scope and returns a function that stops the subscription early:

```ts
useChativaEvent("tool_call_updated", (toolCall) => console.log(toolCall));
```

## Nuxt 3 and SSR

The package never touches `window`, `document` or `customElements` while it is being imported or rendered on the server:

- The components load `@chativa/ui` / `@chativa/genui` with a dynamic `import()` inside `onMounted`, which never runs on the server. On the server they render an empty comment placeholder, and the real element appears after hydration.
- The plugin and the components skip every store and registry write during server rendering. Those stores are process-wide singletons shared by every request, and nothing connects on the server anyway.
- The composables return a static snapshot on the server and only subscribe in the browser.

That means `nuxt build` works without special handling. Register the plugin in a client plugin, because connector instances usually hold browser-only state:

```ts
// plugins/chativa.client.ts
import { ChativaPlugin } from "@chativa/vue";
import { DirectLineConnector } from "@chativa/connector-directline";

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(ChativaPlugin, {
    connector: new DirectLineConnector({ token: useRuntimeConfig().public.dlToken }),
  });
});
```

Because the plugin only runs on the client, global registration is client-only too. In SSR-rendered pages, either wrap the widget in `<ClientOnly>` or import the components explicitly. Explicit imports are safe on the server:

```vue
<template>
  <ClientOnly>
    <ChatBotButton />
    <ChatIva @message="onMessage" />
  </ClientOnly>
</template>
```

## Example app

[`examples/vue3-vite`](https://github.com/AimTune/chativa/tree/main/examples/vue3-vite) is a runnable Vite + Vue 3 app. It uses `ChativaPlugin` with the dummy connector, a custom `<ChatBotButton>` launcher, `<ChatIva>` events, and live state from `useChat`, `useMessages` and `useGenUIStream`, with buttons that stream a GenUI widget and a token-by-token reply:

```bash
pnpm install
pnpm --filter chativa-example-vue3-vite dev
```
