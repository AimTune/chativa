# DirectLineConnector

Azure Bot Framework DirectLine v3 adapter. The richest connector — implements typing indicators, file upload, history pagination, message status (sent/read), like/dislike feedback, custom event handlers, conversation resume across reloads, and survey delivery.

```ts
import { DirectLineConnector } from "@chativa/connector-directline";

ConnectorRegistry.register(
  new DirectLineConnector({
    token: "YOUR_DIRECTLINE_TOKEN",
    locale: "tr-TR",
    resumeConversation: true,
  })
);
chatStore.getState().setConnector("directline");
```

## Options

Schema: [`schemas/connectors/directline.schema.json`](../../schemas/connectors/directline.schema.json).

Provide **exactly one** of `token`, `secret`, or `tokenGeneratorUrl`:

| Field | Default | Description |
|---|---|---|
| `token` | — | Pre-fetched DirectLine token. **Use this in browsers.** |
| `secret` | — | Channel secret. **Server-side only** — exchanges for a token at connect time. Never expose in browser code. |
| `tokenGeneratorUrl` | — | URL of a backend endpoint that POSTs back `{ token, conversationId?, userId? }`. Recommended browser pattern. |
| `userId` | random | Override the user id. Persisted across reloads when `resumeConversation` is true. |
| `userName` | `userId` | Display name on outgoing activities. |
| `domain` | `https://directline.botframework.com/v3/directline` | Sovereign-cloud endpoint (gov, china). |
| `locale` | — | BCP-47 locale (e.g. `tr-TR`) sent in `webchat/join` and outgoing activities. |
| `joinParameters` | `{}` | Extra key/value pairs merged into the `webchat/join` event's `value` payload. |
| `eventHandlers` | `{}` | Map of bot-event names → handler functions. |
| `resumeConversation` | `false` | Persist `conversationId`, `token`, `watermark`, and `userId` to localStorage so reload resumes the same conversation. |
| `typingTimeoutMs` | `3000` | How long the typing indicator stays after a typing signal. Each new signal resets the timer. |
| `typingUntilMessage` | `false` | Keep typing on until the next bot message arrives (no auto-clear). |

## Activity mapping

Inbound DirectLine activities are mapped by `mapActivity.ts` into Chativa's native message types:

| DirectLine activity | Chativa message type |
|---|---|
| `message` (text) | `text` |
| `message` + `attachments[].contentType` = hero card | `card` |
| Adaptive card | `card` (rendered as title/description for now) |
| Suggested actions | `quick-reply` |
| `message` + image attachment | `image` |
| `message` + video attachment | `video` |
| `message` + file attachment | `file` |
| `typing` | typing indicator (no stored message) |
| `event` `name=DisableFeedbackButton` | mutates the message's `feedbackDisabled` flag |
| `event` `name=*` | dispatched to `eventHandlers[name]` if registered |

## Conversation resume

When `resumeConversation: true`:

- The connector persists the conversation in localStorage under `chativa_directline_conversation`.
- On the next page load, it tries to refresh the token via the DirectLine REST API.
- If refresh succeeds, it reconnects with the existing `conversationId` and `watermark`, sends a `webchat/rejoin` event (instead of `webchat/join`), and replays history.
- If refresh fails, it clears the persisted state and starts fresh.

The auto-generated `userId` is also persisted — set `userId` explicitly to override.

## Custom event handlers

```ts
const connector = new DirectLineConnector({
  token: "...",
  eventHandlers: {
    LocationRequest: (ctx) => {
      navigator.geolocation.getCurrentPosition((pos) => {
        ctx.postEvent("webchat/location", {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
      });
    },
  },
});

// You can add / remove handlers at any time:
connector.addEventHandler("MyEvent", (ctx) => { /* ... */ });
connector.removeEventHandler("MyEvent");
```

`ctx` is `EventHandlerContext` — full access to `chativa.messages`, `chativa.chat`, `chativa.theme`, and `chativa.events`.

## Survey delivery

`sendSurvey()` posts an `event` activity with the legacy webchat-friendly shape:

```json
{
  "type": "event",
  "name": "webchat/customerfeedback",
  "value": { "rating": 5, "comment": "Great", "type": 1 }
}
```

`type` is `Number(payload.kind ?? 1)` so existing bot flows that switch on numeric survey kinds keep working.

## Token refresh

The connector decodes the JWT `exp` claim and schedules a refresh **60 seconds before expiry**. When DirectLine emits `ExpiredToken`, it refreshes inline and recreates the connection while preserving the `conversationId` and `watermark`.

## File upload

```ts
const ok = await fetch(`${domain}/conversations/${conversationId}/upload?userId=${userId}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: formData,
});
```

Implemented via `connector.sendFile(file)`. The bot receives the file as an attachment in the next user activity.
