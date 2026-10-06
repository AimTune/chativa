import { describe, it, expect, vi, afterEach } from "vitest";
import type { AIChunk } from "@chativa/core";
import { streamFromFetch } from "../streamFromFetch";

/** Build a fake fetch Response whose body yields the given string pieces. */
function fakeResponse(pieces: string[]) {
  const encoder = new TextEncoder();
  const queue = pieces.map((p) => encoder.encode(p));
  const releaseLock = vi.fn();
  const reader = {
    read: vi.fn(async () =>
      queue.length ? { done: false, value: queue.shift()! } : { done: true, value: undefined },
    ),
    releaseLock,
  };
  const response = { body: { getReader: () => reader } } as unknown as Response;
  return { response, releaseLock };
}

async function collect(response: Response): Promise<AIChunk[]> {
  const out: AIChunk[] = [];
  for await (const chunk of streamFromFetch(response)) out.push(chunk);
  return out;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("streamFromFetch", () => {
  it("parses one AIChunk per NDJSON line", async () => {
    const { response } = fakeResponse([
      '{"type":"text","content":"Hi","id":1}\n{"type":"text","content":"there","id":2}\n',
    ]);
    expect(await collect(response)).toEqual([
      { type: "text", content: "Hi", id: 1 },
      { type: "text", content: "there", id: 2 },
    ]);
  });

  it("reassembles a line split across network reads", async () => {
    const { response } = fakeResponse(['{"type":"text",', '"content":"split","id":1}\n']);
    expect(await collect(response)).toEqual([{ type: "text", content: "split", id: 1 }]);
  });

  it("parses a trailing line that has no final newline", async () => {
    const { response } = fakeResponse(['{"type":"text","content":"a","id":1}\n{"type":"event","name":"done","id":2}']);
    const chunks = await collect(response);
    expect(chunks).toHaveLength(2);
    expect(chunks[1]).toEqual({ type: "event", name: "done", id: 2 });
  });

  it("skips blank lines", async () => {
    const { response } = fakeResponse(['\n  \n{"type":"text","content":"x","id":1}\n\n']);
    expect(await collect(response)).toHaveLength(1);
  });

  it("logs and skips malformed lines without aborting the stream", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { response } = fakeResponse(['not json\n{"type":"text","content":"ok","id":1}\n{broken']);

    expect(await collect(response)).toEqual([{ type: "text", content: "ok", id: 1 }]);
    expect(err).toHaveBeenCalledTimes(2);
    expect(err.mock.calls[0]![0]).toContain("Failed to parse chunk");
    expect(err.mock.calls[1]![0]).toContain("Failed to parse final chunk");
  });

  it("releases the reader lock when done", async () => {
    const { response, releaseLock } = fakeResponse(['{"type":"text","content":"x","id":1}\n']);
    await collect(response);
    expect(releaseLock).toHaveBeenCalledOnce();
  });

  it("releases the reader lock when the consumer stops early", async () => {
    const { response, releaseLock } = fakeResponse([
      '{"type":"text","content":"a","id":1}\n{"type":"text","content":"b","id":2}\n',
    ]);
    for await (const _ of streamFromFetch(response)) break;
    expect(releaseLock).toHaveBeenCalledOnce();
  });

  it("throws when the response has no body", async () => {
    const response = { body: null } as unknown as Response;
    await expect(collect(response)).rejects.toThrow("[GenUI] Response body is empty");
  });
});
