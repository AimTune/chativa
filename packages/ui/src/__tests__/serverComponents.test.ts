import { describe, it, expect, afterEach } from "vitest";
import { genUIDefinitionStore } from "@chativa/core";
import { GenUIRegistry, clearServerComponents, getServerComponentPolicy } from "../index";

/**
 * Server-defined GenUI components (mekik PROTOCOL §10) have to work for an app
 * whose only Chativa dependency is `@chativa/ui`: the definition arrives on the
 * wire, core publishes it, and the subscription `@chativa/ui` sets up when it
 * loads has to turn it into a registered custom element.
 *
 * This also pins the packaging that makes it possible — `@chativa/ui` reaches
 * the *same* GenUI registry as `@chativa/genui` rather than carrying an inlined
 * copy of it, which is what previously left these APIs unreachable and made
 * importing both packages redefine every `genui-*` element.
 */
describe("@chativa/ui — server-defined GenUI components", () => {
  // Only the registry is reset — `genUIDefinitionStore.clear()` would also drop
  // the subscription `@chativa/ui` installs at import time, which is the very
  // thing under test here.
  afterEach(() => {
    clearServerComponents();
  });

  it("registers a component the server publishes, with only @chativa/ui loaded", () => {
    expect(GenUIRegistry.has("kpi-card")).toBe(false);

    genUIDefinitionStore.publish([
      { name: "kpi-card", template: "<div class='kpi'>{{label}}</div>" },
    ]);

    expect(GenUIRegistry.has("kpi-card")).toBe(true);
  });

  it("exposes the server-component policy controls", () => {
    expect(getServerComponentPolicy()).toBe("app-wins");
  });
});
