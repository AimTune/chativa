import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MekikConnector } from "../index";
import type { MekikClientSkill, MekikSkillSummary, MekikSkillUse } from "../index";

/** Minimal WebSocket stub — tests drive open/message transitions by hand. */
class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  sent: string[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: { reason: string }) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }
}

/** In-memory localStorage so the catalog cache is deterministic under node. */
class MemoryStorage {
  #map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.#map.has(k) ? this.#map.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.#map.set(k, String(v));
  }
  removeItem(k: string): void {
    this.#map.delete(k);
  }
}

const SKILL: MekikClientSkill = {
  name: "ui-conventions",
  description: "How this app names its screens and actions.",
  instructions: "# UI conventions\nUse the names from the sidebar.",
};

function makeConnector(opts: Partial<ConstructorParameters<typeof MekikConnector>[0]> = {}) {
  const connector = new MekikConnector({ url: "ws://skills-test", reconnect: false, ...opts });
  const route = (frame: Record<string, unknown>) =>
    (connector as unknown as { routeFrame(raw: string): void }).routeFrame(JSON.stringify(frame));
  return { connector, route };
}

async function openConnection(connector: MekikConnector): Promise<MockWebSocket> {
  const connecting = connector.connect();
  const ws = MockWebSocket.instances.at(-1)!;
  ws.open();
  await connecting;
  return ws;
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
  vi.stubGlobal("localStorage", new MemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("client skill declarations (§12.4)", () => {
  it("declares the skills in the hello handshake", async () => {
    const { connector } = makeConnector({ skills: [SKILL] });
    const ws = await openConnection(connector);

    const hello = JSON.parse(ws.sent[0]) as Record<string, unknown>;
    expect(hello.type).toBe("hello");
    expect(hello.skills).toEqual([SKILL]);
  });

  it("sends no skills field when nothing is declared", async () => {
    const { connector } = makeConnector();
    const ws = await openConnection(connector);
    expect(JSON.parse(ws.sent[0])).not.toHaveProperty("skills");
  });

  it("exposes frozen declaration clones that later mutation cannot change", () => {
    const original = { ...SKILL, tags: ["docs"] };
    const { connector } = makeConnector({ skills: [original] });
    original.description = "rewritten";
    original.tags.push("injected");
    expect(connector.clientSkills[0].description).toBe(SKILL.description);
    expect(connector.clientSkills[0].tags).toEqual(["docs"]);
    expect(Object.isFrozen(connector.clientSkills[0])).toBe(true);
  });

  it("seals the skill set by default: registerSkill/unregisterSkill throw", () => {
    const { connector } = makeConnector({ skills: [SKILL] });
    expect(() => connector.registerSkill({ ...SKILL, name: "another" })).toThrow(/sealed/);
    expect(() => connector.unregisterSkill(SKILL.name)).toThrow(/sealed/);
  });

  it("re-announces the whole set with a client_skills frame when dynamic skills are allowed", async () => {
    const { connector } = makeConnector({ skills: [SKILL], allowDynamicSkills: true });
    const ws = await openConnection(connector);

    const second: MekikClientSkill = {
      name: "house-style",
      description: "Write like the brand book.",
      instructions: "Short sentences.",
    };
    connector.registerSkill(second);
    let frame = JSON.parse(ws.sent.at(-1)!) as Record<string, unknown>;
    expect(frame.type).toBe("client_skills");
    expect(frame.skills).toEqual([SKILL, second]);

    // `[]` is meaningful on the wire — withdrawing the last skill still announces.
    connector.unregisterSkill(SKILL.name);
    connector.unregisterSkill(second.name);
    frame = JSON.parse(ws.sent.at(-1)!) as Record<string, unknown>;
    expect(frame.type).toBe("client_skills");
    expect(frame.skills).toEqual([]);
  });

  it("replaces an earlier declaration of the same name in place", () => {
    const { connector } = makeConnector({ allowDynamicSkills: true, skills: [SKILL] });
    connector.registerSkill({ ...SKILL, description: "Updated trigger surface." });
    expect(connector.clientSkills).toHaveLength(1);
    expect(connector.clientSkills[0].description).toBe("Updated trigger surface.");
  });

  it("rejects declarations the server would discard (§12.4 sanitization)", () => {
    expect(() => makeConnector({ skills: [{ ...SKILL, name: "Bad Name" }] })).toThrow(/name/);
    expect(() => makeConnector({ skills: [{ ...SKILL, name: "-leading" }] })).toThrow(/name/);
    expect(() => makeConnector({ skills: [{ ...SKILL, description: "   " }] })).toThrow(/description/);
    expect(() =>
      makeConnector({ skills: [{ ...SKILL, description: "x".repeat(1025) }] }),
    ).toThrow(/description/);
    expect(() =>
      makeConnector({ skills: [{ ...SKILL, instructions: undefined as unknown as string }] }),
    ).toThrow(/instructions/);
  });
});

describe("server skill catalog (§12.2)", () => {
  const CATALOG: MekikSkillSummary[] = [
    { name: "brand-voice", description: "Write in the house voice.", source: "server" },
    { name: "pdf", description: "Fill, merge and read PDF forms.", tags: ["docs"], source: "server" },
  ];

  it("stores the catalog, notifies the handler, and exposes it via serverSkills", () => {
    const { connector, route } = makeConnector();
    const seen: MekikSkillSummary[][] = [];
    connector.onSkills((s) => seen.push(s));

    route({ type: "skills", hash: "9f3a", skills: CATALOG });

    expect(seen).toEqual([CATALOG]);
    expect(connector.serverSkills).toEqual(CATALOG);
  });

  it("replays an already-arrived catalog to a late-registered handler", () => {
    const { connector, route } = makeConnector();
    route({ type: "skills", hash: "9f3a", skills: CATALOG });

    const seen: MekikSkillSummary[][] = [];
    connector.onSkills((s) => seen.push(s));
    expect(seen).toEqual([CATALOG]);
  });

  it("caches by hash and hands skillsHash back in the next hello", async () => {
    const { route } = makeConnector();
    route({ type: "skills", hash: "9f3a", skills: CATALOG });

    // A new connector against the same URL restores the cache and sends the ETag.
    const { connector: next } = makeConnector();
    const seen: MekikSkillSummary[][] = [];
    next.onSkills((s) => seen.push(s));
    const ws = await openConnection(next);

    const hello = JSON.parse(ws.sent[0]) as Record<string, unknown>;
    expect(hello.skillsHash).toBe("9f3a");
    expect(seen).toEqual([CATALOG]); // restored during the handshake
    expect(next.serverSkills).toEqual(CATALOG);
  });

  it("treats `unchanged` as a cache confirmation: no re-notify, catalog kept", async () => {
    const { route: seedCache } = makeConnector();
    seedCache({ type: "skills", hash: "9f3a", skills: CATALOG });

    const { connector: next, route: routeNext } = makeConnector();
    const seen: MekikSkillSummary[][] = [];
    next.onSkills((s) => seen.push(s));
    await openConnection(next);
    expect(seen).toHaveLength(1);

    routeNext({ type: "skills", hash: "9f3a", unchanged: true });
    expect(seen).toHaveLength(1);
    expect(next.serverSkills).toEqual(CATALOG);
  });

  it("never surfaces the catalog frame as a chat message", () => {
    const { connector, route } = makeConnector();
    const messages: unknown[] = [];
    connector.onMessage((m) => messages.push(m));
    route({ type: "skills", hash: "9f3a", skills: CATALOG });
    expect(messages).toEqual([]);
  });
});

describe("skill use traces (§12.5)", () => {
  it("delivers each `skill` frame to onSkillUse and keeps it out of the chat", () => {
    const { connector, route } = makeConnector();
    const uses: MekikSkillUse[] = [];
    const messages: unknown[] = [];
    connector.onSkillUse((u) => uses.push(u));
    connector.onMessage((m) => messages.push(m));

    route({
      type: "skill",
      seq: 7,
      data: { id: "conv-1:skill:0", name: "pdf", status: "loaded", source: "server" },
    });
    route({
      type: "skill",
      seq: 8,
      data: { id: "conv-1:skill:1", name: "nope", status: "error", error: "unknown skill" },
    });

    expect(uses).toEqual([
      { id: "conv-1:skill:0", name: "pdf", status: "loaded", source: "server" },
      { id: "conv-1:skill:1", name: "nope", status: "error", error: "unknown skill" },
    ]);
    expect(messages).toEqual([]);
  });

  it("advances the resume watermark from a skill frame's seq", () => {
    const { connector, route } = makeConnector();
    route({ type: "skill", seq: 41, data: { id: "s1", name: "pdf", status: "loaded" } });
    expect(
      (connector as unknown as { watermark: number }).watermark,
    ).toBe(41);
  });

  it("drops a malformed skill frame without calling the handler", () => {
    const { connector, route } = makeConnector();
    const uses: MekikSkillUse[] = [];
    connector.onSkillUse((u) => uses.push(u));
    route({ type: "skill", seq: 9, data: { name: "pdf", status: "loaded" } }); // no id
    route({ type: "skill", seq: 10, data: { id: "x", name: "pdf", status: "working" } }); // bad status
    expect(uses).toEqual([]);
  });
});
