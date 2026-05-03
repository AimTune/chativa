---
sidebar_position: 2
title: Built-in
description: text, image, card, buttons, quick-reply, carousel, file, video, genui — and their data shapes.
---

# Built-in message types

All registered automatically by importing `@chativa/ui`.

| `type` | Component | `data` shape |
|---|---|---|
| `text` | `DefaultTextMessage` | `{ text: string }` — Markdown via `marked`. |
| `image` | `ImageMessage` | `{ src: string, alt?: string, caption?: string }` |
| `card` | `CardMessage` | `{ title: string, subtitle?: string, image?: string, buttons?: MessageAction[] }` |
| `buttons` | `ButtonsMessage` | `{ buttons: MessageAction[] }` |
| `quick-reply` | `QuickReplyMessage` | `{ actions: MessageAction[], keepActions?: boolean }` |
| `carousel` | `CarouselMessage` | `{ cards: { title, image?, actions? }[] }` |
| `file` | `FileMessage` | `{ name, size?, url?, type? }` |
| `video` | `VideoMessage` | `{ src, poster?, caption? }` |
| `genui` | `GenUIMessage` | `{ streamId: string }` — see [GenUI overview](../genui/overview.md). |

`MessageAction` shape: `{ label: string, value?: string, url?: string }`. See [`schemas/messages/message-action.schema.json`](https://github.com/AimTune/chativa/blob/main/schemas/messages/message-action.schema.json).

## Visual reference

| Type | Screenshot |
|---|---|
| `text` | ![text message](/img/screenshots/message-types/text.png) |
| `image` | ![image message](/img/screenshots/message-types/image.png) |
| `card` | ![card message](/img/screenshots/message-types/card.png) |
| `buttons` | ![buttons message](/img/screenshots/message-types/buttons.png) |
| `quick-reply` | ![quick-reply message](/img/screenshots/message-types/quick-reply.png) |
| `carousel` | ![carousel message](/img/screenshots/message-types/carousel.png) |
| `file` | ![file message](/img/screenshots/message-types/file.png) |
| `video` | ![video message](/img/screenshots/message-types/video.png) |

> _Screenshots are pending capture from the [sandbox](../sandbox.md)._

## Examples

### text

```json
{ "id": "1", "type": "text", "from": "bot", "data": { "text": "**Hi!**\n\nHow can I help?" } }
```

### card

```json
{
  "id": "2",
  "type": "card",
  "from": "bot",
  "data": {
    "title": "Pro Plan",
    "subtitle": "Best for teams",
    "image": "https://example.com/pro.png",
    "buttons": [
      { "label": "Choose Pro", "value": "select_pro" },
      { "label": "Learn more", "url": "https://example.com/pro" }
    ]
  }
}
```

### quick-reply

```json
{
  "id": "3",
  "type": "quick-reply",
  "from": "bot",
  "data": {
    "actions": [
      { "label": "Track my order", "value": "track" },
      { "label": "Talk to a human", "value": "agent" }
    ]
  }
}
```

#### `keepActions: true` — chips stay visible after selection

By default, tapping a chip dispatches `chat-action` and the chip group disappears (one-time use). Set `keepActions: true` and the chips remain in the message bubble, with the tapped one rendered as **selected** (filled with the primary color, prefixed by ✓) and the rest disabled and dimmed:

```json
{
  "id": "3",
  "type": "quick-reply",
  "from": "bot",
  "data": {
    "keepActions": true,
    "actions": [
      { "label": "📦 Track my order", "value": "track_order" },
      { "label": "↩️ Returns & refunds", "value": "returns" },
      { "label": "💬 Talk to a human", "value": "human" }
    ]
  }
}
```

Pressing the chip still fires `chat-action` and sends the message — `keepActions` only changes the visual persistence of the chip group, not the action behaviour.

### carousel

```json
{
  "id": "4",
  "type": "carousel",
  "from": "bot",
  "data": {
    "cards": [
      { "title": "Card A", "image": "https://example.com/a.png", "actions": [...] },
      { "title": "Card B", "image": "https://example.com/b.png", "actions": [...] }
    ]
  }
}
```
