import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { CSSResultGroup, CSSResultOrNative } from "lit";
import { ConnectorRegistry, chatStore, type IConnector } from "@chativa/core";
import {
  i18next,
  RTL_LANGUAGES,
  isRtlLanguage,
  getLanguageDirection,
} from "../index";

/**
 * RTL support (issue #11).
 *
 * jsdom does no layout, and it does not apply the UA `[dir] { direction }`
 * rule or resolve logical properties — so these tests assert on the things
 * that *drive* the layout instead: the `dir` attribute each root carries, the
 * DOM order flexbox mirrors, and the component stylesheets (no physical
 * left/right left behind, the right logical properties in place). The actual
 * mirrored rendering still needs a visual check in a real browser.
 */

const stubConnector: IConnector = {
  name: "rtl-test",
  connect: async () => {},
  disconnect: async () => {},
  sendMessage: async () => {},
  onMessage: () => {},
};

type LitHost = HTMLElement & { updateComplete: Promise<unknown> };

/** Let MutationObserver callbacks (microtasks) run. */
const flush = () => new Promise((r) => setTimeout(r, 0));

function mount(tag: string, attrs: Record<string, string> = {}): LitHost {
  const el = document.createElement(tag) as LitHost;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  document.body.appendChild(el);
  return el;
}

/** Flattened cssText of a registered Lit element's finalized styles. */
function cssOf(tag: string): string {
  const ctor = customElements.get(tag) as unknown as { elementStyles?: CSSResultOrNative[]; styles?: CSSResultGroup } | undefined;
  expect(ctor, `<${tag}> is registered`).toBeDefined();
  const styles = ctor!.elementStyles ?? [];
  return styles
    .map((s) => ("cssText" in s ? (s as { cssText: string }).cssText : ""))
    .join("\n");
}

beforeAll(() => {
  if (!ConnectorRegistry.has("dummy")) ConnectorRegistry.register({ ...stubConnector, name: "dummy" });
});

afterEach(async () => {
  document.body.innerHTML = "";
  await i18next.changeLanguage("en");
});

afterAll(async () => {
  await i18next.changeLanguage("en");
});

describe("isRtlLanguage / RTL_LANGUAGES", () => {
  it("lists exactly ar, he, fa, ur and is read-only", () => {
    expect([...RTL_LANGUAGES].sort()).toEqual(["ar", "fa", "he", "ur"]);
    expect(Object.isFrozen(RTL_LANGUAGES)).toBe(true);
  });

  it.each(["ar", "AR", "ar-EG", "ar_SA", "he", "he-IL", "fa", "fa-IR", "ur", "ur-PK"])(
    "%s is RTL",
    (lang) => {
      expect(isRtlLanguage(lang)).toBe(true);
      expect(getLanguageDirection(lang)).toBe("rtl");
    },
  );

  it.each(["en", "en-US", "tr", "de", "arn", "here", "", undefined, null])(
    "%s is not RTL (base-subtag match only)",
    (lang) => {
      expect(isRtlLanguage(lang)).toBe(false);
      expect(getLanguageDirection(lang)).toBe("ltr");
    },
  );
});

describe("dir follows the i18next language", () => {
  beforeEach(async () => {
    await i18next.changeLanguage("en");
  });

  it("sets dir on <chat-iva> and flips it on languageChanged", async () => {
    const widget = mount("chat-iva");
    await widget.updateComplete;
    expect(widget.getAttribute("dir")).toBe("ltr");

    await i18next.changeLanguage("ar");
    expect(widget.getAttribute("dir")).toBe("rtl");

    await i18next.changeLanguage("he-IL");
    expect(widget.getAttribute("dir")).toBe("rtl");

    await i18next.changeLanguage("tr");
    expect(widget.getAttribute("dir")).toBe("ltr");
  });

  it("picks up an RTL language that was active before mounting", async () => {
    await i18next.changeLanguage("fa");
    const widget = mount("chat-iva");
    expect(widget.getAttribute("dir")).toBe("rtl");
  });

  it("also drives the separately mounted launcher and agent panel", async () => {
    if (!ConnectorRegistry.has(stubConnector.name)) ConnectorRegistry.register(stubConnector);
    const button = mount("chat-bot-button");
    const panel = mount("agent-panel", { connector: "rtl-test" });
    expect(button.getAttribute("dir")).toBe("ltr");
    expect(panel.getAttribute("dir")).toBe("ltr");

    await i18next.changeLanguage("ur");
    expect(button.getAttribute("dir")).toBe("rtl");
    expect(panel.getAttribute("dir")).toBe("rtl");
  });

  it("stops listening once disconnected", async () => {
    const widget = mount("chat-iva");
    widget.remove();
    await i18next.changeLanguage("ar");
    expect(widget.getAttribute("dir")).toBe("ltr");
  });
});

