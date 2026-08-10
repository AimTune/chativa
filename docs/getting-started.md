# Getting Started

Chativa is shipped as a Web Component. You drop one `<script>` and one element into any HTML page — React, Vue, Angular, plain HTML — and you have a working chat widget.

## 1. Install via CDN (zero build)

```html
<!DOCTYPE html>
<html>
<body>
  <script src="https://cdn.jsdelivr.net/npm/@chativa/ui/dist/chativa.global.js"></script>
  <chat-bot-button></chat-bot-button>
  <chat-iva></chat-iva>
</body>
</html>
```

Open the page — the launcher button shows up in the bottom-right. Click it. The default `dummy` connector echoes whatever you type.

`chativa.global.js` is self-contained: it bundles `@chativa/core`, `@chativa/ui` and `@chativa/genui`, and exposes them as `window.Chativa`. Because core is *inside* it, don't also load `chativa-core.global.js` on the same page — the second copy has its own stores, so anything bound to it would silently never fire. For a bundler-based setup, import from `@chativa/ui` instead; the npm build leaves `lit`, `i18next` and `@chativa/core` as normal imports so your bundler resolves one copy of each.

![Hero — widget closed and open](./assets/screenshots/hero/hero-closed-open.png)
> _Screenshot placeholder._

## 2. Install via npm (recommended for production)

```bash
pnpm add @chativa/ui @chativa/core
# pick the connector that matches your backend:
pnpm add @chativa/connector-directline   # Azure Bot Framework
# or @chativa/connector-websocket / connector-signalr / connector-sse / connector-http
```

```ts
// main.ts
import "@chativa/ui";
import { ConnectorRegistry, chatStore } from "@chativa/core";
import { DirectLineConnector } from "@chativa/connector-directline";

ConnectorRegistry.register(
  new DirectLineConnector({ token: "YOUR_DIRECTLINE_TOKEN" })
);
chatStore.getState().setConnector("directline");
```

## 3. Configure declaratively (no build step)

Set `window.chativaSettings` **before** the script tag is parsed. Chativa picks it up on the first connect.

```html
<script>
  window.chativaSettings = {
    connector: "directline",
    theme: {
      colors: { primary: "#1B1464" },
      windowMode: "popup",
      enableSearch: true,
    },
    locale: "tr",
    i18n: {
      all: { header: { title: "Sanal Asistan" } },
    },
  };
</script>
<script src="https://cdn.jsdelivr.net/npm/@chativa/ui/dist/chativa.global.js"></script>
<chat-iva></chat-iva>
```

The full schema for that object is at [`schemas/chativa-settings.schema.json`](../schemas/chativa-settings.schema.json) — drop the `$schema` URL into your JSON file and your editor gives you auto-completion.

## 4. Live sandbox

Every feature in the widget is wired up in the dev sandbox, hosted on GitHub Pages:

➡ **<https://chativa.aimtune.dev/sandbox/>**

See [docs/sandbox.md](./sandbox.md) for the tour.

## Next steps

- **Theme it** → [theming.md](./theming.md)
- **Wire your backend** → [connectors/overview.md](./connectors/overview.md)
- **Render rich messages** → [message-types/overview.md](./message-types/overview.md)
- **Stream AI components inline** → [genui/overview.md](./genui/overview.md)
- **Extend the pipeline** → [extensions.md](./extensions.md)
