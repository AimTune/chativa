# Custom GenUI Component

Two ways to get your own UI into a chat bubble:

| | Use when |
|---|---|
| **Extend `GenUIElement`** | You ship a compiled widget with the frontend. Full LitElement power, typed props. |
| **Stream `<chativa-html>`** | The markup comes from the backend, a CMS, or a React app. No client-side build step, no redeploy to add a widget. |
| **Let the server define it** (mekik) | The backend owns the whole widget and announces it on connect. Adding a widget is a server deploy. |

Both live in `@chativa/core`, so a widget package doesn't have to depend on `@chativa/genui`.

> **Which package do I import the registry from?** `GenUIRegistry`,
> `registerServerComponent`, `subscribeServerComponents` and
> `setServerComponentPolicy` are re-exported by `@chativa/ui`, so an app that
> already depends on the widget can import them from there and skip the extra
> dependency. Both paths reach the same registry — `@chativa/ui` does not carry
> its own copy of the GenUI components.

## 1. Extend `GenUIElement`

`GenUIElement` extends `ChativaElement` (i18n + auto re-render on locale switch) and implements the whole `GenUIComponentAPI` with working defaults. You call `this.sendEvent(...)` / `this.listenEvent(...)` / `this.tFn(...)` directly — no optional chaining, no injected-property boilerplate.

```ts
import { GenUIElement } from "@chativa/core";
import { GenUIRegistry } from "@chativa/genui";
import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("weather-widget")
export class WeatherWidget extends GenUIElement {
  static override styles = css`
    :host { display: block; }
    .card { border: 1px solid var(--chativa-border-color); border-radius: 12px; padding: 12px; }
  `;

  @property({ type: String }) city = "";
  @property({ type: Number }) temp = 0;

  override connectedCallback() {
    super.connectedCallback();
    // Server-pushed event chunks targeting this component
    this.listenEvent("weather_updated", (p) => {
      this.temp = (p as { temp: number }).temp;
    });
  }

  override render() {
    return html`
      <div class="card">
        <h3>${this.city}</h3>
        <p>${this.temp}°C</p>
        <button @click=${() => this.sendEvent("refresh_weather", { city: this.city })}>
          ${this.tFn("widget.refresh", "Refresh")}
        </button>
      </div>
    `;
  }
}

GenUIRegistry.register("weather", WeatherWidget);
```

The connector then streams `{ type: "ui", component: "weather", props: { city, temp } }`.

**Don't redeclare** `sendEvent` / `listenEvent` / `tFn` / `onLangChange` as class fields — that shadows the base implementations with `undefined`. The old pattern (extending `LitElement` and declaring the four optional fields) still works; it's just boilerplate you no longer need.

## 2. Stream raw markup with `<chativa-html>`

Registered out of the box under `genui-html` and `html`, so a backend can ship the markup itself:

```json
{
  "type": "ui",
  "component": "html",
  "props": {
    "html": "<div class='card'><h3>Order #123</h3><button data-event='track_order' data-payload='{\"id\":123}'>Track</button></div>",
    "css": ".card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }"
  }
}
```

The click reaches your connector as `receiveComponentEvent(streamId, "track_order", { id: 123 })` — the same round trip a compiled component gets.

### Props

| Prop | Meaning |
|---|---|
| `html` | Markup to render. Sanitized unless `unsafe` is set. When empty, light-DOM children are rendered instead. |
| `css` | CSS injected into the element's shadow root — scoped, so it can't leak into the page. |
| `unsafe` | Skip sanitization. Only for markup you fully control. |

### Interaction contract

A click — or a form submit — on an element carrying an event attribute sends that
event. Which attribute you use says **who the interaction is addressed to**, for
backends that model the distinction (mekik `PROTOCOL.md` §10.4):

| attribute | `scope` sent | meaning |
| --- | --- | --- |
| `component-event="<name>"` | `"component"` | the widget's own conversation with the graph node that mounted it — only a node waiting for that event name receives it |
| `mekik-event="<name>"` | `"graph"` | the application, which may start a new turn on it |
| `data-event="<name>"` | none | let the backend decide (the original form, unchanged) |

Only the most specific attribute on an element is used, in the order above; an
empty value is not a trigger. Backends that don't model routing ignore `scope`, so
`data-event` keeps behaving exactly as it did.

