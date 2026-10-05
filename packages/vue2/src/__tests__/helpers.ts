import type Vue from "vue";
import type { ComponentOptions } from "vue";
import type { IConnector, MessageHandler } from "@chativa/core";

/**
 * Poll `assertion` until it stops throwing. The first mount in a file pays
 * for the dynamic `import("@chativa/ui")`, which can take several seconds in
 * a cold Vitest worker — hence the generous default timeout.
 */
export async function waitFor(assertion: () => void, timeout = 15000): Promise<void> {
  const start = Date.now();
  for (;;) {
    try {
      assertion();
      return;
    } catch (err) {
      if (Date.now() - start > timeout) throw err;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}

export interface FakeConnector extends IConnector {
  /** Delivers a message as if it came from the bot. */
  push(text: string): void;
}

export function makeFakeConnector(name: string): FakeConnector {
  let handler: MessageHandler | null = null;
  return {
    name,
    async connect() {},
    async disconnect() {},
    async sendMessage() {},
    onMessage(h) {
      handler = h;
    },
    push(text: string) {
      handler?.({ id: `${name}-${Date.now()}`, type: "text", data: { text }, timestamp: Date.now() });
    },
  };
}

/** A container attached to the document so custom elements actually connect. */
export function attachPoint(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

/**
 * `@vue/test-utils@1`'s `mount()` typings predate Vue 2.7's
 * `defineComponent()` return type; at runtime it mounts them fine.
 */
export function mountable(component: unknown): ComponentOptions<Vue> {
  return component as ComponentOptions<Vue>;
}