import { describe, it, expect, vi, afterEach } from "vitest";
import { parseChatFrame, createGenUIEventFrame } from "../entities/ChatFrame";
import { createGenUIComponentCache } from "../entities/GenUIComponentCache";
import { resolveText } from "../ports/ISlashCommand";
import { DEFAULT_THEME, mergeTheme, themeToCSS, type ThemeConfig } from "../value-objects/Theme";

describe("parseChatFrame — genui_components", () => {
  it("keeps well-formed definitions and the catalog hash", () => {
    const frame = parseChatFrame({
      type: "genui_components",
      hash: "h-1",
      components: [
        { name: "order-card", template: "<p>{{id}}</p>" },
        { name: "", template: "<p/>" }, // no name → dropped
        { name: "no-template" }, // no template → dropped
        "garbage", // not a record → dropped
      ],
    });
    expect(frame).toEqual({
      kind: "genui_components",
      definitions: [{ name: "order-card", template: "<p>{{id}}</p>" }],
      unchanged: false,
      hash: "h-1",
    });
  });

  it("accepts an empty catalog when the server says the cache is still current", () => {
    const frame = parseChatFrame({ type: "genui_components", hash: "h-2", unchanged: true });
    expect(frame).toEqual({ kind: "genui_components", definitions: [], unchanged: true, hash: "h-2" });
  });

  it("omits an empty hash", () => {
    const frame = parseChatFrame({
      type: "genui_components",
      hash: "",
      components: [{ name: "a", template: "<i/>" }],
    });
    expect(frame).not.toHaveProperty("hash");
  });

  it("returns 'other' when nothing usable arrived and the catalog is not unchanged", () => {
    expect(parseChatFrame({ type: "genui_components", components: "nope" }).kind).toBe("other");
    expect(parseChatFrame({ type: "genui_components", components: [{ name: "x" }] }).kind).toBe("other");
  });
});

describe("parseChatFrame — defaults", () => {
  it("falls back to the 'frame' id prefix and Date.now() for quick replies", () => {
    vi.spyOn(Date, "now").mockReturnValue(42);
    const frame = parseChatFrame({ type: "text", actions: [{ label: "Yes" }] });
    expect(frame).toEqual({
      kind: "quick_reply",
      message: {
        id: "frame-42",
        type: "quick-reply",
        data: { actions: [{ label: "Yes" }], keepActions: true },
        timestamp: 42,
      },
    });
  });

  it("returns 'other' for non-record input", () => {
    expect(parseChatFrame(null).kind).toBe("other");
    expect(parseChatFrame("text").kind).toBe("other");
  });
});

describe("createGenUIEventFrame", () => {
  it("includes scope and component when given", () => {
    expect(createGenUIEventFrame("s1", "submit", { a: 1 }, { scope: "graph", component: "form" })).toEqual({
      type: "genui_event",
      streamId: "s1",
      eventType: "submit",
      payload: { a: 1 },
      scope: "graph",
      component: "form",
    });
  });
});

describe("createGenUIComponentCache — default storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses globalThis.localStorage when no storage is injected", () => {
    localStorage.clear();
    const cache = createGenUIComponentCache({ namespace: "default-ls" });
    cache.save("h1", [{ name: "x", template: "<b/>" }]);
    expect(cache.hash()).toBe("h1");
    expect(localStorage.getItem("chativa:genui-components:default-ls")).toContain("h1");
    cache.clear();
    expect(cache.load()).toBeNull();
  });

  it("degrades to no cache when localStorage is missing", () => {
    vi.stubGlobal("localStorage", undefined);
    const cache = createGenUIComponentCache({ namespace: "none" });
    expect(() => cache.save("h1", [])).not.toThrow();
    expect(cache.load()).toBeNull();
    expect(cache.hash()).toBeUndefined();
  });

  it("degrades to no cache when touching localStorage throws", () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("SecurityError");
      },
    });
    try {
      const cache = createGenUIComponentCache({ namespace: "blocked" });
      expect(() => cache.save("h1", [])).not.toThrow();
      expect(cache.load()).toBeNull();
      expect(() => cache.clear()).not.toThrow();
    } finally {
      if (original) Object.defineProperty(globalThis, "localStorage", original);
    }
  });
});

describe("resolveText", () => {
  it("returns an empty string for undefined", () => {
    expect(resolveText(undefined)).toBe("");
  });

  it("returns strings as-is and calls functions", () => {
    expect(resolveText("plain")).toBe("plain");
    expect(resolveText(() => "lazy")).toBe("lazy");
  });
});

describe("themeToCSS — optional colors", () => {
  it("emits a variable for every optional color that is set", () => {
    const theme: ThemeConfig = {
      ...DEFAULT_THEME,
      colors: {
        ...DEFAULT_THEME.colors,
        accent: "#a",
        surface: "#s",
        textSecondary: "#t2",
        textTertiary: "#t3",
        success: "#ok",
        error: "#err",
        warning: "#warn",
        info: "#info",
      },
    };
    const vars = themeToCSS(theme);
    expect(vars).toMatchObject({
      "--chativa-accent-color": "#a",
      "--chativa-surface": "#s",
      "--chativa-text-secondary": "#t2",
      "--chativa-text-tertiary": "#t3",
      "--chativa-success-color": "#ok",
      "--chativa-error-color": "#err",
      "--chativa-warning-color": "#warn",
      "--chativa-info-color": "#info",
    });
  });

  it("omits optional color variables that are not set", () => {
    const theme: ThemeConfig = {
      ...DEFAULT_THEME,
      colors: {
        primary: "#1",
        secondary: "#2",
        background: "#3",
        text: "#4",
        border: "#5",
      },
    };
    expect(Object.keys(themeToCSS(theme))).toEqual([
      "--chativa-primary-color",
      "--chativa-secondary-color",
      "--chativa-background-color",
      "--chativa-text-color",
      "--chativa-border-color",
    ]);
  });
});

describe("mergeTheme — optional nested sections", () => {
  const bare: ThemeConfig = {
    ...DEFAULT_THEME,
    endOfConversationSurvey: undefined,
    disclaimer: undefined,
    icons: undefined,
  };

  it("leaves optional sections undefined when neither side sets them", () => {
    const merged = mergeTheme(bare, {});
    expect(merged.endOfConversationSurvey).toBeUndefined();
    expect(merged.disclaimer).toBeUndefined();
    expect(merged.icons).toBeUndefined();
  });

  it("creates sections that only the overrides define", () => {
    const merged = mergeTheme(bare, {
      endOfConversationSurvey: { mode: "inline" },
      disclaimer: { enabled: true, bottomText: "AI" },
      icons: { send: "<path/>" },
    });
    expect(merged.endOfConversationSurvey).toEqual({ mode: "inline" });
    expect(merged.disclaimer).toEqual({ enabled: true, bottomText: "AI" });
    expect(merged.icons).toEqual({ send: "<path/>" });
  });

  it("merges overrides into sections the base already defines", () => {
    const base: ThemeConfig = {
      ...bare,
      endOfConversationSurvey: { enabled: true, mode: "screen" },
      disclaimer: { enabled: true, bottomText: "base" },
      icons: { close: "<x/>" },
    };
    const merged = mergeTheme(base, { disclaimer: { bottomText: "over" }, icons: { send: "<s/>" } });
    expect(merged.endOfConversationSurvey).toEqual({ enabled: true, mode: "screen" });
    expect(merged.disclaimer).toEqual({ enabled: true, bottomText: "over" });
    expect(merged.icons).toEqual({ close: "<x/>", send: "<s/>" });
  });
});
