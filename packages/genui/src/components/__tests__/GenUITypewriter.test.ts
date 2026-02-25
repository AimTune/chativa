import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GenUITypewriter } from "../GenUITypewriter";

describe("GenUITypewriter", () => {
  let el: GenUITypewriter;

  beforeEach(() => {
    vi.useFakeTimers();
    el = new GenUITypewriter();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is defined as a custom element", () => {
    expect(customElements.get("genui-typewriter")).toBeDefined();
  });

  it("content defaults to empty string", () => {
    expect(el.content).toBe("");
  });

  it("speed defaults to undefined (uses 25ms)", () => {
    expect(el.speed).toBeUndefined();
  });

  it("cursor defaults to undefined (treated as true)", () => {
    expect(el.cursor).toBeUndefined();
  });

  it("_displayed starts empty", () => {
    expect((el as any)._displayed).toBe("");
  });

  it("_clearTimer sets _timer to null", () => {
    (el as any)._timer = setInterval(() => {}, 100);
    (el as any)._clearTimer();
    expect((el as any)._timer).toBeNull();
  });

  it("_restart does nothing when content is already fully displayed", () => {
    el.content = "hi";
    (el as any)._displayed = "hi";
    (el as any)._restart();
    expect((el as any)._timer).toBeNull();
  });

  it("_restart starts a timer when content is ahead of _displayed", () => {
    el.content = "hello";
    (el as any)._displayed = "";
    (el as any)._restart();
    expect((el as any)._timer).not.toBeNull();
    (el as any)._clearTimer();
  });

  it("advances _displayed one char per tick", () => {
    el.content = "abc";
    (el as any)._displayed = "";
    (el as any)._restart();

    vi.advanceTimersByTime(25);
    expect((el as any)._displayed).toBe("a");

    vi.advanceTimersByTime(25);
    expect((el as any)._displayed).toBe("ab");

    vi.advanceTimersByTime(25);
    expect((el as any)._displayed).toBe("abc");
  });

  it("clears timer when animation completes", () => {
    el.content = "hi";
    (el as any)._displayed = "";
    (el as any)._restart();

    vi.advanceTimersByTime(25 * 2);
    expect((el as any)._displayed).toBe("hi");
    expect((el as any)._timer).toBeNull();
  });

  it("uses custom speed", () => {
    el.content = "ab";
    el.speed = 100;
    (el as any)._displayed = "";
    (el as any)._restart();

    vi.advanceTimersByTime(50);
    expect((el as any)._displayed).toBe(""); // not yet

    vi.advanceTimersByTime(60);
    expect((el as any)._displayed).toBe("a");
  });

  it("disconnectedCallback clears timer", () => {
    el.content = "hello";
    (el as any)._displayed = "";
    (el as any)._restart();
    expect((el as any)._timer).not.toBeNull();

    el.disconnectedCallback();
    expect((el as any)._timer).toBeNull();
  });

  it("render does not throw", () => {
    el.content = "test";
    expect(() => (el as any).render()).not.toThrow();
  });
});
