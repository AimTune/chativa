# Built-in GenUI Components

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
| `genui-appointment-form` | Specialised appointment form | `fields[]` | `form_submit` |

## Visual reference

| Component | Screenshot |
|---|---|
| `genui-form` | ![genui-form](../assets/screenshots/genui/form.png) |
| `genui-card` | ![genui-card](../assets/screenshots/genui/card.png) |
| `genui-table` | ![genui-table](../assets/screenshots/genui/table.png) |
| `genui-chart` | ![genui-chart](../assets/screenshots/genui/chart.png) |
| `genui-alert` | ![genui-alert](../assets/screenshots/genui/alert.png) |
| `genui-quick-replies` | ![genui-quick-replies](../assets/screenshots/genui/quick-replies.png) |
| `genui-list` | ![genui-list](../assets/screenshots/genui/list.png) |
| `genui-rating` | ![genui-rating](../assets/screenshots/genui/rating.png) |
| `genui-progress` | ![genui-progress](../assets/screenshots/genui/progress.png) |
| `genui-steps` | ![genui-steps](../assets/screenshots/genui/steps.png) |
| `genui-image-gallery` | ![genui-image-gallery](../assets/screenshots/genui/image-gallery.png) |
| `genui-date-picker` | ![genui-date-picker](../assets/screenshots/genui/date-picker.png) |

> _Screenshots are placeholders — see [docs/assets/screenshots/README.md](../assets/screenshots/README.md)._

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
