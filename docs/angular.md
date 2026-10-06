# Angular

`@chativa/angular` wraps the Chativa custom elements in Angular components, so the widget drops into a template with typed `[inputs]` and `(outputs)` and no `CUSTOM_ELEMENTS_SCHEMA` in your own code.

| Wrapper component | Selector | Renders |
|---|---|---|
| `ChatIvaComponent` | `<chativa-chat-iva>` | `<chat-iva>` — the chat panel |
| `ChatBotButtonComponent` | `<chativa-chat-bot-button>` | `<chat-bot-button>` — the floating launcher |
| `GenUIMessageComponent` | `<chativa-genui-message>` | `<genui-message>` — one Generative UI message |

The selectors are prefixed with `chativa-` so they never collide with the custom element tags they render.

Every wrapper is a **standalone** component, and `ChativaModule` re-exports all three for apps that still use NgModules. Inputs are written to the element as DOM **properties** (never attributes), so objects such as `messageData` arrive intact. Outputs are `EventEmitter`s, and every listener they rely on is removed in `ngOnDestroy`.

## Install

```bash
pnpm add @chativa/angular @chativa/core @chativa/ui
# plus the connector that matches your backend, e.g.
pnpm add @chativa/connector-dummy
```

Peer dependencies: `@angular/core` and `@angular/common` **>= 16**, `@chativa/core`, `@chativa/ui`. There is no `ng add` schematic — the install above plus one provider is the whole setup.

## Quick start (standalone app)

Register the connector once with `provideChativa()`:

```ts
// app.config.ts
import type { ApplicationConfig } from "@angular/core";
import { provideChativa } from "@chativa/angular";
import { DummyConnector } from "@chativa/connector-dummy";

export const appConfig: ApplicationConfig = {
  providers: [
    provideChativa({
      connector: new DummyConnector(),
      theme: { colors: { primary: "#dd0031" } },
    }),
  ],
};
```

Then render the launcher and the panel:

```ts
// app.ts
import { Component } from "@angular/core";
import {
  ChatBotButtonComponent,
  ChatIvaComponent,
  type IncomingMessage,
} from "@chativa/angular";

@Component({
  selector: "app-root",
  imports: [ChatIvaComponent, ChatBotButtonComponent],
  template: `
    <chativa-chat-bot-button />
    <chativa-chat-iva (message)="onMessage($event)" />
  `,
})
export class App {
  onMessage(message: IncomingMessage) {
    console.log("bot said", message);
  }
}
```

`<chativa-chat-iva>` is only the chat panel — like `<chat-iva>`, it has no launcher of its own, so a normal popup setup renders `<chativa-chat-bot-button>` next to it.

You can also pass the connector straight to the component instead of using `provideChativa()`. An `IConnector` instance is registered in `ConnectorRegistry` automatically; a string must name a connector that is already registered:

```html
<chativa-chat-iva [connector]="dummy" (message)="onMessage($event)" />
```

## NgModule apps

