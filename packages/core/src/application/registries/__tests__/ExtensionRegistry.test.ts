import { describe, it, expect, vi, beforeEach } from "vitest";
import { ExtensionRegistry } from "../ExtensionRegistry";
import type { IExtension, ExtensionContext } from "../../../domain/ports/IExtension";

function makeMockExtension(
  name: string,
  installFn?: (ctx: ExtensionContext) => void
): IExtension {
  return {
    name,
    version: "1.0.0",
    install: installFn ?? (() => {}),
    uninstall: vi.fn(),
  };
}

describe("ExtensionRegistry", () => {
  beforeEach(() => ExtensionRegistry.clear());

  it("installs an extension", () => {
    ExtensionRegistry.install(makeMockExtension("analytics"));
    expect(ExtensionRegistry.has("analytics")).toBe(true);
  });

  it("throws when installing the same extension twice", () => {
    ExtensionRegistry.install(makeMockExtension("dup"));
    expect(() => ExtensionRegistry.install(makeMockExtension("dup"))).toThrow(
      /already installed/
    );
  });

  it("calls install() with an ExtensionContext", () => {
    const installFn = vi.fn();
    ExtensionRegistry.install(makeMockExtension("ctx-test", installFn));
    expect(installFn).toHaveBeenCalledOnce();
    expect(installFn.mock.calls[0][0]).toHaveProperty("onAfterReceive");
  });

  it("calls uninstall() when uninstalling", () => {
    const ext = makeMockExtension("rm");
    ExtensionRegistry.install(ext);
    ExtensionRegistry.uninstall("rm");
    expect(ext.uninstall).toHaveBeenCalledOnce();
  });

  it("is no longer listed after uninstall", () => {
    ExtensionRegistry.install(makeMockExtension("gone"));
    ExtensionRegistry.uninstall("gone");
    expect(ExtensionRegistry.has("gone")).toBe(false);
  });

  it("list() returns installed extension names", () => {
    ExtensionRegistry.install(makeMockExtension("a"));
    ExtensionRegistry.install(makeMockExtension("b"));
    expect(ExtensionRegistry.list()).toEqual(expect.arrayContaining(["a", "b"]));
  });

  describe("message pipeline", () => {
    it("passes messages through when no hooks are registered", () => {
      const msg = { id: "1", type: "text", data: { text: "hi" } };
      expect(ExtensionRegistry.runAfterReceive(msg)).toEqual(msg);
      expect(ExtensionRegistry.runBeforeSend({ ...msg, timestamp: 0 })).toEqual({
        ...msg,
        timestamp: 0,
      });
    });

    it("transforms incoming messages via onAfterReceive", () => {
      ExtensionRegistry.install(
        makeMockExtension("transformer", (ctx) => {
          ctx.onAfterReceive((msg) => ({
            ...msg,
            data: { text: "transformed" },
          }));
        })
      );
      const result = ExtensionRegistry.runAfterReceive({
        id: "1",
        type: "text",
        data: { text: "original" },
      });
      expect(result?.data.text).toBe("transformed");
    });

    it("blocks incoming messages when onAfterReceive returns null", () => {
      ExtensionRegistry.install(
        makeMockExtension("blocker", (ctx) => {
          ctx.onAfterReceive(() => null);
        })
      );
      const result = ExtensionRegistry.runAfterReceive({
        id: "1",
        type: "text",
        data: { text: "blocked" },
      });
      expect(result).toBeNull();
    });

    it("transforms outgoing messages via onBeforeSend", () => {
      ExtensionRegistry.install(
        makeMockExtension("send-transformer", (ctx) => {
          ctx.onBeforeSend((msg) => ({ ...msg, data: { text: "modified" } }));
        })
      );
      const result = ExtensionRegistry.runBeforeSend({
        id: "1",
        type: "text",
        data: { text: "original" },
        timestamp: 0,
      });
      expect(result?.data.text).toBe("modified");
    });

    it("notifies open handlers", () => {
      const cb = vi.fn();
      ExtensionRegistry.install(
        makeMockExtension("open-test", (ctx) => ctx.onWidgetOpen(cb))
      );
      ExtensionRegistry.notifyOpen();
      expect(cb).toHaveBeenCalledOnce();
    });

    it("notifies close handlers", () => {
      const cb = vi.fn();
      ExtensionRegistry.install(
        makeMockExtension("close-test", (ctx) => ctx.onWidgetClose(cb))
      );
      ExtensionRegistry.notifyClose();
      expect(cb).toHaveBeenCalledOnce();
    });
  });
});
