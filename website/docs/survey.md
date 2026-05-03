---
sidebar_position: 1
title: End-of-conversation survey
description: Built-in star-rating + comment flow on close — connector-routed via the optional sendSurvey() capability.
---

# End-of-Conversation Survey

A built-in star-rating + comment flow that triggers when the user closes the widget (or when you explicitly request it). Submissions go through the connector via the optional `sendSurvey()` capability.

![Survey screen mode](/img/screenshots/sandbox/survey-screen.png)
> _Screenshot pending capture from the [sandbox](./sandbox.md)._

## Configuration

Set under `theme.endOfConversationSurvey`. Default: enabled. Full schema: [`schemas/theme.schema.json`](https://github.com/AimTune/chativa/blob/main/schemas/theme.schema.json) → `endOfConversationSurvey`.

```ts
chatStore.getState().setTheme({
  endOfConversationSurvey: {
    enabled: true,                  // default true
    mode: "screen",                 // "screen" (overlay) | "inline" (bot card)
    trigger: "onClose",             // "onClose" | "manual"
    maxRating: 5,
    requireCommentBelow: 3,         // require text when rating <= 3 (0 to disable)
    kind: 1,                        // forwarded to SurveyPayload.kind
    resetOnSubmit: true,            // tear down engine + connector after submit
  },
});
```

## Modes

| Mode | What the user sees |
|---|---|
| `screen` _(default)_ | Full-height overlay over the chat panel — title, stars, comment, Submit / Skip. |
| `inline` | A bot-authored survey card appended to the message list. |

## Trigger

| Trigger | When the survey shows |
|---|---|
| `onClose` _(default)_ | The header's close button is intercepted. The survey appears; only after submit/skip does the widget actually close. |
| `manual` | Only when the host page dispatches a `show-survey` event on the widget. |

```js
document.querySelector("chat-iva")?.dispatchEvent(new CustomEvent("show-survey"));
```

## Resetting on submit

`resetOnSubmit: true` (default) is the right choice for most kiosks and customer-care flows: a new visit means a new conversation. Set it to `false` to keep the session, history, and connection alive — useful when the survey is just a checkpoint, not an ending.

## Connector contract

When the user submits, `ChatEngine` calls `connector.sendSurvey(payload)`:

```ts
interface SurveyPayload {
  rating: number;
  comment?: string;
  kind?: string | number;
}
```

Each built-in connector ships an opinionated default delivery format:

| Connector | Wire format |
|---|---|
| `DirectLine` | `event` activity, name `webchat/customerfeedback`, value `{ rating, comment, type }` where `type = Number(kind ?? 1)` (legacy bot-friendly). |
| `SignalR` | `connection.invoke(surveyMethod, payload)` — `surveyMethod` defaults to `"SendSurvey"`. |
| `WebSocket` | JSON frame `{ "type": "survey", ...payload }`. |
| `SSE` | POST to `sendUrl`, body `{ "type": "survey", ...payload }`. |
| `HTTP` | POST to `{url}/survey`, body `payload`. |
| `Dummy` | Logs to console — useful for testing the UI flow. |

If your connector is custom, just implement `sendSurvey?(payload)`. Without it, the survey UI is hidden.

```ts
class MyConnector implements IConnector {
  async sendSurvey(payload: SurveyPayload): Promise<void> {
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }
}
```

## Listening from your code

The survey emits a typed `EventBus` event after the connector accepts:

```ts
import { EventBus } from "@chativa/core";
EventBus.on("survey_submitted", (payload) => {
  // analytics, toast, redirect, …
});
```
