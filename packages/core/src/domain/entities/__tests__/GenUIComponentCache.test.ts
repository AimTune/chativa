import { describe, it, expect, beforeEach } from "vitest";
import type { GenUIComponentDefinition } from "../GenUI";
import {
  createGenUIComponentCache,
  type GenUIComponentCacheStorage,
} from "../GenUIComponentCache";

const DEFS: GenUIComponentDefinition[] = [
  { name: "order-card", template: "<p>{{title}}</p>", props: { title: "" } },
];

class MemoryStorage implements GenUIComponentCacheStorage {
  map = new Map<string, string>();
  getItem(k: string) { return this.map.get(k) ?? null; }
  setItem(k: string, v: string) { this.map.set(k, v); }
  removeItem(k: string) { this.map.delete(k); }
}

let storage: MemoryStorage;
const cache = () => createGenUIComponentCache({ namespace: "ws://a.test/chat", storage });

beforeEach(() => { storage = new MemoryStorage(); });

describe("createGenUIComponentCache", () => {
  it("round-trips a catalog", () => {
    const c = cache();
    c.save("h1", DEFS);

    expect(c.hash()).toBe("h1");
    expect(c.load()?.components).toEqual(DEFS);
  });

  it("returns null / undefined when nothing is cached", () => {
    expect(cache().load()).toBeNull();
    expect(cache().hash()).toBeUndefined();
  });

  it("keys entries by namespace so two servers don't share markup", () => {
    createGenUIComponentCache({ namespace: "a", storage }).save("h1", DEFS);
    expect(createGenUIComponentCache({ namespace: "b", storage }).load()).toBeNull();
  });

  it("replaces the entry on save", () => {
    const c = cache();
    c.save("h1", DEFS);
    c.save("h2", [{ name: "other", template: "<b>x</b>" }]);

    expect(c.hash()).toBe("h2");
    expect(c.load()?.components).toHaveLength(1);
    expect(c.load()?.components[0]!.name).toBe("other");
  });

  it("clears", () => {
    const c = cache();
    c.save("h1", DEFS);
    c.clear();
    expect(c.load()).toBeNull();
  });

  it("treats an empty hash as a clear", () => {
    const c = cache();
    c.save("h1", DEFS);
    c.save("", DEFS);
    expect(c.load()).toBeNull();
  });

  it("ignores a corrupted entry instead of throwing", () => {
    storage.setItem("chativa:genui-components:ws://a.test/chat", "{not json");
    expect(cache().load()).toBeNull();
  });

  it("ignores an entry with the wrong shape", () => {
    storage.setItem("chativa:genui-components:ws://a.test/chat", JSON.stringify({ hash: 1 }));
    expect(cache().load()).toBeNull();
  });

  it("drops malformed definitions from a stored catalog", () => {
    storage.setItem(
      "chativa:genui-components:ws://a.test/chat",
      JSON.stringify({ hash: "h1", components: [DEFS[0], { name: "broken" }, null] })
    );
    expect(cache().load()?.components).toHaveLength(1);
  });

  it("survives a storage that throws on write", () => {
    const hostile: GenUIComponentCacheStorage = {
      getItem: () => null,
      setItem: () => { throw new Error("QuotaExceededError"); },
      removeItem: () => { throw new Error("nope"); },
    };
    const c = createGenUIComponentCache({ namespace: "x", storage: hostile });

    expect(() => c.save("h1", DEFS)).not.toThrow();
    expect(() => c.clear()).not.toThrow();
    expect(c.load()).toBeNull();
  });
});