- `data-payload='<json>'` → parsed and sent as the payload; invalid JSON is sent as the raw string.
- `<form component-event="...">` (or `mekik-event` / `data-event`) → the submit is intercepted and the named fields are sent, merged over `data-payload`.

The frame that reaches the backend also carries `component` — the registry name of
the widget the interaction came from. `GenUIMessage` fills that in from the chunk,
so a component never sets it itself.

### Safety

Markup is sanitized by default: `<script>`, `<iframe>`, `<object>`, `<link>`, `<meta>` and friends are dropped, every `on*` attribute is stripped, and absolute URLs must use a trusted scheme (`http(s):`, `mailto:`, `tel:`, `sms:`, `ftp:`, or `data:image/`) — relative URLs pass through untouched, and obfuscated variants (embedded tabs or newlines, mixed case) are normalised before the check. Structure, classes and inline styles survive untouched. The sanitizer is exported as `sanitizeHtml(markup)` if you want to run it earlier in your pipeline.

Setting `unsafe` re-enables `<script>` and inline handlers — only do that for markup you generate yourself, never for text an LLM or an end user can influence.

### Outside a chat message

`<chativa-html>` is a plain custom element, so it works anywhere:

```html
<!-- Markup as children -->
<chativa-html>
  <button data-event="say_hi">Hi</button>
</chativa-html>
```

```tsx
// React
<chativa-html ref={(el) => { if (el) el.html = markup; }} />
```

When no host has injected `sendEvent` — i.e. the element isn't inside a `GenUIMessage` — events are dispatched as a bubbling, composed `genui-component-event` DOM event with `detail: { eventType, payload }`, so the page can still react.

## 3. Let the backend define the component (mekik)

The two options above still need the markup to reach the page somehow. A mekik
backend can skip that: it defines the component itself and announces the catalog
on connect, so a `{ type: "ui", component: "order-card" }` chunk mounts a widget
nobody compiled into the client.

