# Sandbox

The interactive playground for every Chativa feature. Hosted at **<https://chativa.aimtune.dev/sandbox/>**.

![Sandbox overview](./assets/screenshots/sandbox/overview.png)
> _Screenshot placeholder._

## What's inside

The sandbox is a single Vite app at `apps/sandbox/`. The customisation panel docks to the left of the viewport with a vertical tab rail; each tab is a self-contained section component. The whole layout collapses to a bottom-anchored panel with a horizontal tab strip on viewports under 768 px.

| Tab | What it controls | Source |
|---|---|---|
| Appearance | Theme presets, colors, position, size, layout, window mode | `apps/sandbox/src/sandbox/sections/AppearanceSection.ts` |
| Connector | Active connector + status, kind picker (Dummy, DirectLine), per-kind options, capability matrix | `ConnectorSection.ts` |
| Features | `enableSearch`, `enableFileUpload`, `enableMultiConversation`, `showMessageStatus`, `allowFullscreen`, `hideButtonOnOpen` | `FeaturesSection.ts` |
| Messages | Inject demo messages of every built-in type | `MessagesSection.ts` |
| GenUI | Trigger every demo stream (form, card, table, chart, …) | `GenUISection.ts` |
| Typing | On/off + duration vs. until-message | `TypingSection.ts` |
| Survey | Toggle, mode, trigger, rating, kind, resetOnSubmit | `SurveySection.ts` |
| Actions | `connect`, `disconnect`, `clear`, `loadMore`, fire EventBus events | `ActionsSection.ts` |
| Config | Generated `ChativaSettings` JSON / HTML snippet / paste-to-apply | `ConfigSection.ts` |
| Preview | Live preview area — render the widget at Mobile / Tablet / Desktop / Free sizes (hidden under 768 px) | `PreviewSection.ts`, `PreviewStage.ts` |

Each tab has a sticky toolbar with a **Docs ↗** link to the matching `docs/` page and, where relevant, a **Reset** button that wipes that tab's fields back to baseline. The tab rail also has a global **Reset all** entry that mirrors the Default preset and clears the message store.

There are also two extra entry points:

- `theme-editor.html` — visual color/layout editor that exports JSON or `ThemeBuilder` code.
- `agent-panel.html` — multi-conversation demo against `DummyConnector`.

## Theme presets

The Appearance tab exposes four one-click presets:

- **Default** — full reset to documented baseline.
- **Dark** — dark-palette colors.
- **Compact** — small launcher + 320 × 440 panel.
- **Minimal** — disables search, file upload, fullscreen toggle, and the survey flow.

Presets are cumulative — Dark + Compact gives you a small dark widget. Click Default to wipe.

## Generated config

The Config tab shows a live `ChativaSettings` JSON diff (only the fields you've changed against `DEFAULT_THEME`), pinned with a `$schema` URL pointing at the schema hosted on this same GitHub Pages deployment. Copy as JSON, copy as drop-in HTML snippet, or download `chativa.config.json`.

The same tab has an Import view — paste a `ChativaSettings` blob, click Apply, and it validates the shape and routes the override into `chatStore.setTheme()` / `setConnector()`.

## Preview area

The **Preview** tab opens a live preview area to the right of the panel, so you can check responsive behavior without resizing the browser. Pick a viewport from the tab, or from the chip toolbar above the preview frame:

| Chip | Size |
|---|---|
| Mobile | 390 × 844 |
| Tablet | 768 × 1024 |
| Desktop | 1280 × 800 |
| Free | Drag the frame's bottom-right corner to any size (starts at 480 × 720) |

- The widget switches to `windowMode: "inline"` and fills the frame, so `theme.layout.width` / `height` do not apply while previewing — the frame size does. The previous window mode is restored when the preview closes.
- When a preset is larger than the free space, the frame is scaled down with a CSS transform. The toolbar always shows the real size in CSS pixels, plus the zoom level when scaled (for example `1280 × 800 · 62%`).
- The selected viewport persists across tab switches. It is cleared by the Preview tab's **Reset**, the **×** in the preview toolbar, **Reset all**, or picking another window mode in the Appearance tab (which keeps that new mode).
- While the preview is open the floating launcher is hidden; if you close the widget from its header, the frame shows an **Open widget** button.
- The Config tab reflects `windowMode: "inline"` while the preview is open, because the preview drives the real theme.
- The tab and the preview area are hidden on viewports 768 px wide or narrower — there, the page itself is already the small case.

The preview is **single-instance**: it does not mount a second `<chat-iva>`. The page's one widget is wrapped in `<sandbox-preview-stage>`, which is a transparent wrapper (`display: contents`) until a viewport is picked and then slots the same widget into the sized frame. `chatStore` and `messageStore` are global singletons, so a second widget would share `isOpened`, the theme and the window mode with the first, and both would build a `ChatEngine` over the same registered connector (two `connect()` calls, one overwritten `onMessage` handler). Moving the widget to a new parent element is avoided too, because `disconnectedCallback` destroys its engine.

## Running locally

```bash
pnpm install
pnpm dev          # serves http://localhost:5173
```

Hot reload is wired to every package in the workspace via Vite aliases (see [`apps/sandbox/vite.config.ts`](../apps/sandbox/vite.config.ts)) — editing `packages/core` immediately re-renders the sandbox. The Vite plugin in that file also serves the workspace `schemas/` folder under `/schemas/*` in dev and copies the tree into `dist/schemas/` on build, so the schema `$id` URLs resolve when the sandbox is served from GitHub Pages.

## Building for GitHub Pages

```bash
VITE_BASE=/chativa/ pnpm --filter sandbox build
```

CI publishes the result to `gh-pages` and the live site at the URL above.
