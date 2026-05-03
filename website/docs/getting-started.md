---
sidebar_position: 2
title: Getting started
description: Embed Chativa in any framework — vanilla HTML, React, Vue, Angular, Next.js — and wire it to a real backend in 5 minutes.
---

# Getting started

This page walks you from zero to a working chat widget connected to a real backend, with examples for every popular framework. If you only want to read one page, this is it.

## Step 1 — Embed via CDN (zero build)

The fastest way to see Chativa in action:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Chativa demo</title>
  </head>
  <body>
    <h1>My website</h1>
    <p>Click the chat button in the bottom-right.</p>

    <script type="module" src="https://unpkg.com/@chativa/ui/dist/chativa.js"></script>
    <chat-bot-button></chat-bot-button>
    <chat-iva></chat-iva>
  </body>
</html>
```

That's it. Open the file in a browser. The launcher button appears in the bottom-right; click it and a chat panel slides up. The default `dummy` connector echoes whatever you type back, so you can play with themes, message types, and slash commands offline.

### What just happened?

- `chativa.js` is an **ESM bundle** that registers two custom elements: `<chat-bot-button>` (the launcher) and `<chat-iva>` (the panel itself).
- The bundle includes `@chativa/core`, `@chativa/ui`, and `@chativa/genui` — but **not** any connector. The `dummy` connector is part of `@chativa/core` and registered automatically as a fallback.
- Both elements use **Shadow DOM**, so the host page's CSS can't leak in. You theme via CSS variables, not by overriding internal classes.

## Step 2 — Install via npm (recommended for production)

For real apps you'll want versioned packages, tree-shaken builds, and a connector that talks to your backend.

```bash
pnpm add @chativa/ui @chativa/core
# pick the connector that matches your backend protocol:
pnpm add @chativa/connector-directline   # Azure Bot Framework
pnpm add @chativa/connector-websocket    # raw WebSocket
pnpm add @chativa/connector-signalr      # SignalR (ASP.NET Core)
pnpm add @chativa/connector-sse          # Server-Sent Events
pnpm add @chativa/connector-http         # plain HTTP request/response
pnpm add @chativa/connector-dummy        # local echo, useful for tests
```

Or with `npm` / `yarn` if you prefer.

### Wire it up

```ts
// main.ts
import "@chativa/ui";                              // registers <chat-iva>, <chat-bot-button>
import { ConnectorRegistry, chatStore } from "@chativa/core";
import { DirectLineConnector } from "@chativa/connector-directline";

ConnectorRegistry.register(
  new DirectLineConnector({ token: "YOUR_DIRECTLINE_TOKEN" }),
);
chatStore.getState().setConnector("directline");
```

Then somewhere in your HTML:

```html
<chat-bot-button></chat-bot-button>
<chat-iva></chat-iva>
```

That's the entire integration. Skip ahead to [Step 4](#step-4--configure-everything-declaratively) if you'd rather configure declaratively.

## Step 3 — Framework-by-framework

The widget is a **standards-compliant Web Component** — it works in any framework. Here are the integration patterns that matter:

### Plain HTML

You've already seen it above. Nothing special.

### React (and Next.js)

React 19+ supports custom elements natively. For older React versions, use `dangerouslySetInnerHTML` or the [`@lit/react`](https://www.npmjs.com/package/@lit/react) interop.

```tsx
"use client"; // required in Next.js App Router

import { useEffect } from "react";

export function ChatWidget() {
  useEffect(() => {
    void import("@chativa/ui");
    void import("@chativa/connector-directline").then(({ DirectLineConnector }) => {
      import("@chativa/core").then(({ ConnectorRegistry, chatStore }) => {
        if (ConnectorRegistry.has("directline")) return;
        ConnectorRegistry.register(
          new DirectLineConnector({ token: process.env.NEXT_PUBLIC_DL_TOKEN! }),
        );
        chatStore.getState().setConnector("directline");
      });
    });
  }, []);

  return (
    <>
      {/* @ts-ignore -- web component types */}
      <chat-bot-button></chat-bot-button>
      {/* @ts-ignore */}
      <chat-iva></chat-iva>
    </>
  );
}
```

The dynamic `import()` keeps the chat bundle out of your initial JavaScript payload.

> **Tip:** if TypeScript complains about unknown elements, declare them once in a `chativa.d.ts` file:
>
> ```ts
> import type React from "react";
>
> declare global {
>   namespace JSX {
>     interface IntrinsicElements {
>       "chat-iva": React.HTMLAttributes<HTMLElement>;
>       "chat-bot-button": React.HTMLAttributes<HTMLElement>;
>     }
>   }
> }
> ```

### Vue 3

Vue treats unknown tags with hyphens as custom elements out of the box, but you should opt in explicitly so it doesn't try to create components for them:

```ts
// main.ts
import { createApp } from "vue";
import App from "./App.vue";
import "@chativa/ui";
import { ConnectorRegistry, chatStore } from "@chativa/core";
import { DirectLineConnector } from "@chativa/connector-directline";

