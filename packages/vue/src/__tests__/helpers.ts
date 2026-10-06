import { vi, expect } from "vitest";
import type { VueWrapper } from "@vue/test-utils";
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
 * Wait for a lazily-imported custom element to appear. The first mount in a
 * file pays for the dynamic `import("@chativa/ui")`, which can overrun the
 * default `waitFor` timeout in a cold Vitest worker.
 */
export function waitForElement(wrapper: VueWrapper, selector: string): Promise<void> {
  return vi.waitFor(
    () => {
      expect(wrapper.find(selector).exists()).toBe(true);
    },
    { timeout: 20000, interval: 20 },
  );
}
