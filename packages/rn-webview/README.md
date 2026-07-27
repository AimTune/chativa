# @chativa/rn-webview

Embeds the existing Chativa web chat widget inside a `react-native-webview`,
bridged to native props/callbacks — instead of re-implementing the UI as
native RN views. Tracks [AimTune/chativa#6](https://github.com/AimTune/chativa/issues/6).

## Why WebView instead of native components

The package started out scoped as a from-scratch native re-implementation
(RN `View`/`FlatList`/`Pressable` + FlashList). That was reconsidered: a
WebView wrapper around the *already-shipping* `@chativa/ui` +
`@chativa/genui` widget gets full feature parity with the web build for
free — every message type, every GenUI component, every connector — with no
UI code to port or keep in sync. The tradeoff is WebView UX limits
(keyboard resize timing, scroll/momentum feel, animation smoothness), which
are the reason a **true native UI is tracked as a separate, conditional
follow-up per platform**:

- iOS: [AimTune/chativa#29](https://github.com/AimTune/chativa/issues/29)
- Android: [AimTune/chativa#30](https://github.com/AimTune/chativa/issues/30)

Both are explicitly scoped as "only build this if the WebView approach turns
out to be insufficient in a real app" — not committed work.

## How it works

`<ChativaWebView>` renders a `react-native-webview` pointed at a
self-contained HTML document built by `buildBootstrapHtml()`. That document:

1. Loads `@chativa/core`, `@chativa/ui` (which itself pulls in
   `@chativa/genui`), and whichever connector script the `connector` prop
   asks for — each from that package's own CDN/global (IIFE) build, via
   jsdelivr by default (`https://cdn.jsdelivr.net/npm/<pkg>@latest/dist/...`).
   Override `cdnBaseUrl`/`versions` to pin exact versions or point at bundled
   local assets for offline use.
2. Constructs the connector (`new window.<Global>.<ClassName>(options)`) and
   assigns `window.chativaSettings` — the *same* global-config convention
   `@chativa/core`'s `applyGlobalSettings()` already reads on the web, just
   built dynamically instead of hand-written.
3. Forces `windowMode: "inline"` and calls `chatStore.getState().open()` so
   the widget fills the WebView immediately — there's no separate launcher
   button in this embedding (the RN screen presenting the WebView *is* the
   launcher).
4. Mounts `<chat-iva>` and bridges `@chativa/core`'s `EventBus` to
   `ReactNativeWebView.postMessage`, which `<ChativaWebView>` turns back into
   the same event props `@chativa/react`'s `<ChatIva>` exposes: `onMessage`,
   `onMessageSent`, `onConnect`, `onDisconnect`, `onSurveySubmit`,
   `onWidgetOpen`, `onWidgetClose`.

Because the widget's JS (core + connector + UI) genuinely runs inside the
WebView's browser engine, **every existing `@chativa/connector-*` package
works completely unmodified** — `connector-websocket`, `-signalr`,
`-directline`, `-sse`, `-http` all already have CDN builds (see each
package's `jsdelivr` field / `vite.config.cdn.ts`). A connector without one
(e.g. `@chativa/connector-mekik`, or a private connector) still works via
`{ type: "custom", scriptUrl, globalName, className, options }`.

```tsx
import { ChativaWebView } from "@chativa/rn-webview";

<ChativaWebView
  connector={{ type: "dummy", options: { replyDelay: 500 } }}
  onMessage={(m) => console.log(m)}
  style={{ flex: 1 }}
/>;
```

Live theme updates after mount go through the bridge rather than a prop
change (changing `connector`/`theme` props doesn't re-render the HTML — that
would fully reload the WebView and reconnect):

```tsx
import { sendToChativaWebView } from "@chativa/rn-webview";

sendToChativaWebView(webViewRef, { type: "set_theme", payload: { colors: { primary: "#000" } } });
```

## Building

`pnpm build` runs `react-native-builder-bob` (`module` + `commonjs` +
`typescript` targets). Unlike `@chativa/ui`/`@chativa/genui` — which alias
`@chativa/core` to its *source* in `tsconfig.json` so their vite +
`vite-plugin-dts` build can roll everything into one bundled `.d.ts` — this
package resolves `@chativa/core` through its normal **built** `dist/index.d.ts`
(plain `node_modules` resolution). Bob's `typescript` target is a bare `tsc`
declaration emit with no rollup step, and aliasing to source there made `tsc`
mirror `@chativa/core`'s entire source tree into this package's own
`lib/typescript` output instead of a clean `src/index.d.ts`. Practical effect:
**run `pnpm --filter @chativa/core build` at least once before this
package's `typecheck`/`build` will see local `@chativa/core` changes** — in
the release pipeline this is a non-issue since `pnpm -r build` already
builds packages in dependency order.

## Known gaps

- **File/image upload isn't bridged yet.** A plain HTML `<input type="file">`
  inside a WebView is a poor mobile experience; the intent is for the web
  side to ask RN to open `react-native-image-picker` (or the Expo
  equivalent) and inject the result back over the bridge, but that round
  trip isn't implemented — `sendFile` in the embedded widget currently only
  works with whatever the WebView's own file input gives it.
- **`i18n` per-language overrides** — only the flat format (applied to every
  language) is wired through `buildBootstrapHtml`, matching
  `@chativa/react`'s `ChativaProvider` scope decision, not the full
  per-language `ChativaSettings.i18n` shape.
- **No offline/bundled-asset story yet** — `cdnBaseUrl` accepts a local
  `file://` base in principle, but nothing here packages `dist/*.global.js`
  files as RN assets; today this requires the device to have network access
  to jsdelivr (or an override URL).
- No tests yet.

## `DOM` leaks in `@chativa/core`

No longer a blocker for *this* package specifically — `@chativa/core` runs
*inside* the WebView's real browser engine here, where `window`/`File`/
`HTMLElement` genuinely exist. It would still matter for the native-fallback
issues (#29/#30) if those end up running any core logic directly in RN's own
JS runtime (Hermes) rather than only using `@chativa/core` for types on that
side too.
