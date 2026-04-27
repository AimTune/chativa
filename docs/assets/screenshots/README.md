# Screenshots

Drop-in target for every image referenced from the docs. Filenames are pinned — once you save a PNG with the listed name in the listed folder, the matching `![…](…)` in the docs starts rendering automatically.

> Capture at 2× pixel density when you can. Recommended formats: `.png` for UI, `.gif`/`.mp4` only when motion really helps.

## Hero (used by README + landing docs)

`docs/assets/screenshots/hero/`

| Filename | Where it's used | What it should show |
|---|---|---|
| `hero-closed-open.png` | [README](../../../README.md), [docs/getting-started.md](../../getting-started.md) | The widget closed (just the launcher button) on the left, the same widget open with a sample conversation on the right. Light background, default theme. |
| `architecture.png` | [docs/architecture.md](../../architecture.md) | The hexagonal architecture diagram exported from a Figma/draw.io render. PNG export of the same mermaid diagram is fine if you'd rather skip Figma. |
| `window-modes.png` | [docs/theming.md](../../theming.md#window-modes) | Four panels side by side: `popup`, `side-panel`, `fullscreen`, `inline`. |

## Sandbox (used by docs/sandbox.md and feature pages)

`docs/assets/screenshots/sandbox/`

| Filename | Where it's used | What it should show |
|---|---|---|
| `overview.png` | [docs/sandbox.md](../../sandbox.md) | Full sandbox view with the customisation panel + injected widget visible. |
| `survey-screen.png` | [docs/survey.md](../../survey.md) | The survey overlay (`mode: "screen"`) with stars + comment field. |
| `multi-conversation.png` | [docs/multi-conversation.md](../../multi-conversation.md) | The conversation list view inside the popup. |

## Built-in message types

`docs/assets/screenshots/message-types/`

One file per type, used in [docs/message-types/built-in.md](../../message-types/built-in.md):

| Filename | Type |
|---|---|
| `text.png` | `text` (Markdown sample) |
| `image.png` | `image` |
| `card.png` | `card` |
| `buttons.png` | `buttons` |
| `quick-reply.png` | `quick-reply` |
| `carousel.png` | `carousel` |
| `file.png` | `file` |
| `video.png` | `video` |

## GenUI components

`docs/assets/screenshots/genui/`

One file per built-in component, used in [docs/genui/built-in.md](../../genui/built-in.md):

| Filename | Component |
|---|---|
| `form.png` | `genui-form` |
| `card.png` | `genui-card` |
| `table.png` | `genui-table` |
| `chart.png` | `genui-chart` (mix of bar / line / pie) |
| `alert.png` | `genui-alert` |
| `quick-replies.png` | `genui-quick-replies` |
| `list.png` | `genui-list` |
| `rating.png` | `genui-rating` |
| `progress.png` | `genui-progress` |
| `steps.png` | `genui-steps` |
| `image-gallery.png` | `genui-image-gallery` |
| `typewriter.png` | `genui-typewriter` |
| `date-picker.png` | `genui-date-picker` |

## Chrome extension

`docs/assets/screenshots/extension/`

| Filename | Used in |
|---|---|
| `popup.png` | [docs/chrome-extension.md](../../chrome-extension.md) — opening shot. |
| `load-unpacked.png` | [docs/chrome-extension.md](../../chrome-extension.md#install) — the `chrome://extensions` page right after Load Unpacked. |
| `inject.png` | [docs/chrome-extension.md](../../chrome-extension.md#usage) — popup on one side, host page with injected widget on the other. |

## Chrome extension — toolbar icons

`apps/chrome-extension/public/icons/`

These are not docs screenshots — they're shipped inside the built extension and referenced from `manifest.json`. Drop the four PNGs and the build copies them into `dist/icons/` automatically (see [vite.config.ts](../../../apps/chrome-extension/vite.config.ts)).

| Filename | Size | Used by |
|---|---|---|
| `icon-16.png` | 16 × 16 | Toolbar icon (browser action). |
| `icon-32.png` | 32 × 32 | High-DPI toolbar. |
| `icon-48.png` | 48 × 48 | `chrome://extensions` listing. |
| `icon-128.png` | 128 × 128 | Chrome Web Store listing + install dialog. |

Square, transparent background, the same brand mark on every size — Chrome rejects mismatched icon styles in the Web Store review.

## Chrome Web Store assets (when you publish)

Not committed to the repo, but useful to keep in sync. The Web Store needs:

- 1 small promo tile (440 × 280)
- 1 large promo tile (920 × 680)
- 1 marquee promo tile (1400 × 560) _(only required for featured listings)_
- 1–5 screenshots (1280 × 800 or 640 × 400)

You can re-use the hero / sandbox screenshots above for the listing screenshots — just resize.

## GitHub social card

`public/og-cover.png` (1280 × 640) — referenced from `<meta property="og:image">` if you add OG tags to the GitHub Pages build later. Optional but a nice touch for shared links.
