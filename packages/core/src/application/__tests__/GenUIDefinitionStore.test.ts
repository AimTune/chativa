import { describe, it, expect, vi, beforeEach } from "vitest";
import type { GenUIComponentDefinition } from "../../domain/entities/GenUI";
import { genUIDefinitionStore } from "../GenUIDefinitionStore";

const card: GenUIComponentDefinition = { name: "order-card", template: "<p>{{title}}</p>" };
const list: GenUIComponentDefinition = { name: "order-list", template: "<ul></ul>" };

beforeEach(() => genUIDefinitionStore.clear());

describe("genUIDefinitionStore", () => {
  it("notifies subscribers of published definitions", () => {
    const cb = vi.fn();
    genUIDefinitionStore.subscribe(cb);
    genUIDefinitionStore.publish([card]);

    expect(cb).toHaveBeenCalledWith([card]);
  });

  it("replays what was published before the subscription", () => {
    genUIDefinitionStore.publish([card]);
    const cb = vi.fn();
    genUIDefinitionStore.subscribe(cb);

    expect(cb).toHaveBeenCalledWith([card]);
  });

  it("drops definitions it already knows, so a reconnect notifies nobody", () => {
    genUIDefinitionStore.publish([card]);
    const cb = vi.fn();
    genUIDefinitionStore.subscribe(cb);
    cb.mockClear();

    expect(genUIDefinitionStore.publish([card])).toEqual([]);
    expect(cb).not.toHaveBeenCalled();
  });

  it("publishes only the new definitions of a partially known catalog", () => {
    genUIDefinitionStore.publish([card]);
    const cb = vi.fn();
    genUIDefinitionStore.subscribe(cb);
    cb.mockClear();

    expect(genUIDefinitionStore.publish([card, list])).toEqual([list]);
    expect(cb).toHaveBeenCalledWith([list]);
  });

  it("treats a new version of the same name as new", () => {
    genUIDefinitionStore.publish([card]);
    const v2 = { ...card, version: "2" };

    expect(genUIDefinitionStore.publish([v2])).toEqual([v2]);
    expect(genUIDefinitionStore.list()).toHaveLength(2);
  });

  it("ignores definitions without a name", () => {
    expect(genUIDefinitionStore.publish([{ name: "", template: "x" }])).toEqual([]);
    expect(genUIDefinitionStore.list()).toEqual([]);
  });

  it("reports what it knows", () => {
    genUIDefinitionStore.publish([card]);

    expect(genUIDefinitionStore.has("order-card")).toBe(true);
    expect(genUIDefinitionStore.has("order-card", "2")).toBe(false);
    expect(genUIDefinitionStore.has("nope")).toBe(false);
  });

  it("stops notifying after unsubscribe", () => {
    const cb = vi.fn();
    const unsub = genUIDefinitionStore.subscribe(cb);
    unsub();
    genUIDefinitionStore.publish([card]);

    expect(cb).not.toHaveBeenCalled();
  });
});
