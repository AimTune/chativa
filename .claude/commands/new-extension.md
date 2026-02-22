# New Extension Scaffold

Create a new Chativa extension. The argument is the extension name in PascalCase.

Usage: `/new-extension Analytics`

---

Given the extension name `$ARGUMENTS`, do the following steps **in order**:

## Step 1 — Create the extension file

Create `src/infrastructure/extensions/$ARGUMENTS_Extension.ts`:

```ts
import type { IExtension, ExtensionContext } from "../../domain/ports/IExtension";

export interface $ARGUMENTS_ExtensionOptions {
  // Add your configuration options here
}

export class $ARGUMENTS_Extension implements IExtension {
  readonly name = "$ARGUMENTS_lowercase-extension";
  readonly version = "1.0.0";

  private options: $ARGUMENTS_ExtensionOptions;
  private uninstallHandlers: (() => void)[] = [];

  constructor(options: $ARGUMENTS_ExtensionOptions = {}) {
    this.options = options;
  }

  install(context: ExtensionContext): void {
    // Hook into message pipeline
    context.onAfterReceive((msg) => {
      // Transform or react to incoming messages
      // Return null to drop the message
      return msg;
    });

    context.onBeforeSend((msg) => {
      // Transform or react to outgoing messages
      // Return null to cancel sending
      return msg;
    });

    context.onWidgetOpen(() => {
      // Widget opened
    });

    context.onWidgetClose(() => {
      // Widget closed
    });
  }

  uninstall(): void {
    this.uninstallHandlers.forEach((h) => h());
    this.uninstallHandlers = [];
  }
}
```

Also create the `src/infrastructure/extensions/` directory if it doesn't exist.

## Step 2 — Create the test file

Create `src/infrastructure/extensions/__tests__/$ARGUMENTS_Extension.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { $ARGUMENTS_Extension } from "../$ARGUMENTS_Extension";
import { ExtensionRegistry } from "../../../application/registries/ExtensionRegistry";

describe("$ARGUMENTS_Extension", () => {
  beforeEach(() => ExtensionRegistry.clear());

  it("has the correct name", () => {
    const ext = new $ARGUMENTS_Extension({});
    expect(ext.name).toBe("$ARGUMENTS_lowercase-extension");
  });

  it("installs without throwing", () => {
    const ext = new $ARGUMENTS_Extension({});
    expect(() => ExtensionRegistry.install(ext)).not.toThrow();
  });

  it("is listed after installation", () => {
    ExtensionRegistry.install(new $ARGUMENTS_Extension({}));
    expect(ExtensionRegistry.has("$ARGUMENTS_lowercase-extension")).toBe(true);
  });

  it("uninstalls cleanly", () => {
    ExtensionRegistry.install(new $ARGUMENTS_Extension({}));
    ExtensionRegistry.uninstall("$ARGUMENTS_lowercase-extension");
    expect(ExtensionRegistry.has("$ARGUMENTS_lowercase-extension")).toBe(false);
  });

  it("passes messages through pipeline unmodified by default", () => {
    ExtensionRegistry.install(new $ARGUMENTS_Extension({}));
    const msg = { id: "1", type: "text", data: { text: "hi" } };
    const result = ExtensionRegistry.runAfterReceive(msg);
    expect(result).toEqual(msg);
  });
});
```

## Step 3 — Export

Add to `src/index.ts`:
```ts
export { $ARGUMENTS_Extension } from "./infrastructure/extensions/$ARGUMENTS_Extension";
```

## Step 4 — Run tests

Run `npm test` and confirm all tests pass.
