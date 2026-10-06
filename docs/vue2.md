# Vue 2 / Nuxt 2

`@chativa/vue2` wraps the Chativa web components for **Vue 2.7** apps (Vue CLI / webpack, Vite with `@vitejs/plugin-vue2`, Nuxt 2). It exists so legacy Vue 2 codebases can adopt the widget without migrating to Vue 3 first.

Vue 2's custom-element support is weaker than Vue 3's: object and boolean props end up as attributes, and there is no clean way to listen to `CustomEvent`s and the shared `EventBus` from a template. The wrapper handles both — props are forwarded as **DOM properties**, and widget events become ordinary Vue `@event` listeners.

> **Vue 2 is end-of-life.** Vue 2 reached end of life on **2023-12-31**. `@chativa/vue2` is recommended to be a **maintenance-mode** package: it follows `@chativa/core` / `@chativa/ui` releases and receives bug and security fixes, but new wrapper features land in the Vue 3 wrapper first. (Whether to formally freeze it after v1 is the maintainer's call — see [#3](https://github.com/AimTune/chativa/issues/3).) If you can, plan a move to Vue 3.

## Requirements

- **Vue `^2.7.0`** — the last 2.x line, which ships the composition API the wrapper is built on. Vue 2.6 and older are **not supported**.
- `@chativa/core` (peer dependency) and `@chativa/ui` (dependency). `@chativa/genui` is an optional peer, only needed for the standalone `<GenUIMessage>`.

## Install

```bash
pnpm add @chativa/vue2 @chativa/core @chativa/connector-dummy
```

Swap `@chativa/connector-dummy` for the [connector](./connectors/overview.md) that talks to your backend.

## Quick start

```js
// main.js
import Vue from "vue";
import Chativa from "@chativa/vue2";
import { DummyConnector } from "@chativa/connector-dummy";
import App from "./App.vue";

Vue.use(Chativa, {
  connector: new DummyConnector(),
  theme: { colors: { primary: "#42b883" } },
});

new Vue({ render: (h) => h(App) }).$mount("#app");
```

```vue
<!-- App.vue -->
<template>
  <div>
    <ChatBotButton />
    <ChatIva @message="onMessage" @widget-open="opened = true" />
  </div>
</template>

<script>
export default {
  data: () => ({ opened: false }),
  methods: {
    onMessage(message) {
      console.log("bot said", message.data);
    },
  },
};
</script>
```

`<ChatIva>` is only the chat **panel** — it has no launcher of its own. Render `<ChatBotButton>` next to it for the usual popup setup; both share the same `chatStore`, so the button toggles the panel.

## The plugin

`Vue.use(Chativa, options)` applies app-wide settings once and registers the components globally. It is the Vue 2 equivalent of setting `window.chativaSettings` before `<chat-iva>` connects.

| Option | Type | Description |
|---|---|---|
| `connector` | `string \| IConnector` | A registered connector name, or an `IConnector` instance to register (if not already registered) and activate. |
| `extensions` | `IExtension[]` | [Extensions](./extensions.md) to install. Names already in `ExtensionRegistry` are skipped. |
| `theme` | `DeepPartial<ThemeConfig>` | [Theme](./theming.md) overrides, deep-merged over the default theme. |
| `locale` | `string` | Initial language (e.g. `"tr"`), skipping browser detection. |
| `i18n` | `Record<string, unknown>` | Flat [translation](./i18n.md) overrides, applied to every registered language. |
| `components` | `boolean` | Register `ChatIva`, `ChatBotButton` and `GenUIMessage` globally. Default `true`. |

The plugin also adds `chat-iva`, `chat-bot-button` and `genui-message` to `Vue.config.ignoredElements`.

With the components registered globally, Vue 2 also resolves the kebab-case tag `<chat-iva>` in templates to the `ChatIva` wrapper (and `<chat-bot-button>` to `ChatBotButton`). That is intentional — the wrapper accepts the same `connector` and `fullscreen-only` inputs as the raw element.

To register the components yourself instead, pass `components: false` and import them:

```js
import { ChatIva, ChatBotButton } from "@chativa/vue2";

export default {
  components: { ChatIva, ChatBotButton },
};
```

## Components

All three components render **nothing** until `@chativa/ui` (or `@chativa/genui`) has been dynamically imported in `mounted()`. Importing `@chativa/vue2` therefore never evaluates the custom-element code on a server, which is what makes the Nuxt 2 path below work.

### `<ChatIva>`

Wraps `<chat-iva>`.

| Prop | Type | Description |
|---|---|---|
| `connector` | `string \| IConnector` | Connector name or instance. Defaults to whatever the plugin (or `window.chativaSettings`) activated. Instances are auto-registered. |
| `fullscreen-only` | `boolean` | Start in fullscreen and hide the fullscreen toggle. Absent / `false` means "no opinion". |

The connector and `fullscreen-only` are written to the shared `chatStore` before the element connects — `<chat-iva>` reads `chatStore.activeConnector` in preference to its own `connector` property and picks its window mode while connecting, so setting them only as element properties would be too late.

| Event | Payload | Source |
|---|---|---|
| `message` | `IncomingMessage` | `EventBus` `message_received` |
| `message-sent` | `OutgoingMessage` | `EventBus` `message_sent` |
| `connect` | — | `EventBus` `connector_status_changed` → `"connected"` |
| `disconnect` | `{ status: ConnectorStatus }` | `connector_status_changed` → `"disconnected"` or `"error"` |
| `survey-submit` | `SurveyPayload` | `EventBus` `survey_submitted` |
| `widget-open` | — | `EventBus` `widget_opened` |
| `widget-close` | — | `EventBus` `widget_closed` |
| `feedback` | `{ messageId, feedback }` | DOM `chativa-feedback` event (like / dislike) |
| `reset` | — | DOM `chativa-reset` event (conversation reset after a [survey](./survey.md)) |

The default slot is passed through to `<chat-iva>`.

### `<ChatBotButton>`

Wraps `<chat-bot-button>`. Default-slot content replaces the built-in gradient circle with your own launcher; the wrapper still handles positioning and the open/close click. Listeners bound on it (e.g. `@click`) are attached to the element itself.

```vue
<ChatBotButton>
  <button class="my-launcher">Ask us</button>
</ChatBotButton>
```

### `<GenUIMessage>`

Wraps `<genui-message>` to render one [Generative UI](./genui/overview.md) message outside the chat panel. Requires `@chativa/genui`.

| Prop | Type |
|---|---|
| `message-data` | `GenUIStreamState` object (`{ chunks, streamingComplete }`) |
| `sender` | `"user" \| "bot"` |
| `message-id` | `string` |
| `timestamp` | `number` |
| `hide-avatar` | `boolean` |
| `status` | `string` |
| `debug` | `boolean` |

Every prop is set as a DOM property, so `message-data` arrives as the same object, not a stringified attribute. Props you leave unset keep the element's own defaults.

| Event | Payload |
|---|---|
| `send-event` | `genui-send-event` detail: `{ msgId, eventType, payload, sourceId? }` |
| `action` | `chat-action` detail (the value a built-in GenUI button or quick reply sent) |

## `useChativaEvent`

For other [`EventBus`](./architecture.md) events, use the composable from a Vue 2.7 `setup()`. It subscribes on mount and unsubscribes before unmount:

```js
import { useChativaEvent } from "@chativa/vue2";

export default {
  setup() {
    useChativaEvent("history_loaded", ({ count }) => console.log(`${count} messages loaded`));
  },
};
```

## Nuxt 2

The widget is browser-only, so register it from a **client-only plugin**:

```js
// plugins/chativa.client.js
import Vue from "vue";
import Chativa from "@chativa/vue2";
import { DirectLineConnector } from "@chativa/connector-directline";

export default ({ $config }) => {
  Vue.use(Chativa, {
    connector: new DirectLineConnector({ token: $config.directLineToken }),
  });
};
```

```js
// nuxt.config.js
export default {
  plugins: [{ src: "~/plugins/chativa.client.js", mode: "client" }],
  build: {
    // Nuxt 2 bundles with webpack 4, whose parser rejects modern syntax
    // (`?.`, `??`, class fields) in node_modules — let Babel transpile the
    // Chativa packages and Lit first.
    transpile: [/^@chativa\//, "lit", /^@lit\//, /^@lit-labs\//],
  },
};
```

The `.client.js` suffix alone already makes the plugin client-only (Nuxt >= 2.4); `mode: "client"` says the same thing explicitly. On Nuxt < 2.4 use `{ src: "~/plugins/chativa.client.js", ssr: false }` instead.

Because the components are only registered on the client, wrap them in `<client-only>` so the server render doesn't warn about unknown components:

```vue
<template>
  <div>
    <client-only>
      <ChatBotButton />
      <ChatIva @message="onMessage" />
    </client-only>
  </div>
</template>
```

## TypeScript

The package is written in TypeScript and ships its own declarations. It re-exports the `@chativa/core` types you need for options and event payloads — `IConnector`, `IExtension`, `ThemeConfig`, `DeepPartial`, `IncomingMessage`, `OutgoingMessage`, `SurveyPayload`, `ConnectorStatus`, `EventBusEventName`, `EventBusPayloadMap` and more — along with `ChativaPluginOptions`:

```ts
import type { ChativaPluginOptions, IncomingMessage } from "@chativa/vue2";
```

## Example

[`examples/vue2-webpack`](https://github.com/AimTune/chativa/tree/main/examples/vue2-webpack) is a Vue 2.7 + webpack 5 + `vue-loader` 15 app showing the plugin, a custom launcher, an event log and a standalone `<GenUIMessage>`. It uses the built `dist/` output of the packages, the same way an app installing from npm does:

```bash
pnpm install
pnpm build                                   # build the @chativa/* packages
pnpm --filter chativa-example-vue2-webpack dev
```