describe("an author-set dir wins", () => {
  beforeEach(async () => {
    await i18next.changeLanguage("en");
  });

  it("keeps a dir present in the markup, whatever the language", async () => {
    const widget = mount("chat-iva", { dir: "rtl" });
    expect(widget.getAttribute("dir")).toBe("rtl");

    await i18next.changeLanguage("tr");
    expect(widget.getAttribute("dir")).toBe("rtl");

    const ltr = mount("chat-iva", { dir: "ltr" });
    await i18next.changeLanguage("ar");
    expect(ltr.getAttribute("dir")).toBe("ltr");
  });

  it("keeps a dir set after mounting", async () => {
    await i18next.changeLanguage("ar");
    const widget = mount("chat-iva");
    expect(widget.getAttribute("dir")).toBe("rtl");

    widget.dir = "ltr";
    await flush();
    await i18next.changeLanguage("he");
    expect(widget.getAttribute("dir")).toBe("ltr");
  });

  it("keeps an author dir equal to the language's own direction", async () => {
    await i18next.changeLanguage("ar");
    const widget = mount("chat-iva");
    await flush();

    // Same value the controller wrote — still an explicit author choice.
    widget.setAttribute("dir", "rtl");
    await flush();
    await i18next.changeLanguage("en");
    expect(widget.getAttribute("dir")).toBe("rtl");
  });

  it("respects an author dir set in the same task as a language switch", async () => {
    const widget = mount("chat-iva");
    await flush();
    widget.setAttribute("dir", "rtl");
    await i18next.changeLanguage("tr"); // observer has not run yet
    expect(widget.getAttribute("dir")).toBe("rtl");
  });

  it("hands control back to the language when the attribute is removed", async () => {
    const widget = mount("chat-iva", { dir: "rtl" });
    widget.removeAttribute("dir");
    await flush();
    expect(widget.getAttribute("dir")).toBe("ltr");

    await i18next.changeLanguage("ar");
    expect(widget.getAttribute("dir")).toBe("rtl");
  });
});