```ts
import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { ChativaModule } from "@chativa/angular";
import { DummyConnector } from "@chativa/connector-dummy";

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    // forRoot() applies the config once, like provideChativa().
    ChativaModule.forRoot({ connector: new DummyConnector() }),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

Import plain `ChativaModule` (without `forRoot`) in feature modules that only need the components.

## `<chativa-chat-iva>`

| Input | Type | Description |
|---|---|---|
| `connector` | `string \| IConnector` | Connector name, or an instance to auto-register. Activated in the shared `chatStore`. Defaults to whatever `provideChativa()` / `ChativaService` / `window.chativaSettings` activated. |
| `fullscreenOnly` | `boolean` | Start in fullscreen and hide the fullscreen toggle — the `fullscreen-only` attribute of `<chat-iva>`. A bare `fullscreenOnly` attribute counts as `true`; `false` means "no opinion" and never re-enables a toggle the theme turned off. |

Content projected into the component lands in `<chat-iva>`'s light DOM.

| Output | Payload | Fires when |
|---|---|---|
| `(message)` | `IncomingMessage` | A bot/connector message was delivered. |
| `(messageSent)` | `OutgoingMessage` | The user sent a message. |
| `(connect)` | `void` | The connector status became `"connected"`. |
| `(disconnect)` | `{ status: ConnectorStatus }` | The connector status became `"disconnected"` or `"error"`. |
| `(surveySubmit)` | `SurveyPayload` | The end-of-conversation survey was submitted. |
| `(widgetOpen)` | `void` | The chat panel opened. |
| `(widgetClose)` | `void` | The chat panel closed. |
| `(chativaReset)` | `void` | `<chat-iva>` dispatched `chativa-reset` — it is about to rebuild its engine after a survey. Swap the registered connector here to start the next conversation with fresh credentials. |

`<chat-iva>` does not dispatch DOM events for messages or connection changes — those are published on `@chativa/core`'s `EventBus`. The wrapper subscribes to the matching `EventBus` events (`message_received`, `message_sent`, `connector_status_changed`, `survey_submitted`, `widget_opened`, `widget_closed`) in `ngOnInit` and unsubscribes in `ngOnDestroy`; `chativaReset` is a DOM listener on the element itself. Like the `EventBus` they come from, these outputs are app-wide: two `<chativa-chat-iva>` instances on one page both see every message.

The `connector` and `fullscreenOnly` inputs are applied to the shared `chatStore` as soon as they are set, before the element exists: `<chat-iva>` decides its connector and window mode while it connects, and the store is the only place it reads them from at that moment.

## `<chativa-chat-bot-button>`

No inputs or outputs. Project content into it to replace the default gradient circle with your own launcher — `<chat-bot-button>` still handles the positioning and the open/close click:

```html
<chativa-chat-bot-button>
  <button class="my-launcher" type="button">Ask Iva</button>
</chativa-chat-bot-button>
```

## `<chativa-genui-message>`

Renders a single streaming Generative UI message outside the chat panel, for example to embed one AI reply in a custom layout. `GenUIStreamState` is the shape documented in [Generative UI streaming](./genui/streaming.md).

| Input | Type | Default |
|---|---|---|
| `messageData` | `GenUIStreamState` (as `Record<string, unknown>`) | `{}` |
| `sender` | `"user" \| "bot"` | `"bot"` |
| `messageId` | `string` | `""` |
| `timestamp` | `number` | `0` |
| `hideAvatar` | `boolean` | `false` |
| `status` | `string` | `"sent"` |
| `debug` | `boolean` | `false` |

| Output | Payload | Fires when |
|---|---|---|
| `(genuiSendEvent)` | `GenUISendEventDetail` — `{ msgId, eventType, payload, sourceId?, scope?, component? }` | A component inside the message called `sendEvent(...)` (the element's `genui-send-event` DOM event). |

```html
<chativa-genui-message
  messageId="reply-1"
  [messageData]="{ chunks: chunks, streamingComplete: true }"
  (genuiSendEvent)="onComponentEvent($event)"
