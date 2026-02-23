import { describe, it, expect } from "vitest";
import { createOutgoingMessage } from "../Message";

describe("createOutgoingMessage", () => {
  it("creates a message with the given text", () => {
    const msg = createOutgoingMessage("Hello world");
    expect(msg.data.text).toBe("Hello world");
  });

  it("defaults type to 'text'", () => {
    const msg = createOutgoingMessage("Hi");
    expect(msg.type).toBe("text");
  });

  it("accepts a custom type", () => {
    const msg = createOutgoingMessage("payload", "card");
    expect(msg.type).toBe("card");
  });

  it("generates a unique id each call", () => {
    const a = createOutgoingMessage("x");
    const b = createOutgoingMessage("x");
    expect(a.id).not.toBe(b.id);
  });

  it("sets a timestamp close to now", () => {
    const before = Date.now();
    const msg = createOutgoingMessage("t");
    const after = Date.now();
    expect(msg.timestamp).toBeGreaterThanOrEqual(before);
    expect(msg.timestamp).toBeLessThanOrEqual(after);
  });
});