describe("layout invariants under dir=rtl", () => {
  beforeEach(async () => {
    await i18next.changeLanguage("ar");
  });

  afterEach(() => {
    chatStore.getState().close();
  });

  it("mounts the open widget with the composer in inline order (attach → text → send)", async () => {
    const widget = mount("chat-iva");
    chatStore.getState().open();
    await widget.updateComplete;
    expect(widget.getAttribute("dir")).toBe("rtl");

    const input = widget.shadowRoot!.querySelector("chat-input") as LitHost;
    await input.updateComplete;
    const area = input.shadowRoot!.querySelector(".input-area")!;
    const order = Array.from(area.children).map((c) => c.className.split(" ")[0]);
    // Flex row follows `direction`, so DOM order = inline order: the send
    // button is last → inline-end (right in LTR, left in RTL). No
    // row-reverse hack is involved.
    expect(order.indexOf("send-btn")).toBe(order.length - 1);
    expect(order.indexOf("text-input")).toBeLessThan(order.indexOf("send-btn"));
    expect(cssOf("chat-input")).not.toMatch(/\.input-area\s*\{[^}]*row-reverse/);

    // User-typed text picks its own base direction.
    expect(input.shadowRoot!.querySelector(".text-input")!.getAttribute("dir")).toBe("auto");
  });

  it("mirrors directional icons and the conversation-list slide", () => {
    expect(cssOf("chat-input")).toMatch(/:host\(:dir\(rtl\)\)\s*\.send-btn svg\s*\{\s*transform:\s*scaleX\(-1\)/);
    expect(cssOf("chat-header")).toMatch(/:host\(:dir\(rtl\)\)\s*\.icon-btn svg\.flip-rtl/);
    expect(cssOf("carousel-message")).toMatch(/:host\(:dir\(rtl\)\)\s*\.nav-btn svg/);
    expect(cssOf("chat-iva")).toMatch(/:host\(:dir\(rtl\)\)\s*conversation-list\s*\{\s*animation-name:\s*slideInFromRight/);
  });

  it("anchors bubble tails and avatar offsets with logical properties", () => {
    const text = cssOf("default-text-message");
    expect(text).toMatch(/\.message\.bot\s*\{\s*margin-inline-end:\s*auto/);
    expect(text).toMatch(/\.message\.user\s*\{\s*margin-inline-start:\s*auto/);
    expect(text).toMatch(/\.message\.bot \.bubble\s*\{[^}]*border-start-start-radius:\s*4px/);
    expect(text).toMatch(/\.message\.user \.bubble\s*\{[^}]*border-start-end-radius:\s*4px/);

    const list = cssOf("chat-message-list");
    expect(list).toMatch(/\.message-feedback\.avatar-offset\s*\{\s*margin-inline-start:\s*36px/);
    expect(list).toMatch(/\.tool-activity-attached\.avatar-offset\s*\{\s*margin-inline-start:\s*36px/);
    expect(list).toMatch(/\.typing-bubble\s*\{[^}]*border-end-start-radius:\s*4px/);

    expect(cssOf("chat-bot-button")).toMatch(/\.badge\s*\{[^}]*inset-inline-end:\s*-4px/);
  });

  it("keeps rating stars left-to-right", () => {
    expect(cssOf("end-of-conversation-survey")).toMatch(/\.stars\s*\{[^}]*direction:\s*ltr/);
    expect(cssOf("genui-rating")).toMatch(/\.stars\s*\{[^}]*direction:\s*ltr/);
  });

  it("bidi-isolates message text and timestamps", async () => {
    const msg = mount("default-text-message") as LitHost & {
      messageData: Record<string, unknown>;
      sender: string;
      timestamp: number;
    };
    msg.messageData = { text: "مرحبا Chativa 2.0!" };
    msg.sender = "user";
    msg.timestamp = Date.now();
    await msg.updateComplete;

    const bubbleText = msg.shadowRoot!.querySelector(".bubble .bubble-text")!;
    expect(bubbleText.getAttribute("dir")).toBe("auto");
    expect(msg.shadowRoot!.querySelector(".time bdi")).not.toBeNull();
    expect(cssOf("default-text-message")).toMatch(/\.bubble a,\s*\.bubble code\s*\{\s*unicode-bidi:\s*isolate/);
  });
});

/**
 * Guard against physical properties creeping back in. Anything listed in
 * ALLOWED is intentionally physical (see the comment next to it).
 */
describe("no physical left/right in component styles", () => {
  const TAGS = [
    "chat-iva", "chat-bot-button", "chat-header", "chat-input", "chat-message-list",
    "default-text-message", "quick-reply-message", "image-message", "card-message",
    "buttons-message", "file-message", "video-message", "carousel-message",
    "emoji-picker", "conversation-list", "agent-panel", "end-of-conversation-survey",
    "link-preview-card", "tool-call-card", "tool-call-activity", "message-feedback",
    "genui-message", "genui-text-block", "genui-card", "genui-form", "genui-alert",
    "genui-chart", "genui-date-picker", "genui-image-gallery", "genui-list",
    "genui-progress", "genui-quick-replies", "genui-rating", "genui-steps", "genui-table",
  ];

  const PHYSICAL =
    /(?:^|[\s;{])(?:left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right|border-top-left-radius|border-top-right-radius|border-bottom-left-radius|border-bottom-right-radius)\s*:|text-align:\s*(?:left|right)\b|float:\s*(?:left|right)/g;

  // chat-message-list: the new-message pill is centred with
  // `left: 50%; translateX(-50%)`, which is direction-neutral.
  // default-text-message: code blocks are pinned to LTR on purpose.
  const ALLOWED: Record<string, string[]> = {
    "chat-message-list": ["left:"],
    "default-text-message": ["text-align: left"],
  };

  it.each(TAGS)("<%s>", (tag) => {
    const css = cssOf(tag);
    expect(css.length).toBeGreaterThan(0);
    const found = (css.match(PHYSICAL) ?? []).map((m) => m.replace(/^[\s;{]/, "").trim());
    const allowed = ALLOWED[tag] ?? [];
    const unexpected = found.filter((f) => !allowed.some((a) => f.startsWith(a)));
    expect(unexpected).toEqual([]);
  });
});
