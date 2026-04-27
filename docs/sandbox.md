# Sandbox

The interactive playground for every Chativa feature. Hosted at **<https://aimtune.github.io/chativa/>**.

![Sandbox overview](./assets/screenshots/sandbox/overview.png)
> _Screenshot placeholder._

## What's inside

The sandbox is a single Vite app at `apps/sandbox/`. The current iteration packs every control into a left-side panel with seven sections — see the screenshot above. A sectioned + tabbed redesign is on the [todos](../todos.md) list.

| Section | What it controls | Source |
|---|---|---|
| Appearance | Colors, position, size, layout, window mode | `apps/sandbox/src/sandbox/sections/AppearanceSection.ts` |
| Features | `enableSearch`, `enableFileUpload`, `enableMultiConversation`, message status, fullscreen, draggable | `FeaturesSection.ts` |
| Messages | Inject demo messages of every built-in type | `MessagesSection.ts` |
| GenUI | Trigger every demo stream (form, card, table, chart, …) | `GenUISection.ts` |
| Typing | On/off + duration vs. until-message | `TypingSection.ts` |
| Survey | Toggle, mode, trigger, rating, kind, resetOnSubmit | `SurveySection.ts` |
| Actions | `connect`, `disconnect`, `clear`, `loadMore`, fire EventBus events | `ActionsSection.ts` |

There are also two extra entry points:

- `theme-editor.html` — visual color/layout editor that exports JSON or `ThemeBuilder` code.
- `agent-panel.html` — multi-conversation demo against `DummyConnector`.

## Running locally

```bash
pnpm install
pnpm dev          # serves http://localhost:5173
```

Hot reload is wired to every package in the workspace via Vite aliases (see [`apps/sandbox/vite.config.ts`](../apps/sandbox/vite.config.ts)) — editing `packages/core` immediately re-renders the sandbox.

## Building for GitHub Pages

```bash
VITE_BASE=/chativa/ pnpm --filter sandbox build
```

CI publishes the result to `gh-pages` and the live site at the URL above.

## Coming soon

The sandbox is being redesigned into a tabbed editor with:

- one tab per feature (clearer surface area)
- a "paste JSON to apply" import box
- copy / download for the current `ChativaSettings` blob
- preset selector (Default, Dark, Compact, Minimal)
- capability badges for the active connector

Tracked in [`todos.md`](../todos.md). Until then, the existing single-panel layout is the source of truth.
