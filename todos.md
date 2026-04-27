# Chativa — Pending Work

Backlog for things we deliberately deferred. Not a full issue tracker — this file is for cross-PR reminders that should not get lost between sessions. Anything finished moves out of here; anything new gets a one-line checkbox.

---

## Sandbox redesign (separate PR)

The current sandbox panel (`apps/sandbox/src/sandbox/SandboxControls.ts`) packs every section into a 272 px scroll. We agreed to re-do it with a sidebar + per-feature tabs + a generated-config drawer in a follow-up PR.

- [ ] Convert `SandboxControls` from single-scroll to sidebar + tabs (one tab per section: Theme, Layout, Connector, Messages, GenUI, Survey, Typing, Actions, Extensions).
- [ ] Add a right-hand live preview area with viewport-resize controls (so the same widget can be tested at desktop / tablet / mobile widths).
- [ ] Generated-config drawer at the bottom:
  - [ ] Computes the full `ChativaSettings` JSON from the live store + connector + extension state.
  - [ ] **Copy as JSON** button.
  - [ ] **Copy as `<chat-iva>` HTML snippet** button.
  - [ ] **Download `chativa.config.json`** button.
- [ ] **Paste-to-apply**: a `<textarea>` accepts a JSON blob; on apply, validate against `chativa-settings.schema.json` and call `chatStore.setTheme()` + `setConnector()` accordingly. (User ruled out URL-hash sharing — JSON paste is the only import path.)
- [ ] Capability badges per connector — when a connector is selected, show which optional capabilities (`sendFile`, `loadHistory`, `onMessageStatus`, `sendSurvey`, `onGenUIChunk`, `listConversations`, …) are available, dimmed for unsupported.
- [ ] Preset selector with at least: Default, Dark, Compact, Minimal — each preset writes a partial `ThemeConfig`.
- [ ] Per-tab "Reset section" + global "Reset all".
- [ ] Mobile responsive: collapse sidebar into a top tab bar under 768 px.
- [ ] Each tab links to its corresponding `docs/<topic>.md` page so README → docs → sandbox cross-link cleanly.

## Screenshots (you, not the agent)

- [ ] Capture every shot listed in `docs/assets/screenshots/README.md` and drop them into the matching folder. Filenames are pinned — the docs already reference them.
- [ ] Drop the four toolbar icon PNGs into `apps/chrome-extension/public/icons/` (`icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`). The Vite plugin in `apps/chrome-extension/vite.config.ts` copies them to `dist/icons/` automatically.
- [ ] (Optional) `public/og-cover.png` (1280 × 640) for GitHub social card / OG share image.

## Chrome extension polish

- [ ] After icons land, build the extension and verify Chrome shows the toolbar icon at every DPI.
- [ ] Add a footer to the popup that links to the GitHub Pages sandbox + the docs hub.
- [ ] (Stretch) "Open docs for this section" button next to each collapsed section in the popup.

## Schema coverage

- [ ] Extend `schema-drift.test.ts` to cover the connector option schemas (`*ConnectorOptions`) — currently only `ThemeConfig` is mechanically guarded.
- [ ] Cover `IncomingMessage` / `OutgoingMessage` / `AIChunk` / `Conversation` / `SurveyPayload` similarly.

## Docs follow-ups

- [ ] Add a "common recipes" page (`docs/recipes.md`): "embed in React", "embed in Vue", "embed in Wordpress", "with a custom token endpoint".
- [ ] Add a sequence diagram to `docs/genui/streaming.md` showing the `sendEvent` → `receiveComponentEvent` round-trip.
- [ ] Cross-link `EventBus` payloads as a separate `docs/events.md` page.

## Skipped on purpose

- ❌ URL-hash config sharing in the sandbox. (User ruled out — JSON paste is the only import path.)

---

> When you finish an item, delete the bullet (don't mark it strikethrough). Keep this file short.
