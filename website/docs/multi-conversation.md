---
sidebar_position: 2
title: Multi-conversation
description: Agent-panel mode — one user juggling many conversations at once. Requires four optional IConnector hooks.
---

# Multi-conversation mode

For agent-panel and helpdesk scenarios where one user juggles many conversations in parallel.

![Multi-conversation list view](/img/screenshots/sandbox/multi-conversation.png)
> _Screenshot pending capture from the [sandbox](./sandbox.md)._

## Enable

```ts
chatStore.getState().setTheme({ enableMultiConversation: true });
```

A conversations icon appears in the chat header. Clicking it slides in a list; tapping a row swaps the active conversation.

## Connector contract

Multi-conversation mode requires the connector to implement four optional `IConnector` methods:

```ts
interface IConnector {
  // ... required methods (connect, disconnect, sendMessage, onMessage)

  listConversations?(): Promise<Conversation[]>;
  createConversation?(title?: string, metadata?: Record<string, unknown>): Promise<Conversation>;
  switchConversation?(conversationId: string): Promise<void>;
  closeConversation?(conversationId: string): Promise<void>;
  onConversationUpdate?(callback: (conv: Conversation) => void): void;
}
```

`Conversation` shape: see [`schemas/messages/conversation.schema.json`](https://github.com/AimTune/chativa/blob/main/schemas/messages/conversation.schema.json) and [`domain/entities/Conversation.ts`](https://github.com/AimTune/chativa/blob/main/packages/core/src/domain/entities/Conversation.ts).

## How it works under the hood

`MultiConversationEngine` (in `application/`) wraps a single `ChatEngine` and is responsible for:

- Calling `listConversations()` to populate `conversationStore`.
- Routing `switchConversation(id)` calls and swapping the active `messageStore`.
- Subscribing to `onConversationUpdate` for unread counts / status changes.
- Lazy-loading per-conversation message history.

The widget treats it as a single engine — UI components don't need to know whether they're in single or multi mode.

## Sandbox demo

`DummyConnector` ships with three demo conversations and supports `createConversation`. Try it in the sandbox: enable multi-conversation in the panel, then create / switch / close conversations from the slide-in list.

## Test coverage

[`packages/core/src/application/__tests__/MultiConversationEngine.test.ts`](https://github.com/AimTune/chativa/blob/main/packages/core/src/application/__tests__/MultiConversationEngine.test.ts) (24 tests) covers the swap logic, unread propagation, and lazy mount behaviour. Use it as a reference when implementing the four optional methods on your own connector.
