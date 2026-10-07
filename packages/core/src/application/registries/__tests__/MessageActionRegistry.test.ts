import { describe, it, expect, vi, beforeEach } from "vitest";
import { MessageActionRegistry } from "../MessageActionRegistry";
import { resolveMessageActionLabel } from "../../../domain/ports/IMessageAction";
import type {
  IMessageAction,
  MessageActionContext,
} from "../../../domain/ports/IMessageAction";

function makeAction(name: string, extra: Partial<IMessageAction> = {}): IMessageAction {
  return { name, label: name, execute: vi.fn(), ...extra };
}

function ctx(sender: "bot" | "user", isLatest = false, type = "text"): MessageActionContext {
  return {
    message: { id: "m1", type, data: { text: "hi" } },
    sender,
    isLatest,
  };
}

describe("MessageActionRegistry", () => {
  beforeEach(() => MessageActionRegistry.clear());

  it("registers, retrieves and unregisters an action", () => {
    const share = makeAction("share");
    MessageActionRegistry.register(share);
    expect(MessageActionRegistry.has("share")).toBe(true);
    expect(MessageActionRegistry.get("share")).toBe(share);

    MessageActionRegistry.unregister("share");
    expect(MessageActionRegistry.has("share")).toBe(false);
    expect(MessageActionRegistry.get("share")).toBeUndefined();
  });

  it("registering the same name replaces the action", () => {
    const a = makeAction("share");
    const b = makeAction("share");
    MessageActionRegistry.register(a);
    MessageActionRegistry.register(b);
    expect(MessageActionRegistry.list()).toEqual([b]);
  });

  it("list() sorts by order, keeping registration order for ties", () => {
    MessageActionRegistry.register(makeAction("c", { order: 5 }));
    MessageActionRegistry.register(makeAction("a"));
    MessageActionRegistry.register(makeAction("b"));
    MessageActionRegistry.register(makeAction("first", { order: -1 }));
    expect(MessageActionRegistry.list().map((x) => x.name)).toEqual(["first", "a", "b", "c"]);
  });

  it("forMessage() defaults to bot messages and honours appliesTo", () => {
    MessageActionRegistry.register(makeAction("bot-only"));
    MessageActionRegistry.register(makeAction("user-only", { appliesTo: "user" }));
    MessageActionRegistry.register(makeAction("everyone", { appliesTo: "all" }));

    expect(MessageActionRegistry.forMessage(ctx("bot")).map((a) => a.name)).toEqual([
      "bot-only",
      "everyone",
    ]);
    expect(MessageActionRegistry.forMessage(ctx("user")).map((a) => a.name)).toEqual([
      "user-only",
      "everyone",
    ]);
  });

  it("appliesTo accepts a list of senders, and excludeSenders wins over it", () => {
    MessageActionRegistry.register(makeAction("both", { appliesTo: ["bot", "user"] }));
    MessageActionRegistry.register(makeAction("all-but-user", { appliesTo: "all", excludeSenders: ["user"] }));
    MessageActionRegistry.register(makeAction("contradiction", { appliesTo: ["user"], excludeSenders: ["user"] }));

    expect(MessageActionRegistry.forMessage(ctx("bot")).map((a) => a.name)).toEqual(["both", "all-but-user"]);
    expect(MessageActionRegistry.forMessage(ctx("user")).map((a) => a.name)).toEqual(["both"]);
  });

  it("messageTypes limits the types; excludeMessageTypes wins over it", () => {
    MessageActionRegistry.register(makeAction("text-only", { messageTypes: ["text"] }));
    MessageActionRegistry.register(makeAction("not-genui", { excludeMessageTypes: ["genui"] }));
    MessageActionRegistry.register(makeAction("cards-but-not-cards", { messageTypes: ["card"], excludeMessageTypes: ["card"] }));
    MessageActionRegistry.register(makeAction("any"));

    const names = (type: string) =>
      MessageActionRegistry.forMessage(ctx("bot", false, type)).map((a) => a.name);
    expect(names("text")).toEqual(["text-only", "not-genui", "any"]);
    expect(names("genui")).toEqual(["any"]);
    expect(names("card")).toEqual(["not-genui", "any"]);
  });

  it("the declarative filters run before isVisible", () => {
    const isVisible = vi.fn(() => true);
    MessageActionRegistry.register(makeAction("x", { messageTypes: ["card"], isVisible }));
    expect(MessageActionRegistry.forMessage(ctx("bot"))).toEqual([]);
    expect(isVisible).not.toHaveBeenCalled();
  });

  it("forMessage() applies isVisible with the message context", () => {
    const isVisible = vi.fn((c: MessageActionContext) => c.isLatest);
    MessageActionRegistry.register(makeAction("latest-only", { isVisible }));

    expect(MessageActionRegistry.forMessage(ctx("bot", false))).toEqual([]);
    expect(MessageActionRegistry.forMessage(ctx("bot", true))).toHaveLength(1);
    expect(isVisible).toHaveBeenLastCalledWith(ctx("bot", true));
  });

  it("resolveMessageActionLabel: exact locale, then base language, then label", () => {
    const action = makeAction("share", {
      label: "Share",
      translations: { tr: "Paylaş", "pt-BR": "Compartilhar", de: "" },
    });
    expect(resolveMessageActionLabel(action, "tr")).toBe("Paylaş");
    expect(resolveMessageActionLabel(action, "tr-TR")).toBe("Paylaş");
    expect(resolveMessageActionLabel(action, "pt-BR")).toBe("Compartilhar");
    expect(resolveMessageActionLabel(action, "de")).toBe("Share"); // empty string = not translated
    expect(resolveMessageActionLabel(action, "fr")).toBe("Share");
    expect(resolveMessageActionLabel(action, undefined)).toBe("Share");
    expect(resolveMessageActionLabel(makeAction("x", { label: () => "Lazy" }), "tr")).toBe("Lazy");
  });

  it("clear() removes everything", () => {
    MessageActionRegistry.register(makeAction("x"));
    MessageActionRegistry.clear();
    expect(MessageActionRegistry.list()).toEqual([]);
  });
});
