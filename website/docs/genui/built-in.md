---
sidebar_position: 3
title: Built-in components
description: Out-of-the-box GenUI components — text, card, form, alert, table, chart, list, rating, progress, and more.
---

# Built-in GenUI components

Auto-registered by importing `@chativa/genui`.

| Component name | Purpose | Key props | Emits |
|---|---|---|---|
| `genui-text` | Markdown text block | `content: string` | — |
| `genui-card` | Card with title, description, optional actions | `title, description, image?, actions[]` | `chat-action` (when an action is tapped) |
| `genui-form` | Dynamic form with validation | `title?, buttonText?, fields: { name, label, type, placeholder?, required? }[]` | `form_submit` → connector; on success injects `form_success` |
| `genui-alert` | Styled alert box | `variant: "info" \| "success" \| "warning" \| "error", title?, message` | — |
| `genui-quick-replies` | Quick-reply chip group | `label?, items: { label, value?, icon? }[]` | `chat-action` |
| `genui-list` | Scrollable item list | `title?, ordered?, items: { text, secondary?, icon? }[]` | — |
| `genui-table` | Data table | `title?, columns?, rows[][]` | — |
| `genui-rating` | Star rating | `title?, maxStars?` | `rating_submit` |
| `genui-progress` | Progress bar | `label?, value (0-100), caption?, variant?` | — |
| `genui-date-picker` | Date input | `label?, min?, max?` | `date_submit` |
| `genui-chart` | Bar / line / pie chart | `type: "bar" \| "line" \| "pie", title?, labels?, datasets` | — |
| `genui-steps` | Vertical step list | `steps: { label, status, description? }[]` | — |
| `genui-image-gallery` | Grid of images | `columns?, images: { src, alt?, caption? }[]` | — |
| `genui-typewriter` | Animated typewriter text | `content, speed?, cursor?` | — |
| `genui-appointment-form` | Specialised appointment form | `fields[]` | `form_submit` |

## Visual reference

| Component | Screenshot |
|---|---|
| `genui-form` | ![genui-form](/img/screenshots/genui/form.png) |
| `genui-card` | ![genui-card](/img/screenshots/genui/card.png) |
| `genui-table` | ![genui-table](/img/screenshots/genui/table.png) |
| `genui-chart` | ![genui-chart](/img/screenshots/genui/chart.png) |
| `genui-alert` | ![genui-alert](/img/screenshots/genui/alert.png) |
| `genui-quick-replies` | ![genui-quick-replies](/img/screenshots/genui/quick-replies.png) |
| `genui-list` | ![genui-list](/img/screenshots/genui/list.png) |
| `genui-rating` | ![genui-rating](/img/screenshots/genui/rating.png) |
| `genui-progress` | ![genui-progress](/img/screenshots/genui/progress.png) |
| `genui-steps` | ![genui-steps](/img/screenshots/genui/steps.png) |
| `genui-image-gallery` | ![genui-image-gallery](/img/screenshots/genui/image-gallery.png) |
| `genui-typewriter` | ![genui-typewriter](/img/screenshots/genui/typewriter.png) |
| `genui-date-picker` | ![genui-date-picker](/img/screenshots/genui/date-picker.png) |

> _Screenshots are pending capture from the [sandbox](../sandbox.md)._

## Using a built-in from the bot side

```ts
genUICallback(streamId, {
  type: "ui",
  component: "genui-form",
  props: {
    title: "Get in touch",
    buttonText: "Send",
    fields: [
      { name: "name",  label: "Full Name", type: "text",  placeholder: "Jane Doe", required: true },
      { name: "email", label: "Email",     type: "email", placeholder: "jane@example.com", required: true },
    ],
  },
  id: 1,
}, false);
```

When the user taps Submit, the form fires `form_submit` with `{ name, email }`. Your connector receives it via `receiveComponentEvent(streamId, "form_submit", payload)` and can stream back a `form_success` event chunk to swap the form for a success view.
