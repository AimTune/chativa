# Built-in Message Types

All registered automatically by importing `@chativa/ui`.

| `type` | Component | `data` shape |
|---|---|---|
| `text` | `DefaultTextMessage` | `{ text: string }` — Markdown via `marked`. |
| `image` | `ImageMessage` | `{ src: string, alt?: string, caption?: string }` |
| `card` | `CardMessage` | `{ title: string, subtitle?: string, image?: string, buttons?: MessageAction[] }` |
| `buttons` | `ButtonsMessage` | `{ buttons: MessageAction[] }` |
| `quick-reply` | `QuickReplyMessage` | `{ actions: MessageAction[] }` |
| `carousel` | `CarouselMessage` | `{ cards: { title, image?, actions? }[] }` |
| `file` | `FileMessage` | `{ name, size?, url?, type? }` |
| `video` | `VideoMessage` | `{ src, poster?, caption? }` |
| `genui` | `GenUIMessage` | `{ streamId: string }` — see [genui/overview.md](../genui/overview.md). |

`MessageAction` shape: `{ label: string, value?: string, url?: string }`. See [`schemas/messages/message-action.schema.json`](../../schemas/messages/message-action.schema.json).

## Visual reference

| Type | Screenshot |
|---|---|
| `text` | ![text message](../assets/screenshots/message-types/text.png) |
| `image` | ![image message](../assets/screenshots/message-types/image.png) |
| `card` | ![card message](../assets/screenshots/message-types/card.png) |
| `buttons` | ![buttons message](../assets/screenshots/message-types/buttons.png) |
| `quick-reply` | ![quick-reply message](../assets/screenshots/message-types/quick-reply.png) |
| `carousel` | ![carousel message](../assets/screenshots/message-types/carousel.png) |
| `file` | ![file message](../assets/screenshots/message-types/file.png) |
| `video` | ![video message](../assets/screenshots/message-types/video.png) |

> _Screenshots are placeholders — see [docs/assets/screenshots/README.md](../assets/screenshots/README.md)._

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
