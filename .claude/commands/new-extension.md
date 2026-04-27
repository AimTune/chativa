---
description: Scaffold a new Chativa extension that hooks into the message pipeline and lifecycle.
argument-hint: <PascalCase name, e.g. Analytics>
---

# New Extension Scaffold

Create a new Chativa extension. Extensions are middleware — they install once and hook into the pipeline (`onBeforeSend`, `onAfterReceive`), the widget lifecycle (`onWidgetOpen`, `onWidgetClose`), and can register slash commands.

Usage: `/new-extension Analytics`

> Extensions live in **user-land** — there is no dedicated `packages/extension-*`. For in-repo demos and tests, use `apps/sandbox/src/extensions/`. For real apps, the file lives wherever the consumer wants it.

---

Given the extension name `$ARGUMENTS` (PascalCase):

## Step 1 — Decide the location

- In-repo demo / fixture: `apps/sandbox/src/extensions/$ARGUMENTS_Extension.ts`
- Library-grade reusable extension that ships separately: a fresh `packages/extension-[name]/` package (rare — usually overkill).

If unsure, ask the user. Default to the sandbox path.

## Step 2 — Implement the extension

```ts
import type { IExtension, ExtensionContext } from "@chativa/core";

export interface $ARGUMENTS_ExtensionOptions {
  // Configuration options here.
}

export class $ARGUMENTS_Extension implements IExtension {
  readonly name = "[name]-extension";
  readonly version = "1.0.0";

  constructor(private readonly options: $ARGUMENTS_ExtensionOptions = {} as never) {}

  install(context: ExtensionContext): void {
    context.onBeforeSend((msg) => {
      // Transform or react to outgoing messages. Return null to cancel.
      return msg;
    });

    context.onAfterReceive((msg) => {
      // Transform or react to incoming messages. Return null to drop.
      return msg;
    });

    context.onWidgetOpen(() => {
      // Widget opened.
    });

    context.onWidgetClose(() => {
      // Widget closed.
    });

    // Optional — register a slash command:
    // context.registerCommand({
    //   name: "[name]",
    //   description: () => "Run [name] action",
    //   execute: ({ args }) => { /* ... */ },
    // });
  }

  uninstall(): void {
    // Cleanup any external resources here. Hook teardown is automatic.
  }
}
```

## Step 3 — Tests

Create `__tests__/$ARGUMENTS_Extension.test.ts` next to the source:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { ExtensionRegistry } from "@chativa/core";
import { $ARGUMENTS_Extension } from "../$ARGUMENTS_Extension";

describe("$ARGUMENTS_Extension", () => {
  beforeEach(() => ExtensionRegistry.clear());

  it("has the correct name", () => {
    const ext = new $ARGUMENTS_Extension();
    expect(ext.name).toBe("[name]-extension");
  });

  it("installs into ExtensionRegistry", () => {
    ExtensionRegistry.install(new $ARGUMENTS_Extension());
    expect(ExtensionRegistry.has("[name]-extension")).toBe(true);
  });

  it("uninstalls cleanly", () => {
    ExtensionRegistry.install(new $ARGUMENTS_Extension());
    ExtensionRegistry.uninstall("[name]-extension");
    expect(ExtensionRegistry.has("[name]-extension")).toBe(false);
  });

  it("passes incoming messages through unchanged by default", () => {
    ExtensionRegistry.install(new $ARGUMENTS_Extension());
    const msg = { id: "1", type: "text", from: "bot" as const, data: { text: "hi" } };
    const result = ExtensionRegistry.runAfterReceive(msg);
    expect(result).toEqual(msg);
  });
});
```

## Step 4 — Wire it up (sandbox only)

If the extension lives under `apps/sandbox/src/extensions/`, install it from `apps/sandbox/src/main.ts` (or the appropriate entry):

```ts
import { ExtensionRegistry } from "@chativa/core";
import { $ARGUMENTS_Extension } from "./extensions/$ARGUMENTS_Extension";

ExtensionRegistry.install(new $ARGUMENTS_Extension({ /* ... */ }));
```

## Step 5 — Verify

Run `pnpm --filter <package> test` and `pnpm --filter <package> typecheck`.
