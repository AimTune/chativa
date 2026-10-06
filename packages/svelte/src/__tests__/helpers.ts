import { waitFor } from "@testing-library/svelte";
import { expect } from "vitest";
import type { IConnector } from "@chativa/core";

export function makeFakeConnector(name: string): IConnector {
  return {
    name,
    async connect() {},
    async disconnect() {},
    async sendMessage() {},
    onMessage() {},
  };
}

/**
 * Wait for a lazily-imported element to mount. The first mount in a file
 * pays for the dynamic `import("@chativa/ui")`, which regularly overruns
 * `waitFor`'s 1s default in a cold Vitest worker — hence the explicit timeout.
 */
export function waitForElement(tag: string): Promise<Element> {
  return waitFor(
    () => {
      const el = document.querySelector(tag);
      expect(el).not.toBeNull();
      return el as Element;
    },
    { timeout: 15000 },
  );
}
