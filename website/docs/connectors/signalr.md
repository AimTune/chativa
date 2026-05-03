---
sidebar_position: 4
title: SignalR
description: Microsoft SignalR hub adapter — automatic reconnect, configurable method names, bearer auth.
---

# SignalRConnector

Microsoft SignalR hub adapter. `@microsoft/signalr` is loaded as a **dynamic peer dependency** — install it explicitly:

```bash
pnpm add @microsoft/signalr
```

```ts
import { SignalRConnector } from "@chativa/connector-signalr";

ConnectorRegistry.register(
  new SignalRConnector({
    url: "https://my-server.example.com/chathub",
    receiveMethod: "ReceiveMessage",
    sendMethod: "SendMessage",
    accessTokenFactory: async () => localStorage.getItem("token") ?? "",
  })
);
chatStore.getState().setConnector("signalr");
```

## Options

Schema: [`schemas/connectors/signalr.schema.json`](https://github.com/AimTune/chativa/blob/main/schemas/connectors/signalr.schema.json).

| Field | Default | Description |
|---|---|---|
| `url` _(required)_ | — | Hub URL. |
| `hubName` | `"chat"` | Logical name — informational, not sent on the wire. |
| `receiveMethod` | `"ReceiveMessage"` | Server → client method name. The connector subscribes via `connection.on(receiveMethod, ...)`. |
| `sendMethod` | `"SendMessage"` | Client → server method invoked by `sendMessage()`. |
| `surveyMethod` | `"SendSurvey"` | Client → server method invoked by `sendSurvey()`. |
| `accessTokenFactory` | `() => ""` | Function returning a bearer token (sync or `Promise<string>`). |

## Server hub example

```cs
public class ChatHub : Hub
{
    public async Task SendMessage(OutgoingMessage msg)
    {
        var reply = new IncomingMessage {
            Id = Guid.NewGuid().ToString(),
            Type = "text",
            Data = new { text = $"Echo: {msg.Data.text}" },
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        };
        await Clients.Caller.SendAsync("ReceiveMessage", reply);
    }

    public Task SendSurvey(SurveyPayload payload) => /* persist */;
}
```

## Reconnect

The connector enables `withAutomaticReconnect()` on the hub builder. SignalR handles backoff internally; you don't need to configure anything else.
