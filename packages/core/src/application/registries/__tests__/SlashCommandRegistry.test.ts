import { describe, it, expect, vi, beforeEach } from "vitest";
import { SlashCommandRegistry } from "../SlashCommandRegistry";
import type { ISlashCommand, CommandContext } from "../../../domain/ports/ISlashCommand";

function makeCommand(name: string, execute?: (ctx: CommandContext) => void): ISlashCommand {
  return {
    name,
    description: `${name} command`,
    execute: execute ?? vi.fn(),
  };
}

describe("SlashCommandRegistry", () => {
  beforeEach(() => {
    SlashCommandRegistry.clear();
  });

  // ── register / get ─────────────────────────────────────────────────

  it("register stores a command retrievable by get()", () => {
    const cmd = makeCommand("clear");
    SlashCommandRegistry.register(cmd);
    expect(SlashCommandRegistry.get("clear")).toBe(cmd);
  });

  it("get() returns undefined for unknown command", () => {
    expect(SlashCommandRegistry.get("nonexistent")).toBeUndefined();
  });

  it("registering the same name twice overwrites the old command", () => {
    const cmd1 = makeCommand("clear");
    const cmd2 = makeCommand("clear");
    SlashCommandRegistry.register(cmd1);
    SlashCommandRegistry.register(cmd2);
    expect(SlashCommandRegistry.get("clear")).toBe(cmd2);
  });

  // ── unregister ─────────────────────────────────────────────────────

  it("unregister removes the command", () => {
    SlashCommandRegistry.register(makeCommand("help"));
    SlashCommandRegistry.unregister("help");
    expect(SlashCommandRegistry.get("help")).toBeUndefined();
  });

  it("unregister on unknown name is a no-op", () => {
    expect(() => SlashCommandRegistry.unregister("ghost")).not.toThrow();
  });

  // ── list ───────────────────────────────────────────────────────────

  it("list() returns all registered commands", () => {
    SlashCommandRegistry.register(makeCommand("a"));
    SlashCommandRegistry.register(makeCommand("b"));
    SlashCommandRegistry.register(makeCommand("c"));
    const names = SlashCommandRegistry.list().map((c) => c.name);
    expect(names).toContain("a");
    expect(names).toContain("b");
    expect(names).toContain("c");
    expect(names).toHaveLength(3);
  });

  it("list() returns empty array when nothing is registered", () => {
    expect(SlashCommandRegistry.list()).toHaveLength(0);
  });

  // ── has ────────────────────────────────────────────────────────────

  it("has() returns true for registered command", () => {
    SlashCommandRegistry.register(makeCommand("ping"));
    expect(SlashCommandRegistry.has("ping")).toBe(true);
  });

  it("has() returns false for unknown command", () => {
    expect(SlashCommandRegistry.has("missing")).toBe(false);
  });

  // ── execute ────────────────────────────────────────────────────────

  it("execute() calls the command's execute function and returns true", () => {
    const fn = vi.fn();
    SlashCommandRegistry.register(makeCommand("run", fn));
    const result = SlashCommandRegistry.execute("run", "some args");
    expect(result).toBe(true);
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith({ args: "some args" });
  });

  it("execute() returns false for unknown command and does not throw", () => {
    const result = SlashCommandRegistry.execute("ghost", "");
    expect(result).toBe(false);
  });

  it("execute() passes args string in CommandContext", () => {
    let received: CommandContext | null = null;
    SlashCommandRegistry.register(makeCommand("greet", (ctx) => { received = ctx; }));
    SlashCommandRegistry.execute("greet", "hello world");
    expect(received).toEqual({ args: "hello world" });
  });

  it("execute() with empty args string passes empty args", () => {
    let received: CommandContext | null = null;
    SlashCommandRegistry.register(makeCommand("noop", (ctx) => { received = ctx; }));
    SlashCommandRegistry.execute("noop", "");
    expect(received).toEqual({ args: "" });
  });

  // ── clear ──────────────────────────────────────────────────────────

  it("clear() removes all commands", () => {
    SlashCommandRegistry.register(makeCommand("x"));
    SlashCommandRegistry.register(makeCommand("y"));
    SlashCommandRegistry.clear();
    expect(SlashCommandRegistry.list()).toHaveLength(0);
  });

  it("after clear(), previously registered commands are not found", () => {
    SlashCommandRegistry.register(makeCommand("gone"));
    SlashCommandRegistry.clear();
    expect(SlashCommandRegistry.has("gone")).toBe(false);
    expect(SlashCommandRegistry.get("gone")).toBeUndefined();
  });

  it("after clear(), execute() returns false", () => {
    SlashCommandRegistry.register(makeCommand("done"));
    SlashCommandRegistry.clear();
    expect(SlashCommandRegistry.execute("done", "")).toBe(false);
  });
});
