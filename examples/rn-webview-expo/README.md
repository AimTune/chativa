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
- `sendToChativaWebView(ref, { type: "set_theme", payload })` — pushing a
  live update into an already-mounted WebView, rather than relying on a prop
  change (which would reload the page and reconnect).

## Not verified by an automated check

Unlike `examples/react-vite` (typechecked *and* exercised in a real browser
via chrome-devtools during development), this example is typechecked but was
**not** run in an actual Expo Go client/simulator — that requires a device or
emulator this environment doesn't have. If something doesn't work when you
actually run it, that's the gap to check first.
