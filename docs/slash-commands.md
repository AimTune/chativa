# Slash Commands

Users typing `/` in the chat input get an autocomplete list of registered commands. Built-in: `/clear` (clears the message list).

## Register a command

```ts
import { registerCommand } from "@chativa/ui";

registerCommand({
  name: "help",
  description: () => "Show all available commands",   // can be lazy for i18n
  usage:       () => "/help [topic]",
  execute({ args }) {
    // args: string[] — words after the command name
    console.log("Help requested:", args);
  },
});
```

`description` and `usage` accept either a `string` or a `() => string` thunk. The thunk form is recommended when the text comes from i18next — it resolves the translation lazily at execute time, not at registration time.

## Contract

```ts
interface ISlashCommand {
  name: string;                                  // /name
  description?: string | (() => string);
  usage?: string | (() => string);
  execute(ctx: { args: string[] }): void | Promise<void>;
}
```

## Register from an extension

`ExtensionContext.registerCommand` does the same thing — wrap commands in an extension if they ship together with other behaviour:

```ts
ctx.registerCommand({
  name: "summary",
  description: () => "Summarise this conversation",
  execute() { /* ... */ },
});
```

See [extensions.md](./extensions.md).

## Built-in commands

| Command | Behaviour |
|---|---|
| `/clear` | Clears the message store. |
| `/disconnect` _(DummyConnector only)_ | Triggers the connector's `disconnect()` — handy for testing reconnect flows. |
| `/genui`, `/genui-weather`, `/genui-form` _(DummyConnector only)_ | Trigger the demo GenUI streams. See [genui/overview.md](./genui/overview.md). |

## Tips

- Commands run client-side; they're not sent to the connector. If you need server-side behaviour, do the work inside `execute()` and call `chatStore` / your own API.
- Names are case-insensitive but conventionally lowercase.
- Re-registering a name overwrites the previous handler.
