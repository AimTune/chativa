# Extensions

Extensions are middleware. They install once, hook into the message pipeline and lifecycle, and can register slash commands. They live in user code — there's no separate package.

## Lifecycle

```ts
interface IExtension {
  readonly name: string;
  readonly version: string;
  install(context: ExtensionContext): void;
  uninstall?(): void;
}

interface ExtensionContext {
  onBeforeSend(handler: (msg: OutgoingMessage) => OutgoingMessage | null): void;
  onAfterReceive(handler: (msg: IncomingMessage) => IncomingMessage | null): void;
  onWidgetOpen(handler: () => void): void;
  onWidgetClose(handler: () => void): void;
  registerCommand(command: ISlashCommand): void;
}
```

Returning `null` from `onBeforeSend` cancels the send. Returning `null` from `onAfterReceive` drops the incoming message before it's stored.

## Install

```ts
import { ExtensionRegistry } from "@chativa/core";
ExtensionRegistry.install(new AnalyticsExtension({ trackingId: "UA-..." }));
```

Hooks fire in install order. `uninstall()` is called only if you explicitly remove the extension.

## Example — analytics

```ts
import type { IExtension, ExtensionContext } from "@chativa/core";

export class AnalyticsExtension implements IExtension {
  readonly name = "analytics";
  readonly version = "1.0.0";

  constructor(private readonly opts: { trackingId: string }) {}

  install(ctx: ExtensionContext): void {
    ctx.onBeforeSend((msg) => {
      window.gtag?.("event", "chat_message_sent", {
        tracking_id: this.opts.trackingId,
        type: msg.type,
      });
      return msg;                       // return msg to keep, null to cancel
    });

    ctx.onAfterReceive((msg) => {
      if ((msg.data as { text?: string }).text === "[redacted]") return null;
      return msg;
    });

    ctx.onWidgetOpen(() => window.gtag?.("event", "chat_opened"));
  }
}
```

## Example — register a slash command from an extension

```ts
import type { IExtension, ExtensionContext } from "@chativa/core";

export class HelpExtension implements IExtension {
  readonly name = "help";
  readonly version = "1.0.0";

  install(ctx: ExtensionContext): void {
    ctx.registerCommand({
      name: "help",
      description: () => "Show available commands",
      execute({ args }) {
        console.log("Help requested with args:", args);
      },
    });
  }
}
```

## Add a message action

To add your own action under messages ("Share", "Report", "Translate"), register it with `MessageActionRegistry`. It appears in the "⋮" (more actions) menu at the end of the message action bar; set `placement: "inline"` to pin it to the bar as an icon button instead. Extensions often register actions in `install()`:

```ts
import { MessageActionRegistry } from "@chativa/core";

MessageActionRegistry.register({
  name: "report",
  label: "Report this answer",                 // fallback label
  translations: {                              // per-locale labels, follow the widget language
    tr: "Bu yanıtı bildir",
    de: "Antwort melden",
  },
  icon: "🚩",                                  // emoji, or inner SVG markup
  placement: "menu",                           // "menu" (default): in the ⋮ menu | "inline": icon button on the bar
  appliesTo: "bot",                            // whose messages: "bot" (default) | "user" | "all" | ["bot", "user"]
  excludeMessageTypes: ["genui"],              // or messageTypes: ["text"] to allow-list types
  execute: ({ message }) => reportToSupport(message.id),
});
```

- **`placement`** decides where the action shows. `"menu"` (the default) lists it with its icon and label in the "⋮" menu, the last item of the row. `"inline"` pins it to the bar as an icon button after copy / regenerate / edit.
- **`appliesTo` / `excludeSenders`** pick whose messages get the action; **`messageTypes` / `excludeMessageTypes`** pick which message types (`"text"`, `"card"`, `"genui"`, custom types …). Exclusions win.
- **`translations`** maps a language code to a label. The widget uses the active language (exact match like `pt-BR` first, then the base language `pt`) and falls back to `label`. Switching the language updates the label without re-registering.

Field reference, layout and visibility rules: [Message actions → Custom actions](./message-actions.md#custom-actions) and [Which messages get an action](./message-actions.md#which-messages-get-an-action).

## Tip: prefer `EventBus` for read-only analytics

If you only want to observe events (not transform messages), the typed `EventBus` is lighter — no extension lifecycle, just a subscribe:

```ts
import { EventBus } from "@chativa/core";

EventBus.on("message_sent",       (msg) => track("sent", msg));
EventBus.on("widget_opened",      ()    => track("opened"));
EventBus.on("genui_stream_completed", ({ streamId }) => track("genui_done", { streamId }));
```

Every event, its payload type and exactly when it fires: [EventBus reference](./events.md). Source: [`packages/core/src/application/EventBus.ts`](../packages/core/src/application/EventBus.ts).