ConnectorRegistry.register(new DirectLineConnector({ token: import.meta.env.VITE_DL_TOKEN }));
chatStore.getState().setConnector("directline");

const app = createApp(App);
app.config.compilerOptions.isCustomElement = (tag) => tag.startsWith("chat-") || tag.startsWith("genui-");
app.mount("#app");
```

```vue
<!-- App.vue -->
<template>
  <chat-bot-button />
  <chat-iva />
</template>
```

### Angular

```ts
// app.module.ts
import { CUSTOM_ELEMENTS_SCHEMA, NgModule } from "@angular/core";
// ...
@NgModule({
  // ...
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppModule {}
```

```ts
// app.component.ts
import "@chativa/ui";
import { ConnectorRegistry, chatStore } from "@chativa/core";
import { DirectLineConnector } from "@chativa/connector-directline";

ConnectorRegistry.register(new DirectLineConnector({ token: environment.dlToken }));
chatStore.getState().setConnector("directline");
```

```html
<!-- app.component.html -->
<chat-bot-button></chat-bot-button>
<chat-iva></chat-iva>
```

### Svelte / SvelteKit

```svelte
<script lang="ts">
  import { onMount } from "svelte";

  onMount(async () => {
    await import("@chativa/ui");
    const { ConnectorRegistry, chatStore } = await import("@chativa/core");
    const { DirectLineConnector } = await import("@chativa/connector-directline");

    ConnectorRegistry.register(new DirectLineConnector({ token: import.meta.env.VITE_DL_TOKEN }));
    chatStore.getState().setConnector("directline");
  });
</script>

<chat-bot-button></chat-bot-button>
<chat-iva></chat-iva>
```

## Step 4 — Configure everything declaratively

If you'd rather not write any imperative wiring code, set `window.chativaSettings` **before** the script tag is parsed:

```html
<script>
  window.chativaSettings = {
    connector: "directline",
    theme: {
      colors: { primary: "#1B1464" },
      windowMode: "popup",
      enableSearch: true,
      position: "bottom-right",
    },
    locale: "tr",
    i18n: {
      all: { header: { title: "Sanal Asistan" } },
    },
  };
</script>
<script type="module" src="https://unpkg.com/@chativa/ui/dist/chativa.js"></script>
<chat-iva></chat-iva>
```

The full schema for that object is published at [`schemas/chativa-settings.schema.json`](https://github.com/AimTune/chativa/blob/main/schemas/chativa-settings.schema.json). Reference it from your config file and your editor will autocomplete everything:

```jsonc
// chativa.config.json
{
  "$schema": "https://chativa.aimtune.dev/schemas/chativa-settings.schema.json",
  "connector": "directline",
  "theme": { "colors": { "primary": "#1B1464" } }
}
```

## Step 5 — Try the live sandbox

Every feature in the widget is wired up in the dev sandbox:

➡ **[chativa.aimtune.dev/sandbox](/sandbox/)**

Use it to test theme presets, switch connectors, trigger every message type, fire GenUI components, and try the agent-panel mode. See the [Sandbox tour](./sandbox.md) for a walkthrough.

## Troubleshooting

**The widget doesn't appear.**
Check the browser console. The most common cause is a Content Security Policy that blocks ESM modules from `unpkg.com`. Either copy `chativa.js` into your own bundle or extend the CSP with `script-src https://unpkg.com`.

**Custom elements show up as plain text in React/Vue/Angular.**
You forgot to opt in. See the framework-specific snippets above (`CUSTOM_ELEMENTS_SCHEMA` for Angular, `compilerOptions.isCustomElement` for Vue, JSX intrinsic-element augmentation for React).

**My theme isn't applied.**
You're probably calling `setTheme()` after the widget has rendered with the default. That's fine — `setTheme()` patches at runtime via `mergeTheme()`. But if you rely on `window.chativaSettings.theme`, make sure that script runs **before** `chativa.js`.

**The dummy connector keeps replying instead of my real backend.**
You registered your real connector but never called `chatStore.getState().setConnector("name")`. Or you set `window.chativaSettings.connector` to a string for which no connector with that name has been registered.

## Where to go next

- [**Concepts**](./concepts.md) — Ports & Adapters from scratch, what an `IConnector` actually does.
- [**Connectors**](./connectors/overview.md) — capability matrix and per-connector configuration.
- [**Theming**](./theming.md) — three layers: CSS variables → JSON → fluent builder.
- [**Custom message type**](./message-types/custom.md) — render any payload your backend sends.
- [**Generative UI**](./genui/overview.md) — stream LitElement components inline.
