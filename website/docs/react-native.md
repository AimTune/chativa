---
sidebar_position: 4
title: React Native
description: Embed the Chativa widget in a React Native app with @chativa/rn-webview — a WebView bridge with full web feature parity, mekik support and GenUI observability.
---

# React Native

`@chativa/rn-webview` embeds the existing web widget (`@chativa/ui` + `@chativa/genui`) inside a [`react-native-webview`](https://github.com/react-native-webview/react-native-webview), bridged to native props and callbacks. Because the widget's JavaScript genuinely runs inside the WebView's browser engine, you get **full feature parity with the web build** — every message type, every GenUI component, and **every existing `@chativa/connector-*` package works completely unmodified**.

> A from-scratch native RN UI is tracked separately per platform ([#29](https://github.com/AimTune/chativa/issues/29) iOS, [#30](https://github.com/AimTune/chativa/issues/30) Android) as a conditional follow-up — only if the WebView approach doesn't meet the UX bar in practice.

## Install

```bash
pnpm add @chativa/rn-webview react-native-webview
```

Peer dependencies: `react >= 18.2`, `react-native >= 0.74`, `react-native-webview >= 13`. The widget scripts themselves are loaded from a CDN inside the WebView (jsdelivr by default) — see [CDN and versions](#cdn-and-versions). The loaded `@chativa/ui` build must be **>= 0.10**: the bridge binds `window.Chativa.EventBus` / `window.Chativa.chatStore` (the singletons inside the ui bundle), and older builds don't expose them — the bridge then reports a loud `onError` instead of silently observing a disconnected copy of core.

## Quick start

```tsx
import { ChativaWebView } from "@chativa/rn-webview";

<ChativaWebView
  connector={{ type: "dummy", options: { replyDelay: 500 } }}
  theme={{ colors: { primary: "#4f46e5" } }}
  onMessage={(m) => console.log(m)}
  style={{ flex: 1 }}
/>;
```

The widget always renders in `inline` window mode and opens immediately — there is no launcher button in this embedding; the RN screen presenting the WebView *is* the launcher.

## Connector spec

A live `IConnector` instance can't cross the native/web bridge, so the `connector` prop *describes* which connector to construct inside the WebView (`ChativaConnectorSpec`). `options` must be JSON-serializable.

Built-in types (loaded from each connector package's CDN build): `dummy`, `websocket`, `signalr`, `directline`, `http`, `sse`, `mekik`.

A private connector works via `type: "custom"`:

```tsx
<ChativaWebView
  connector={{
    type: "custom",
    scriptUrl: "https://cdn.example.com/my-connector.global.js",
    globalName: "MyConnector",       // window.<globalName> the script assigns itself to
    className: "MyConnector",        // exported class to instantiate from that global
    options: { url: "wss://bot.example.com" },
  }}
/>
```

## Mekik and server-defined GenUI

`connector: { type: "mekik", options }` connects the WebView-hosted widget straight to a [mekik](./connectors/mekik.md) server. [Server-defined GenUI components](./genui/custom-component.md#3-let-the-backend-define-the-component-mekik) render inside the WebView exactly as on the web; React Native observes the flow through the GenUI callbacks:

```tsx
<ChativaWebView
  connector={{
    type: "mekik",
    options: {
      url: "ws://192.168.1.10:8790/chat", // a device can't reach your machine's `localhost`
      resumeConversation: true,
      auth: { kind: "token", token: "my-api-key" },
    },
  }}
  onGenUIComponentsRegistered={({ components }) => console.log("catalog:", components)}
  onGenUIStreamStarted={({ streamId }) => console.log("stream started", streamId)}
  onGenUIStreamCompleted={({ streamId }) => console.log("stream done", streamId)}
  onAuthError={({ code, message }) => console.warn("auth rejected:", code, message)}
  style={{ flex: 1 }}
/>
```

- `onGenUIComponentsRegistered` delivers **summaries only** (`{ name, version?, tag? }`) — the full template stays inside the WebView where it renders.
- Component events (`component-event` / `mekik-event` / `data-event` buttons in a rendered widget) round-trip to the server entirely inside the WebView; RN doesn't need to participate.

**Auth is described, not passed.** [`MekikConnectorOptions.auth`](./connectors/mekik.md#authentication) normally takes a live `TokenAuth` / `CookieAuth` instance, but a class instance can't cross the JSON bridge. The spec's `auth` field (`MekikAuthSpec`) is a plain object rebuilt into the real adapter inside the WebView:

| Spec | Rebuilt as | Notes |
|---|---|---|
| `{ kind: "token", token, transport?, queryParam?, maxRetries? }` | `new TokenAuth({...})` | Only a *string* token — a token-minting function can't be serialized. |
| `{ kind: "cookie" }` | `new CookieAuth()` | The `refresh` callback is likewise unsupported over the bridge. |

`onAuthError` can't be passed inside `options` either; the bootstrap wires it and surfaces rejections as the `onAuthError` prop. Apps that need function credentials should host the widget with `@chativa/react` or supply a `custom` connector script that builds its own provider.

## Props

| Prop | Description |
|---|---|
| `connector` | `ChativaConnectorSpec` — required, see above. |
| `theme` | `DeepPartial<ThemeConfig>` applied on load. |
| `locale`, `i18n` | Same shape as `ChativaSettings` (flat `i18n` overrides only). |
| `cdnBaseUrl` | Base URL scripts are resolved against. Default: jsdelivr `@latest` per package. |
| `versions` | Pin exact versions per package (`{ ui?, dummy?, websocket?, ... }`) instead of `@latest`. |
| `style` | `StyleProp<ViewStyle>` for the underlying WebView. |

Callback props (each is the bridge event it maps to — see the [bridge reference](#bridge-message-reference)): `onReady`, `onMessage`, `onMessageSent`, `onConnect`, `onDisconnect`, `onSurveySubmit`, `onWidgetOpen`, `onWidgetClose`, `onGenUIComponentsRegistered`, `onGenUIStreamStarted`, `onGenUIStreamCompleted`, `onToolCallUpdated`, `onAuthError`, `onError`.

## Live commands after mount

Changing `connector` / `theme` props does **not** re-render the HTML — that would fully reload the WebView and reconnect. Live updates go through the bridge instead, via `sendToChativaWebView(ref, msg)`:

```tsx
import { useRef } from "react";
import type WebView from "react-native-webview";
import { ChativaWebView, sendToChativaWebView } from "@chativa/rn-webview";

const webViewRef = useRef<WebView>(null);

sendToChativaWebView(webViewRef, { type: "set_theme", payload: { colors: { primary: "#000" } } });
sendToChativaWebView(webViewRef, { type: "send_message", payload: { text: "Hello" } });
sendToChativaWebView(webViewRef, { type: "open_widget" });
sendToChativaWebView(webViewRef, { type: "close_widget" });
```

## Bridge message reference

Outbound (WebView → RN), delivered as the matching callback prop:

| message | payload | prop |
|---|---|---|
| `ready` | — | `onReady` |
| `message_received` | `IncomingMessage` | `onMessage` |
| `message_sent` | `OutgoingMessage` | `onMessageSent` |
| `connector_status_changed` | `{ status }` | `onConnect` / `onDisconnect` |
| `survey_submitted` | `SurveyPayload` | `onSurveySubmit` |
| `widget_opened` / `widget_closed` | — | `onWidgetOpen` / `onWidgetClose` |
| `genui_components_registered` | `{ components: [{ name, version?, tag? }] }` | `onGenUIComponentsRegistered` |
| `genui_stream_started` / `genui_stream_completed` | `{ streamId }` | `onGenUIStreamStarted` / `onGenUIStreamCompleted` |
| `tool_call_updated` | `ToolCall` | `onToolCallUpdated` |
| `auth_error` | `{ code, message }` | `onAuthError` |
| `error` | `{ message }` | `onError` |

Inbound (RN → WebView), via `sendToChativaWebView(ref, msg)`:

| message | payload | effect |
|---|---|---|
| `set_theme` | `DeepPartial<ThemeConfig>` | Live theme update. |
| `send_message` | `{ text, markdown? }` | Sends a user message (same path as typing it). |
| `open_widget` / `close_widget` | — | `chatStore.open()` / `.close()`. |

## CDN and versions

The bootstrap page (built by the exported `buildBootstrapHtml()`) loads `@chativa/ui` and the requested connector from each package's CDN/global (IIFE) build — `https://cdn.jsdelivr.net/npm/<pkg>@latest/dist/...` by default. Override `cdnBaseUrl` and/or `versions` to pin exact versions or point at bundled local assets for offline use.

## Known gaps

- **File/image upload isn't bridged yet** — `sendFile` in the embedded widget only works with whatever the WebView's own file input gives it.
- **`i18n` per-language overrides** — only the flat format (applied to every language) is wired through, matching `@chativa/react`'s scope decision.
- **No offline/bundled-asset story yet** — the device needs network access to jsdelivr (or an override URL).
- **No RN-originated GenUI component events** — a rendered widget's buttons round-trip inside the WebView, but native code can't synthesize a component event.

## Example app

[`examples/rn-webview-expo`](https://github.com/AimTune/chativa/tree/main/examples/rn-webview-expo) is a runnable Expo app with a dummy/mekik connector toggle, GenUI event logging and bridge command buttons.
