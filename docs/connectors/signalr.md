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


> **Tool calls, GenUI and human-in-the-loop chips** work over this connector via the shared JSON frame vocabulary — see [Rich frames](./frames.md).

## Options

Schema: [`schemas/connectors/signalr.schema.json`](../../schemas/connectors/signalr.schema.json).

| Field | Default | Description |
|---|---|---|
| `url` _(required)_ | — | Hub URL. |
| `hubName` | `"chat"` | Logical name — informational, not sent on the wire. |
| `receiveMethod` | `"ReceiveMessage"` | Server → client method name. The connector subscribes via `connection.on(receiveMethod, ...)`. |
| `sendMethod` | `"SendMessage"` | Client → server method invoked by `sendMessage()`. |
| `surveyMethod` | `"SendSurvey"` | Client → server method invoked by `sendSurvey()`. |
| `genUIEventMethod` | `"SendGenUIEvent"` | Client → server method invoked when a GenUI component fires an event. |
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

## Tool calls, GenUI and HITL from the hub

All of it travels through the **same `receiveMethod`** you already use for messages — no extra hub method, no client changes beyond registering any GenUI component. See [Rich frames](./frames.md) for the full vocabulary.

```cs
public class ChatHub : Hub
{
    public async Task SendMessage(OutgoingMessage msg)
    {
        var send = (object frame) => Clients.Caller.SendAsync("ReceiveMessage", frame);

        await send(new { type = "typing", isTyping = true });

        // A tool call is a lifecycle: re-send the SAME id to advance the row.
        await send(new { type = "tool_call", data = new {
            id = "c1", name = "get_sales_stats", status = "running", @params = new { region = "EMEA" } } });
        await send(new { type = "tool_call", data = new {
            id = "c1", name = "get_sales_stats", status = "completed", result = "42 orders" } });

        // Stream a GenUI component into the bubble.
        await send(new { type = "genui", streamId = "s1", done = true, chunk = new {
            type = "ui", component = "sales-chart", props = new { orders = 42 }, id = 1 } });

        await send(new { type = "typing", isTyping = false });

        // Ask for approval — chips are the human-in-the-loop interrupt.
        await send(new {
            type    = "text",
            id      = Guid.NewGuid().ToString(),
            from    = "bot",
            data    = new { text = "Generate the PDF report?" },
            actions = new[] {
                new { label = "Approve", value = "approve_pdf" },
                new { label = "Cancel" }
            }
        });
    }

    /// A mounted GenUI component fired an event (form submit, card action…).
    /// Name it whatever you like and set `genUIEventMethod` to match.
    public Task SendGenUIEvent(GenUIEventFrame frame)
    {
        // frame.StreamId, frame.EventType, frame.Payload
        return Task.CompletedTask;
    }
}

public record GenUIEventFrame(string StreamId, string EventType, JsonElement Payload);
```

The tapped chip arrives as an ordinary `SendMessage` call with `"approve_pdf"` — there's no separate resume channel to build.

On the client, register the component before connecting:

```ts
import { GenUIRegistry } from "@chativa/genui";

GenUIRegistry.register("sales-chart", "sales-chart-element"); // your LitElement tag
```

## Reconnect

The connector enables `withAutomaticReconnect()` on the hub builder. SignalR handles backoff internally; you don't need to configure anything else.
