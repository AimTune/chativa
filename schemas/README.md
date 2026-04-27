# Chativa JSON Schemas

Single source of truth for every JSON-serialisable Chativa contract. Each schema is paired 1:1 with a TypeScript type in `packages/core/src/domain/`. Editors and IDEs that understand `$schema` (VS Code, IntelliJ, Cursor) get auto-completion, validation, and inline docs for free.

> **Sync rule (mandatory).** When you change a TypeScript type listed below, you **MUST** update its schema in the same commit and run the schema-drift test. PRs that touch the type but not the schema (or vice versa) are rejected by CI. See [AGENTS.md → Schema sync](../AGENTS.md#schema-sync-rule).

## Index

### Top-level

| Schema | TypeScript source | Purpose |
|---|---|---|
| [chativa-settings.schema.json](./chativa-settings.schema.json) | `application/ChativaSettings.ts` → `ChativaSettings` | Top-level config object — what `window.chativaSettings` accepts |
| [theme.schema.json](./theme.schema.json) | `domain/value-objects/Theme.ts` → `ThemeConfig` | Theme + behavioural flags passed to `chatStore.getState().setTheme()` |

### Messages

| Schema | TypeScript source |
|---|---|
| [messages/incoming-message.schema.json](./messages/incoming-message.schema.json) | `domain/entities/Message.ts` → `IncomingMessage` |
| [messages/outgoing-message.schema.json](./messages/outgoing-message.schema.json) | `domain/entities/Message.ts` → `OutgoingMessage` |
| [messages/message-action.schema.json](./messages/message-action.schema.json) | `domain/entities/Message.ts` → `MessageAction` |
| [messages/history-result.schema.json](./messages/history-result.schema.json) | `domain/entities/Message.ts` → `HistoryResult` |
| [messages/conversation.schema.json](./messages/conversation.schema.json) | `domain/entities/Conversation.ts` → `Conversation` |
| [messages/survey-payload.schema.json](./messages/survey-payload.schema.json) | `domain/ports/IConnector.ts` → `SurveyPayload` |

### Generative UI

| Schema | TypeScript source |
|---|---|
| [genui/ai-chunk.schema.json](./genui/ai-chunk.schema.json) | `domain/entities/GenUI.ts` → `AIChunk` |

### Connector options

Each connector's constructor `Options` interface:

| Schema | TypeScript source |
|---|---|
| [connectors/dummy.schema.json](./connectors/dummy.schema.json) | `connector-dummy/src/DummyConnector.ts` |
| [connectors/websocket.schema.json](./connectors/websocket.schema.json) | `connector-websocket/src/WebSocketConnector.ts` → `WebSocketConnectorOptions` |
| [connectors/signalr.schema.json](./connectors/signalr.schema.json) | `connector-signalr/src/SignalRConnector.ts` → `SignalRConnectorOptions` |
| [connectors/directline.schema.json](./connectors/directline.schema.json) | `connector-directline/src/DirectLineConnector.ts` → `DirectLineConnectorOptions` |
| [connectors/sse.schema.json](./connectors/sse.schema.json) | `connector-sse/src/SseConnector.ts` → `SseConnectorOptions` |
| [connectors/http.schema.json](./connectors/http.schema.json) | `connector-http/src/HttpConnector.ts` → `HttpConnectorOptions` |

## How to use a schema in your editor

```jsonc
// chativa.config.json
{
  "$schema": "https://aimtune.github.io/chativa/schemas/chativa-settings.schema.json",
  "connector": "directline",
  "theme": {
    "colors": { "primary": "#1B1464" },
    "windowMode": "popup"
  }
}
```

VS Code, IntelliJ, and most editors will fetch the schema and provide auto-completion + validation while you type.

## How the drift test works

`packages/core/src/__tests__/schema-drift.test.ts` runs in `pnpm test`. It:

1. Imports `ThemeConfig` keys via TypeScript reflection.
2. Reads `schemas/theme.schema.json`.
3. Fails if any field exists on one side but not the other.

When you add a field to `ThemeConfig`, the test fails until you mirror it in the schema.

## Adding a new schema

1. Add the TypeScript type in the appropriate `domain/` file.
2. Create `schemas/<area>/<name>.schema.json` — copy the closest existing schema as a starting template.
3. Add a row to this index.
4. If the type is high-traffic (likely to drift), extend the drift test to cover it.
