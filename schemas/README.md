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
| [messages/tool-call.schema.json](./messages/tool-call.schema.json) | `domain/entities/ToolCall.ts` → `ToolCall` |

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
| [connectors/mekik.schema.json](./connectors/mekik.schema.json) | `connector-mekik/src/index.ts` → `MekikConnectorOptions` |

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

Every schema in the index above is guarded by a `schema-drift.test.ts` that runs in `pnpm test`:

- `packages/core/src/domain/value-objects/__tests__/schema-drift.test.ts` — `theme.schema.json`
- `packages/core/src/domain/entities/__tests__/schema-drift.test.ts` — `messages/*` and `genui/ai-chunk.schema.json` (each `oneOf` variant, matched by its `type` const)
- `packages/connector-<name>/src/__tests__/schema-drift.test.ts` — `connectors/<name>.schema.json`

Each test:

1. Declares the type's keys as a mapped-type contract (`{ [K in keyof Required<T>]: true }`) — `pnpm typecheck` fails if the TypeScript type gains or loses a field.
2. Reads the paired schema.
3. Fails if any field exists on one side but not the other.

When you add a field to a paired type, typecheck and the test fail until you mirror it in the schema.

## Adding a new schema

1. Add the TypeScript type in the appropriate `domain/` file.
2. Create `schemas/<area>/<name>.schema.json` — copy the closest existing schema as a starting template.
3. Add a row to this index.
4. Extend the nearest drift test (or, for a new connector, add one to its package) to cover it.
