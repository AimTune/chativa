import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chatStore } from "@chativa/core";
import "../../i18n/i18n";
import "../ChatBotButton";
import "../ChatHeader";
import "../ChatInput";
import { $$, mount, resetGlobals } from "../../__tests__/testUtils";

const SVG_NS = "http://www.w3.org/2000/svg";

/** Every shape drawn inside the component's icons — built-in or overridden. */
const shapes = (el: HTMLElement) => $$(el, "svg path, svg circle");

describe("built-in icons", () => {
  beforeEach(() => resetGlobals());
  afterEach(() => resetGlobals());

  // An `html` fallback inside `<svg>` creates HTML-namespace shapes that never
  // paint — the launcher, close, send, attach and emoji buttons rendered empty.
  it.each(["chat-bot-button", "chat-header", "chat-input"])("%s draws its icons in the SVG namespace", async (tag) => {
    const el = await mount(tag);
    const drawn = shapes(el);
    expect(drawn.length).toBeGreaterThan(0);
    for (const shape of drawn) expect(shape.namespaceURI).toBe(SVG_NS);
  });

  it("an overridden icon is drawn in the SVG namespace too", async () => {
    chatStore.getState().setTheme({ icons: { send: '<path d="M1 1h22" />' } });
    const el = await mount("chat-input");
    const send = $$(el, ".send-btn svg path");
    expect(send.map((p) => p.getAttribute("d"))).toEqual(["M1 1h22"]);
    expect(send[0]!.namespaceURI).toBe(SVG_NS);
  });
});
