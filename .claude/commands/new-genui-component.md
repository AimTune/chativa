---
description: Scaffold a new Generative UI streaming component under packages/genui/src/components/.
argument-hint: <PascalCase suffix, e.g. Weather (becomes GenUIWeather)>
---

# New GenUI Component Scaffold

Scaffold a new Generative UI streaming component. The agent provides streaming `AIChunk` data; this component renders it.

Usage: `/new-genui-component Weather`

> Built-in GenUI components live in `packages/genui/src/components/` and follow a strict pattern. They extend `ChativaElement` from `@chativa/core` (NOT raw `LitElement` — `ChativaElement` provides i18n + the `GenUIComponentAPI` injection points). Registration happens centrally in `packages/genui/src/index.ts`, not as a side-effect at module load.

---

Given the suffix `$ARGUMENTS` (PascalCase), the class name is `GenUI$ARGUMENTS`, the file is `GenUI$ARGUMENTS.ts`, and the registry key + custom element tag is `genui-[kebab-name]` (e.g. `Weather` → `genui-weather`, `ImageGallery` → `genui-image-gallery`).

## Step 1 — Create the component

Create `packages/genui/src/components/GenUI$ARGUMENTS.ts`:

```ts
import { html, css, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { ChativaElement } from "@chativa/core";

/**
 * `<genui-[kebab-name]>` — built-in $ARGUMENTS component for Generative UI streams.
 *
 * Expected props from connector:
 * ```json
 * {
 *   "title": "...",
 *   "value": "..."
 * }
 * ```
 */
@customElement("genui-[kebab-name]")
export class GenUI$ARGUMENTS extends ChativaElement {
  static override styles = css`
    :host { display: block; }
    .container {
      padding: 12px;
      border-radius: 10px;
      background: var(--chativa-genui-surface, #f8fafc);
      max-width: 420px;
    }
    .title { margin: 0 0 6px; font-weight: 600; font-size: 0.9rem; }
  `;

  @property({ type: String }) title = "";
  @property({ type: String }) value = "";

  override render() {
    return html`
      <div class="container">
        ${this.title ? html`<p class="title">${this.title}</p>` : nothing}
        ${this.value ? html`<p>${this.value}</p>` : nothing}
      </div>
    `;
  }
}
```

If the component reacts to user input, dispatch events via the injected `GenUIComponentAPI` rather than wiring up DOM events ad-hoc — see `GenUIForm.ts` and `GenUIQuickReplies.ts` for the pattern.

## Step 2 — Tests

Create `packages/genui/src/components/__tests__/GenUI$ARGUMENTS.test.ts`:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import "../GenUI$ARGUMENTS";

describe("GenUI$ARGUMENTS", () => {
  beforeAll(() => {
    if (!customElements.get("genui-[kebab-name]")) {
      throw new Error("Custom element not registered");
    }
  });

  it("renders the title prop", async () => {
    const el = document.createElement("genui-[kebab-name]") as HTMLElement & { title: string };
    el.title = "Hello";
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 0));
    expect(el.shadowRoot?.textContent).toContain("Hello");
    el.remove();
  });
});
```

## Step 3 — Wire up in the central index

Edit `packages/genui/src/index.ts`:

1. Add the named export alongside the others:
   ```ts
   export { GenUI$ARGUMENTS } from "./components/GenUI$ARGUMENTS";
   ```
2. Add the import in the registration block:
   ```ts
   import { GenUI$ARGUMENTS } from "./components/GenUI$ARGUMENTS";
   ```
3. Add the `GenUIRegistry.register(...)` line, keeping column alignment with the existing block:
   ```ts
   GenUIRegistry.register("genui-[kebab-name]", GenUI$ARGUMENTS as unknown as typeof HTMLElement);
   ```

## Step 4 — Schema pairing

If the component's payload shape is non-trivial (more than 2-3 string fields), document it under `schemas/genui/` following the `ai-chunk.schema.json` pattern. Hand off to `chativa-schema-sync` for that work.

## Step 5 — Verify

Run:
- `pnpm --filter @chativa/genui typecheck`
- `pnpm --filter @chativa/genui test`
- `pnpm --filter @chativa/genui build`
