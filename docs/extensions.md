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

## Tip: prefer `EventBus` for read-only analytics

If you only want to observe events (not transform messages), the typed `EventBus` is lighter — no extension lifecycle, just a subscribe:

```ts
import { EventBus } from "@chativa/core";

EventBus.on("message_sent",       (msg) => track("sent", msg));
EventBus.on("widget_opened",      ()    => track("opened"));
EventBus.on("genui_stream_completed", ({ streamId }) => track("genui_done", { streamId }));
```

Full event payload map: [`packages/core/src/application/EventBus.ts`](../packages/core/src/application/EventBus.ts).
