# @chativa/rn-webview example (Expo)

Living usage doc for [`@chativa/rn-webview`](../../packages/rn-webview) —
`<ChativaWebView>` wired to `@chativa/connector-dummy`, plus a live
theme-update button using `sendToChativaWebView`.

## Running it

From the repo root (this is a pnpm workspace member, not a standalone app):

```sh
pnpm install
pnpm --filter chativa-example-rn-webview-expo start
```

Then scan the QR code with **Expo Go** (iOS/Android) — no custom dev client
or native build needed, since `react-native-webview` is one of the modules
Expo Go ships with.

This example was scaffolded with `create-expo-app` and depends on
`@chativa/rn-webview`/`@chativa/core` via `workspace:*`. Expo/Metro (SDK 52+)
auto-detects the pnpm workspace root from `pnpm-workspace.yaml` — no manual
`metro.config.js` needed.

## What it shows

- `connector={{ type: "dummy", options: {...} }}` — the connector runs
  *inside* the WebView's own browser engine, not in RN's JS runtime, so this
  is the exact same `DummyConnector` class `@chativa/connector-dummy` ships
  for the web, completely unmodified.
- `onMessage` / `onMessageSent` / `onConnect` / `onReady` / `onError` — the
  bridge surfaces the same event shape `@chativa/react`'s `<ChatIva>` does.
- `sendToChativaWebView(ref, ...)` — pushing live commands into an
  already-mounted WebView (`set_theme`, `send_message`, `open_widget`,
  `close_widget`), rather than relying on a prop change (which would reload
  the page and reconnect).
- GenUI observability callbacks (`onGenUIComponentsRegistered`,
  `onGenUIStreamStarted/Completed`, `onToolCallUpdated`, `onAuthError`) —
  logged to the console; they fire when a server streams GenUI.

## Mekik smoke test (server-defined GenUI components)

Set `USE_MEKIK = true` at the top of `App.tsx` and point `MEKIK_URL` at a
running mekik dev server. A device/emulator can't reach your machine's
`localhost` — use your LAN IP, or `10.0.2.2` from the Android emulator.

Expected console sequence after connecting and sending a prompt that streams
a server-defined component:

1. `genui catalog registered: [{name, version, tag}, ...]` — the server's
   `genui_components` frame was registered as custom elements.
2. `genui stream started: <streamId>` → the component renders in the chat →
   `genui stream completed: <streamId>`.
3. Tapping a `component-event`/`mekik-event` button inside the rendered
   component round-trips to the server entirely inside the WebView (watch
   the server logs for the `genui_event` frame).
4. On an app reload, the catalog comes from the WebView's localStorage cache
   (the `hello` frame carries `componentsHash`; the server replies
   `unchanged: true`).

## Not verified by an automated check

Unlike `examples/react-vite` (typechecked *and* exercised in a real browser
via chrome-devtools during development), this example is typechecked but was
**not** run in an actual Expo Go client/simulator — that requires a device or
emulator this environment doesn't have. If something doesn't work when you
actually run it, that's the gap to check first.
