import { describe, it, expect, vi, afterEach } from "vitest";
import { EventBus } from "@chativa/core";
import { registerChativa } from "../registerChativa";
import { onChativaEvent } from "../events";
import { isBrowser } from "../internal/env";
import * as env from "../internal/env";

vi.mock("../internal/env", { spy: true });

afterEach(() => {
  vi.mocked(env.isBrowser).mockRestore();
});

describe("isBrowser", () => {
  it("is true in a DOM environment", () => {
    expect(isBrowser()).toBe(true);
  });
});

describe("registerChativa", () => {
  it("is a no-op on the server and never imports @chativa/ui there", async () => {
    vi.mocked(env.isBrowser).mockReturnValue(false);
    await expect(registerChativa()).resolves.toBe(false);
    expect(customElements.get("chat-iva")).toBeUndefined();
  });

  it("defines the Chativa custom elements in the browser (idempotently)", async () => {
    await expect(registerChativa()).resolves.toBe(true);
    await expect(registerChativa()).resolves.toBe(true);
    expect(customElements.get("chat-iva")).toBeDefined();
    expect(customElements.get("chat-bot-button")).toBeDefined();
    expect(customElements.get("genui-message")).toBeDefined();
  });
});

describe("onChativaEvent", () => {
  it("subscribes to an EventBus event and returns the unsubscribe", () => {
    const handler = vi.fn();
    const off = onChativaEvent("history_loaded", handler);

    EventBus.emit("history_loaded", { count: 3 });
    off();
    EventBus.emit("history_loaded", { count: 4 });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ count: 3 });
  });

  it("is a no-op on the server", () => {
    vi.mocked(env.isBrowser).mockReturnValue(false);
    const handler = vi.fn();
    const off = onChativaEvent("history_loaded", handler);

    EventBus.emit("history_loaded", { count: 1 });
    off();

    expect(handler).not.toHaveBeenCalled();
  });
});
