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

/** Poll until `check` stops throwing — the first mount pays for importing `@chativa/ui`. */
export async function waitFor(check: () => void, timeout = 15000): Promise<void> {
  const start = Date.now();
  for (;;) {
    try {
      check();
      return;
    } catch (error) {
      if (Date.now() - start > timeout) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}