/>
```

## `ChativaService`

An injectable (`providedIn: "root"`) for changing Chativa at runtime. Every method is a typed call into the `@chativa/core` registries and stores that `<chat-iva>` itself reads.

| Method | Description |
|---|---|
| `configure(config)` | Apply a whole `ChativaConfig` (what `provideChativa()` calls). |
| `registerConnector(connector)` | Register an `IConnector`. Idempotent — an already-registered name is left alone. |
| `unregisterConnector(name)` | Remove a connector from `ConnectorRegistry`. |
| `useConnector(nameOrInstance)` | Register (if needed) and activate a connector. Returns its name. Affects `<chat-iva>` elements that connect afterwards. |
| `activeConnector` | Name of the active connector (getter). |
| `listConnectors()` | Registered connector names. |
| `installExtension(extension)` | Install an `IExtension`. Idempotent. |
| `uninstallExtension(name)` / `listExtensions()` | Remove / list extensions. |
| `setTheme(theme)` | Deep-merge `DeepPartial<ThemeConfig>` overrides over the current theme. |
| `setLocale(locale)` | Switch language (applied once i18next is initialised if it isn't yet). |
| `setTranslations(overrides)` | Flat translation overrides applied to every language, re-applied on language switch. |
| `open()` / `close()` / `toggle()` | Open or close the chat panel. |
| `on(event, handler)` | Subscribe to an `EventBus` event; returns an unsubscribe function. Remaining subscriptions are removed when the injector is destroyed. |

```ts
import { DestroyRef, inject } from "@angular/core";
import { ChativaService } from "@chativa/angular";
import { DirectLineConnector } from "@chativa/connector-directline";

export class SupportPage {
  private readonly chativa = inject(ChativaService);

  constructor() {
    const off = this.chativa.on("survey_submitted", (survey) => this.save(survey));
    inject(DestroyRef).onDestroy(off);
  }

  talkToSales() {
    this.chativa.useConnector(new DirectLineConnector({ token: this.salesToken }));
    this.chativa.open();
  }
}
```

### `ChativaConfig`

Accepted by `provideChativa()`, `ChativaModule.forRoot()` and `ChativaService.configure()`. It mirrors the `ChativaProvider` props of `@chativa/react`:

| Field | Type | Description |
|---|---|---|
| `connector` | `string \| IConnector` | Registered (if an instance) and activated. |
| `extensions` | `IExtension[]` | Installed once. |
| `theme` | `DeepPartial<ThemeConfig>` | Theme overrides. |
| `locale` | `string` | Initial locale, skipping browser detection. |
| `i18n` | `Record<string, unknown>` | Flat translation overrides for every language. |

`provideChativa()` runs through `ENVIRONMENT_INITIALIZER`, so the config is applied before any component renders. The config object is also available as the `CHATIVA_CONFIG` injection token.

## Change detection: Zone.js and zoneless

The wrappers never rely on Zone.js. They use `OnPush`, and they call `ChangeDetectorRef.markForCheck()` after the UI module loads and after every output emission, which schedules change detection under zoneless change detection (`provideExperimentalZonelessChangeDetection()` in Angular 18–19, `provideZonelessChangeDetection()` from Angular 20, the default for new apps since Angular 21) as well as under Zone.js. Output handlers are ordinary Angular event bindings, so writing to a signal or a field in them updates the view in both modes.

Handlers passed to `ChativaService.on()` are plain callbacks, not outputs: in a zoneless or `OnPush` component, update a signal in them (or call `markForCheck()`) so the view refreshes.

## SSR

The wrappers render their custom element only in the browser. `@chativa/ui` (which registers the custom elements as a side effect) is loaded with a dynamic `import()` on the browser platform, so the components are safe to server-render — the server output contains just the empty `<chativa-*>` hosts, and the widget appears after hydration. Their `element` property returns the underlying custom element once it exists (`null` before that and on the server).

## Compatibility

`@chativa/angular` is compiled with Angular 16 in partial (Ivy) mode, so the linker of any Angular 16 or later application can consume it. The example app below builds it with Angular 21 and AOT.

Angular 15 and older are not supported.

## Example app

[`examples/angular-cli`](https://github.com/AimTune/chativa/tree/main/examples/angular-cli) is a zoneless Angular CLI standalone app: `provideChativa()` with `DummyConnector`, a custom launcher projected into `<chativa-chat-bot-button>`, an event log driven by `<chativa-chat-iva>`'s outputs, and a standalone `<chativa-genui-message>`.

```bash
pnpm --filter @chativa/core --filter @chativa/genui --filter @chativa/ui \
     --filter @chativa/connector-dummy --filter @chativa/angular build
pnpm --filter chativa-example-angular-cli start   # or: build
```
