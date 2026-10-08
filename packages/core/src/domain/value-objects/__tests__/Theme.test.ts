import { describe, it, expect } from "vitest";
import { DEFAULT_THEME, mergeTheme, themeToCSS } from "../Theme";

describe("DEFAULT_THEME", () => {
  it("has a primary color", () => {
    expect(DEFAULT_THEME.colors.primary).toBeTruthy();
  });

  it("has bottom-right as default position", () => {
    expect(DEFAULT_THEME.position).toBe("bottom-right");
  });

  it("has medium size by default", () => {
    expect(DEFAULT_THEME.size).toBe("medium");
  });
});

describe("mergeTheme", () => {
  it("overrides a top-level color", () => {
    const result = mergeTheme(DEFAULT_THEME, {
      colors: { primary: "#ff0000" },
    });
    expect(result.colors.primary).toBe("#ff0000");
  });

  it("preserves non-overridden colors", () => {
    const result = mergeTheme(DEFAULT_THEME, {
      colors: { primary: "#ff0000" },
    });
    expect(result.colors.secondary).toBe(DEFAULT_THEME.colors.secondary);
  });

  it("overrides layout fields", () => {
    const result = mergeTheme(DEFAULT_THEME, {
      layout: { width: "400px" },
    });
    expect(result.layout.width).toBe("400px");
    expect(result.layout.height).toBe(DEFAULT_THEME.layout.height);
  });

  it("overrides position", () => {
    const result = mergeTheme(DEFAULT_THEME, { position: "top-left" });
    expect(result.position).toBe("top-left");
  });

  it("does not mutate the base theme", () => {
    const before = { ...DEFAULT_THEME.colors };
    mergeTheme(DEFAULT_THEME, { colors: { primary: "#123456" } });
    expect(DEFAULT_THEME.colors.primary).toBe(before.primary);
  });
});

describe("themeToCSS", () => {
  it("maps primary color to CSS variable", () => {
    const css = themeToCSS(DEFAULT_THEME);
    expect(css["--chativa-primary-color"]).toBe(DEFAULT_THEME.colors.primary);
  });

  it("maps all five color variables", () => {
    const css = themeToCSS(DEFAULT_THEME);
    expect(Object.keys(css)).toHaveLength(5);
  });

  it("maps extended colors only when provided", () => {
    const themed = mergeTheme(DEFAULT_THEME, {
      colors: { accent: "#e35205", textTertiary: "#97999b" },
    });
    const css = themeToCSS(themed);
    expect(css["--chativa-accent-color"]).toBe("#e35205");
    expect(css["--chativa-text-tertiary"]).toBe("#97999b");
    expect(css["--chativa-surface"]).toBeUndefined();
  });
});


describe("menu button text alignment", () => {
  it("keeps the default CSS fallback when alignment is unset", () => {
    expect(themeToCSS(DEFAULT_THEME)["--chativa-button-text-align"]).toBeUndefined();
  });

  it.each(["left", "center", "right"] as const)("maps %s alignment without changing the base theme", (alignment) => {
    const theme = mergeTheme(DEFAULT_THEME, { buttonTextAlign: alignment });
    expect(themeToCSS(theme)["--chativa-button-text-align"]).toBe(alignment);
    expect(DEFAULT_THEME.buttonTextAlign).toBeUndefined();
  });
});


describe("menu button width", () => {
  it("leaves automatic sizing to CSS when unset", () => {
    expect(themeToCSS(DEFAULT_THEME)["--chativa-button-width"]).toBeUndefined();
  });

  it("maps fixed width and preserves unrelated theme settings", () => {
    const theme = mergeTheme(DEFAULT_THEME, { buttonWidth: "280px", buttonTextAlign: "left" });
    expect(themeToCSS(theme)["--chativa-button-width"]).toBe("280px");
    expect(themeToCSS(theme)["--chativa-button-text-align"]).toBe("left");
    expect(DEFAULT_THEME.buttonWidth).toBeUndefined();
  });

  it("restores intrinsic sizing with explicit auto", () => {
    const theme = mergeTheme(DEFAULT_THEME, { buttonWidth: "auto" });
    expect(themeToCSS(theme)["--chativa-button-width"]).toBe("max-content");
  });
});
