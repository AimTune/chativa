# Recipes

Copy-paste starting points for the integrations people ask about most. Each one is complete on its own; the [Getting started](./getting-started.md) page explains the pieces in more depth.

All recipes use the [DirectLine connector](./connectors/directline.md) with a backend token endpoint, because that is the setup you want in production — the [last recipe](#directline-with-a-custom-token-endpoint) shows the endpoint itself. Swap in any other connector the same way.

## React

`@chativa/react` wraps the web components in typed React components. They load `@chativa/ui` lazily on the client, so they are safe to render from a Next.js Server Component tree.

```bash
pnpm add @chativa/react @chativa/core @chativa/connector-directline
```

```tsx
"use client"; // Next.js App Router only

import {
  ChativaProvider,
  ChatIva,
  ChatBotButton,
  type DeepPartial,
  type ThemeConfig,
} from "@chativa/react";
import { DirectLineConnector } from "@chativa/connector-directline";

// Create the connector once, outside the component, so re-renders reuse it.
const connector = new DirectLineConnector({
  tokenGeneratorUrl: "/api/directline/token",
});

// Hoisted for the same reason: `theme` is re-applied whenever its identity changes.
const theme: DeepPartial<ThemeConfig> = {
  colors: { primary: "#1B1464" },
  windowMode: "popup",
};

export function Chat() {
  return (
    <ChativaProvider connector={connector} theme={theme} locale="en">
      <ChatBotButton />
      <ChatIva
        onMessage={(msg) => console.log("bot:", msg)}
        onConnect={() => console.log("connected")}
      />
    </ChativaProvider>
  );
}
```

`<ChativaProvider>` registers the connector (an `IConnector` instance is registered for you; a string must name one already registered) and activates it before any widget mounts. It also accepts `extensions`, `theme`, `locale` and `i18n`. `<ChatIva>` exposes `onMessage`, `onMessageSent`, `onConnect`, `onDisconnect`, `onSurveySubmit`, `onWidgetOpen` and `onWidgetClose`; for any other [EventBus event](./events.md), use the `useChativaEvent(event, handler)` hook.

### Without the wrapper

If you'd rather use the raw custom elements, register the connector in a `useEffect` and point `chatStore` at it:

```tsx
"use client";

import { useEffect } from "react";

export function Chat() {
  useEffect(() => {
    void (async () => {
      await import("@chativa/ui"); // registers <chat-iva> and <chat-bot-button>
      const { ConnectorRegistry, chatStore } = await import("@chativa/core");
      const { DirectLineConnector } = await import("@chativa/connector-directline");

      if (!ConnectorRegistry.has("directline")) {
        ConnectorRegistry.register(
          new DirectLineConnector({ tokenGeneratorUrl: "/api/directline/token" }),
        );
      }
      chatStore.getState().setConnector("directline");
    })();
  }, []);

  return (
    <>
      <chat-bot-button></chat-bot-button>
      <chat-iva></chat-iva>
    </>
  );
}
```

The `ConnectorRegistry.has()` guard keeps React Strict Mode's double-invoked effects from registering twice. See [Getting started → React](./getting-started.md#react-and-nextjs) for the JSX type declarations the custom elements need.

## Vue 3 (`<script setup>`)

There is no Vue wrapper package — Vue renders custom elements natively once you tell its compiler which tags are custom elements.

```bash
pnpm add @chativa/ui @chativa/core @chativa/connector-directline
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag.startsWith("chat-") || tag.startsWith("genui-"),
        },
      },
    }),
  ],
});
```

```vue
<!-- ChatWidget.vue -->
<script setup lang="ts">
import { onBeforeUnmount } from "vue";
import "@chativa/ui"; // registers <chat-iva> and <chat-bot-button>
import { ConnectorRegistry, chatStore, EventBus, type IncomingMessage } from "@chativa/core";
import { DirectLineConnector } from "@chativa/connector-directline";

// <script setup> runs before the template mounts, so the connector is
// active by the time <chat-iva> connects.
if (!ConnectorRegistry.has("directline")) {
  ConnectorRegistry.register(
    new DirectLineConnector({ tokenGeneratorUrl: "/api/directline/token" }),
  );
}
chatStore.getState().setConnector("directline");
chatStore.getState().setTheme({ colors: { primary: "#42b883" } });

const onMessage = (msg: IncomingMessage) => console.log("bot:", msg);
EventBus.on("message_received", onMessage);
onBeforeUnmount(() => EventBus.off("message_received", onMessage));
</script>

<template>
  <chat-bot-button />
  <chat-iva />
</template>
```

With Nuxt (or any SSR setup), `@chativa/ui` must not be evaluated on the server: wrap the component in `<ClientOnly>`, or move the imports into `onMounted` with dynamic `import()` as in the React example above.

## WordPress

No build step: load the two CDN bundles from your theme (or a small plugin), set `window.chativaSettings` before the widget script runs, and print the elements in the footer.

```php
<?php
// functions.php (child theme) — or a tiny must-use plugin

add_action( 'wp_enqueue_scripts', function () {
    // Exposes window.ChativaDirectLine. Pin versions in production.
    wp_enqueue_script(
        'chativa-directline',
        'https://cdn.jsdelivr.net/npm/@chativa/connector-directline/dist/chativa-directline.global.js',
        array(),
        null,
        true
    );
    // Core + UI + GenUI in one file. Exposes window.Chativa.
    wp_enqueue_script(
        'chativa',
        'https://cdn.jsdelivr.net/npm/@chativa/ui/dist/chativa.global.js',
        array( 'chativa-directline' ),
        null,
        true
    );

    $options = array(
        'tokenGeneratorUrl' => rest_url( 'chativa/v1/directline-token' ),
        'locale'            => str_replace( '_', '-', get_locale() ),
    );

    // Runs after chativa-directline loads and before chativa.global.js.
    wp_add_inline_script( 'chativa', sprintf(
        'window.chativaSettings = {
            connector: new ChativaDirectLine.DirectLineConnector(%s),
            theme: { colors: { primary: "#1B1464" }, position: "bottom-right" },
            locale: %s,
        };',
        wp_json_encode( $options ),
        wp_json_encode( substr( get_locale(), 0, 2 ) )
    ), 'before' );
} );

add_action( 'wp_footer', function () {
    echo '<chat-bot-button></chat-bot-button><chat-iva></chat-iva>';
} );
```

`<chat-iva>` reads `window.chativaSettings` once, when it connects — that is why the settings script must come first. `connector` accepts a connector instance (registered for you) or the name of one already registered; `theme`, `locale` and `i18n` follow [`ChativaSettings`](./configuration.md).

The backend half is a REST route that exchanges your DirectLine secret for a token. Keep the secret in `wp-config.php` (`define( 'CHATIVA_DIRECTLINE_SECRET', '…' );`), never in the page:

```php
<?php
add_action( 'rest_api_init', function () {
    register_rest_route( 'chativa/v1', '/directline-token', array(
        'methods'             => 'POST',
        'permission_callback' => '__return_true',
        'callback'            => function () {
            $user_id  = 'dl_' . wp_generate_uuid4();
            $response = wp_remote_post(
                'https://directline.botframework.com/v3/directline/tokens/generate',
                array(
                    'headers' => array(
                        'Authorization' => 'Bearer ' . CHATIVA_DIRECTLINE_SECRET,
                        'Content-Type'  => 'application/json',
                    ),
                    'body'    => wp_json_encode( array( 'user' => array( 'id' => $user_id ) ) ),
                )
            );
            if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
                return new WP_Error( 'chativa_token', 'Token generation failed', array( 'status' => 502 ) );
            }
            $body = json_decode( wp_remote_retrieve_body( $response ), true );
            return array(
                'token'          => $body['token'],
                'conversationId' => $body['conversationId'],
                'userId'         => $user_id,
            );
        },
    ) );
} );
```

Prefer to build the DOM yourself? `Chativa.render(document.body, { connector, theme, button: true })` writes the same settings and appends both elements in one call.

## DirectLine with a custom token endpoint

Never ship a DirectLine **secret** to the browser. Instead, give the connector the URL of an endpoint on your own backend that exchanges the secret for a short-lived token:

```ts
import { DirectLineConnector } from "@chativa/connector-directline";

new DirectLineConnector({ tokenGeneratorUrl: "/api/directline/token" });
```

### The endpoint contract

| | |
|---|---|
| **Request** | `POST <tokenGeneratorUrl>` — no body and no custom headers. `fetch`'s default `credentials: "same-origin"` applies, so cookies are sent only when the endpoint is on the page's origin. |
| **Success** | `2xx` with a JSON body `{ "token": string, "conversationId"?: string, "userId"?: string }`. |
| **Failure** | Any non-`2xx` status. `connect()` throws `Token generator failed: <status>` and the connector status becomes `"error"`. |

Field by field:

- `token` — required. The DirectLine token the connector opens the conversation with.
- `conversationId` — optional. Return the one DirectLine issued with the token.
- `userId` — optional. When present, it **replaces** the connector's `userId`, so the id your backend bound into the token is the one sent on every activity. DirectLine expects such ids to start with `dl_`.

A minimal Node/Express implementation:

```ts
app.post("/api/directline/token", async (req, res) => {
  const userId = `dl_${req.session?.userId ?? crypto.randomUUID()}`;

  const r = await fetch("https://directline.botframework.com/v3/directline/tokens/generate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.DIRECTLINE_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user: { id: userId } }),
  });
  if (!r.ok) return res.status(502).json({ error: "token_generation_failed" });

  const { token, conversationId } = await r.json();
  res.json({ token, conversationId, userId });
});
```

### How the connector uses it

- **When it's called** — once per `connect()`: on startup and again on each automatic reconnect attempt after a dropped connection.
- **Precedence** — `tokenGeneratorUrl` wins over `token` and `secret` when more than one is set. The schema asks for exactly one.
- **Refresh** — your endpoint is *not* called to refresh. The connector reads the JWT's `exp`, refreshes against DirectLine's own `/tokens/refresh` 60 seconds before expiry, and does the same if DirectLine reports the token expired.
- **Resume** — with `resumeConversation: true`, a reload first tries to refresh the token persisted in `localStorage`; the endpoint is only called when there is nothing to resume or that refresh fails.
- **Sovereign clouds** — `domain` changes where the connector refreshes and connects; point your endpoint's `tokens/generate` call at the same cloud.

### Cross-origin or authenticated endpoints

The connector sends no `Authorization` header and no cookies cross-origin. If the endpoint lives on another origin, allow it with CORS (the request has no body, so a plain `Access-Control-Allow-Origin` is enough) and authenticate by something other than cookies. If it needs a bearer token of your own, fetch the DirectLine token yourself and pass it as `token` instead:

```ts
const res = await fetch("https://api.example.com/directline/token", {
  method: "POST",
  headers: { Authorization: `Bearer ${await getAccessToken()}` },
});
const { token } = await res.json();

new DirectLineConnector({ token });
```

The trade-off: a fixed `token` is reused on reconnect (it is still refreshed before expiry), whereas `tokenGeneratorUrl` mints a fresh one each time.

All options: [DirectLine connector](./connectors/directline.md#options) · schema: [`schemas/connectors/directline.schema.json`](../schemas/connectors/directline.schema.json).