```ts
// mekik server
const orderCard = defineComponent({
  name: "order-card",
  template: `<h3>{{title}}</h3>
    {{#each lines}}<p>{{this.label}} — {{this.price}} ₺</p>{{/each}}
    <button mekik-event="track_order" data-payload='{"id":"{{id}}"}'>Track</button>`,
  css: `h3 { margin: 0 0 8px; }`,
  props: { id: "", title: "", lines: [] },
});

const app = mekik({ graph, components: [orderCard] });
```

Nothing to do on the client: `@chativa/genui` subscribes to the catalog at import
time, turns each definition into a custom element (via `defineGenUIComponent`) and
registers it under its name.

### What travels, and when

```
hello  { componentsHash?: "<cached>" }        ← the widget already sends this frame
welcome
genui_components  { hash, components: [...] }  ← only when the hash moved
                  { hash, unchanged: true }    ← otherwise: no markup
```

The catalog is cached in `localStorage` under the server URL, so a returning user's
widgets render before the server answers, and validating the cache costs no extra
round trip — the hash rides along on the `hello` frame the connector already sends.
Change a template on the server and the hash changes; the next connect picks it up.

### Template language

| form | meaning |
|---|---|
| `{{path.to.value}}` | HTML-escaped interpolation |
| `{{#if path}} … {{else}} … {{/if}}` | truthiness (empty string / empty array / 0 are false) |
| `{{#each path}} … {{/each}}` | iteration, with `{{this}}`, `{{this.field}}`, `{{@index}}`, parent scope still visible |

Interactions use the same event-attribute contract as `<chativa-html>`, and arrive
at the connector as `receiveComponentEvent` — a server-defined component gets the
same round trip a compiled one does.

With a mekik backend the choice of attribute is what routes the click: a
`mekik-event` reaches the app's `onGenUiEvent` handler and can start a new turn,
while a `component-event` reaches only a graph node parked on `mekik.onEvent`
waiting for that name — so a widget can answer the very run that mounted it. A
pause waiting that way announces `data.event` on its `interrupt` frame, and the
connector renders no chat chips for it: the widget on screen is the answer.

### Driving a server-defined component

A definition is markup; what makes it feel alive is the chunk stream. Two moves
cover almost everything:

**Re-render it.** Send the same `id` again with new props and the element updates
in place — see [Updating a component in place](./streaming.md#updating-a-component-in-place).

```ts
// mekik server — one card, walked through its states
await phase(ctx, "packing",    () => orderCard(ctx, props("Preparing"),  { id: "card-1" }));
await phase(ctx, "in_transit", () => orderCard(ctx, props("In transit"), { id: "card-1" }));
```

**Let a human change it.** The run can pause on chips while the widget stays on
screen, and the answer re-renders that same element:

```ts
const choice = await mekik.choose(ctx, "What should the courier do?", [
    mekik.action("Hand it to me", "handover"),
    mekik.action("Reschedule", "reschedule"),
] as const);

orderCard(ctx, props(choice === "handover" ? "Delivered" : "Rescheduled"), { id: "card-1" });
```

Two things to get right on the server side:

- **Pace the updates.** Emissions that land together are invisible; the client
  renders the final state and nothing looks like it moved.
- **Wrap pre-pause emissions in `ctx.step`** (`ctx.StepAsync` in .NET) and use
  literal chunk ids. A resume replays the node from the top: without the journal
  the whole sequence is re-sent and the widget flashes back through states the
  user already saw; with it, only what follows the answer travels.

Runnable end to end: [`ts/examples/server-components.ts`](https://github.com/AimTune/mekik/blob/main/ts/examples/server-components.ts)
and `dotnet/examples/Mekik.ServerComponents` in the mekik repo.

### Limits

### Name collisions

A server definition never silently replaces a component the page already
registered — a backend must not be able to redefine `genui-form`, or your own
checkout widget, under your feet. The collision is logged and the local
component stays.

That default has a sharp edge worth knowing: the local component then renders
with the *server's* props, which it was never written for, so the widget usually
comes out blank. If a server-defined widget renders empty, check the console for
the collision warning first.

Two ways out:

```ts
import { setServerComponentPolicy } from "@chativa/genui";

// the server is the source of truth for widgets
setServerComponentPolicy("server-wins");
```

…or rename one of the two so both can coexist. A definition always replaces an
earlier definition of the same name *from the server itself* — that is a new
version of the same widget, not a collision.

### Other limits

- `unsafe` is not honoured from the wire. Server markup is always sanitized.
- Only `@chativa/connector-mekik` implements the catalog handshake. Other
  connectors ignore the frame.

## Backend-driven components end to end

With a streaming connector (Mekik, SSE, WebSocket, SignalR), the backend owns the whole widget:

```
backend frame  { type: "genui", streamId, chunk: { type: "ui", component: "html", props: { html, css } }, done }
      ↓ connector.onGenUIChunk
GenUIMessage mounts <chativa-html> and syncs props on every chunk
      ↓ user clicks [component-event | mekik-event | data-event]
connector.receiveComponentEvent(streamId, eventType, payload, { scope, component })
      ↓ e.g. Mekik sends { type: "genui_event", streamId, eventType, scope, component, payload }
backend
```

Because props are re-assigned on every chunk, re-sending the same chunk id with new `html` updates the widget in place — that's how you stream a form into its own success state.

## The injected API

`GenUIMessage` assigns four methods onto each mounted instance, shadowing `GenUIElement`'s defaults:

| Method | Purpose |
|---|---|
| `sendEvent(type, payload, opts?)` | Send to the connector via `IConnector.receiveComponentEvent`. `opts` is routing metadata — `{ scope }` says who the interaction is addressed to (see the table above); `component` is stamped in by `GenUIMessage`, never by the component. |
| `listenEvent(type, cb)` | Subscribe to event chunks targeting this component (`for === this.id`) or broadcast events. |
| `tFn(key, fallback?)` | i18next translation. |
| `onLangChange(cb)` | Subscribe to locale changes. Returns an unsubscribe function. |

Outside a message the defaults keep working: `sendEvent` dispatches `genui-component-event`, `listenEvent` registers locally (deliver with `receiveEvent(type, payload)` in tests), and `tFn` / `onLangChange` use the shared i18next instance.

## Naming convention

- Built-in components are namespaced `genui-<thing>` (kebab-case). For your own widgets, any unique custom-element-compatible name works; just stay consistent across registrations.
- Don't expose a `translate` property on your component — `HTMLElement.translate` collides. Always use `tFn`.

## See also

- [Streaming protocol](./streaming.md) — chunks, event routing, `receiveComponentEvent`.
- Built-in source examples — [`packages/genui/src/components/`](../../packages/genui/src/components/) — copy/paste any of them as a starting template.
